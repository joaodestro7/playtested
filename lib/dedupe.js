'use strict';

const { sanitizeGenerationsAndPlatforms, applyMetadataOverride } = require('./metadata-fixes');

const PLATFORM_ORDER = ['pc', 'ps', 'xbox'];

/**
 * Normalizes a game title into a deterministic canonical matching key so the same
 * game ingested from Steam, PlayStation, Xbox, or IGDB merges into a single record
 * instead of appearing multiple times.
 *
 * Preserves sequel numbers (2, II, III, 2077, 26, 27) and distinct editions
 * (Remastered, Enhanced, Legacy, Director's Cut) while stripping storefront/platform
 * clutter (PS4 & PS5, Xbox Series X|S, Standard Edition, ™, ®).
 */
function normalizeTitle(rawName) {
  let s = String(rawName || '')
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Remove bracketed platform tags
  s = s.replace(/\((?:ps4|ps5|ps4\s*[&/]\s*ps5|playstation\s*\d?|xbox\s*(?:one|series\s*x\|?s)?|pc|steam|windows|console)[^)]*\)/gi, ' ');
  s = s.replace(/\[(?:ps4|ps5|xbox|pc|steam)[^\]]*\]/gi, ' ');

  // Remove trailing storefront edition/platform suffixes
  s = s.replace(/\s*[-–—:|]\s*(?:ps4\s*[&/]\s*ps5|ps5\s*version|ps4\s*version|xbox\s*series\s*x\|?s|xbox\s*one|xbox|playstation|for\s*windows\s*10?|pc\s*edition|pc|steam|standard\s*edition|digital\s*edition|launch\s*edition|base\s*game|20\d\d\s+edition)\s*$/i, '');
  s = s.replace(/\s+(?:ps4\s*[&/]\s*ps5|ps5|ps4|xbox\s*series\s*x\|?s|xbox\s*one|standard\s*edition)\s*$/i, '');

  // Normalize punctuation and whitespace
  s = s.replace(/['’`]/g, '');
  s = s.replace(/&/g, ' and ');
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();
  return s;
}

const EDITION_SUFFIX_RE =
  /\s+(?:remastered|remaster|directors?\s+cut|game\s+of\s+the\s+year(?:\s+edition)?|goty(?:\s+edition)?|definitive\s+edition|complete\s+edition|ultimate\s+edition|enhanced\s+edition|special\s+edition|anniversary\s+edition|deluxe\s+edition|gold\s+edition|legendary\s+edition|royal\s+edition|hd\s+remaster)$/i;

const PUBLISHER_PREFIX_RE =
  /^(?:marvels|tom clancys|sid meiers|clive barkers|disneys|disney|dreamworks)\s+/i;

function isEditionVariant(rawName) {
  return EDITION_SUFFIX_RE.test(normalizeTitle(rawName));
}

/**
 * Strips possessive publisher prefixes ("Marvel's", "Tom Clancy's", "Sid Meier's")
 * and same-era re-release suffixes ("Remastered", "Director's Cut", "Definitive Edition")
 * to find canonical base-game matches across Steam, PlayStation, Xbox, and Wikidata.
 */
function baseTitleKey(rawName) {
  let s = normalizeTitle(rawName);
  s = s.replace(PUBLISHER_PREFIX_RE, '');
  s = s.replace(EDITION_SUFFIX_RE, '');
  return s.trim();
}

/**
 * Checks whether two game records with the same baseTitleKey represent the same
 * game (e.g., "Marvel's Spider-Man" 2018 + "Spider-Man" 2018 + "Spider-Man Remastered" 2020,
 * or "Ghost of Tsushima" 2020 + "Ghost of Tsushima Director's Cut" 2020), while keeping
 * separate reboots/remakes distinct (e.g., "Spider-Man" 2000 vs 2018, or
 * "Call of Duty: Modern Warfare Remastered" 2016 vs "Call of Duty: Modern Warfare" 2019).
 */
function areCompatibleReleases(a, b) {
  const isPlaceholder = (g) => g.developer === 'Verified Release' && /^(?:ps|xbox)-/.test(String(g.id || ''));
  const ya = isPlaceholder(a) ? null : yearOf(a.date);
  const yb = isPlaceholder(b) ? null : yearOf(b.date);

  if (!ya || !yb) return true;
  if (Math.abs(ya - yb) > 3) return false;

  const aEd = isEditionVariant(a.name);
  const bEd = isEditionVariant(b.name);
  // A Remastered/Director's Cut edition must launch in the same year or AFTER the base game
  // (prevents e.g. CoD: Modern Warfare Remastered 2016 from merging into CoD: Modern Warfare 2019).
  if (aEd && !bEd && ya < yb) return false;
  if (bEd && !aEd && yb < ya) return false;

  return true;
}

function canonicalSlug(name) {
  return normalizeTitle(name).replace(/\s+/g, '-') || 'game';
}

function sortPlatforms(list) {
  const set = new Set((list || []).filter((p) => PLATFORM_ORDER.includes(p)));
  return PLATFORM_ORDER.filter((p) => set.has(p));
}

function yearOf(dateStr) {
  const m = /^(\d{4})/.exec(String(dateStr || ''));
  return m ? Number(m[1]) : null;
}

function romanToArabic(str) {
  return String(str || '')
    .replace(/\bviii\b/g, '8')
    .replace(/\bvii\b/g, '7')
    .replace(/\bvi\b/g, '6')
    .replace(/\biv\b/g, '4')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bv\b/g, '5');
}

/**
 * Guards against merging distinct games that happen to share a recycled Steam AppID
 * (e.g. Wikidata "Counter-Strike: Global Offensive" having legacy P1733=730 when
 * AppID 730 is now "Counter-Strike 2", or Rearmed vs Rearmed 2).
 */
function areTitlesCompatibleForIdMerge(nameA, nameB) {
  const a = romanToArabic(baseTitleKey(nameA));
  const b = romanToArabic(baseTitleKey(nameB));
  if (!a || !b || a === b) return true;
  const numsA = (a.match(/\b\d{1,2}\b/g) || []).join(',');
  const numsB = (b.match(/\b\d{1,2}\b/g) || []).join(',');
  if (numsA !== numsB) return false;
  return true;
}

/**
 * Finds an existing canonical game matching the incoming game by:
 * 1. Exact internal id (with title-compatibility guard when Steam AppID was rebranded)
 * 2. Exact platform external id (steam, igdb, ps, xbox)
 * 3. Canonical normalized title with compatible release year (within +/- 3 years
 *    to handle staggered console/PC ports, or when either date is unknown).
 */
function findCanonicalGame(games, byId, incoming) {
  if (incoming.id && byId.has(String(incoming.id))) {
    const hit = byId.get(String(incoming.id));
    if (!incoming.platformIds?.wikidata || areTitlesCompatibleForIdMerge(hit.name, incoming.name)) {
      return hit;
    }
  }

  const inPids = incoming.platformIds || {};
  if (inPids.steam && byId.has(String(inPids.steam))) {
    const hit = byId.get(String(inPids.steam));
    if (areTitlesCompatibleForIdMerge(hit.name, incoming.name)) {
      return hit;
    }
  }

  for (const g of games) {
    const gPids = g.platformIds || {};
    if (
      inPids.steam &&
      (String(g.id) === String(inPids.steam) || String(gPids.steam) === String(inPids.steam)) &&
      areTitlesCompatibleForIdMerge(g.name, incoming.name)
    ) {
      return g;
    }
    if (inPids.igdb && gPids.igdb && String(gPids.igdb) === String(inPids.igdb)) {
      return g;
    }
    if (inPids.ps && gPids.ps && String(gPids.ps) === String(inPids.ps)) {
      return g;
    }
    if (inPids.xbox && gPids.xbox && String(gPids.xbox) === String(inPids.xbox)) {
      return g;
    }
    if (inPids.wikidata && gPids.wikidata && String(gPids.wikidata) === String(inPids.wikidata)) {
      return g;
    }
  }

  const key = normalizeTitle(incoming.name);
  const baseKey = baseTitleKey(incoming.name);
  if (!key) return null;

  for (const g of games) {
    const gKey = normalizeTitle(g.name) || g.canonicalKey;
    const gBase = baseTitleKey(g.name);
    if (gKey !== key && (!baseKey || gBase !== baseKey)) continue;
    if (areCompatibleReleases(g, incoming)) {
      return g;
    }
  }

  return null;
}

/**
 * Merges incoming game metadata into an existing canonical game record,
 * preserving all verified platforms and external IDs without duplicating entries.
 */
function mergeGameRecords(target, incoming) {
  const mergedPlatforms = sortPlatforms([...(target.platforms || []), ...(incoming.platforms || [])]);
  if (mergedPlatforms.length) target.platforms = mergedPlatforms;

  if ((incoming.generations || []).length) {
    const GEN_ORDER = ['PC', 'PS1', 'PS2', 'PS3', 'PS4', 'PS5', 'Xbox', 'Xbox 360', 'Xbox One', 'Xbox Series X|S'];
    const genSet = new Set([...(target.generations || []), ...incoming.generations]);
    target.generations = GEN_ORDER.filter((g) => genSet.has(g));
  }

  const prevSteamIds = new Set(
    [target.platformIds?.steam, ...(target.platformIds?.steamAlts || [])].filter(Boolean).map(String)
  );
  if (incoming.platformIds?.steam) prevSteamIds.add(String(incoming.platformIds.steam));
  for (const alt of incoming.platformIds?.steamAlts || []) prevSteamIds.add(String(alt));
  if (/^\d+$/.test(String(target.id))) prevSteamIds.add(String(target.id));
  if (/^\d+$/.test(String(incoming.id))) prevSteamIds.add(String(incoming.id));

  target.platformIds = {
    ...(target.platformIds || {}),
    ...(incoming.platformIds || {}),
  };
  const primarySteam =
    (/^\d+$/.test(String(target.id)) ? String(target.id) : '') ||
    target.platformIds.steam ||
    incoming.platformIds?.steam ||
    '';
  if (primarySteam) target.platformIds.steam = primarySteam;
  const extraSteam = [...prevSteamIds].filter((id) => id !== primarySteam);
  if (extraSteam.length) target.platformIds.steamAlts = extraSteam;

  // Prefer the clean base game title over "Remastered" / "Director's Cut" suffixes,
  // and prefer fuller official titles (e.g. "Marvel's Spider-Man" over bare "Spider-Man")
  if (isEditionVariant(target.name) && !isEditionVariant(incoming.name)) {
    target.name = incoming.name;
  } else if (
    !isEditionVariant(target.name) &&
    !isEditionVariant(incoming.name) &&
    PUBLISHER_PREFIX_RE.test(normalizeTitle(incoming.name)) &&
    !PUBLISHER_PREFIX_RE.test(normalizeTitle(target.name))
  ) {
    target.name = incoming.name;
  }

  target.canonicalKey = normalizeTitle(target.name || incoming.name);

  if ((!target.developer || target.developer === 'Verified Release') && incoming.developer && incoming.developer !== 'Verified Release') {
    target.developer = incoming.developer;
  }
  if (!target.publisher && incoming.publisher) target.publisher = incoming.publisher;
  if (!target.cover && incoming.cover) target.cover = incoming.cover;
  if (!target.hdr && incoming.hdr) target.hdr = incoming.hdr;

  // Keep the most accurate earliest valid release date:
  // - Never let a year-only YYYY-01-01 overwrite a specific date (prevents old Wikidata announced years
  //   like 2024-01-01 from clobbering real launch dates like 2025-02-18).
  // - Upgrade a YYYY-01-01 placeholder when an exact date arrives within [-1, +3] years.
  const validDate = (d) => /^(19|20)\d\d-\d\d-\d\d$/.test(String(d || ''));
  const targetIsPlaceholder = target.developer === 'Verified Release' && /^(?:ps|xbox)-/.test(String(target.id || ''));
  const incomingIsPlaceholder = incoming.developer === 'Verified Release' && /^(?:ps|xbox)-/.test(String(incoming.id || ''));
  if (!validDate(target.date) && validDate(incoming.date) && !incomingIsPlaceholder) {
    target.date = incoming.date;
  } else if (targetIsPlaceholder && validDate(incoming.date) && !incomingIsPlaceholder) {
    target.date = incoming.date;
  } else if (validDate(target.date) && validDate(incoming.date) && !incomingIsPlaceholder) {
    const tYear = Number(target.date.slice(0, 4));
    const iYear = Number(incoming.date.slice(0, 4));
    const tJan1 = target.date.endsWith('-01-01');
    const iJan1 = incoming.date.endsWith('-01-01');
    if (tJan1 && !iJan1 && iYear >= tYear - 1 && iYear <= tYear + 3) {
      target.date = incoming.date;
    } else if (!tJan1 && iJan1) {
      // Never let a year-only placeholder overwrite an exact date
    } else if (incoming.date < target.date) {
      target.date = incoming.date;
    }
  }

  // Strip impossible retro console generations after merging platforms + date
  if (Array.isArray(target.generations) && target.generations.length) {
    const cleaned = sanitizeGenerationsAndPlatforms(target.platforms, target.generations, target.date);
    target.platforms = cleaned.platforms;
    target.generations = cleaned.generations;
  }

  if ((incoming.trend || 0) > (target.trend || 0)) {
    target.trend = incoming.trend;
  }
  if (incoming.checked && (!target.checked || incoming.checked > target.checked)) {
    target.checked = incoming.checked;
  }
  return target;
}

function upsertCanonicalGame(db, byId, incoming) {
  const existing = findCanonicalGame(db.games, byId, incoming);
  if (existing) {
    mergeGameRecords(existing, incoming);
    applyMetadataOverride(existing);
    return existing;
  }

  // If incoming Wikidata record collided with an existing Steam AppID belonging to a different game
  // (e.g. CS:GO colliding with Counter-Strike 2 on 730), keep it under its wd-QID instead of hijacking 730.
  let id = String(
    incoming.id ||
      incoming.platformIds?.steam ||
      (incoming.platformIds?.igdb ? `igdb-${incoming.platformIds.igdb}` : '') ||
      (incoming.platformIds?.ps ? `ps-${incoming.platformIds.ps}` : '') ||
      (incoming.platformIds?.xbox ? `xbox-${incoming.platformIds.xbox}` : '') ||
      `game-${canonicalSlug(incoming.name)}`
  );
  const pids = { ...(incoming.platformIds || {}) };
  if (byId.has(id) && pids.wikidata) {
    id = `wd-${pids.wikidata}`;
    delete pids.steam;
  }
  if (/^\d+$/.test(id) && !pids.steam) pids.steam = id;

  const initPlats = sortPlatforms(incoming.platforms && incoming.platforms.length ? incoming.platforms : ['pc']);
  const sanitized = sanitizeGenerationsAndPlatforms(initPlats, incoming.generations || [], incoming.date || '');

  const record = {
    id,
    canonicalKey: normalizeTitle(incoming.name),
    name: incoming.name,
    date: incoming.date || '',
    platforms: sanitized.platforms,
    ...(sanitized.generations && sanitized.generations.length ? { generations: sanitized.generations } : {}),
    platformIds: pids,
    developer: incoming.developer || '',
    publisher: incoming.publisher || '',
    cover: incoming.cover || '',
    hdr: incoming.hdr || '',
    trend: incoming.trend || 0,
    checked: incoming.checked || Date.now(),
  };

  applyMetadataOverride(record);
  db.games.push(record);
  byId.set(record.id, record);
  return record;
}

/**
 * Scans the entire catalog in O(N) time using indexed hash maps and collapses
 * any duplicate games into single canonical entries while migrating any reviews
 * referencing merged IDs so zero reviews are lost.
 */
function deduplicateCatalog(db) {
  const unique = [];
  const byId = new Map();
  const byPid = { steam: new Map(), igdb: new Map(), ps: new Map(), xbox: new Map(), wikidata: new Map() };
  const byKey = new Map(); // canonicalKey -> array of games sharing that title
  const byBaseKey = new Map(); // baseTitleKey -> array of games sharing base title
  const idRemap = new Map();
  let mergedCount = 0;

  const indexGame = (g) => {
    byId.set(g.id, g);
    const pids = g.platformIds || {};
    for (const k of ['steam', 'igdb', 'ps', 'xbox', 'wikidata']) {
      if (pids[k]) byPid[k].set(String(pids[k]), g);
    }
    for (const altSteam of pids.steamAlts || []) {
      byPid.steam.set(String(altSteam), g);
    }
    if (g.canonicalKey) {
      let arr = byKey.get(g.canonicalKey);
      if (!arr) {
        arr = [];
        byKey.set(g.canonicalKey, arr);
      }
      if (!arr.includes(g)) arr.push(g);
    }
    const bKey = baseTitleKey(g.name);
    if (bKey) {
      let arr = byBaseKey.get(bKey);
      if (!arr) {
        arr = [];
        byBaseKey.set(bKey, arr);
      }
      if (!arr.includes(g)) arr.push(g);
    }
  };

  // Process Steam/base-title entries BEFORE edition variants & console placeholders so canonical Steam IDs win
  const isPlaceholder = (g) => g.developer === 'Verified Release' && /^(?:ps|xbox)-/.test(String(g.id || ''));
  const rank = (g) => {
    let score = 0;
    if (isPlaceholder(g)) score += 10;
    if (!/^\d+$/.test(String(g.id))) score += 2;
    if (isEditionVariant(g.name)) score += 1;
    return score;
  };
  const orderedGames = [...db.games].sort((a, b) => rank(a) - rank(b));

  for (const raw of orderedGames) {
    delete raw.alts;
    raw.id = String(raw.id);
    raw.canonicalKey = normalizeTitle(raw.name) || raw.canonicalKey || '';
    raw.platformIds = {
      ...(raw.platformIds || {}),
      ...(/^\d+$/.test(raw.id) ? { steam: raw.id } : {}),
    };
    raw.platforms = sortPlatforms(raw.platforms && raw.platforms.length ? raw.platforms : ['pc']);

    let match = byId.get(raw.id) || null;
    if (!match) {
      for (const k of ['steam', 'igdb', 'ps', 'xbox', 'wikidata']) {
        const v = raw.platformIds[k];
        if (v && byPid[k].has(String(v))) {
          match = byPid[k].get(String(v));
          break;
        }
      }
    }
    if (!match && raw.canonicalKey && byKey.has(raw.canonicalKey)) {
      for (const cand of byKey.get(raw.canonicalKey)) {
        if (areCompatibleReleases(cand, raw)) {
          match = cand;
          break;
        }
      }
    }
    const bKey = baseTitleKey(raw.name);
    if (!match && bKey && byBaseKey.has(bKey)) {
      for (const cand of byBaseKey.get(bKey)) {
        if (areCompatibleReleases(cand, raw)) {
          match = cand;
          break;
        }
      }
    }

    if (match) {
      mergeGameRecords(match, raw);
      indexGame(match);
      if (raw.id !== match.id) {
        idRemap.set(raw.id, match.id);
      }
      mergedCount++;
    } else {
      unique.push(raw);
      indexGame(raw);
    }
  }

  if (idRemap.size) {
    for (const review of db.reviews || []) {
      const mapped = idRemap.get(String(review.gameId));
      if (mapped) review.gameId = mapped;
    }
  }

  db.games = unique;
  return { byId, mergedCount, idRemap };
}

module.exports = {
  PLATFORM_ORDER,
  normalizeTitle,
  baseTitleKey,
  isEditionVariant,
  canonicalSlug,
  sortPlatforms,
  findCanonicalGame,
  mergeGameRecords,
  upsertCanonicalGame,
  deduplicateCatalog,
};
