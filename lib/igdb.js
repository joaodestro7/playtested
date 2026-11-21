'use strict';

/**
 * Official IGDB v4 (via Twitch OAuth) Multi-Platform Catalog Connector
 *
 * When TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are configured, Playtested
 * pulls games across PC (Steam), PlayStation (PS4/PS5), and Xbox (Xbox One / Series X|S)
 * along with external store IDs so all platforms share ONE deduplicated catalog.
 */

const IGDB_PLATFORM_MAP = {
  6: { platform: 'pc', gen: 'PC' },
  7: { platform: 'ps', gen: 'PS1' },
  8: { platform: 'ps', gen: 'PS2' },
  9: { platform: 'ps', gen: 'PS3' },
  48: { platform: 'ps', gen: 'PS4' },
  167: { platform: 'ps', gen: 'PS5' },
  11: { platform: 'xbox', gen: 'Xbox' },
  12: { platform: 'xbox', gen: 'Xbox 360' },
  49: { platform: 'xbox', gen: 'Xbox One' },
  169: { platform: 'xbox', gen: 'Xbox Series X|S' },
};

const ALL_IGDB_PLATFORM_IDS = Object.keys(IGDB_PLATFORM_MAP).join(',');

let tokenCache = { token: null, expiresAt: 0 };

async function getTwitchToken(clientId, clientSecret) {
  if (!clientId || !clientSecret) return null;
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Twitch OAuth failed (${res.status})`);
  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, (Number(data.expires_in) || 3600) - 120) * 1000,
  };
  return tokenCache.token;
}

async function igdbQuery(endpoint, queryBody, clientId, clientSecret) {
  const token = await getTwitchToken(clientId, clientSecret);
  if (!token) return [];
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: queryBody,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  return res.json();
}

function mapIgdbGame(row) {
  const mapped = (row.platforms || []).map((pid) => IGDB_PLATFORM_MAP[pid]).filter(Boolean);
  const platforms = [...new Set(mapped.map((m) => m.platform))];
  const generations = [...new Set(mapped.map((m) => m.gen))];
  if (!platforms.length) return null;

  const platformIds = { igdb: String(row.id) };
  for (const ext of row.external_games || []) {
    if (ext.category === 1 && ext.uid) platformIds.steam = String(ext.uid);
    if (ext.category === 36 && ext.uid) platformIds.ps = String(ext.uid);
    if ((ext.category === 11 || ext.category === 31) && ext.uid) platformIds.xbox = String(ext.uid);
  }

  const devs = [];
  const pubs = [];
  for (const ic of row.involved_companies || []) {
    const cname = ic.company?.name;
    if (!cname) continue;
    if (ic.developer) devs.push(cname);
    if (ic.publisher) pubs.push(cname);
  }

  const date = row.first_release_date
    ? new Date(row.first_release_date * 1000).toISOString().slice(0, 10)
    : '';

  const cover = row.cover?.image_id
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${row.cover.image_id}.jpg`
    : '';
  const hdr = row.screenshots?.[0]?.image_id
    ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${row.screenshots[0].image_id}.jpg`
    : cover;

  return {
    id: platformIds.steam || `igdb-${row.id}`,
    name: row.name,
    date,
    platforms,
    generations,
    platformIds,
    developer: devs.join(', '),
    publisher: pubs.join(', '),
    cover,
    hdr,
    trend: 0,
    checked: Date.now(),
  };
}

async function fetchIgdbBatch(clientId, clientSecret, offset = 0, limit = 100) {
  if (!clientId || !clientSecret) return [];
  const nowSec = Math.floor(Date.now() / 1000);
  const query = `
    fields name, first_release_date, platforms, cover.image_id, screenshots.image_id,
           involved_companies.developer, involved_companies.publisher, involved_companies.company.name,
           external_games.category, external_games.uid, total_rating_count;
    where platforms = (${ALL_IGDB_PLATFORM_IDS})
      & first_release_date != null
      & first_release_date <= ${nowSec}
      & cover != null
      & category = (0,8,9);
    sort total_rating_count desc;
    limit ${limit};
    offset ${offset};
  `;
  const rows = await igdbQuery('games', query, clientId, clientSecret);
  return rows.map(mapIgdbGame).filter(Boolean);
}

async function searchIgdb(term, clientId, clientSecret, limit = 8) {
  if (!clientId || !clientSecret || !term) return [];
  const safe = String(term).replace(/"/g, '').trim();
  const query = `
    search "${safe}";
    fields name, first_release_date, platforms, cover.image_id, screenshots.image_id,
           involved_companies.developer, involved_companies.publisher, involved_companies.company.name,
           external_games.category, external_games.uid;
    where platforms = (${ALL_IGDB_PLATFORM_IDS}) & cover != null;
    limit ${limit};
  `;
  const rows = await igdbQuery('games', query, clientId, clientSecret);
  return rows.map(mapIgdbGame).filter(Boolean);
}

module.exports = {
  fetchIgdbBatch,
  searchIgdb,
};
