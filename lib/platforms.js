'use strict';

const crypto = require('crypto');
const { normalizeTitle } = require('./dedupe');

const TIMEOUT_MS = 12000;

function upgradeHttps(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (s.startsWith('http://images-eds.xboxlive.com')) {
    return s.replace(/^http:\/\/images-eds\.xboxlive\.com/i, 'https://images-eds-ssl.xboxlive.com');
  }
  if (s.startsWith('http://')) {
    return 'https://' + s.slice(7);
  }
  return s;
}

/**
 * Merges duplicate platform versions of the same game (e.g. PS4 + PS5 or
 * Xbox One + Series X|S entries sharing the same canonicalKey) into one
 * entry with summed playtime and all externalIds preserved.
 */
function mergeDuplicateLibraryItems(items) {
  const byKey = new Map();
  const output = [];

  for (const raw of items) {
    const extId = String(raw.externalId || '').trim();
    const key = raw.canonicalKey || '';
    const item = {
      ...raw,
      externalId: extId,
      externalIds: extId ? [extId] : [],
      hours: Math.round((Number(raw.hours) || 0) * 10) / 10,
      cover: upgradeHttps(raw.cover),
    };

    if (!key) {
      output.push(item);
      continue;
    }

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      output.push(item);
      continue;
    }

    // Avoid double-counting the exact same externalId
    if (extId && existing.externalIds.includes(extId)) {
      if (item.hours > existing.hours) existing.hours = item.hours;
      if (!existing.cover && item.cover) existing.cover = item.cover;
      continue;
    }

    const prevBestHours = existing._bestEditionHours ?? existing.hours;
    if (extId) existing.externalIds.push(extId);
    existing.hours = Math.round((existing.hours + item.hours) * 10) / 10;

    // Prefer the primary externalId, name, and cover from the most-played edition
    if (item.hours > prevBestHours) {
      existing._bestEditionHours = item.hours;
      if (extId) existing.externalId = extId;
      if (item.cover) existing.cover = item.cover;
      if (item.name) existing.name = item.name;
    } else {
      existing._bestEditionHours = prevBestHours;
      if (!existing.cover && item.cover) existing.cover = item.cover;
    }

    if (item.needsHoursLookup) existing.needsHoursLookup = true;
    if ((Number(item.achievementPct) || 0) > (Number(existing.achievementPct) || 0)) {
      existing.achievementPct = Number(item.achievementPct) || 0;
    }
    if (!existing.developer && item.developer) existing.developer = item.developer;
    if (!existing.publisher && item.publisher) existing.publisher = item.publisher;
    if (!existing.releaseDate && item.releaseDate) existing.releaseDate = item.releaseDate;
  }

  for (const item of output) {
    delete item._bestEditionHours;
  }
  return output;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), ...opts });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(json.error_description || json.error?.message || json.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// ============================================================================
// 1. STEAM (OpenID 2.0 + Steam Web API)
// ============================================================================
function buildSteamAuthUrl(baseUrl) {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${baseUrl}/auth/steam/return`,
    'openid.realm': baseUrl,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return `https://steamcommunity.com/openid/login?${params}`;
}

async function verifySteamReturn(query, steamApiKey) {
  const params = new URLSearchParams(query);
  params.set('openid.mode', 'check_authentication');
  const res = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  const idMatch = /(\d{17})$/.exec(String(query['openid.claimed_id'] || ''));
  if (!/is_valid\s*:\s*true/.test(text) || !idMatch) {
    throw new Error('Invalid Steam OpenID response.');
  }

  const steamid = idMatch[1];
  let name = `Steam ${steamid.slice(-4)}`;
  let avatar = '';

  if (steamApiKey) {
    try {
      const data = await fetchJson(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?steamids=${steamid}&key=${encodeURIComponent(steamApiKey)}&format=json`
      );
      const player = (data.response?.players || [])[0];
      if (player) {
        name = player.personaname || name;
        avatar = player.avatarfull || player.avatarmedium || '';
      }
    } catch {
      // Fall through to public Steam profile XML fallback
    }
  }

  // Fallback to public Steam Community XML profile if API key was omitted or timed out
  if (!avatar || name.startsWith('Steam ')) {
    try {
      const xmlRes = await fetch(`https://steamcommunity.com/profiles/${steamid}/?xml=1`, {
        signal: AbortSignal.timeout(8000),
      });
      if (xmlRes.ok) {
        const xml = await xmlRes.text();
        const nameMatch = /<steamID><!\[CDATA\[([\s\S]*?)\]\]><\/steamID>/.exec(xml);
        const avatarMatch =
          /<avatarFull><!\[CDATA\[([\s\S]*?)\]\]><\/avatarFull>/.exec(xml) ||
          /<avatarMedium><!\[CDATA\[([\s\S]*?)\]\]><\/avatarMedium>/.exec(xml);
        if (nameMatch && nameMatch[1].trim()) name = nameMatch[1].trim();
        if (avatarMatch && avatarMatch[1].trim()) avatar = avatarMatch[1].trim();
      }
    } catch {
      // Keep fallback Steam ID label
    }
  }

  return { id: steamid, name, avatar, platform: 'pc' };
}

const LIBRARY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // Keep synced library cached for the full session (6 hours)
const inFlightLibraries = new Map();

async function withLibraryInFlight(platform, accountId, forceRefresh, loader) {
  const key = `${platform}:${accountId}`;
  if (!forceRefresh && inFlightLibraries.has(key)) {
    return inFlightLibraries.get(key);
  }
  const promise = Promise.resolve().then(loader).finally(() => {
    if (inFlightLibraries.get(key) === promise) {
      inFlightLibraries.delete(key);
    }
  });
  inFlightLibraries.set(key, promise);
  return promise;
}

async function fetchSteamLibrary(account, steamApiKey, { forceRefresh = false } = {}) {
  if (!forceRefresh && account.lib && Array.isArray(account.lib.d) && Date.now() - account.lib.t < LIBRARY_CACHE_TTL_MS) {
    return account.lib.d;
  }
  if (!steamApiKey) {
    throw new Error('Steam library verification is currently unavailable on this server.');
  }
  return withLibraryInFlight('pc', account.id, forceRefresh, async () => {
    const data = await fetchJson(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?steamid=${encodeURIComponent(account.id)}&include_appinfo=1&include_played_free_games=1&key=${encodeURIComponent(steamApiKey)}&format=json`
    );
    const rawGames = data.response?.games;
    if (!rawGames) {
      throw new Error(
        'Could not read your Steam library. Set "Game details" to Public in your Steam Privacy Settings and try again.'
      );
    }
    const items = rawGames.map((x) => ({
      platform: 'pc',
      externalId: String(x.appid),
      name: x.name || `Steam App ${x.appid}`,
      canonicalKey: normalizeTitle(x.name || ''),
      hours: Math.round((x.playtime_forever || 0) / 6) / 10,
      cover: `https://cdn.akamai.steamstatic.com/steam/apps/${x.appid}/library_600x900.jpg`,
    }));
    account.lib = { t: Date.now(), d: items };
    return items;
  });
}

const steamAchCache = new Map();

/**
 * Fetches Steam achievement completion percentage for a player + appid.
 * Called for ANY Steam game with 0.1h <= hours < 2.0h so players who complete
 * short or micro-length games (even 15-25 min) with >= 50% achievements unlock
 * verified reviewing automatically. Falls back to public Steam Community XML
 * stats if GetPlayerAchievements fails or returns empty.
 */
async function fetchSteamAchievementProgress(steamid, appid, steamApiKey, { forceRefresh = false } = {}) {
  const sid = String(steamid || '').trim();
  const aid = String(appid || '').trim();
  if (!sid || !aid) return null;

  const key = `${sid}:${aid}`;
  if (!forceRefresh) {
    const cached = steamAchCache.get(key);
    if (cached && Date.now() - cached.t < 600000) return cached.d;
  }

  const storeCache = (result) => {
    if (steamAchCache.size > 1500) {
      const oldest = steamAchCache.keys().next().value;
      if (oldest) steamAchCache.delete(oldest);
    }
    steamAchCache.set(key, { t: Date.now(), d: result });
    return result;
  };

  // 1. Official Steam Web API GetPlayerAchievements
  if (steamApiKey) {
    try {
      const data = await fetchJson(
        `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?appid=${encodeURIComponent(aid)}&steamid=${encodeURIComponent(sid)}&l=english&key=${encodeURIComponent(steamApiKey)}&format=json`
      );
      const list = data.playerstats?.achievements;
      if (Array.isArray(list) && list.length > 0) {
        const unlocked = list.filter((a) => Number(a.achieved) === 1).length;
        const percent = Math.round((unlocked / list.length) * 100);
        return storeCache({ total: list.length, unlocked, percent });
      }
    } catch {
      // Fall through to Steam Community XML stats fallback
    }
  }

  // 2. Public Steam Community XML achievements fallback (handles edge cases where Web API fails)
  try {
    const xmlRes = await fetch(
      `https://steamcommunity.com/profiles/${encodeURIComponent(sid)}/stats/appid/${encodeURIComponent(aid)}/achievements/?xml=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (xmlRes.ok) {
      const xml = await xmlRes.text();
      const matches = [...xml.matchAll(/<achievement\s+closed="([01])"/gi)];
      if (matches.length > 0) {
        const unlocked = matches.filter((m) => m[1] === '1').length;
        const percent = Math.round((unlocked / matches.length) * 100);
        return storeCache({ total: matches.length, unlocked, percent });
      }
    }
  } catch {
    // Ignore fallback failure
  }

  return null;
}

// ============================================================================
// 2. XBOX LIVE
//    Mode A (Recommended): Official Microsoft Identity Platform v2.0 OAuth
//            (Consumers) + PKCE -> XBL User Token -> XSTS -> TitleHub & UserStats
//    Mode B (Alternative): OpenXBL (xbl.io) API key with Xbox Bio Challenge
//    Completely open-source & read-only: never asks for a user's password.
// ============================================================================
function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function buildXboxAuthUrl(baseUrl, clientId, stateToken, codeChallenge = '') {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: `${baseUrl}/auth/xbox/return`,
    response_mode: 'query',
    scope: 'XboxLive.signin offline_access',
    state: stateToken,
    prompt: 'select_account',
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params}`;
}

async function exchangeXboxOAuthCode(code, baseUrl, clientId, clientSecret = '', codeVerifier = '') {
  // Step 1: Exchange authorization code for Microsoft consumer access token (v2.0)
  const tokenBody = new URLSearchParams({
    client_id: clientId,
    code,
    grant_type: 'authorization_code',
    redirect_uri: `${baseUrl}/auth/xbox/return`,
    scope: 'XboxLive.signin offline_access',
  });
  if (clientSecret) tokenBody.set('client_secret', clientSecret);
  if (codeVerifier) tokenBody.set('code_verifier', codeVerifier);

  const msToken = await fetchJson('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
  });

  // Step 2: Exchange Microsoft token for Xbox Live User Token
  const xblRes = await fetchJson('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${msToken.access_token}`,
      },
    }),
  });

  // Step 3: Exchange XBL User Token for XSTS Token
  const xstsRes = await fetchJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      RelyingParty: 'http://xboxlive.com',
      TokenType: 'JWT',
      Properties: {
        UserTokens: [xblRes.Token],
        SandboxId: 'RETAIL',
      },
    }),
  });

  const xui = xstsRes.DisplayClaims?.xui?.[0] || {};
  const uhs = xui.uhs;
  const xuid = xui.xid;
  const xstsToken = xstsRes.Token;
  if (!uhs || !xstsToken) {
    throw new Error('Xbox Live XSTS authentication did not return a valid token.');
  }

  // Step 4: Fetch Gamertag and Gamerpic
  let name = xui.gtg || `Xbox ${String(xuid || '').slice(-4)}`;
  let avatar = '';
  try {
    const prof = await fetchJson(
      `https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag,ModernGamertag,GameDisplayPicRaw`,
      {
        headers: {
          Authorization: `XBL3.0 x=${uhs};${xstsToken}`,
          'x-xbl-contract-version': '2',
        },
      }
    );
    const settings = prof.profileUsers?.[0]?.settings || [];
    const byId = Object.fromEntries(settings.map((s) => [s.id, s.value]));
    name = byId.ModernGamertag || byId.Gamertag || name;
    avatar = upgradeHttps(byId.GameDisplayPicRaw || '');
  } catch {
    // Keep xui gamertag fallback
  }

  return {
    id: String(xuid || name),
    name,
    avatar,
    platform: 'xbox',
    uhs,
    xstsToken,
  };
}

// OpenXBL (xbl.io) helpers — always unwrap .content and send Accept-Language: en-US
function openXblHeaders(openXblKey) {
  return {
    'X-Authorization': openXblKey,
    Accept: 'application/json',
    'Accept-Language': 'en-US',
  };
}

const openXblMinutesCache = new Map();

/**
 * Fetches exact MinutesPlayed for a SPECIFIC player XUID across up to 100+ titles
 * using OpenXBL's batch POST /api/v2/player/stats endpoint.
 * Strictly checks stat.xuid === xuid so another player's playtime is never mixed.
 */
async function fetchOpenXblBatchHours(xuid, titleIds, openXblKey) {
  const results = new Map();
  const cleanXuid = String(xuid || '').trim();
  if (!cleanXuid || !openXblKey || !Array.isArray(titleIds) || !titleIds.length) {
    return results;
  }

  const missing = [];
  const now = Date.now();
  for (const rawId of titleIds) {
    const tid = String(rawId || '').trim();
    if (!tid) continue;
    const cacheKey = `${cleanXuid}:${tid}`;
    const cached = openXblMinutesCache.get(cacheKey);
    if (cached && now - cached.t < 600000) {
      results.set(tid, cached.hours);
    } else if (!missing.includes(tid)) {
      missing.push(tid);
    }
  }

  // Query in batches of 50 titles per POST /v2/player/stats call
  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50);
    try {
      const res = await fetchJson('https://xbl.io/api/v2/player/stats', {
        method: 'POST',
        headers: {
          ...openXblHeaders(openXblKey),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          xuids: [cleanXuid],
          stats: chunk.map((tid) => ({ name: 'MinutesPlayed', titleId: tid })),
        }),
      });
      const body = res.content || res;
      const groups = body.statlistscollection || [];
      for (const group of groups) {
        for (const stat of group.stats || []) {
          if (stat.name !== 'MinutesPlayed') continue;
          if (stat.xuid && String(stat.xuid) !== cleanXuid) continue;
          const tid = String(stat.titleid || stat.titleId || '');
          if (!tid) continue;
          const mins = Number(stat.value || 0);
          const hours = Math.round((mins / 60) * 10) / 10;
          results.set(tid, hours);
          openXblMinutesCache.set(`${cleanXuid}:${tid}`, { t: Date.now(), hours });
        }
      }
      // Cache explicit 0h for titles returned without a MinutesPlayed stat so we don't re-query
      for (const tid of chunk) {
        if (!results.has(tid)) {
          results.set(tid, 0);
          openXblMinutesCache.set(`${cleanXuid}:${tid}`, { t: Date.now(), hours: 0 });
        }
      }
    } catch (err) {
      console.warn(`OpenXBL batch stats lookup failed for xuid=${cleanXuid}:`, err.message);
    }
  }

  return results;
}

async function fetchOpenXblTitleHours(xuid, titleId, openXblKey) {
  const cleanXuid = String(xuid || '').trim();
  const tid = String(titleId || '').trim();
  if (!cleanXuid || !tid || !openXblKey) return 0;

  const cacheKey = `${cleanXuid}:${tid}`;
  const cached = openXblMinutesCache.get(cacheKey);
  if (cached && Date.now() - cached.t < 600000) return cached.hours;

  // Primary: per-XUID POST /api/v2/player/stats
  const batch = await fetchOpenXblBatchHours(cleanXuid, [tid], openXblKey);
  if (batch.has(tid)) return batch.get(tid);

  // Fallback: /v2/achievements/stats/{titleId} ONLY if the returned stat belongs to this exact XUID
  try {
    const res = await fetchJson(`https://xbl.io/api/v2/achievements/stats/${encodeURIComponent(tid)}`, {
      headers: openXblHeaders(openXblKey),
    });
    const body = res.content || res;
    const stats = body.statlistscollection?.[0]?.stats || [];
    const match = stats.find(
      (s) => s.name === 'MinutesPlayed' && s.xuid && String(s.xuid) === cleanXuid
    );
    if (!match) return 0;
    const mins = Number(match.value || 0);
    const hours = Math.round((mins / 60) * 10) / 10;
    openXblMinutesCache.set(cacheKey, { t: Date.now(), hours });
    return hours;
  } catch {
    return 0;
  }
}

// OpenXBL (xbl.io) bio-challenge verification when OPENXBL_KEY is configured
async function verifyXboxBioChallenge(gamertag, expectedCode, openXblKey) {
  const clean = String(gamertag || '').trim();
  if (clean.length < 2 || clean.length > 25) {
    throw new Error('Enter a valid Xbox Gamertag.');
  }
  if (!openXblKey) {
    throw new Error('Xbox verification is temporarily unavailable on this server.');
  }
  const search = await fetchJson(`https://xbl.io/api/v2/search/${encodeURIComponent(clean)}`, {
    headers: openXblHeaders(openXblKey),
  });
  const people = search.content?.people || search.people || [];
  const person =
    people.find(
      (p) =>
        String(p.gamertag || '').toLowerCase() === clean.toLowerCase() ||
        String(p.modernGamertag || '').toLowerCase() === clean.toLowerCase()
    ) || people[0];

  if (!person || !person.xuid) {
    throw new Error(`Xbox Gamertag "${clean}" was not found.`);
  }
  const acct = await fetchJson(`https://xbl.io/api/v2/account/${encodeURIComponent(person.xuid)}`, {
    headers: openXblHeaders(openXblKey),
  });
  const users = acct.content?.profileUsers || acct.profileUsers || [];
  const settings = users[0]?.settings || [];
  const byId = Object.fromEntries(settings.map((s) => [s.id, s.value]));
  const bio = String(byId.Bio || '');
  if (!bio.toUpperCase().includes(expectedCode.toUpperCase())) {
    throw new Error(
      `Verification code "${expectedCode}" was not found in ${person.gamertag}'s Xbox Bio yet. Save your Xbox profile bio and try again.`
    );
  }
  return {
    id: String(person.xuid),
    name: byId.ModernGamertag || byId.Gamertag || person.gamertag,
    avatar: upgradeHttps(byId.GameDisplayPicRaw || person.displayPicRaw || ''),
    platform: 'xbox',
    viaOpenXbl: true,
  };
}

async function fetchXboxLibrary(account, openXblKey = '', { forceRefresh = false } = {}) {
  if (!forceRefresh && account.lib && Array.isArray(account.lib.d) && Date.now() - account.lib.t < LIBRARY_CACHE_TTL_MS) {
    return account.lib.d;
  }

  return withLibraryInFlight('xbox', account.id, forceRefresh, async () => {
    if (account.viaOpenXbl) {
      if (!openXblKey) throw new Error('Xbox library service is temporarily unavailable.');
      let data;
      try {
        data = await fetchJson(`https://xbl.io/api/v2/titles/${encodeURIComponent(account.id)}`, {
          headers: openXblHeaders(openXblKey),
        });
      } catch {
        data = await fetchJson(`https://xbl.io/api/v2/player/titleHistory/${encodeURIComponent(account.id)}`, {
          headers: openXblHeaders(openXblKey),
        });
      }
      const rawTitles = data.content?.titles || data.titles || [];
      // Keep genuine Xbox console / Game Pass / Xbox Store titles (exclude Win32-only Game Bar logs)
      const titles = rawTitles.filter(
        (t) => t.name && t.type === 'Game' && !(Array.isArray(t.devices) && t.devices.length === 1 && t.devices[0] === 'Win32')
      );

      const rawItems = titles.map((t) => ({
        platform: 'xbox',
        externalId: String(t.titleId || t.modernTitleId || ''),
        name: t.name,
        canonicalKey: normalizeTitle(t.name),
        hours: Math.round((Number(t.stats?.minutesPlayed || 0) / 60) * 10) / 10,
        achievementPct: Number(t.achievement?.progressPercentage || 0),
        needsHoursLookup: !t.stats?.minutesPlayed,
        cover: upgradeHttps(t.displayImage || ''),
        developer: t.detail?.developerName || '',
        publisher: t.detail?.publisherName || '',
        releaseDate: t.detail?.releaseDate ? String(t.detail.releaseDate).slice(0, 10) : '',
      }));

      // Batch-hydrate exact MinutesPlayed for this specific player XUID (up to 150 titles in 1-3 calls)
      const idsToLookup = rawItems
        .filter((item) => item.needsHoursLookup && item.externalId)
        .slice(0, 150)
        .map((item) => item.externalId);
      if (idsToLookup.length) {
        const hoursByTitle = await fetchOpenXblBatchHours(account.id, idsToLookup, openXblKey);
        for (const item of rawItems) {
          if (item.needsHoursLookup && hoursByTitle.has(item.externalId)) {
            item.hours = hoursByTitle.get(item.externalId);
            item.needsHoursLookup = false;
          }
        }
      }

      const items = mergeDuplicateLibraryItems(rawItems);
      account.lib = { t: Date.now(), d: items };
      return items;
    }

    if (!account.uhs || !account.xstsToken) {
      throw new Error('Xbox session expired. Please reconnect your Xbox account.');
    }

    const authHeader = `XBL3.0 x=${account.uhs};${account.xstsToken}`;
    const data = await fetchJson(
      `https://titlehub.xboxlive.com/users/xuid(${encodeURIComponent(account.id)})/titles/titlehistory/decoration/detail,stats`,
      {
        headers: {
          Authorization: authHeader,
          'x-xbl-contract-version': '2',
          'Accept-Language': 'en-US',
        },
      }
    );

    const titles = (data.titles || []).filter((t) => (t.type === 'Game' || t.titleType === 'LiveApp' ? t.type === 'Game' : true));

    // Batch fetch MinutesPlayed via Xbox UserStats for titles missing inline playtime
    const minutesByTitle = new Map();
    const titleIds = titles.map((t) => String(t.titleId)).filter(Boolean).slice(0, 100);
    if (titleIds.length) {
      try {
        const statsRes = await fetchJson('https://userstats.xboxlive.com/batch', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'x-xbl-contract-version': '2',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            arrangebyfield: 'xuid',
            xuids: [String(account.id)],
            stats: titleIds.map((tid) => ({ name: 'MinutesPlayed', titleid: tid })),
          }),
        });
        for (const group of statsRes.statlistscollection || []) {
          for (const stat of group.stats || []) {
            if (stat.name === 'MinutesPlayed' && stat.value != null) {
              minutesByTitle.set(String(stat.titleid || stat.titleId), Number(stat.value) || 0);
            }
          }
        }
      } catch {
        // Continue with TitleHub stats if batch userstats is rate-limited
      }
    }

    const rawItems = titles
      .filter((t) => t.name && t.type !== 'App')
      .map((t) => {
        const tid = String(t.titleId || t.modernTitleId || '');
        const minutes =
          minutesByTitle.get(tid) ??
          Number(t.stats?.minutesPlayed || 0);
        return {
          platform: 'xbox',
          externalId: tid,
          name: t.name,
          canonicalKey: normalizeTitle(t.name),
          hours: Math.round((minutes / 60) * 10) / 10,
          achievementPct: Number(t.achievement?.progressPercentage || 0),
          cover: upgradeHttps(t.displayImage || ''),
          developer: t.detail?.developerName || '',
          publisher: t.detail?.publisherName || '',
          releaseDate: t.detail?.releaseDate ? String(t.detail.releaseDate).slice(0, 10) : '',
        };
      });

    const items = mergeDuplicateLibraryItems(rawItems);
    account.lib = { t: Date.now(), d: items };
    return items;
  });
}

// ============================================================================
// 3. PLAYSTATION NETWORK (PSN Bio Challenge OR Direct Short-Lived NPSSO)
//    Uses Sony's official np.playstation.com OAuth + gamelist/v2 playtime API
//    (same open-source flow as psn-api / Exophase / PSNProfiles).
//    - Never asks for or stores a user's PlayStation password.
//    - Tokens are kept in server RAM only and never written to disk.
// ============================================================================
const PSN_AUTH_BASIC =
  'MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=';
const PSN_CLIENT_ID = '09515159-7237-4370-9b40-3806e67c0891';
const PSN_REDIRECT_URI = 'com.scee.psxandroid.scecompcall://redirect';

let servicePsnTokenCache = { accessToken: null, expiresAt: 0 };

async function exchangeNpssoForAccessToken(npsso) {
  const clean = String(npsso || '').trim();
  if (clean.length < 32) {
    throw new Error('Invalid NPSSO token format.');
  }

  const authParams = new URLSearchParams({
    access_type: 'offline',
    client_id: PSN_CLIENT_ID,
    redirect_uri: PSN_REDIRECT_URI,
    response_type: 'code',
    scope: 'psn:mobile.v2.core psn:clientapp',
  });

  const authRes = await fetch(`https://ca.account.sony.com/api/authz/v3/oauth/authorize?${authParams}`, {
    redirect: 'manual',
    headers: { Cookie: `npsso=${clean}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const loc = authRes.headers.get('location') || '';
  const codeMatch = /[?&]code=([^&]+)/.exec(loc);
  if (!codeMatch) {
    throw new Error('Could not authenticate with PlayStation Network. The NPSSO token may be expired.');
  }

  const tokenBody = new URLSearchParams({
    code: decodeURIComponent(codeMatch[1]),
    redirect_uri: PSN_REDIRECT_URI,
    grant_type: 'authorization_code',
    token_format: 'jwt',
  });

  const tokenData = await fetchJson('https://ca.account.sony.com/api/authz/v3/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${PSN_AUTH_BASIC}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: tokenBody,
  });

  return {
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + Math.max(60, (Number(tokenData.expires_in) || 3600) - 120) * 1000,
  };
}

async function getServicePsnToken(serviceNpsso) {
  if (!serviceNpsso) return null;
  if (servicePsnTokenCache.accessToken && Date.now() < servicePsnTokenCache.expiresAt) {
    return servicePsnTokenCache.accessToken;
  }
  servicePsnTokenCache = await exchangeNpssoForAccessToken(serviceNpsso);
  return servicePsnTokenCache.accessToken;
}

/**
 * Parses ISO-8601 duration strings returned by Sony's gamelist/v2 API
 * e.g. "PT84H22M10S" -> 84.4 hours, "P2DT3H15M" -> 51.3 hours, "PT145M" -> 2.4 hours
 */
function parseIsoDurationHours(duration) {
  const s = String(duration || '').trim();
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(s);
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return 0;
  const days = Number(m[1] || 0);
  const h = Number(m[2] || 0);
  const min = Number(m[3] || 0);
  const sec = Number(m[4] || 0);
  return Math.round((days * 24 + h + min / 60 + sec / 3600) * 10) / 10;
}

function createPsnChallengeCode() {
  return 'PT-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function pickBestPsnAvatar(profile) {
  if (!profile) return '';
  const sizeOrder = { xl: 4, l: 3, m: 2, s: 1 };
  const pickFrom = (arr, urlKey) => {
    if (!Array.isArray(arr) || !arr.length) return '';
    const sorted = [...arr].sort((a, b) => (sizeOrder[String(b.size || '').toLowerCase()] || 0) - (sizeOrder[String(a.size || '').toLowerCase()] || 0));
    return upgradeHttps(sorted[0]?.[urlKey] || sorted[0]?.url || sorted[0]?.avatarUrl || '');
  };
  return (
    pickFrom(profile.avatars, 'url') ||
    pickFrom(profile.avatarUrls, 'avatarUrl') ||
    pickFrom(profile.personalDetail?.profilePictureUrls, 'profilePictureUrl') ||
    ''
  );
}

async function fetchPsnOwnProfile(accessToken, accountIdHint = 'me') {
  let accountId = String(accountIdHint || 'me');
  let onlineId = '';
  let avatar = '';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Accept-Language': 'en-US',
  };

  // 1. Modern PSN mobile profile endpoint (m.np.playstation.com) by numeric accountId
  if (accountId && accountId !== 'me') {
    try {
      const prof = await fetchJson(
        `https://m.np.playstation.com/api/userProfile/v1/internal/users/${encodeURIComponent(accountId)}/profiles`,
        { headers }
      );
      if (prof.onlineId) onlineId = prof.onlineId;
      avatar = pickBestPsnAvatar(prof) || avatar;
    } catch {
      // Fall through to next endpoint
    }
  }

  // 2. Modern PSN mobile profile endpoint using "me"
  if (!onlineId || !avatar) {
    try {
      const prof = await fetchJson(
        'https://m.np.playstation.com/api/userProfile/v1/internal/users/me/profiles',
        { headers }
      );
      if (prof.onlineId && !onlineId) onlineId = prof.onlineId;
      avatar = avatar || pickBestPsnAvatar(prof);
    } catch {
      // Fall through to legacy profile2
    }
  }

  // 3. Legacy profile2 endpoint (also resolves numeric accountId when JWT omits it)
  if (!onlineId || !avatar || accountId === 'me') {
    try {
      const legacy = await fetchJson(
        'https://us-prof.np.community.playstation.net/userProfile/v1/users/me/profile2?fields=accountId,onlineId,avatarUrls,personalDetail',
        { headers }
      );
      const profile = legacy.profile || legacy;
      if (profile.accountId && accountId === 'me') accountId = String(profile.accountId);
      if (profile.onlineId && !onlineId) onlineId = profile.onlineId;
      avatar = avatar || pickBestPsnAvatar(profile);
    } catch {
      // Fall through to batch endpoint
    }
  }

  // 4. Batch profiles endpoint if we now have numeric accountId
  if ((!onlineId || !avatar) && accountId && accountId !== 'me') {
    try {
      const batch = await fetchJson(
        `https://m.np.playstation.com/api/userProfile/v1/internal/users/profiles?accountIds=${encodeURIComponent(accountId)}`,
        { headers }
      );
      const profile = batch.profiles?.[0];
      if (profile?.onlineId && !onlineId) onlineId = profile.onlineId;
      avatar = avatar || pickBestPsnAvatar(profile);
    } catch {
      // Exhausted fallbacks
    }
  }

  if (!onlineId) {
    console.warn(`PSN profile lookup fell back to generic name (accountId=${accountId})`);
  }

  return {
    accountId,
    name: onlineId || 'PlayStation Player',
    avatar,
  };
}

async function lookupPsnUserByOnlineId(onlineId, accessToken) {
  const cleanId = String(onlineId || '').trim();
  if (!/^[A-Za-z0-9_-]{3,16}$/.test(cleanId)) {
    throw new Error('Please enter a valid PlayStation Online ID (3–16 characters).');
  }

  // Sony's official onlineId -> accountId lookup (legacy profile2 on community host)
  const legacyProfile = await fetchJson(
    `https://us-prof.np.community.playstation.net/userProfile/v1/users/${encodeURIComponent(cleanId)}/profile2?fields=accountId,onlineId,aboutMe,avatarUrls,personalDetail`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept-Language': 'en-US',
      },
    }
  );
  const profile = legacyProfile.profile || legacyProfile;
  if (!profile || !profile.accountId) {
    throw new Error(`PlayStation Online ID "${cleanId}" was not found.`);
  }
  return {
    accountId: String(profile.accountId),
    onlineId: profile.onlineId || cleanId,
    aboutMe: String(profile.aboutMe || ''),
    avatar: pickBestPsnAvatar(profile),
  };
}

async function verifyPsnBioChallenge(onlineId, expectedCode, serviceNpsso) {
  const token = await getServicePsnToken(serviceNpsso);
  if (!token) {
    throw new Error('Server PSN_NPSSO is not configured for bio-challenge verification.');
  }
  const user = await lookupPsnUserByOnlineId(onlineId, token);
  if (!user.aboutMe.toUpperCase().includes(expectedCode.toUpperCase())) {
    throw new Error(
      `Verification code "${expectedCode}" was not found in ${user.onlineId}'s PlayStation "About Me" bio yet. Save your bio on PSN and try again.`
    );
  }
  return {
    id: user.accountId,
    name: user.onlineId,
    avatar: user.avatar,
    platform: 'ps',
    usesServiceToken: true,
  };
}

async function verifyPsnDirectNpsso(userNpsso) {
  const { accessToken, expiresAt } = await exchangeNpssoForAccessToken(userNpsso);
  // Decode JWT payload to retrieve authenticated account_id safely
  let accountId = 'me';
  try {
    const payloadPart = accessToken.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (decoded.account_id) accountId = String(decoded.account_id);
    else if (decoded.user_id && /^\d+$/.test(String(decoded.user_id))) accountId = String(decoded.user_id);
    else if (decoded.sub && /^\d+$/.test(String(decoded.sub))) accountId = String(decoded.sub);
  } catch {
    accountId = 'me';
  }

  const profile = await fetchPsnOwnProfile(accessToken, accountId);

  return {
    id: String(profile.accountId || accountId),
    name: profile.name,
    avatar: profile.avatar,
    platform: 'ps',
    accessToken,
    expiresAt,
    usesServiceToken: false,
  };
}

async function fetchPsnLibrary(account, serviceNpsso, { forceRefresh = false } = {}) {
  if (!forceRefresh && account.lib && Array.isArray(account.lib.d) && Date.now() - account.lib.t < LIBRARY_CACHE_TTL_MS) {
    return account.lib.d;
  }

  const token = account.usesServiceToken
    ? await getServicePsnToken(serviceNpsso)
    : account.accessToken && Date.now() < (account.expiresAt || 0)
      ? account.accessToken
      : null;

  if (!token) {
    throw new Error('PlayStation session expired. Please reconnect your PlayStation account.');
  }

  return withLibraryInFlight('ps', account.id, forceRefresh, async () => {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'en-US',
    };

    const [firstPage, trophyMap] = await Promise.all([
      fetchJson(
        `https://m.np.playstation.com/api/gamelist/v2/users/${encodeURIComponent(account.id)}/titles?categories=ps4_game,ps5_native_game&limit=200`,
        { headers }
      ),
      // Fetch trophy completion percentages in parallel (0ms added latency; degrades gracefully if private)
      fetchJson(
        `https://m.np.playstation.com/api/trophy/v1/users/${encodeURIComponent(account.id)}/trophyTitles?limit=250`,
        { headers }
      )
        .then((res) => {
          const map = new Map();
          for (const tt of res.trophyTitles || []) {
            const key = normalizeTitle(tt.trophyTitleName || '');
            const pct = Number(tt.progress) || 0;
            if (key && pct > (map.get(key) || 0)) map.set(key, pct);
          }
          return map;
        })
        .catch(() => new Map()),
    ]);

    let rawTitles = firstPage.titles || [];
    // Fetch a second page if the player owns more than 200 PS4/PS5 games
    if (firstPage.nextOffset && Number(firstPage.nextOffset) > 0) {
      try {
        const secondPage = await fetchJson(
          `https://m.np.playstation.com/api/gamelist/v2/users/${encodeURIComponent(account.id)}/titles?categories=ps4_game,ps5_native_game&limit=200&offset=${encodeURIComponent(firstPage.nextOffset)}`,
          { headers }
        );
        if (Array.isArray(secondPage.titles) && secondPage.titles.length) {
          rawTitles = rawTitles.concat(secondPage.titles);
        }
      } catch {
        // Keep first 200 titles if second page fails
      }
    }

    if (!rawTitles.length) {
      throw new Error(
        'No PlayStation games returned. Make sure your PSN Gaming History privacy setting is set to "Anyone".'
      );
    }

    const rawItems = rawTitles.map((t) => {
      const canonicalKey = normalizeTitle(t.name || '');
      return {
        platform: 'ps',
        externalId: String(t.titleId || t.concept?.id || ''),
        name: t.name || 'PlayStation Title',
        canonicalKey,
        hours: parseIsoDurationHours(t.playDuration),
        achievementPct: canonicalKey ? trophyMap.get(canonicalKey) || 0 : 0,
        cover: upgradeHttps(t.imageUrl || t.concept?.media?.images?.[0]?.url || ''),
      };
    });

    const items = mergeDuplicateLibraryItems(rawItems);
    account.lib = { t: Date.now(), d: items };
    return items;
  });
}

module.exports = {
  LIBRARY_CACHE_TTL_MS,
  buildSteamAuthUrl,
  verifySteamReturn,
  fetchSteamLibrary,
  fetchSteamAchievementProgress,
  createPkcePair,
  buildXboxAuthUrl,
  exchangeXboxOAuthCode,
  verifyXboxBioChallenge,
  fetchOpenXblBatchHours,
  fetchOpenXblTitleHours,
  fetchXboxLibrary,
  createPsnChallengeCode,
  verifyPsnBioChallenge,
  verifyPsnDirectNpsso,
  fetchPsnOwnProfile,
  fetchPsnLibrary,
  parseIsoDurationHours,
  mergeDuplicateLibraryItems,
  pickBestPsnAvatar,
  upgradeHttps,
};
