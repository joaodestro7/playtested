'use strict';

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

/**
 * Finds an existing canonical game matching the incoming game by:
 * 1. Exact internal id
 * 2. Exact platform external id (steam, igdb, ps, xbox)
 * 3. Canonical normalized title with compatible release year (within +/- 3 years
 *    to handle staggered console/PC ports, or when either date is unknown).
 */
function findCanonicalGame(games, byId, incoming) {
  if (incoming.id && byId.has(String(incoming.id))) {
    return byId.get(String(incoming.id));
  }

  const inPids = incoming.platformIds || {};
  if (inPids.steam && byId.has(String(inPids.steam))) {
    return byId.get(String(inPids.steam));
  }

  for (const g of games) {
    const gPids = g.platformIds || {};
    if (inPids.steam && (String(g.id) === String(inPids.steam) || String(gPids.steam) === String(inPids.steam))) {
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
  if (!key) return null;
  const inPlaceholder = incoming.developer === 'Verified Release' && /^(?:ps|xbox)-/.test(String(incoming.id || ''));
  const inYear = inPlaceholder ? null : yearOf(incoming.date);

  for (const g of games) {
    const gKey = normalizeTitle(g.name) || g.canonicalKey;
    if (gKey !== key) continue;
    const gPlaceholder = g.developer === 'Verified Release' && /^(?:ps|xbox)-/.test(String(g.id || ''));
    const gYear = gPlaceholder ? null : yearOf(g.date);
    if (!inYear || !gYear || Math.abs(inYear - gYear) <= 3) {
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

  target.platformIds = {
    ...(target.platformIds || {}),
    ...(incoming.platformIds || {}),
  };
  if (/^\d+$/.test(String(target.id)) && !target.platformIds.steam) {
    target.platformIds.steam = String(target.id);
  }

  target.canonicalKey = target.canonicalKey || normalizeTitle(target.name || incoming.name);

  if ((!target.developer || target.developer === 'Verified Release') && incoming.developer && incoming.developer !== 'Verified Release') {
    target.developer = incoming.developer;
  }
  if (!target.publisher && incoming.publisher) target.publisher = incoming.publisher;
  if (!target.cover && incoming.cover) target.cover = incoming.cover;
  if (!target.hdr && incoming.hdr) target.hdr = incoming.hdr;

  // Keep the most accurate earliest valid release date (never let a year-only YYYY-01-01
  // overwrite a specific date in the same year, and never let a placeholder beat a real date).
  const validDate = (d) => /^(19|20)\d\d-\d\d-\d\d$/.test(String(d || ''));
  const targetIsPlaceholder = target.developer === 'Verified Release' && /^(?:ps|xbox)-/.test(String(target.id || ''));
  const incomingIsPlaceholder = incoming.developer === 'Verified Release' && /^(?:ps|xbox)-/.test(String(incoming.id || ''));
  if (!validDate(target.date) && validDate(incoming.date) && !incomingIsPlaceholder) {
    target.date = incoming.date;
  } else if (targetIsPlaceholder && validDate(incoming.date) && !incomingIsPlaceholder) {
    target.date = incoming.date;
  } else if (validDate(target.date) && validDate(incoming.date) && !incomingIsPlaceholder) {
    const tYear = target.date.slice(0, 4);
    const iYear = incoming.date.slice(0, 4);
    if (tYear === iYear) {
      if (target.date.endsWith('-01-01') && !incoming.date.endsWith('-01-01')) {
        target.date = incoming.date;
      } else if (!incoming.date.endsWith('-01-01') && incoming.date < target.date) {
        target.date = incoming.date;
      }
    } else if (incoming.date < target.date) {
      target.date = incoming.date;
    }
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
    return mergeGameRecords(existing, incoming);
  }

  const id = String(
    incoming.id ||
      incoming.platformIds?.steam ||
      (incoming.platformIds?.igdb ? `igdb-${incoming.platformIds.igdb}` : '') ||
      (incoming.platformIds?.ps ? `ps-${incoming.platformIds.ps}` : '') ||
      (incoming.platformIds?.xbox ? `xbox-${incoming.platformIds.xbox}` : '') ||
      `game-${canonicalSlug(incoming.name)}`
  );

  const record = {
    id,
    canonicalKey: normalizeTitle(incoming.name),
    name: incoming.name,
    date: incoming.date || '',
    platforms: sortPlatforms(incoming.platforms && incoming.platforms.length ? incoming.platforms : ['pc']),
    ...(incoming.generations && incoming.generations.length ? { generations: incoming.generations } : {}),
    platformIds: {
      ...(incoming.platformIds || {}),
      ...(/^\d+$/.test(id) ? { steam: id } : {}),
    },
    developer: incoming.developer || '',
    publisher: incoming.publisher || '',
    cover: incoming.cover || '',
    hdr: incoming.hdr || '',
    trend: incoming.trend || 0,
    checked: incoming.checked || Date.now(),
  };

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
  const idRemap = new Map();
  let mergedCount = 0;

  const indexGame = (g) => {
    byId.set(g.id, g);
    const pids = g.platformIds || {};
    for (const k of ['steam', 'igdb', 'ps', 'xbox', 'wikidata']) {
      if (pids[k]) byPid[k].set(String(pids[k]), g);
    }
    if (g.canonicalKey) {
      let arr = byKey.get(g.canonicalKey);
      if (!arr) {
        arr = [];
        byKey.set(g.canonicalKey, arr);
      }
      if (!arr.includes(g)) arr.push(g);
    }
  };

  // Process real canonical entries (Steam / Wikidata / IGDB) BEFORE placeholder ps-/xbox- records
  const isPlaceholder = (g) => g.developer === 'Verified Release' && /^(?:ps|xbox)-/.test(String(g.id || ''));
  const orderedGames = [...db.games].sort((a, b) => Number(isPlaceholder(a)) - Number(isPlaceholder(b)));

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
      const inYear = isPlaceholder(raw) ? null : yearOf(raw.date);
      for (const cand of byKey.get(raw.canonicalKey)) {
        const gYear = isPlaceholder(cand) ? null : yearOf(cand.date);
        if (!inYear || !gYear || Math.abs(inYear - gYear) <= 3) {
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
  canonicalSlug,
  sortPlatforms,
  findCanonicalGame,
  mergeGameRecords,
  upsertCanonicalGame,
  deduplicateCatalog,
};
