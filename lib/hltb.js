'use strict';

const { normalizeTitle, baseTitleKey } = require('./dedupe');

/**
 * HowLongToBeat (HLTB) Silent Short-Game Duration Resolver
 *
 * For owned games where a player has < 2h played, Playtested queries HLTB once
 * (cached for 30 days in RAM + Postgres kv_state). If the game's Main Story
 * time-to-beat is under 2 hours, the verified playtime requirement scales down
 * silently to 20% of the total HLTB time (minimum 0.1h / ~6 min so 0h unplayed
 * accounts stay blocked). Games >= 2h to beat stay strictly at the 2h floor.
 */

const HLTB_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const HLTB_MISS_TTL_MS = 24 * 60 * 60 * 1000; // Retry misses after 24h
const TOKEN_TTL_MS = 18 * 60 * 1000; // Refresh search init token every 18m
const SHORT_GAME_RATIO = 0.2;
const MIN_FLOOR_HOURS = 0.1;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let cachedToken = { token: '', ts: 0 };
const inFlightLookups = new Map();

function cleanSearchTitle(name) {
  return String(name || '')
    .replace(/[™®©]/g, '')
    .replace(/\s*\((?:19|20)\d{2}\)\s*$/i, '')
    .replace(/\s*[:\-–—]\s*(?:Definitive|Complete|Ultimate|Deluxe|Enhanced|GOTY|Game of the Year|Director'?s Cut|Remastered|HD)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getHltbToken(forceRefresh = false) {
  if (!forceRefresh && cachedToken.token && Date.now() - cachedToken.ts < TOKEN_TTL_MS) {
    return cachedToken.token;
  }
  const res = await fetch(`https://howlongtobeat.com/api/search/site/init?t=${Date.now()}`, {
    headers: {
      'User-Agent': UA,
      Referer: 'https://howlongtobeat.com/',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HLTB init HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.token) throw new Error('HLTB init returned no token');
  cachedToken = { token: String(data.token), ts: Date.now() };
  return cachedToken.token;
}

async function queryHltbRaw(searchTitle, retryAuth = true) {
  const clean = cleanSearchTitle(searchTitle);
  const terms = clean.split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  const token = await getHltbToken(!retryAuth);
  const res = await fetch('https://howlongtobeat.com/api/search/site', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: 'https://howlongtobeat.com',
      Referer: 'https://howlongtobeat.com/',
      'x-auth-token': token,
    },
    body: JSON.stringify({
      searchType: 'games',
      searchTerms: terms,
      searchPage: 1,
      size: 8,
      searchOptions: {
        games: {
          userId: 0,
          platform: '',
          sortCategory: 'popular',
          rangeCategory: 'main',
          rangeTime: { min: null, max: null },
          gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
          rangeYear: { min: '', max: '' },
          modifier: '',
        },
        users: { sortCategory: 'postcount' },
        lists: { sortCategory: 'follows' },
        filter: '',
        sort: 0,
        randomizer: 0,
      },
      useCache: true,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (res.status === 403 && retryAuth) {
    cachedToken = { token: '', ts: 0 };
    return queryHltbRaw(searchTitle, false);
  }
  if (!res.ok) throw new Error(`HLTB search HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.data) ? data.data : [];
}

function pickBestHltbMatch(results, rawName) {
  if (!Array.isArray(results) || !results.length) return null;
  const targetNorm = normalizeTitle(rawName);
  const targetBase = baseTitleKey(rawName);

  // 1. Exact normalized title or alias match
  const exact = results.find(
    (r) =>
      (r.game_name && normalizeTitle(r.game_name) === targetNorm) ||
      (r.game_alias && normalizeTitle(r.game_alias) === targetNorm)
  );
  if (exact) return exact;

  // 2. Exact base-title match (strips edition/remaster noise while avoiding DLC/sequels)
  const baseMatch = results.find(
    (r) =>
      (r.game_name && baseTitleKey(r.game_name) === targetBase) ||
      (r.game_alias && baseTitleKey(r.game_alias) === targetBase)
  );
  if (baseMatch) return baseMatch;

  return null;
}

function extractBeatHours(hit) {
  if (!hit) return 0;
  // Prefer Main Story time; fall back to All Styles if Main Story has no entries yet
  const sec = Number(hit.comp_main) > 0 ? Number(hit.comp_main) : Number(hit.comp_all) || 0;
  if (sec <= 0) return 0;
  return Math.round((sec / 3600) * 100) / 100;
}

function computeRequiredHours(beatHours, defaultMinHours = 2) {
  const h = Number(beatHours) || 0;
  if (h > 0 && h < defaultMinHours) {
    return Math.max(MIN_FLOOR_HOURS, Math.round(h * SHORT_GAME_RATIO * 10) / 10);
  }
  return defaultMinHours;
}

function getCachedEffectiveMinHours(game, cacheObj, defaultMinHours = 2) {
  if (!game || !cacheObj) return defaultMinHours;
  const key = game.canonicalKey || normalizeTitle(game.name || '');
  if (!key) return defaultMinHours;
  const entry = cacheObj[key];
  if (!entry || typeof entry.h !== 'number') return defaultMinHours;
  const ttl = entry.h > 0 ? HLTB_TTL_MS : HLTB_MISS_TTL_MS;
  if (Date.now() - (entry.t || 0) >= ttl) return defaultMinHours;
  return computeRequiredHours(entry.h, defaultMinHours);
}

/**
 * Resolves the effective minimum playtime (hours) for a game using HowLongToBeat.
 * - Uses cached HLTB entry if fresh
 * - Otherwise queries HLTB once (deduplicated in-flight), stores in `cacheObj`, and invokes `onPersist`
 */
async function resolveEffectiveMinHours(game, cacheObj, { defaultMinHours = 2, onPersist = null } = {}) {
  const name = String(game?.name || '').trim();
  const key = game?.canonicalKey || normalizeTitle(name);
  if (!name || !key) return { minHours: defaultMinHours, beatHours: 0 };

  const store = cacheObj || {};
  const existing = store[key];
  if (existing && typeof existing.h === 'number') {
    const ttl = existing.h > 0 ? HLTB_TTL_MS : HLTB_MISS_TTL_MS;
    if (Date.now() - (existing.t || 0) < ttl) {
      return { minHours: computeRequiredHours(existing.h, defaultMinHours), beatHours: existing.h };
    }
  }

  let promise = inFlightLookups.get(key);
  if (!promise) {
    promise = (async () => {
      try {
        const hits = await queryHltbRaw(name);
        const match = pickBestHltbMatch(hits, name);
        const beatHours = extractBeatHours(match);
        // Bound cache size cleanly
        const keys = Object.keys(store);
        if (keys.length >= 5000) {
          delete store[keys[0]];
        }
        store[key] = { h: beatHours, t: Date.now() };
        if (typeof onPersist === 'function') {
          try {
            onPersist(store);
          } catch {}
        }
        return beatHours;
      } catch (err) {
        console.warn(`[hltb] Lookup failed for "${name}":`, err.message);
        return 0;
      }
    })().finally(() => {
      if (inFlightLookups.get(key) === promise) inFlightLookups.delete(key);
    });
    inFlightLookups.set(key, promise);
  }

  const beatHours = await promise;
  return { minHours: computeRequiredHours(beatHours, defaultMinHours), beatHours };
}

module.exports = {
  MIN_FLOOR_HOURS,
  SHORT_GAME_RATIO,
  computeRequiredHours,
  getCachedEffectiveMinHours,
  resolveEffectiveMinHours,
  pickBestHltbMatch,
  extractBeatHours,
};
