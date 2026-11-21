'use strict';

const crypto = require('crypto');
const { normalizeTitle } = require('./dedupe');

const TIMEOUT_MS = 12000;

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

async function fetchSteamLibrary(account, steamApiKey) {
  if (account.lib && Date.now() - account.lib.t < 300000) return account.lib.d;
  if (!steamApiKey) {
    throw new Error('Steam library verification is currently unavailable on this server.');
  }
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
    avatar = byId.GameDisplayPicRaw || '';
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

async function fetchOpenXblTitleHours(titleId, openXblKey) {
  if (!titleId || !openXblKey) return 0;
  const cached = openXblMinutesCache.get(String(titleId));
  if (cached && Date.now() - cached.t < 600000) return cached.hours;
  try {
    const res = await fetchJson(`https://xbl.io/api/v2/achievements/stats/${encodeURIComponent(titleId)}`, {
      headers: openXblHeaders(openXblKey),
    });
    const body = res.content || res;
    const stats = body.statlistscollection?.[0]?.stats || [];
    const mins = Number((stats.find((s) => s.name === 'MinutesPlayed') || {}).value || 0);
    const hours = Math.round((mins / 60) * 10) / 10;
    openXblMinutesCache.set(String(titleId), { t: Date.now(), hours });
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
    avatar: byId.GameDisplayPicRaw || person.displayPicRaw || '',
    platform: 'xbox',
    viaOpenXbl: true,
  };
}

async function fetchXboxLibrary(account, openXblKey = '') {
  if (account.lib && Date.now() - account.lib.t < 300000) return account.lib.d;

  if (account.viaOpenXbl) {
    if (!openXblKey) throw new Error('Xbox library service is temporarily unavailable.');
    const data = await fetchJson(`https://xbl.io/api/v2/player/titleHistory/${encodeURIComponent(account.id)}`, {
      headers: openXblHeaders(openXblKey),
    });
    const rawTitles = data.content?.titles || data.titles || [];
    // Keep genuine Xbox console / Game Pass / Xbox Store titles (exclude Win32-only Game Bar logs)
    const titles = rawTitles.filter(
      (t) => t.name && t.type === 'Game' && !(Array.isArray(t.devices) && t.devices.length === 1 && t.devices[0] === 'Win32')
    );

    const items = titles.map((t) => ({
      platform: 'xbox',
      externalId: String(t.titleId || t.modernTitleId || ''),
      name: t.name,
      canonicalKey: normalizeTitle(t.name),
      hours: Math.round((Number(t.stats?.minutesPlayed || 0) / 60) * 10) / 10,
      needsHoursLookup: !t.stats?.minutesPlayed,
      cover: t.displayImage || '',
      developer: t.detail?.developerName || '',
      publisher: t.detail?.publisherName || '',
      releaseDate: t.detail?.releaseDate ? String(t.detail.releaseDate).slice(0, 10) : '',
    }));

    // Hydrate exact MinutesPlayed in parallel for the top 12 recently played Xbox titles
    await Promise.all(
      items.slice(0, 12).map(async (item) => {
        if (item.needsHoursLookup && item.externalId) {
          item.hours = await fetchOpenXblTitleHours(item.externalId, openXblKey);
          item.needsHoursLookup = false;
        }
      })
    );

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

  const titles = (data.titles || []).filter((t) => t.type === 'Game' || t.titleType === 'LiveApp' ? t.type === 'Game' : true);

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
            minutesByTitle.set(String(stat.titleid), Number(stat.value) || 0);
          }
        }
      }
    } catch {
      // Continue with TitleHub stats if batch userstats is rate-limited
    }
  }

  const items = titles
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
        cover: t.displayImage || '',
        developer: t.detail?.developerName || '',
        publisher: t.detail?.publisherName || '',
        releaseDate: t.detail?.releaseDate ? String(t.detail.releaseDate).slice(0, 10) : '',
      };
    });

  account.lib = { t: Date.now(), d: items };
  return items;
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
 * e.g. "PT84H22M10S" -> 84.4 hours, "PT145M" -> 2.4 hours
 */
function parseIsoDurationHours(duration) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(String(duration || ''));
  if (!m) return 0;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const sec = Number(m[3] || 0);
  return Math.round((h + min / 60 + sec / 3600) * 10) / 10;
}

function createPsnChallengeCode() {
  return 'PT-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function lookupPsnUserByOnlineId(onlineId, accessToken) {
  const cleanId = String(onlineId || '').trim();
  if (!/^[A-Za-z0-9_-]{3,16}$/.test(cleanId)) {
    throw new Error('Please enter a valid PlayStation Online ID (3–16 characters).');
  }
  const searchRes = await fetchJson(
    `https://us-prof.np.playstation.com/api/userProfile/v1/internal/users/profiles?accountIds=`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  ).catch(() => null);
  void searchRes;

  // Sony's official onlineId -> accountId lookup
  const legacyProfile = await fetchJson(
    `https://us-prof.np.playstation.com/api/userProfile/v1/internal/users/${encodeURIComponent(cleanId)}/profile2?fields=accountId,onlineId,aboutMe,avatarUrls`,
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
    avatar: profile.avatarUrls?.[0]?.avatarUrl || '',
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
  } catch {
    accountId = 'me';
  }

  let name = 'PlayStation Player';
  let avatar = '';
  try {
    const prof = await fetchJson(
      `https://us-prof.np.playstation.com/api/userProfile/v1/internal/users/${encodeURIComponent(accountId)}/profiles`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    name = prof.onlineId || name;
    avatar = prof.avatars?.[prof.avatars.length - 1]?.url || '';
  } catch {
    // Keep fallback name
  }

  return {
    id: String(accountId),
    name,
    avatar,
    platform: 'ps',
    accessToken,
    expiresAt,
    usesServiceToken: false,
  };
}

async function fetchPsnLibrary(account, serviceNpsso) {
  if (account.lib && Date.now() - account.lib.t < 300000) return account.lib.d;

  const token = account.usesServiceToken
    ? await getServicePsnToken(serviceNpsso)
    : account.accessToken && Date.now() < (account.expiresAt || 0)
      ? account.accessToken
      : null;

  if (!token) {
    throw new Error('PlayStation session expired. Please reconnect your PlayStation account.');
  }

  const data = await fetchJson(
    `https://m.np.playstation.com/api/gamelist/v2/users/${encodeURIComponent(account.id)}/titles?categories=ps4_game,ps5_native_game&limit=200`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Language': 'en-US',
      },
    }
  );

  const rawTitles = data.titles || [];
  if (!rawTitles.length) {
    throw new Error(
      'No PlayStation games returned. Make sure your PSN Gaming History privacy setting is set to "Anyone".'
    );
  }

  const items = rawTitles.map((t) => ({
    platform: 'ps',
    externalId: String(t.titleId || t.concept?.id || ''),
    name: t.name || 'PlayStation Title',
    canonicalKey: normalizeTitle(t.name || ''),
    hours: parseIsoDurationHours(t.playDuration),
    cover: t.imageUrl || t.concept?.media?.images?.[0]?.url || '',
  }));

  account.lib = { t: Date.now(), d: items };
  return items;
}

module.exports = {
  buildSteamAuthUrl,
  verifySteamReturn,
  fetchSteamLibrary,
  createPkcePair,
  buildXboxAuthUrl,
  exchangeXboxOAuthCode,
  verifyXboxBioChallenge,
  fetchOpenXblTitleHours,
  fetchXboxLibrary,
  createPsnChallengeCode,
  verifyPsnBioChallenge,
  verifyPsnDirectNpsso,
  fetchPsnLibrary,
  parseIsoDurationHours,
};
