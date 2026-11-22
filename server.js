'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Zero-dependency .env loader (never overrides explicit environment variables)
(() => {
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const rawLine of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (k && !(k in process.env)) process.env[k] = v;
  }
})();

const {
  PLATFORM_ORDER,
  normalizeTitle,
  upsertCanonicalGame,
  deduplicateCatalog,
} = require('./lib/dedupe');
const { getLegacyStatus } = require('./lib/legacy');

const {
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
} = require('./lib/platforms');

const { fetchIgdbBatch, searchIgdb } = require('./lib/igdb');
const { enrichMultiplatformCatalog } = require('./lib/multiplatform-seed');
const {
  GENERATION_BUCKETS,
  searchWikidataGames,
  hydrateWikidataEntities,
  fetchGenerationQids,
} = require('./lib/wikidata');
const { PlaytestedStore } = require('./lib/store');

const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const IS_CLOUD_HOST = Boolean(process.env.K_SERVICE || process.env.RENDER);
const STEAM_KEY = process.env.STEAM_API_KEY || '';
const SGDB_KEY = process.env.SGDB_KEY || '';
const XBOX_CLIENT_ID = process.env.XBOX_CLIENT_ID || '';
const XBOX_CLIENT_SECRET = process.env.XBOX_CLIENT_SECRET || '';
const OPENXBL_KEY = process.env.OPENXBL_KEY || '';
const PSN_NPSSO = process.env.PSN_NPSSO || '';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
const DONATE_URL = process.env.DONATE_URL || '';
const BASE = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const MIN_HOURS = Number(process.env.MIN_HOURS) || 2;
const NO_SYNC = process.env.NO_SYNC === '1';

const DB_FILE = path.join(__dirname, 'db.json');
const store = new PlaytestedStore({ dbFile: DB_FILE, databaseUrl: DATABASE_URL });
const db = {
  games: [],
  reviews: [],
  bad: {},
  genOffsets: {},
};
let byId = new Map();

const oauthStates = new Map();

function save() {
  store.saveLocalSync(db);
}

function getSid(req) {
  const match = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  return match ? match[1] : null;
}

async function getSession(req) {
  const sid = getSid(req);
  return sid ? await store.getSession(sid) : null;
}

async function ensureSession(req, res) {
  let sid = getSid(req);
  let session = sid ? await store.getSession(sid) : null;
  if (!session) {
    sid = crypto.randomBytes(24).toString('hex');
    session = {
      accounts: { pc: null, ps: null, xbox: null },
      psnChallenge: null,
      xboxChallenge: null,
    };
    await store.saveSession(sid, session);
    const secure = BASE.startsWith('https://') ? '; Secure' : '';
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax${secure}`);
  }
  return { sid, session };
}

function primaryAccount(session) {
  if (!session) return null;
  return session.accounts.pc || session.accounts.ps || session.accounts.xbox || null;
}

function reviewOwnerId(review) {
  return String(review.accountId || review.steamid || '');
}

async function steamApi(endpoint) {
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `https://api.steampowered.com/${endpoint}${sep}key=${encodeURIComponent(STEAM_KEY)}&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Steam API returned ${res.status}`);
  return res.json();
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '150kb' }));
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders(res, filePath) {
      if (/\.(png|jpg|jpeg|webp|svg|ico)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      } else if (/\.(css|js)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// Prevent Cloudflare/proxies from ever caching auth or private user API responses
app.use(['/auth', '/api/me', '/api/library', '/api/eligibility', '/api/review'], (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

// Lightweight health check for Cloud Run / systemd / uptime monitors
app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    storage: store.isPostgres ? 'postgres' : 'json',
    uptimeSec: Math.round(process.uptime()),
    games: db.games.length,
    reviews: db.reviews.length,
  });
});

// Optional Cloud Scheduler cron endpoint to refresh trending & index a cross-gen batch
app.post('/api/cron/sync', async (req, res) => {
  if (!CRON_SECRET || req.headers['x-cron-secret'] !== CRON_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await refreshCatalog();
    const bucket = GENERATION_BUCKETS[Math.floor(Date.now() / 3600000) % GENERATION_BUCKETS.length];
    const offset = Number(db.genOffsets[bucket.qid] || 0);
    const qids = await fetchGenerationQids(bucket.qid, offset, 35);
    const hydrated = await hydrateWikidataEntities(qids);
    const upserted = [];
    for (const item of hydrated) {
      if (isValidGame(item)) upserted.push(upsertCanonicalGame(db, byId, item));
    }
    db.genOffsets[bucket.qid] = qids.length ? offset + qids.length : 0;
    if (store.isPostgres) {
      await store.upsertGamesBatch(upserted);
      await store.setKv('genOffsets', db.genOffsets);
    } else {
      save();
    }
    res.json({ ok: true, bucket: bucket.label, synced: upserted.length, total: db.games.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// AUTHENTICATION ROUTES: STEAM, XBOX LIVE, PLAYSTATION NETWORK
// ============================================================================

// ---- Steam OpenID ----
app.get('/auth/steam', (_req, res) => {
  res.redirect(buildSteamAuthUrl(BASE));
});

app.get('/auth/steam/return', async (req, res) => {
  try {
    const account = await verifySteamReturn(req.query, STEAM_KEY);
    const { sid, session } = await ensureSession(req, res);
    session.accounts.pc = { ...account, lib: null };
    await store.saveSession(sid, session);
    res.redirect('/?connected=pc');
  } catch (err) {
    console.warn('Steam login failed:', err.message);
    res.redirect('/?e=login');
  }
});

// ---- Xbox Live (Microsoft Identity v2.0 OAuth + PKCE -> XBL -> XSTS, OR OpenXBL Bio Challenge) ----
app.get('/auth/xbox', async (req, res) => {
  if (!XBOX_CLIENT_ID) {
    return res.redirect('/?e=xbox_config');
  }
  const { sid } = await ensureSession(req, res);
  const stateToken = crypto.randomBytes(16).toString('hex');
  const pkce = createPkcePair();
  oauthStates.set(stateToken, { sid, verifier: pkce.verifier, ts: Date.now() });
  res.redirect(buildXboxAuthUrl(BASE, XBOX_CLIENT_ID, stateToken, pkce.challenge));
});

app.get('/auth/xbox/return', async (req, res) => {
  try {
    const stateToken = String(req.query.state || '');
    const savedState = oauthStates.get(stateToken);
    oauthStates.delete(stateToken);
    if (!savedState || Date.now() - savedState.ts > 600000) {
      throw new Error('Expired or invalid Xbox OAuth state.');
    }
    if (req.query.error || !req.query.code) {
      throw new Error(String(req.query.error_description || req.query.error || 'Xbox sign-in cancelled.'));
    }

    const account = await exchangeXboxOAuthCode(
      String(req.query.code),
      BASE,
      XBOX_CLIENT_ID,
      XBOX_CLIENT_SECRET,
      savedState.verifier
    );
    const { sid, session } = await ensureSession(req, res);
    session.accounts.xbox = { ...account, lib: null };
    await store.saveSession(sid, session);
    res.redirect('/?connected=xbox');
  } catch (err) {
    console.warn('Xbox login failed:', err.message);
    res.redirect('/?e=xbox_login');
  }
});

app.post('/auth/xbox/challenge', async (req, res) => {
  const gamertag = String(req.body?.gamertag || '').trim();
  if (gamertag.length < 2 || gamertag.length > 25) {
    return res.status(400).json({ error: 'Enter a valid Xbox Gamertag.' });
  }
  if (!OPENXBL_KEY) {
    return res.status(400).json({ error: 'Xbox bio verification is not configured on this server.' });
  }
  const { sid, session } = await ensureSession(req, res);
  const code = createPsnChallengeCode();
  session.xboxChallenge = { gamertag, code, ts: Date.now() };
  await store.saveSession(sid, session);
  res.json({ gamertag, code });
});

app.post('/auth/xbox/verify', async (req, res) => {
  const sid = getSid(req);
  const session = await getSession(req);
  if (!session?.xboxChallenge) {
    return res.status(400).json({ error: 'Generate a verification code first.' });
  }
  if (Date.now() - session.xboxChallenge.ts > 1800000) {
    session.xboxChallenge = null;
    await store.saveSession(sid, session);
    return res.status(400).json({ error: 'Verification code expired. Please generate a new one.' });
  }
  try {
    const account = await verifyXboxBioChallenge(
      session.xboxChallenge.gamertag,
      session.xboxChallenge.code,
      OPENXBL_KEY
    );
    session.accounts.xbox = { ...account, lib: null };
    session.xboxChallenge = null;
    await store.saveSession(sid, session);
    res.json({ ok: true, account: { name: account.name, avatar: account.avatar, platform: 'xbox' } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- PlayStation Network (Bio Challenge OR Direct Short-Lived NPSSO) ----
app.post('/auth/psn/challenge', async (req, res) => {
  const onlineId = String(req.body?.onlineId || '').trim();
  if (!/^[A-Za-z0-9_-]{3,16}$/.test(onlineId)) {
    return res.status(400).json({ error: 'Enter a valid PlayStation Online ID (3–16 letters, numbers, - or _).' });
  }
  if (!PSN_NPSSO) {
    return res.status(400).json({
      error: 'Server bio-challenge mode requires PSN_NPSSO. You can use Direct NPSSO verification below instead.',
    });
  }
  const { sid, session } = await ensureSession(req, res);
  const code = createPsnChallengeCode();
  session.psnChallenge = { onlineId, code, ts: Date.now() };
  await store.saveSession(sid, session);
  res.json({ onlineId, code });
});

app.post('/auth/psn/verify', async (req, res) => {
  const sid = getSid(req);
  const session = await getSession(req);
  if (!session?.psnChallenge) {
    return res.status(400).json({ error: 'Generate a verification code first.' });
  }
  if (Date.now() - session.psnChallenge.ts > 1800000) {
    session.psnChallenge = null;
    await store.saveSession(sid, session);
    return res.status(400).json({ error: 'Verification code expired. Please generate a new one.' });
  }
  try {
    const account = await verifyPsnBioChallenge(
      session.psnChallenge.onlineId,
      session.psnChallenge.code,
      PSN_NPSSO
    );
    session.accounts.ps = { ...account, lib: null };
    session.psnChallenge = null;
    await store.saveSession(sid, session);
    res.json({ ok: true, account: { name: account.name, avatar: account.avatar, platform: 'ps' } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/auth/psn/direct', async (req, res) => {
  const npsso = String(req.body?.npsso || '').trim();
  if (npsso.length < 32) {
    return res.status(400).json({ error: 'Paste the 64-character NPSSO value from ca.account.sony.com/api/v1/ssocookie.' });
  }
  try {
    const account = await verifyPsnDirectNpsso(npsso);
    const { sid, session } = await ensureSession(req, res);
    session.accounts.ps = { ...account, lib: null };
    await store.saveSession(sid, session);
    res.json({ ok: true, account: { name: account.name, avatar: account.avatar, platform: 'ps' } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- Unlink Single Platform / Full Logout ----
app.post('/auth/unlink/:platform', async (req, res) => {
  const plat = String(req.params.platform);
  const sid = getSid(req);
  const session = await getSession(req);
  if (!session || !PLATFORM_ORDER.includes(plat)) {
    return res.status(400).json({ error: 'Invalid platform.' });
  }
  session.accounts[plat] = null;
  await store.saveSession(sid, session);
  res.json({ ok: true });
});

app.get('/auth/logout', async (req, res) => {
  const sid = getSid(req);
  if (sid) await store.deleteSession(sid);
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  res.redirect('/');
});

// ============================================================================
// PER-PLATFORM LIBRARY FETCHING & STRICT SCORE ISOLATION
// ============================================================================
async function getLibraryForPlatform(session, platform) {
  const account = session?.accounts?.[platform];
  if (!account) {
    throw new Error(`Connect your ${platform === 'pc' ? 'Steam' : platform === 'ps' ? 'PlayStation' : 'Xbox'} account first.`);
  }
  if (platform === 'pc') return fetchSteamLibrary(account, STEAM_KEY);
  if (platform === 'xbox') return fetchXboxLibrary(account, OPENXBL_KEY);
  if (platform === 'ps') return fetchPsnLibrary(account, PSN_NPSSO);
  throw new Error('Unsupported platform.');
}

function findOwnedGameInLibrary(libItems, game, gameId) {
  const targetId = String(gameId);
  const pids = game?.platformIds || {};
  const targetKey = game ? game.canonicalKey || normalizeTitle(game.name) : '';

  return libItems.find((item) => {
    if (item.externalId && (item.externalId === targetId || item.externalId === String(pids[item.platform] || ''))) {
      return true;
    }
    if (item.platform === 'pc' && item.externalId === String(pids.steam || targetId)) {
      return true;
    }
    if (targetKey && item.canonicalKey && item.canonicalKey === targetKey) {
      return true;
    }
    return false;
  });
}

/**
 * STRICTLY ISOLATED PER-PLATFORM SCORING
 * Each platform (PC/Steam, PlayStation, Xbox) is calculated exclusively from
 * verified reviews submitted on THAT platform. Scores are NEVER mixed across platforms.
 * Weight per review: 1 + log10(1 + hours)
 */
function computeScores(gameId) {
  const id = String(gameId);
  return Object.fromEntries(
    PLATFORM_ORDER.map((plat) => {
      const list = db.reviews.filter((r) => String(r.gameId) === id && r.platform === plat);
      if (!list.length) return [plat, null];
      const weights = list.map((r) => (r.legacy ? 1 : 1 + Math.log10(1 + Math.max(0, Number(r.hours) || 0))));
      const sumW = weights.reduce((a, b) => a + b, 0);
      const weighted = Math.round(list.reduce((acc, r, i) => acc + r.score * weights[i], 0) / sumW);
      const timed = list.filter((r) => !r.legacy && (Number(r.hours) || 0) > 0);
      const avgHours = timed.length
        ? Math.round((timed.reduce((acc, r) => acc + (Number(r.hours) || 0), 0) / timed.length) * 10) / 10
        : 0;
      const legacyOnly = timed.length === 0 && list.every((r) => r.legacy);
      return [plat, { score: weighted, n: list.length, avgHours, legacyOnly }];
    })
  );
}

function detectSpike(gameId) {
  const id = String(gameId);
  const list = db.reviews.filter((r) => String(r.gameId) === id);
  if (list.length < 5) return false;
  const cutoff = Date.now() - 86400000;
  const recent = list.filter((r) => (r.ts || 0) >= cutoff).length;
  return recent >= 5 && recent / list.length >= 0.6;
}

function totalReviewsCount(sc, plat = 'all') {
  if (!sc) return 0;
  if (plat !== 'all') return sc[plat] ? sc[plat].n : 0;
  return Object.values(sc).reduce((acc, x) => acc + (x ? x.n : 0), 0);
}

/**
 * Returns a game's score for sorting/filtering WITHOUT ever blending scores
 * across platforms. When filtering a specific platform, uses that platform's
 * isolated score. When viewing "all", uses the highest individual platform score.
 */
function isolatedSortScore(sc, plat = 'all') {
  if (!sc) return -1;
  if (plat !== 'all') return sc[plat] ? sc[plat].score : -1;
  const vals = Object.values(sc)
    .filter(Boolean)
    .map((x) => x.score);
  return vals.length ? Math.max(...vals) : -1;
}

// ============================================================================
// UNIFIED CATALOG INGESTION, VALIDATION & COVER FALLBACK
// ============================================================================
const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
const HOSTS = ['cdn.akamai.steamstatic.com', 'cdn.cloudflare.steamstatic.com'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseDate(str) {
  const yearMatch = /\b(\d{4})\b/.exec(str || '');
  if (!yearMatch) return null;
  const lower = str.toLowerCase();
  const monthIdx = MONTHS.findIndex((m) => lower.includes(m));
  const dayMatch = /\b(\d{1,2})\b/.exec(str.replace(yearMatch[1], ''));
  const month = String(monthIdx < 0 ? 1 : monthIdx + 1).padStart(2, '0');
  const day = String(monthIdx < 0 || !dayMatch ? 1 : Number(dayMatch[1])).padStart(2, '0');
  return `${yearMatch[1]}-${month}-${day}`;
}

async function fetchJsonSafe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

const isValidGame = (g) =>
  Boolean(g && g.name && g.developer && g.cover && /^(19|20)\d\d-\d\d-\d\d$/.test(g.date || ''));

const isBadId = (id) => Boolean(db.bad[id] && Date.now() - db.bad[id] < 1209600000);

let APPS = [];
let TREND = {};
let queue = [];

async function fetchSteamDetails(id) {
  const payload = await fetchJsonSafe(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english&cc=us`);
  const entry = payload[id];
  if (!entry) throw new Error('transient');
  if (!entry.success || entry.data?.type !== 'game' || entry.data?.release_date?.coming_soon) {
    return null;
  }
  const d = entry.data;
  const descriptors = d.content_descriptors?.ids || [];
  if (descriptors.includes(3)) return null;
  return {
    name: d.name,
    date: parseDate(d.release_date?.date),
    developer: (d.developers || []).join(', '),
    publisher: (d.publishers || []).filter(Boolean).join(', '),
    hdr: d.header_image || '',
  };
}

async function checkImage(url) {
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-0' },
      signal: AbortSignal.timeout(8000),
    });
    const ok = res.ok && /^image\//.test(res.headers.get('content-type') || '');
    if (res.body) res.body.cancel().catch(() => {});
    return ok;
  } catch {
    return false;
  }
}

async function fetchSteamGridDB(steamId, gameName = '') {
  if (!SGDB_KEY) return [];
  const headers = { Authorization: 'Bearer ' + SGDB_KEY };
  try {
    if (steamId && /^\d+$/.test(String(steamId))) {
      const res = await fetch(`https://www.steamgriddb.com/api/v2/grids/steam/${steamId}?dimensions=600x900`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json();
        const urls = (json.data || []).slice(0, 2).map((x) => x.url).filter(Boolean);
        if (urls.length) return urls;
      }
    }
    // Name-based fallback for PlayStation & Xbox exclusives
    if (gameName) {
      const searchRes = await fetch(
        `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(gameName)}`,
        { headers, signal: AbortSignal.timeout(8000) }
      );
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        const sgdbGameId = searchJson.data?.[0]?.id;
        if (sgdbGameId) {
          const gridRes = await fetch(
            `https://www.steamgriddb.com/api/v2/grids/game/${sgdbGameId}?dimensions=600x900`,
            { headers, signal: AbortSignal.timeout(8000) }
          );
          if (gridRes.ok) {
            const gridJson = await gridRes.json();
            return (gridJson.data || []).slice(0, 2).map((x) => x.url).filter(Boolean);
          }
        }
      }
    }
  } catch {
    return [];
  }
  return [];
}

async function pickCover(id, hdr, name = '', steamId = '') {
  const sid = steamId || (/^\d+$/.test(String(id)) ? String(id) : '');
  const candidates = [
    ...(sid ? HOSTS.map((h) => `https://${h}/steam/apps/${sid}/library_600x900.jpg`) : []),
    ...(hdr ? [hdr] : []),
    ...(sid ? HOSTS.map((h) => `https://${h}/steam/apps/${sid}/header.jpg`) : []),
  ];
  for (const url of candidates) {
    if (await checkImage(url)) return url;
  }
  const sgdbUrls = await fetchSteamGridDB(sid, name);
  for (const url of sgdbUrls) {
    if (await checkImage(url)) return url;
  }
  return '';
}

async function ingestSteamGame(id) {
  const sid = String(id);
  const details = await fetchSteamDetails(sid);
  if (!details) {
    db.bad[sid] = Date.now();
    return null;
  }
  details.cover = await pickCover(sid, details.hdr, details.name, sid);
  details.checked = Date.now();
  if (!isValidGame(details)) {
    db.bad[sid] = Date.now();
    return null;
  }
  const g = upsertCanonicalGame(db, byId, {
    id: sid,
    platforms: ['pc'],
    platformIds: { steam: sid },
    trend: TREND[sid] || 0,
    ...details,
  });
  if (store.isPostgres) await store.upsertGame(g).catch(() => {});
  return g;
}

let ingestedCount = 0;
async function catalogWorker() {
  for (;;) {
    const id = queue.shift();
    if (!id) {
      await sleep(30000);
      continue;
    }
    if (isBadId(id) || (byId.has(id) && isValidGame(byId.get(id)))) continue;
    try {
      await ingestSteamGame(id);
      if (++ingestedCount % 50 === 0) save();
    } catch {
      queue.push(id);
      await sleep(30000);
    }
    await sleep(1700);
  }
}

/**
 * Continuous Cross-Generation Background Worker
 * Cycles round-robin across PS5, PS4, PS3, PS2, PS1, Xbox Series X|S, Xbox One,
 * Xbox 360, Original Xbox, and PC using Wikidata + Wikipedia, automatically
 * deduplicating every title into the unified catalog.
 */
async function generationWorker() {
  let bucketIdx = 0;
  await sleep(3500);
  for (;;) {
    const bucket = GENERATION_BUCKETS[bucketIdx % GENERATION_BUCKETS.length];
    bucketIdx++;
    const offset = Number(db.genOffsets[bucket.qid] || 0);
    try {
      const qids = await fetchGenerationQids(bucket.qid, offset, 35);
      if (!qids.length) {
        // Reached end of this generation; loop back gently later
        db.genOffsets[bucket.qid] = 0;
        await sleep(15000);
        continue;
      }
      const hydrated = await hydrateWikidataEntities(qids);
      let added = 0;
      for (const item of hydrated) {
        if (isValidGame(item)) {
          const before = db.games.length;
          upsertCanonicalGame(db, byId, item);
          if (db.games.length > before) added++;
        }
      }
      db.genOffsets[bucket.qid] = offset + qids.length;
      if (added > 0) save();
      console.log(`Gen sync [${bucket.label}]: +${added} unique games (offset ${db.genOffsets[bucket.qid]}, total ${db.games.filter(isValidGame).length})`);
    } catch (err) {
      await sleep(12000);
    }
    await sleep(4500);
  }
}

async function searchSteamStorePublic(term) {
  const res = await fetchJsonSafe(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=us`
  );
  const items = (res.items || []).filter((x) => x.type === 'app' && x.id).slice(0, 5);
  await Promise.all(
    items.map((x) => {
      const sid = String(x.id);
      if (isBadId(sid) || (byId.has(sid) && isValidGame(byId.get(sid)))) return null;
      return ingestSteamGame(sid).catch(() => {});
    })
  );
}

const searchCache = new Map();

async function refreshCatalog() {
  // 1. Steam trending & featured
  const charts = await fetchJsonSafe('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/');
  const ranks = charts.response?.ranks || [];
  if (ranks.length) {
    TREND = {};
    for (const row of ranks) {
      TREND[String(row.appid)] = row.peak_in_game || 0;
    }
    db.games.forEach((g) => {
      const sid = g.platformIds?.steam || g.id;
      if (TREND[String(sid)]) g.trend = TREND[String(sid)];
    });
  }

  const featured = await fetchJsonSafe('https://store.steampowered.com/api/featuredcategories?cc=us&l=english');
  const hot = ['new_releases', 'top_sellers'].flatMap((k) =>
    (featured[k]?.items || []).map((x) => String(x.id))
  );

  // 2. Steam full app list (when STEAM_API_KEY is configured)
  if (STEAM_KEY) {
    let lastAppId = 0;
    const apps = [];
    for (;;) {
      try {
        const res = await steamApi(
          `IStoreService/GetAppList/v1/?include_games=true&max_results=50000&last_appid=${lastAppId}`
        );
        const page = res.response || {};
        apps.push(
          ...(page.apps || [])
            .filter((a) => a.name)
            .map((a) => [String(a.appid), a.name, a.name.toLowerCase()])
        );
        if (!page.have_more_results) break;
        lastAppId = page.last_appid;
      } catch (err) {
        console.warn('GetAppList interrupted:', err.message);
        break;
      }
    }
    if (apps.length) APPS = apps;
  }

  // 3. IGDB multi-platform catalog sync (PC + PlayStation + Xbox, auto-deduplicated!)
  if (TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET) {
    try {
      let igdbAdded = 0;
      for (let offset = 0; offset < 300; offset += 100) {
        const batch = await fetchIgdbBatch(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, offset, 100);
        if (!batch.length) break;
        for (const item of batch) {
          if (isValidGame(item)) {
            upsertCanonicalGame(db, byId, item);
            igdbAdded++;
          }
        }
      }
      console.log(`IGDB multi-platform batch merged: ${igdbAdded} games processed.`);
    } catch (err) {
      console.warn('IGDB sync skipped:', err.message);
    }
  }

  // Re-run deduplication pass to guarantee zero duplicates
  ({ byId } = deduplicateCatalog(db));
  enrichMultiplatformCatalog(db, byId, upsertCanonicalGame);

  queue = [
    ...new Set([
      ...Object.keys(TREND),
      ...hot,
      ...db.games.filter((g) => !isValidGame(g) && /^\d+$/.test(g.id)).map((g) => String(g.id)),
      ...APPS.map((a) => a[0]).sort((a, b) => Number(b) - Number(a)),
    ]),
  ].filter((id) => !isBadId(id) && !(byId.has(id) && isValidGame(byId.get(id))));

  // Recheck 40 oldest covers
  const toRecheck = db.games
    .filter((x) => x.cover)
    .sort((a, b) => (a.checked || 0) - (b.checked || 0))
    .slice(0, 40);

  for (const g of toRecheck) {
    if (!(await checkImage(g.cover))) {
      const replacement = await pickCover(g.id, g.hdr, g.name, g.platformIds?.steam || '');
      if (replacement) g.cover = replacement;
    }
    g.checked = Date.now();
  }

  save();
  console.log(
    `Catalog synced: ${db.games.filter(isValidGame).length} unique games indexed, ${APPS.length} known on Steam, ${queue.length} queued`
  );
}

// ============================================================================
// PUBLIC API ENDPOINTS
// ============================================================================
const fixingCovers = new Set();
app.post('/api/broken/:id', async (req, res) => {
  const g = byId.get(String(req.params.id));
  if (g && !fixingCovers.has(g.id)) {
    fixingCovers.add(g.id);
    try {
      const cover = await pickCover(g.id, g.hdr, g.name, g.platformIds?.steam || '');
      if (cover) {
        g.cover = cover;
        save();
        store.upsertGame(g).catch(() => {});
      }
      g.checked = Date.now();
      return res.json({ cover });
    } finally {
      fixingCovers.delete(g.id);
    }
  }
  res.json({ cover: '' });
});

app.get('/api/me', async (req, res) => {
  const s = await getSession(req);
  const primary = primaryAccount(s);
  if (!primary) return res.json(null);

  const accounts = {};
  for (const p of PLATFORM_ORDER) {
    accounts[p] = s.accounts[p]
      ? { name: s.accounts[p].name, avatar: s.accounts[p].avatar, connected: true }
      : null;
  }
  res.json({
    name: primary.name,
    avatar: primary.avatar,
    primaryPlatform: primary.platform,
    accounts,
  });
});

app.get('/api/stats', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30');
  const validGames = db.games.filter(isValidGame);
  const reviewers = new Set(db.reviews.map((r) => `${r.platform}:${reviewOwnerId(r) || r.name}`));
  const totalHours = Math.round(db.reviews.reduce((sum, r) => sum + (Number(r.hours) || 0), 0));

  const reviewedGameIds = [...new Set(db.reviews.map((r) => String(r.gameId)))];
  const spotlight = reviewedGameIds
    .map((id) => {
      const g = byId.get(id);
      if (!g || !isValidGame(g)) return null;
      const sc = computeScores(id);
      const latest = db.reviews
        .filter((r) => String(r.gameId) === id && r.text && r.text.trim())
        .sort((a, b) => (b.hours || 0) - (a.hours || 0))[0];
      const highlightPlat = latest?.platform || PLATFORM_ORDER.find((p) => sc[p]) || 'pc';
      return {
        ...g,
        scores: sc,
        reviews: totalReviewsCount(sc, 'all'),
        highlightPlatform: highlightPlat,
        highlightPlatformScore: sc[highlightPlat] ? sc[highlightPlat].score : null,
        highlight: latest
          ? {
              name: latest.name,
              avatar: latest.avatar,
              hours: latest.hours,
              score: latest.score,
              platform: latest.platform,
              text: latest.text,
            }
          : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.reviews - a.reviews || isolatedSortScore(b.scores) - isolatedSortScore(a.scores))
    .slice(0, 4);

  res.json({
    indexed: validGames.length,
    known: APPS.length,
    totalReviews: db.reviews.length,
    verifiedReviewers: reviewers.size,
    totalVerifiedHours: totalHours,
    minHours: MIN_HOURS,
    donateUrl: DONATE_URL,
    providers: {
      pc: { configured: Boolean(STEAM_KEY), openIdReady: true },
      xbox: { configured: Boolean(XBOX_CLIENT_ID), bioChallengeReady: Boolean(OPENXBL_KEY) },
      ps: { bioChallengeReady: Boolean(PSN_NPSSO), directNpssoReady: true },
      igdb: Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET),
      sgdb: Boolean(SGDB_KEY),
    },
    spotlight,
  });
});

app.get('/api/games', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30');
  const Q = req.query;
  const searchTerm = String(Q.q || '').toLowerCase().trim();
  const plat = PLATFORM_ORDER.includes(Q.platform) ? Q.platform : 'all';
  const size = [30, 50, 100].includes(Number(Q.size)) ? Number(Q.size) : 30;
  const sortKey = String(Q.sort || 'trend');

  let all = db.games.filter(isValidGame);

  // On-demand cross-generation live search (Wikidata PS1-PS5 & Xbox-Series X|S + Steam Store + IGDB)
  const localMatches = searchTerm
    ? all.filter((g) => g.name.toLowerCase().includes(searchTerm))
    : all;
  const hasExactMatch = searchTerm
    ? localMatches.some((g) => normalizeTitle(g.name) === normalizeTitle(searchTerm))
    : true;

  if (searchTerm.length >= 3 && (!hasExactMatch || localMatches.length < 5)) {
    const cacheTs = searchCache.get(searchTerm) || 0;
    if (Date.now() - cacheTs > 600000) {
      searchCache.set(searchTerm, Date.now());
      const newlyDiscovered = [];
      const jobs = [
        searchWikidataGames(searchTerm, 10)
          .then((found) => {
            for (const item of found) {
              if (isValidGame(item)) {
                newlyDiscovered.push(upsertCanonicalGame(db, byId, item));
              }
            }
          })
          .catch(() => {}),
        searchSteamStorePublic(searchTerm).catch(() => {}),
      ];

      if (APPS.length) {
        const steamCandidates = APPS.filter(
          (a) => a[2].includes(searchTerm) && !isBadId(a[0]) && !(byId.has(a[0]) && isValidGame(byId.get(a[0])))
        ).slice(0, 4);
        jobs.push(
          ...steamCandidates.map((a) =>
            ingestSteamGame(a[0])
              .then((g) => {
                if (g) newlyDiscovered.push(g);
              })
              .catch(() => {})
          )
        );
      }

      if (TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET) {
        jobs.push(
          searchIgdb(searchTerm, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, 6)
            .then((found) => {
              for (const item of found) {
                if (isValidGame(item)) newlyDiscovered.push(upsertCanonicalGame(db, byId, item));
              }
            })
            .catch(() => {})
        );
      }

      await Promise.all(jobs);
      if (newlyDiscovered.length) {
        save();
        if (store.isPostgres) await store.upsertGamesBatch(newlyDiscovered).catch(() => {});
      }
      all = db.games.filter(isValidGame);
    }
  }

  const rated = new Map([...new Set(db.reviews.map((x) => String(x.gameId)))].map((id) => [id, computeScores(id)]));
  const scoreVal = (g) => isolatedSortScore(rated.get(String(g.id)), plat);
  const revCount = (g) => totalReviewsCount(rated.get(String(g.id)), plat);
  const matchesText = (field, needle) => !needle || String(field || '').toLowerCase().includes(needle.toLowerCase());
  const yearOf = (g) => String(g.date || '').slice(0, 4);

  const filtered = all.filter(
    (g) =>
      (plat === 'all' || (g.platforms || []).includes(plat)) &&
      matchesText(g.name, searchTerm) &&
      matchesText(g.developer, Q.dev) &&
      matchesText(g.publisher, Q.pub) &&
      (!Q.from || yearOf(g) >= String(Q.from)) &&
      (!Q.to || yearOf(g) <= String(Q.to)) &&
      (!Q.reviewed || revCount(g) > 0) &&
      (!Q.min || scoreVal(g) >= Number(Q.min))
  );

  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare;
  const comparators = {
    new: (a, b) =>
      String(b.date).localeCompare(String(a.date)) || (b.trend || 0) - (a.trend || 0) || revCount(b) - revCount(a),
    old: (a, b) => String(a.date).localeCompare(String(b.date)) || (b.trend || 0) - (a.trend || 0),
    trend: (a, b) =>
      (b.trend || 0) - (a.trend || 0) || revCount(b) - revCount(a) || String(b.date).localeCompare(String(a.date)),
    top: (a, b) => scoreVal(b) - scoreVal(a) || revCount(b) - revCount(a) || (b.trend || 0) - (a.trend || 0),
    most: (a, b) => revCount(b) - revCount(a) || scoreVal(b) - scoreVal(a) || (b.trend || 0) - (a.trend || 0),
    az: (a, b) => collator(a.name, b.name),
    za: (a, b) => collator(b.name, a.name),
  };

  filtered.sort(comparators[sortKey] || comparators.trend);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(Math.max(1, Number(Q.page) || 1), pages);

  const items = filtered.slice((page - 1) * size, page * size).map((g) => {
    const sc = rated.get(String(g.id)) || { pc: null, ps: null, xbox: null };
    return {
      ...g,
      scores: sc,
      reviews: totalReviewsCount(sc, 'all'),
      spike: detectSpike(g.id),
    };
  });

  res.json({
    total: filtered.length,
    page,
    pages,
    indexed: all.length,
    known: APPS.length,
    items,
  });
});

// Recent verified reviews feed across all platforms
app.get('/api/reviews', (req, res) => {
  const sort = String(req.query.sort || 'recent');
  const plat = PLATFORM_ORDER.includes(req.query.platform) ? req.query.platform : 'all';

  let list = db.reviews
    .filter((r) => plat === 'all' || r.platform === plat)
    .map(({ steamid, accountId, ...rest }) => {
      const game = byId.get(String(rest.gameId));
      return {
        ...rest,
        gameName: game?.name || `Game #${rest.gameId}`,
        gameCover: game?.cover || '',
        gameHdr: game?.hdr || '',
        gameYear: game?.date ? game.date.slice(0, 4) : '',
        gameDeveloper: game?.developer || '',
        gamePlatforms: game?.platforms || [rest.platform],
      };
    });

  if (sort === 'hours') {
    list.sort((a, b) => (b.hours || 0) - (a.hours || 0));
  } else if (sort === 'high') {
    list.sort((a, b) => b.score - a.score || (b.hours || 0) - (a.hours || 0));
  } else if (sort === 'low') {
    list.sort((a, b) => a.score - b.score || (b.hours || 0) - (a.hours || 0));
  } else {
    list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }

  res.json({ total: list.length, items: list.slice(0, 100) });
});

app.get('/api/reviews/:id', async (req, res) => {
  const id = String(req.params.id);
  const s = await getSession(req);
  const game = byId.get(id) || null;
  const sc = computeScores(id);
  const raw = db.reviews.filter((x) => String(x.gameId) === id).sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const myReviews = { pc: null, ps: null, xbox: null };
  if (s) {
    for (const p of PLATFORM_ORDER) {
      const acc = s.accounts[p];
      if (!acc) continue;
      const found = raw.find((x) => x.platform === p && reviewOwnerId(x) === String(acc.id));
      if (found) {
        myReviews[p] = { score: found.score, text: found.text || '', hours: found.hours };
      }
    }
  }

  const reviews = raw.map(({ steamid, accountId, ...safe }) => {
    const owner = String(accountId || steamid || '');
    const isMine = Boolean(s && s.accounts[safe.platform] && String(s.accounts[safe.platform].id) === owner);
    return { ...safe, isMine };
  });

  const legacy = Object.fromEntries(PLATFORM_ORDER.map((p) => [p, getLegacyStatus(game, p)]));

  res.json({
    game,
    scores: sc,
    reviews,
    legacy,
    stats: {
      totalReviews: reviews.length,
      spike: detectSpike(id),
    },
    myReviews,
  });
});

// Check eligibility for every platform on a specific game (strictly enforces platform release + legacy rules)
app.get('/api/eligibility/:id', async (req, res) => {
  const s = await getSession(req);
  if (!primaryAccount(s)) return res.status(401).json({ error: 'Sign in first.' });
  const gameId = String(req.params.id);
  const game = byId.get(gameId) || null;

  const result = {};
  for (const p of PLATFORM_ORDER) {
    const released = !game || (game.platforms || []).includes(p);
    const legacyStatus = getLegacyStatus(game, p);

    if (!released) {
      result[p] = {
        released: false,
        connected: Boolean(s.accounts[p]),
        legacy: false,
        owned: false,
        eligible: false,
        hours: 0,
        minHours: MIN_HOURS,
      };
      continue;
    }

    if (!s.accounts[p]) {
      result[p] = {
        released: true,
        connected: false,
        legacy: legacyStatus.legacy,
        legacyEra: legacyStatus.era,
        legacyReason: legacyStatus.reason,
        owned: false,
        eligible: false,
        hours: 0,
        minHours: MIN_HOURS,
      };
      continue;
    }

    if (legacyStatus.legacy) {
      result[p] = {
        released: true,
        connected: true,
        legacy: true,
        legacyEra: legacyStatus.era,
        legacyReason: legacyStatus.reason,
        owned: true,
        eligible: true,
        hours: 0,
        minHours: 0,
      };
      continue;
    }

    try {
      const lib = await getLibraryForPlatform(s, p);
      const own = findOwnedGameInLibrary(lib, game, gameId);
      if (own && p === 'xbox' && own.needsHoursLookup && own.externalId && OPENXBL_KEY) {
        own.hours = await fetchOpenXblTitleHours(own.externalId, OPENXBL_KEY);
        own.needsHoursLookup = false;
      }
      result[p] = own
        ? {
            released: true,
            connected: true,
            legacy: false,
            owned: true,
            eligible: own.hours >= MIN_HOURS,
            hours: own.hours,
            minHours: MIN_HOURS,
          }
        : {
            released: true,
            connected: true,
            legacy: false,
            owned: false,
            eligible: false,
            hours: 0,
            minHours: MIN_HOURS,
          };
    } catch (err) {
      result[p] = {
        released: true,
        connected: true,
        legacy: false,
        error: err.message,
        owned: false,
        eligible: false,
        hours: 0,
        minHours: MIN_HOURS,
      };
    }
  }
  res.json(result);
});

// Unified multi-platform user library
app.get('/api/library', async (req, res) => {
  const s = await getSession(req);
  if (!primaryAccount(s)) return res.status(401).json({ error: 'Sign in first.' });

  const requestedPlat = PLATFORM_ORDER.includes(req.query.platform) ? req.query.platform : null;
  const connected = PLATFORM_ORDER.filter((p) => Boolean(s.accounts[p]));
  const activePlat = requestedPlat && s.accounts[requestedPlat] ? requestedPlat : connected[0];

  try {
    const lib = await getLibraryForPlatform(s, activePlat);
    const acc = s.accounts[activePlat];

    const myReviewsMap = new Map(
      db.reviews
        .filter((r) => r.platform === activePlat && reviewOwnerId(r) === String(acc.id))
        .map((r) => [String(r.gameId), r])
    );

    const enriched = lib
      .map((item) => {
        // Match to existing canonical game so zero duplicates occur
        const matched =
          byId.get(item.externalId) ||
          db.games.find(
            (g) =>
              String(g.platformIds?.[activePlat] || '') === item.externalId ||
              (item.canonicalKey && (g.canonicalKey || normalizeTitle(g.name)) === item.canonicalKey)
          );
        const canonicalId = matched ? matched.id : item.externalId;
        const rev = myReviewsMap.get(String(canonicalId));
        return {
          id: canonicalId,
          externalId: item.externalId,
          platform: activePlat,
          name: matched?.name || item.name,
          hours: item.hours,
          eligible: item.hours >= MIN_HOURS,
          reviewed: Boolean(rev),
          myScore: rev ? rev.score : null,
          cover: matched?.cover || item.cover || '',
          date: matched?.date || item.releaseDate || null,
          developer: matched?.developer || item.developer || '',
          publisher: matched?.publisher || item.publisher || '',
          platforms: matched?.platforms || [activePlat],
        };
      })
      .sort((a, b) => b.hours - a.hours);

    res.json({
      minHours: MIN_HOURS,
      activePlatform: activePlat,
      connected,
      items: enriched,
    });
  } catch (err) {
    res.status(400).json({ error: err.message, activePlatform: activePlat, connected });
  }
});

// Submit or update a strictly platform-isolated verified review
app.post('/api/review', async (req, res) => {
  const s = await getSession(req);
  if (!primaryAccount(s)) return res.status(401).json({ error: 'Sign in with a gaming account first.' });

  const { gameId, platform = 'pc', text = '', score } = req.body || {};
  if (!PLATFORM_ORDER.includes(platform)) {
    return res.status(400).json({ error: 'Invalid platform. Must be Steam (pc), PlayStation (ps), or Xbox (xbox).' });
  }
  const account = s.accounts[platform];
  if (!account) {
    return res.status(401).json({
      error: `Connect your ${platform === 'pc' ? 'Steam' : platform === 'ps' ? 'PlayStation' : 'Xbox'} account to publish a review for this platform.`,
    });
  }

  const numericScore = Math.round(Number(score));
  if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
    return res.status(400).json({ error: 'Score must be an integer between 0 and 100.' });
  }

  try {
    let game = byId.get(String(gameId)) || null;
    const platLabel = platform === 'pc' ? 'Steam' : platform === 'ps' ? 'PlayStation' : 'Xbox';

    // 1. Strict platform release check: never allow rating a game on a platform it was not released on
    if (game && !(game.platforms || []).includes(platform)) {
      return res.status(403).json({
        error: `${game.name} was not released on ${platLabel}. You can only review games on platforms where they exist.`,
      });
    }

    // 2. Check whether this game qualifies as an unverifiable Legacy Classic on this platform
    const legacyStatus = getLegacyStatus(game, platform);
    let verifiedHours = 0;
    let isLegacyReview = false;

    if (legacyStatus.legacy && game) {
      isLegacyReview = true;
      verifiedHours = 0;
    } else {
      const lib = await getLibraryForPlatform(s, platform);
      const own = findOwnedGameInLibrary(lib, game, gameId);

      if (!own) {
        return res.status(403).json({ error: `This game was not found in your verified ${platLabel} library.` });
      }
      if (platform === 'xbox' && own.needsHoursLookup && own.externalId && OPENXBL_KEY) {
        own.hours = await fetchOpenXblTitleHours(own.externalId, OPENXBL_KEY);
        own.needsHoursLookup = false;
      }
      if (own.hours < MIN_HOURS) {
        return res.status(403).json({
          error: `You need at least ${MIN_HOURS}h of verified playtime on ${platLabel} to review. You currently have ${own.hours}h.`,
        });
      }
      verifiedHours = own.hours;

      // Ensure canonical game record exists and includes this verified platform (zero duplication)
      if (!game) {
        if (platform === 'pc' && /^\d+$/.test(own.externalId)) {
          game = await ingestSteamGame(own.externalId).catch(() => null);
        }
        if (!game) {
          const cover = own.cover || (await pickCover(own.externalId, '', own.name));
          game = upsertCanonicalGame(db, byId, {
            name: own.name,
            date: own.releaseDate || new Date().toISOString().slice(0, 10),
            platforms: [platform],
            platformIds: { [platform === 'pc' ? 'steam' : platform]: own.externalId },
            developer: own.developer || 'Verified Release',
            publisher: own.publisher || '',
            cover,
          });
        }
      } else {
        upsertCanonicalGame(db, byId, {
          id: game.id,
          name: game.name,
          platforms: [platform],
          platformIds: { [platform === 'pc' ? 'steam' : platform]: own.externalId },
        });
      }
    }

    const canonicalId = String(game.id);
    const ownerId = String(account.id);
    const existing = db.reviews.find(
      (x) => String(x.gameId) === canonicalId && x.platform === platform && reviewOwnerId(x) === ownerId
    );

    db.reviews = db.reviews.filter(
      (x) => !(String(x.gameId) === canonicalId && x.platform === platform && reviewOwnerId(x) === ownerId)
    );

    const newReview = {
      gameId: canonicalId,
      platform,
      accountId: ownerId,
      ...(platform === 'pc' ? { steamid: ownerId } : {}),
      name: account.name,
      avatar: account.avatar,
      score: numericScore,
      text: String(text).trim().slice(0, 2000),
      hours: verifiedHours,
      ...(isLegacyReview ? { legacy: true, legacyEra: legacyStatus.era } : {}),
      ts: Date.now(),
      edited: Boolean(existing),
    };
    db.reviews.push(newReview);

    save();
    if (store.isPostgres) {
      await store.upsertGame(game);
      await store.upsertReview(newReview);
    }
    res.json({ ok: true, edited: Boolean(existing), legacy: isLegacyReview, gameId: canonicalId, platform });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/review/:id', async (req, res) => {
  const s = await getSession(req);
  if (!primaryAccount(s)) return res.status(401).json({ error: 'Sign in first.' });
  const targetId = String(req.params.id);
  const plat = PLATFORM_ORDER.includes(req.query.platform) ? req.query.platform : 'pc';
  const account = s.accounts[plat];
  if (!account) return res.status(401).json({ error: 'Platform account not connected.' });

  const ownerId = String(account.id);
  const before = db.reviews.length;
  db.reviews = db.reviews.filter(
    (x) => !(String(x.gameId) === targetId && x.platform === plat && reviewOwnerId(x) === ownerId)
  );
  if (db.reviews.length === before) {
    return res.status(404).json({ error: 'Review not found.' });
  }
  save();
  if (store.isPostgres) {
    await store.deleteReview(targetId, plat, ownerId);
  }
  res.json({ ok: true });
});

async function shutdown(signal) {
  console.log(`Received ${signal}, flushing cleanly...`);
  try {
    save();
    await store.close();
  } catch (err) {
    console.error('Error during shutdown:', err.message);
  }
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function startServer() {
  const info = await store.init(db);
  const deduped = deduplicateCatalog(db);
  byId = deduped.byId;
  const enrichedCount = enrichMultiplatformCatalog(db, byId, upsertCanonicalGame);
  if (deduped.mergedCount > 0 || enrichedCount > 0) {
    console.log(
      `Catalog normalized: ${deduped.mergedCount} duplicate(s) merged, ${enrichedCount} multi-platform record(s) enriched.`
    );
  }

  app.listen(PORT, () => {
    console.log(
      `Playtested running at ${BASE} [storage=${info.mode}, games=${db.games.length}, reviews=${db.reviews.length}]` +
        (IS_CLOUD_HOST ? ' [Cloud managed mode]' : '')
    );
    if (!NO_SYNC && !IS_CLOUD_HOST) {
      const go = () => refreshCatalog().catch((e) => console.log('Refresh skipped:', e.message));
      go();
      setInterval(go, 21600000);
      catalogWorker();
      generationWorker();
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start Playtested:', err);
  process.exit(1);
});
