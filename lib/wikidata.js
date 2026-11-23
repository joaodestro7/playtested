'use strict';

/**
 * Free, Zero-Key Cross-Generation Game Indexer (Wikidata + Wikipedia)
 *
 * Covers ALL video games released across:
 * - PlayStation: PS1, PS2, PS3, PS4, PS5
 * - Xbox: Original Xbox, Xbox 360, Xbox One, Xbox Series X|S
 * - PC: Windows, Linux, macOS, DOS
 *
 * Used for both instant live search (e.g., searching "Shadow of the Colossus",
 * "Metal Gear Solid", "Halo 3", "Fable II") and continuous background indexing.
 */

const USER_AGENT = 'Playtested/1.0 (https://github.com/playtested; verified-player-reviews)';
const TIMEOUT_MS = 12000;

const WIKIDATA_PLATFORMS = {
  // PlayStation (PS1 - PS5)
  Q10677: { platform: 'ps', gen: 'PS1' },
  Q10680: { platform: 'ps', gen: 'PS2' },
  Q10683: { platform: 'ps', gen: 'PS3' },
  Q5014725: { platform: 'ps', gen: 'PS4' },
  Q63184502: { platform: 'ps', gen: 'PS5' },

  // Xbox (Original Xbox - Series X|S)
  Q132020: { platform: 'xbox', gen: 'Xbox' },
  Q48263: { platform: 'xbox', gen: 'Xbox 360' },
  Q13361286: { platform: 'xbox', gen: 'Xbox One' },
  Q64513817: { platform: 'xbox', gen: 'Xbox Series X|S' },
  Q98973368: { platform: 'xbox', gen: 'Xbox Series X|S' },

  // PC
  Q1406: { platform: 'pc', gen: 'PC' },
  Q16338: { platform: 'pc', gen: 'PC' },
  Q388: { platform: 'pc', gen: 'PC' },
  Q14116: { platform: 'pc', gen: 'PC' },
  Q170434: { platform: 'pc', gen: 'PC' },
};

// Ordered generation buckets for continuous background SPARQL indexing
const GENERATION_BUCKETS = [
  { qid: 'Q63184502', label: 'PS5' },
  { qid: 'Q5014725', label: 'PS4' },
  { qid: 'Q10683', label: 'PS3' },
  { qid: 'Q10680', label: 'PS2' },
  { qid: 'Q10677', label: 'PS1' },
  { qid: 'Q64513817', label: 'Xbox Series X|S' },
  { qid: 'Q13361286', label: 'Xbox One' },
  { qid: 'Q48263', label: 'Xbox 360' },
  { qid: 'Q132020', label: 'Xbox' },
  { qid: 'Q1406', label: 'PC' },
];

const VIDEO_GAME_TYPES = new Set([
  'Q7889',     // video game
  'Q7058673',  // video game remake
  'Q65963104', // video game remaster
  'Q4393107',  // video game compilation
]);

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseWikidataTime(str) {
  const m = /^[+-]?(\d{4})-(\d{2})-(\d{2})/.exec(String(str || ''));
  if (!m) return '';
  const y = Number(m[1]);
  if (y < 1970 || y > new Date().getUTCFullYear()) return '';
  const mo = m[2] === '00' ? '01' : m[2];
  const day = m[3] === '00' ? '01' : m[3];
  const iso = `${m[1]}-${mo}-${day}`;
  return iso <= todayIso() ? iso : '';
}

function extractClaimIds(entity, prop) {
  return (entity.claims?.[prop] || [])
    .map((c) => c.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

function extractEarliestDate(entity) {
  const dates = (entity.claims?.P577 || [])
    .map((c) => parseWikidataTime(c.mainsnak?.datavalue?.value?.time))
    .filter(Boolean)
    .sort();
  return dates[0] || '';
}

function mapPlatformsAndGens(platQids) {
  const plats = new Set();
  const gens = new Set();
  for (const qid of platQids) {
    const info = WIKIDATA_PLATFORMS[qid];
    if (info) {
      plats.add(info.platform);
      gens.add(info.gen);
    }
  }
  return {
    platforms: ['pc', 'ps', 'xbox'].filter((p) => plats.has(p)),
    generations: [...gens],
  };
}

/**
 * Batch fetches English Wikipedia cover thumbnails for up to 50 Wikipedia page titles
 * in a single fast request.
 */
async function fetchWikipediaCovers(wikiTitles) {
  const unique = [...new Set(wikiTitles.filter(Boolean))];
  const map = new Map();
  if (!unique.length) return map;

  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    try {
      const url =
        'https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pilicense=any&pithumbsize=600&redirects=1&format=json&titles=' +
        encodeURIComponent(chunk.join('|'));
      const data = await fetchJson(url);
      const normMap = new Map();
      for (const n of data.query?.normalized || []) normMap.set(n.to, n.from);
      for (const r of data.query?.redirects || []) normMap.set(r.to, normMap.get(r.from) || r.from);

      for (const page of Object.values(data.query?.pages || {})) {
        const src = page.thumbnail?.source;
        if (!src) continue;
        map.set(page.title, src);
        const orig = normMap.get(page.title);
        if (orig) map.set(orig, src);
      }
    } catch {
      // Skip failed batch gracefully
    }
  }
  return map;
}

/**
 * Batch resolves Wikidata entity QIDs to English labels (used for developers & publishers).
 */
async function resolveLabels(qids) {
  const unique = [...new Set(qids.filter(Boolean))];
  const map = new Map();
  if (!unique.length) return map;

  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    try {
      const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=labels&languages=en|mul&format=json`;
      const data = await fetchJson(url);
      for (const [id, ent] of Object.entries(data.entities || {})) {
        const lbl = ent.labels?.en?.value || ent.labels?.mul?.value;
        if (lbl) map.set(id, lbl);
      }
    } catch {
      // Ignore partial label failures
    }
  }
  return map;
}

/**
 * Hydrates a list of Wikidata game QIDs into full Playtested game records.
 */
async function hydrateWikidataEntities(qids) {
  const unique = [...new Set(qids.filter(Boolean))].slice(0, 50);
  if (!unique.length) return [];

  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${unique.join('|')}&props=labels|descriptions|claims|sitelinks&languages=en|mul&sitefilter=enwiki&format=json`;
  const data = await fetchJson(url);

  const candidates = [];
  const labelIdsToFetch = [];
  const wikiTitles = [];

  for (const qid of unique) {
    const ent = data.entities?.[qid];
    if (!ent || ent.missing) continue;

    const types = extractClaimIds(ent, 'P31');
    const desc = String(ent.descriptions?.en?.value || '');
    const platQids = extractClaimIds(ent, 'P400');
    const isGame = types.some((t) => VIDEO_GAME_TYPES.has(t)) || /\bvideo game\b/i.test(desc);
    if (!isGame) continue;

    // Exclude pure DLC / expansion packs / soundtracks / mod tools
    if (types.includes('Q209163') || /\b(soundtrack|album|downloadable content|dlc|film|manga|novel)\b/i.test(desc)) {
      continue;
    }

    const { platforms, generations } = mapPlatformsAndGens(platQids);
    if (!platforms.length) continue;

    const title = ent.labels?.en?.value || ent.labels?.mul?.value;
    const date = extractEarliestDate(ent);
    if (!title || !date || /\b(mod tools|soundtrack|dedicated server)\b/i.test(title)) continue;

    const devIds = extractClaimIds(ent, 'P178').slice(0, 3);
    const pubIds = extractClaimIds(ent, 'P123').slice(0, 3);
    const steamId = ent.claims?.P1733?.[0]?.mainsnak?.datavalue?.value || '';
    const igdbId = ent.claims?.P5794?.[0]?.mainsnak?.datavalue?.value || '';
    const enwiki = ent.sitelinks?.enwiki?.title || '';

    labelIdsToFetch.push(...devIds, ...pubIds);
    if (enwiki) wikiTitles.push(enwiki);

    candidates.push({
      qid,
      title,
      date,
      platforms,
      generations,
      devIds,
      pubIds,
      steamId: /^\d+$/.test(String(steamId)) ? String(steamId) : '',
      igdbId: igdbId ? String(igdbId) : '',
      enwiki,
    });
  }

  if (!candidates.length) return [];

  const [labels, wikiCovers] = await Promise.all([
    resolveLabels(labelIdsToFetch),
    fetchWikipediaCovers(wikiTitles),
  ]);

  const records = [];
  for (const c of candidates) {
    const developer = c.devIds.map((id) => labels.get(id)).filter(Boolean).join(', ') || '';
    const publisher = c.pubIds.map((id) => labels.get(id)).filter(Boolean).join(', ');
    const wikiCover = c.enwiki ? wikiCovers.get(c.enwiki) || '' : '';
    const steamCover = c.steamId
      ? `https://cdn.akamai.steamstatic.com/steam/apps/${c.steamId}/library_600x900.jpg`
      : '';
    // Prefer Wikipedia cover when available for multi-gen/console classics (avoids Steam DLC missing-grid 404s)
    // and keep Steam library_600x900 when PC-native or when wikiCover is absent.
    const cover = (c.platforms.includes('pc') && c.steamId && !c.generations.some((g) => /^(PS[1-3]|Xbox|Xbox 360)$/.test(g)))
      ? steamCover
      : wikiCover || steamCover;
    if (!cover) continue;

    records.push({
      id: c.steamId || `wd-${c.qid}`,
      name: c.title,
      date: c.date,
      platforms: c.platforms,
      generations: c.generations,
      platformIds: {
        wikidata: c.qid,
        ...(c.steamId ? { steam: c.steamId } : {}),
        ...(c.igdbId ? { igdb: c.igdbId } : {}),
      },
      developer: developer || publisher || 'Verified Release',
      publisher,
      cover,
      hdr: wikiCover || (c.steamId ? `https://cdn.akamai.steamstatic.com/steam/apps/${c.steamId}/header.jpg` : cover),
      trend: 0,
      checked: Date.now(),
    });
  }

  return records;
}

/**
 * Live search on Wikidata + Wikipedia for ANY game across PS1-PS5, Xbox-Series X|S, and PC.
 */
async function searchWikidataGames(term, limit = 10) {
  const clean = String(term || '').trim();
  if (clean.length < 2) return [];

  const urls = [
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(clean)}&language=en&limit=${limit}&format=json`,
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(clean + ' video game')}&language=en&limit=6&format=json`,
  ];

  const results = await Promise.all(urls.map((u) => fetchJson(u).catch(() => ({ search: [] }))));
  const qids = [];
  const seen = new Set();

  for (const res of results) {
    for (const item of res.search || []) {
      if (!item.id || seen.has(item.id)) continue;
      const desc = String(item.description || '');
      // Prioritize obvious video games, skip obvious non-games (albums, films, people)
      if (/\b(album|song|film|movie|television|novel|comic|person|politician|footballer|city|band)\b/i.test(desc)) {
        continue;
      }
      seen.add(item.id);
      qids.push(item.id);
    }
  }

  if (!qids.length) return [];
  return hydrateWikidataEntities(qids.slice(0, 14));
}

/**
 * Background paginated SPARQL fetch for a specific console generation (PS1-PS5, Xbox-Series X|S, PC).
 * Returns Wikidata QIDs ready for batch hydration via hydrateWikidataEntities.
 */
async function fetchGenerationQids(platformQid, offset = 0, limit = 50) {
  const sparql = [
    'SELECT ?game WHERE {',
    `  ?game wdt:P31 wd:Q7889 ; wdt:P400 wd:${platformQid} ; wdt:P577 ?d .`,
    '  ?article schema:about ?game ; schema:isPartOf <https://en.wikipedia.org/> .',
    '}',
    'GROUP BY ?game',
    `LIMIT ${limit}`,
    `OFFSET ${offset}`,
  ].join(' ');

  const data = await fetchJson(
    'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql),
    { Accept: 'application/sparql-results+json' }
  );

  return (data.results?.bindings || [])
    .map((b) => String(b.game?.value || '').split('/').pop())
    .filter((id) => /^Q\d+$/.test(id));
}

module.exports = {
  GENERATION_BUCKETS,
  WIKIDATA_PLATFORMS,
  searchWikidataGames,
  hydrateWikidataEntities,
  fetchGenerationQids,
  fetchWikipediaCovers,
};
