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
  baseTitleKey,
  upsertCanonicalGame,
  deduplicateCatalog,
} = require('./lib/dedupe');
const { getLegacyStatus } = require('./lib/legacy');
const {
  getCachedEffectiveMinHours,
  resolveEffectiveMinHours,
} = require('./lib/hltb');

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
  fetchPsnOwnProfile,
  fetchPsnLibrary,
} = require('./lib/platforms');

const { fetchIgdbBatch, searchIgdb } = require('./lib/igdb');
const { enrichMultiplatformCatalog } = require('./lib/multiplatform-seed');
const {
  GENERATION_BUCKETS,
  searchWikidataGames,
  hydrateWikidataEntities,
  fetchGenerationQids,
  fetchWikipediaCovers,
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
const DAILY_INDEX_LIMIT = Number(process.env.DAILY_INDEX_LIMIT) || 1000;
const NO_SYNC = process.env.NO_SYNC === '1';

const DB_FILE = path.join(__dirname, 'db.json');
const store = new PlaytestedStore({ dbFile: DB_FILE, databaseUrl: DATABASE_URL });
const db = {
  games: [],
  reviews: [],
  bad: {},
  genOffsets: {},
  marketing: {},
  indexState: null,
  hltbCache: {},
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
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`);
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

async function syncAccountProfileToReviews(platform, account) {
  if (!account || !account.id) return;
  const ownerId = String(account.id);
  const hasRealName = Boolean(account.name && account.name !== 'PlayStation Player');
  const nextAvatar = account.avatar || '';
  if (!hasRealName && !nextAvatar) return;

  const updated = [];
  for (const r of db.reviews) {
    if (r.platform !== platform || reviewOwnerId(r) !== ownerId) continue;
    let changed = false;
    if (hasRealName && r.name !== account.name) {
      r.name = account.name;
      changed = true;
    }
    if (nextAvatar && r.avatar !== nextAvatar) {
      r.avatar = nextAvatar;
      changed = true;
    }
    if (changed) updated.push(r);
  }

  if (updated.length) {
    save();
    if (store.isPostgres) {
      for (const r of updated) {
        await store.upsertReview(r).catch(() => {});
      }
    }
  }
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

// Standard HTTP security headers (clickjacking, MIME sniffing, referrer, CSP, HSTS)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  if (BASE.startsWith('https://') || req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

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
app.use(['/auth', '/api/me', '/api/library', '/api/eligibility', '/api/review', '/api/marketing'], (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

// Privacy-first, zero-cookie aggregate UTM attribution (visits -> connects -> reviews)
const ALLOWED_UTM_EVENTS = new Set(['visit', 'connect', 'review']);
function cleanUtmTag(val, fallback) {
  const s = String(val || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || fallback;
}

app.post('/api/marketing/event', async (req, res) => {
  const { event, source, campaign, platform } = req.body || {};
  if (!ALLOWED_UTM_EVENTS.has(event)) {
    return res.status(400).json({ error: 'Invalid event.' });
  }
  const src = cleanUtmTag(source, 'direct');
  const cmp = cleanUtmTag(campaign, 'organic');
  const key = `${src}/${cmp}`;
  const existingKeys = Object.keys(db.marketing || {});
  if (!db.marketing[key] && existingKeys.length >= 250) {
    return res.json({ ok: true, capped: true });
  }
  if (!db.marketing[key]) {
    db.marketing[key] = {
      source: src,
      campaign: cmp,
      visits: 0,
      connects: 0,
      reviews: 0,
      platforms: { pc: 0, ps: 0, xbox: 0 },
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };
  }
  const bucket = db.marketing[key];
  if (event === 'visit') bucket.visits += 1;
  if (event === 'connect') {
    bucket.connects += 1;
    if (PLATFORM_ORDER.includes(platform)) {
      bucket.platforms = bucket.platforms || { pc: 0, ps: 0, xbox: 0 };
      bucket.platforms[platform] = (bucket.platforms[platform] || 0) + 1;
    }
  }
  if (event === 'review') bucket.reviews += 1;
  bucket.lastSeen = Date.now();

  save();
  if (store.isPostgres) {
    store.setKv('marketing', db.marketing).catch(() => {});
  }
  res.json({ ok: true });
});

app.get('/api/marketing/report', (_req, res) => {
  const campaigns = Object.values(db.marketing || {})
    .map((b) => ({
      ...b,
      connectRatePct: b.visits ? Math.round((b.connects / b.visits) * 1000) / 10 : 0,
      reviewRatePct: b.visits ? Math.round((b.reviews / b.visits) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.visits - a.visits || b.reviews - a.reviews);

  const totals = campaigns.reduce(
    (acc, c) => {
      acc.visits += c.visits || 0;
      acc.connects += c.connects || 0;
      acc.reviews += c.reviews || 0;
      return acc;
    },
    { visits: 0, connects: 0, reviews: 0 }
  );

  res.json({
    updatedAt: new Date().toISOString(),
    totals,
    siteTotals: {
      games: db.games.length,
      reviews: db.reviews.length,
    },
    campaigns,
  });
});

// XML sitemap for search engines
app.get('/sitemap.xml', (_req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const lastmod = new Date().toISOString().slice(0, 10);
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url>\n` +
      `    <loc>${BASE}/</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>daily</changefreq>\n` +
      `    <priority>1.0</priority>\n` +
      `  </url>\n` +
      `</urlset>\n`
  );
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

// Public read-only status of the daily catalog indexer
app.get('/api/index/status', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const st = ensureIndexState();
  const bucketsDone = Object.values(st.wikidataDoneBuckets || {}).filter(Boolean).length;
  res.json({
    indexed: db.games.filter(isValidGame).length,
    totalInDb: db.games.length,
    mode: st.mode,
    date: st.date,
    addedToday: st.addedToday,
    dailyLimit: DAILY_INDEX_LIMIT,
    remainingToday: Math.max(0, DAILY_INDEX_LIMIT - st.addedToday),
    wikidataBucketsDone: `${bucketsDone}/${GENERATION_BUCKETS.length}`,
    steamCursor: st.steamCursor,
    steamKnownTotal: APPS.length,
    steamDone: Boolean(st.steamDone),
    running: dailyIndexRunning,
    lastRunAt: st.lastRunAt ? new Date(st.lastRunAt).toISOString() : null,
    totalAddedEver: st.totalAddedEver || 0,
  });
});

// Optional Cloud Scheduler / Cron endpoint to trigger a bounded daily indexing batch
app.post('/api/cron/sync', async (req, res) => {
  if (!CRON_SECRET || req.headers['x-cron-secret'] !== CRON_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const requestedMax = Math.min(Math.max(10, Number(req.query.limit || req.body?.limit || 200)), DAILY_INDEX_LIMIT);
    const summary = await runDailyIndexBatch(requestedMax);
    res.json({ ok: true, ...summary, total: db.games.length });
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
    await syncAccountProfileToReviews('pc', account);
    warmLibraryCache(sid, session, 'pc');
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
  // Prune stale OAuth states older than 15 minutes
  const cutoff = Date.now() - 900000;
  for (const [k, v] of oauthStates) {
    if (v.ts < cutoff) oauthStates.delete(k);
  }
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
    await syncAccountProfileToReviews('xbox', account);
    warmLibraryCache(sid, session, 'xbox');
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
    await syncAccountProfileToReviews('xbox', account);
    warmLibraryCache(sid, session, 'xbox');
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
    await syncAccountProfileToReviews('ps', account);
    warmLibraryCache(sid, session, 'ps');
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
    await syncAccountProfileToReviews('ps', account);
    warmLibraryCache(sid, session, 'ps');
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
async function getLibraryForPlatform(session, platform, { sid = '', forceRefresh = false } = {}) {
  const account = session?.accounts?.[platform];
  if (!account) {
    throw new Error(`Connect your ${platform === 'pc' ? 'Steam' : platform === 'ps' ? 'PlayStation' : 'Xbox'} account first.`);
  }
  const prevSyncedAt = account.lib?.t || 0;
  let items;
  if (platform === 'pc') items = await fetchSteamLibrary(account, STEAM_KEY, { forceRefresh });
  else if (platform === 'xbox') items = await fetchXboxLibrary(account, OPENXBL_KEY, { forceRefresh });
  else if (platform === 'ps') items = await fetchPsnLibrary(account, PSN_NPSSO, { forceRefresh });
  else throw new Error('Unsupported platform.');

  // Persist freshly synced compact library snapshot to session store without blocking the response
  if (sid && account.lib?.t && account.lib.t !== prevSyncedAt) {
    store.saveSession(sid, session).catch(() => {});
  }
  return items;
}

function warmLibraryCache(sid, session, platform) {
  if (!sid || !session?.accounts?.[platform]) return;
  getLibraryForPlatform(session, platform, { sid }).catch(() => {});
}

function findOwnedGameInLibrary(libItems, game, gameId) {
  const targetId = String(gameId || '');
  const strippedTargetId = targetId.replace(/^(?:ps|xbox|steam)-/i, '');
  const pids = game?.platformIds || {};
  const steamAlts = new Set(
    [pids.steam, ...(Array.isArray(pids.steamAlts) ? pids.steamAlts : []), targetId].filter(Boolean).map(String)
  );
  const targetKey = game ? game.canonicalKey || normalizeTitle(game.name) : '';
  const targetBaseKey = game ? baseTitleKey(game.name) : '';

  const matches = libItems.filter((item) => {
    const ids = new Set(
      [item.externalId, ...(Array.isArray(item.externalIds) ? item.externalIds : [])]
        .filter(Boolean)
        .map(String)
    );
    const platPid = String(pids[item.platform] || '');
    if (
      (targetId && ids.has(targetId)) ||
      (strippedTargetId && ids.has(strippedTargetId)) ||
      (platPid && ids.has(platPid))
    ) {
      return true;
    }
    if (item.platform === 'pc') {
      for (const sid of steamAlts) {
        if (ids.has(sid)) return true;
      }
    }
    if (targetKey && item.canonicalKey && item.canonicalKey === targetKey) {
      return true;
    }
    if (targetBaseKey && item.name && baseTitleKey(item.name) === targetBaseKey) {
      return true;
    }
    return false;
  });

  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];

  // Combine multi-version ownership (e.g. PS4 + PS5 or Xbox One + Series X|S)
  // without ever double-counting the same externalId.
  const seenIds = new Set();
  const allExternalIds = [];
  let totalHours = 0;
  let best = matches[0];
  let needsLookup = false;

  for (const m of matches) {
    const mIds = [m.externalId, ...(Array.isArray(m.externalIds) ? m.externalIds : [])].filter(Boolean).map(String);
    const isDuplicate = mIds.length > 0 && mIds.every((id) => seenIds.has(id));
    for (const id of mIds) {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allExternalIds.push(id);
      }
    }
    if (!isDuplicate) {
      totalHours += Number(m.hours) || 0;
    }
    if ((Number(m.hours) || 0) > (Number(best.hours) || 0)) {
      best = m;
    }
    if (m.needsHoursLookup) needsLookup = true;
  }

  return {
    ...best,
    externalIds: allExternalIds,
    hours: Math.round(totalHours * 10) / 10,
    needsHoursLookup: needsLookup,
  };
}

/**
 * STRICTLY ISOLATED EQUAL-WEIGHT PER-PLATFORM SCORING
 * Each platform (PC/Steam, PlayStation, Xbox) is calculated exclusively from
 * verified reviews submitted on THAT platform. Scores are NEVER mixed across platforms.
 * Every verified owner counts equally (1:1 arithmetic mean) — playtime is displayed
 * alongside every review for context, never used to weight or skew scores.
 */
function computeScores(gameId) {
  const id = String(gameId);
  return Object.fromEntries(
    PLATFORM_ORDER.map((plat) => {
      const list = db.reviews.filter((r) => String(r.gameId) === id && r.platform === plat);
      if (!list.length) return [plat, null];
      const equalMean = Math.round(list.reduce((acc, r) => acc + r.score, 0) / list.length);
      const timed = list
        .filter((r) => !r.legacy && (Number(r.hours) || 0) > 0)
        .map((r) => Number(r.hours) || 0)
        .sort((a, b) => a - b);
      const avgHours = timed.length
        ? Math.round((timed.reduce((a, b) => a + b, 0) / timed.length) * 10) / 10
        : 0;
      const midIdx = Math.floor(timed.length / 2);
      const medianHours = timed.length
        ? Math.round(
            (timed.length % 2 ? timed[midIdx] : (timed[midIdx - 1] + timed[midIdx]) / 2) * 10
          ) / 10
        : 0;
      const dist = {
        hi: list.filter((r) => r.score >= 75).length,
        mid: list.filter((r) => r.score >= 50 && r.score < 75).length,
        lo: list.filter((r) => r.score < 50).length,
      };
      const legacyOnly = timed.length === 0 && list.every((r) => r.legacy);
      return [plat, { score: equalMean, n: list.length, avgHours, medianHours, dist, legacyOnly }];
    })
  );
}

/**
 * Evaluates whether a verified owner meets the playtime gate for a game:
 * - Standard games: >= MIN_HOURS (2h)
 * - Short games (< 2h to beat on HowLongToBeat): silently requires 20% of the
 *   HLTB main-story completion time (min 0.1h so 0h unplayed accounts stay blocked)
 */
async function evaluateOwnershipEligibility(_account, _platform, game, own) {
  const refGame = game || { name: own.name, canonicalKey: own.canonicalKey };
  const hours = Number(own.hours) || 0;

  if (hours >= MIN_HOURS) {
    return {
      eligible: true,
      hours,
      minHours: MIN_HOURS,
    };
  }

  if (hours > 0) {
    db.hltbCache = db.hltbCache || {};
    const { minHours } = await resolveEffectiveMinHours(refGame, db.hltbCache, {
      defaultMinHours: MIN_HOURS,
      onPersist: (nextCache) => {
        save();
        if (store.isPostgres) store.setKv('hltbCache', nextCache).catch(() => {});
      },
    });
    return {
      eligible: hours >= minHours,
      hours,
      minHours,
    };
  }

  const cachedMin = getCachedEffectiveMinHours(refGame, db.hltbCache, MIN_HOURS);
  return {
    eligible: false,
    hours: 0,
    minHours: cachedMin,
  };
}

function classifyAveragePlaytime(avgHours) {
  if (!Number.isFinite(avgHours) || avgHours <= 0) return null;
  if (avgHours <= 80) return 'low';
  if (avgHours <= 200) return 'medium';
  if (avgHours <= 1500) return 'high';
  return 'second_job';
}

function buildAveragePlaytimeMap() {
  const sums = new Map();
  for (const r of db.reviews) {
    if (r.legacy) continue;
    const h = Number(r.hours) || 0;
    if (h <= 0) continue;
    const id = String(r.gameId);
    const cur = sums.get(id) || { sum: 0, n: 0 };
    cur.sum += h;
    cur.n += 1;
    sums.set(id, cur);
  }
  const out = new Map();
  for (const [id, { sum, n }] of sums) {
    const avgPlaytime = Math.round((sum / n) * 10) / 10;
    out.set(id, { avgPlaytime, playtimeTier: classifyAveragePlaytime(avgPlaytime) });
  }
  return out;
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

const todayIso = () => new Date().toISOString().slice(0, 10);
const isIsoDate = (d) => /^(19|20)\d\d-\d\d-\d\d$/.test(String(d || ''));

const isValidGame = (g) => {
  if (!g || !g.name || !g.developer || !g.cover) return false;
  if (isIsoDate(g.date)) return g.date <= todayIso();
  // Allow games with verified reviews to stay visible even when original release date is unknown
  return db.reviews.some((r) => String(r.gameId) === String(g.id));
};

// Verified original launch metadata fallback for iconic console/F2P titles not on Steam
const KNOWN_TITLE_METADATA = {
  fortnite: {
    name: 'Fortnite',
    date: '2017-07-21',
    developer: 'Epic Games',
    publisher: 'Epic Games',
    platforms: ['pc', 'ps', 'xbox'],
  },
  roblox: {
    name: 'Roblox',
    date: '2006-09-01',
    developer: 'Roblox Corporation',
    publisher: 'Roblox Corporation',
    platforms: ['pc', 'ps', 'xbox'],
  },
  'injustice 2': {
    name: 'Injustice 2',
    date: '2017-05-16',
    developer: 'NetherRealm Studios',
    publisher: 'Warner Bros. Interactive Entertainment',
    platforms: ['pc', 'ps', 'xbox'],
  },
  'crash bandicoot n sane trilogy': {
    name: 'Crash Bandicoot N. Sane Trilogy',
    date: '2017-06-30',
    developer: 'Vicarious Visions',
    publisher: 'Activision',
    platforms: ['pc', 'ps', 'xbox'],
  },
  'marvels spider man': {
    name: "Marvel's Spider-Man",
    date: '2018-09-07',
    developer: 'Insomniac Games',
    publisher: 'Sony Interactive Entertainment',
    platforms: ['pc', 'ps'],
  },
  'gang beasts': {
    name: 'Gang Beasts',
    date: '2014-08-29',
    developer: 'Boneloaf',
    publisher: 'Boneloaf',
    platforms: ['pc', 'ps', 'xbox'],
  },
  'ea sports fc 27': {
    date: '2026-09-24',
    developer: 'EA Canada, EA Romania',
    publisher: 'Electronic Arts',
  },
  'grand theft auto vi': {
    date: '2026-11-19',
    developer: 'Rockstar Games',
    publisher: 'Rockstar Games',
  },
};

function cleanDisplayTitle(rawName) {
  return String(rawName || '')
    .replace(/\s*[-–—:|]\s*(?:xbox|playstation|ps4\s*[&/]\s*ps5|ps5|ps4|pc)\s*$/i, '')
    .trim();
}

async function resolveRealMetadataForTitle(rawName, platform = '') {
  const cleanName = cleanDisplayTitle(rawName);
  const key = normalizeTitle(cleanName);
  const known = KNOWN_TITLE_METADATA[key] || null;
  if (known && known.date) {
    return {
      name: known.name || cleanName,
      date: known.date,
      developer: known.developer || '',
      publisher: known.publisher || '',
      platforms: known.platforms || (platform ? [platform] : ['pc']),
    };
  }

  // 1. Try Wikidata for exact cross-platform original release date & developer
  try {
    const wdResults = await searchWikidataGames(cleanName, 6);
    const wdMatch = wdResults.find((x) => normalizeTitle(x.name) === key && isIsoDate(x.date));
    if (wdMatch) {
      return {
        name: wdMatch.name || cleanName,
        date: wdMatch.date,
        developer: wdMatch.developer || '',
        publisher: wdMatch.publisher || '',
        platforms: wdMatch.platforms || (platform ? [platform] : ['pc']),
        generations: wdMatch.generations || [],
        platformIds: wdMatch.platformIds || {},
        cover: wdMatch.cover || '',
        hdr: wdMatch.hdr || '',
      };
    }
  } catch {
    // Fall through to Steam Store lookup
  }

  // 2. Try Steam Store public search for exact release date & developer
  try {
    const payload = await fetchJsonSafe(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanName)}&l=english&cc=us`
    );
    const items = payload.items || [];
    const hit = items.find((it) => normalizeTitle(it.name) === key);
    if (hit && hit.id) {
      const det = await fetchSteamDetails(String(hit.id)).catch(() => null);
      if (det && isIsoDate(det.date)) {
        return {
          name: det.name || cleanName,
          date: det.date,
          developer: det.developer || '',
          publisher: det.publisher || '',
          platforms: [...new Set(['pc', ...(platform ? [platform] : [])])],
          platformIds: { steam: String(hit.id) },
          hdr: det.hdr || '',
        };
      }
    }
  } catch {
    // No external date found — never fabricate today's date
  }

  return { name: cleanName, date: '', developer: '', publisher: '' };
}

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
  return {
    name: d.name,
    date: parseDate(d.release_date?.date),
    developer: (d.developers || []).join(', ') || (d.publishers || []).filter(Boolean).join(', ') || 'Steam Release',
    publisher: (d.publishers || []).filter(Boolean).join(', '),
    hdr: d.header_image || '',
  };
}

// Reject 404s AND Valve's 1,655-byte blank placeholder library_600x900.jpg responses
const MIN_VALID_COVER_BYTES = 3500;

async function checkImage(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-0' },
      signal: AbortSignal.timeout(8000),
    });
    const ct = res.headers.get('content-type') || '';
    const cr = res.headers.get('content-range') || '';
    const cl = Number(res.headers.get('content-length') || 0);
    const totalMatch = /\/(\d+)$/.exec(cr);
    const totalBytes = totalMatch ? Number(totalMatch[1]) : cl;
    if (res.body) res.body.cancel().catch(() => {});
    if (!res.ok || !/^image\//.test(ct)) return false;
    if (totalBytes > 0 && totalBytes < MIN_VALID_COVER_BYTES) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches official hashed vertical Steam covers (library_capsule_2x / library_capsule)
 * in batch (up to 80 AppIDs per request) via Valve's free zero-key IStoreBrowseService.
 * Solves Valve's post-2024 content-hashed asset URLs where legacy library_600x900.jpg
 * returns a 1,655-byte blank placeholder JPEG (e.g. Battlefield 6).
 */
async function fetchSteamBrowseCoversBatch(appIds) {
  const clean = [...new Set((appIds || []).map(String).filter((x) => /^\d+$/.test(x)))];
  const map = new Map();
  if (!clean.length) return map;

  for (let i = 0; i < clean.length; i += 80) {
    const chunk = clean.slice(i, i + 80);
    try {
      const inputJson = JSON.stringify({
        ids: chunk.map((id) => ({ appid: Number(id) })),
        context: { language: 'english', country_code: 'US' },
        data_request: { include_assets: true },
      });
      const data = await fetchJsonSafe(
        `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(inputJson)}`
      );
      for (const item of data.response?.store_items || []) {
        const aid = String(item.appid || '');
        if (!aid || aid === '0') continue;
        const a = item.assets || {};
        const fmt = String(a.asset_url_format || '');
        const file = a.library_capsule_2x || a.library_capsule || '';
        if (fmt && file) {
          const url = 'https://shared.akamai.steamstatic.com/store_item_assets/' + fmt.replace('${FILENAME}', file);
          map.set(aid, url);
        }
      }
    } catch {
      // Ignore batch error gracefully
    }
  }
  return map;
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
    // Name-based fallback for PlayStation/Xbox exclusives or stale Wikidata Steam IDs
    const cleanName = cleanDisplayTitle(gameName).replace(/[™®©]/g, '').trim();
    if (cleanName) {
      const searchRes = await fetch(
        `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(cleanName)}`,
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
  const candidates = [];

  // 1. Official hashed vertical Steam cover (IStoreBrowseService)
  if (sid) {
    const browseMap = await fetchSteamBrowseCoversBatch([sid]).catch(() => new Map());
    const hashed = browseMap.get(sid);
    if (hashed) candidates.push(hashed);
    candidates.push(...HOSTS.map((h) => `https://${h}/steam/apps/${sid}/library_600x900.jpg`));
  }

  for (const url of candidates) {
    if (await checkImage(url)) return url;
  }

  // 2. SteamGridDB 600x900 portrait cover (by Steam ID or cleaned game name)
  const sgdbUrls = await fetchSteamGridDB(sid, name);
  for (const url of sgdbUrls) {
    if (await checkImage(url)) return url;
  }

  // 3. Wikipedia box art fallback
  const cleanName = cleanDisplayTitle(name).replace(/[™®©]/g, '').trim();
  if (cleanName) {
    try {
      const wikiMap = await fetchWikipediaCovers([cleanName, `${cleanName} (video game)`]);
      for (const wUrl of wikiMap.values()) {
        if (await checkImage(wUrl)) return wUrl;
      }
    } catch {}
  }

  // 4. Last-resort landscape Steam header
  const lastResort = [
    ...(hdr ? [hdr] : []),
    ...(sid ? HOSTS.map((h) => `https://${h}/steam/apps/${sid}/header.jpg`) : []),
  ];
  for (const url of lastResort) {
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
  const items = (res.items || []).filter((x) => x.type === 'app' && x.id).slice(0, 8);
  const found = [];
  await Promise.all(
    items.map(async (x) => {
      const sid = String(x.id);
      if (byId.has(sid) && isValidGame(byId.get(sid))) return;
      // Clear stale bad-id entry on explicit user search so previously filtered games load
      delete db.bad[sid];
      const g = await ingestSteamGame(sid).catch(() => null);
      if (g) found.push(g);
    })
  );
  return found;
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
  const sid = getSid(req);
  const s = sid ? await store.getSession(sid) : null;
  const primary = primaryAccount(s);
  if (!primary) return res.json(null);

  // Auto-upgrade any existing PSN session that previously fell back to "PlayStation Player"
  const psAcc = s.accounts.ps;
  if (
    psAcc &&
    (psAcc.name === 'PlayStation Player' || !psAcc.avatar) &&
    psAcc.accessToken &&
    Date.now() < (psAcc.expiresAt || 0)
  ) {
    try {
      const refreshed = await fetchPsnOwnProfile(psAcc.accessToken, psAcc.id);
      if (refreshed.name !== 'PlayStation Player' || refreshed.avatar) {
        if (refreshed.accountId && refreshed.accountId !== 'me') psAcc.id = String(refreshed.accountId);
        if (refreshed.name !== 'PlayStation Player') psAcc.name = refreshed.name;
        if (refreshed.avatar) psAcc.avatar = refreshed.avatar;
        await store.saveSession(sid, s);
        await syncAccountProfileToReviews('ps', psAcc);
      }
    } catch {
      // Keep existing session profile if PSN refresh fails
    }
  }

  const freshPrimary = primaryAccount(s);
  const accounts = {};
  for (const p of PLATFORM_ORDER) {
    accounts[p] = s.accounts[p]
      ? { name: s.accounts[p].name, avatar: s.accounts[p].avatar, connected: true }
      : null;
  }
  res.json({
    name: freshPrimary.name,
    avatar: freshPrimary.avatar,
    primaryPlatform: freshPrimary.platform,
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
  const normSearch = normalizeTitle(searchTerm);
  const titleMatches = (name) => {
    if (!searchTerm) return true;
    const raw = String(name || '').toLowerCase();
    if (raw.includes(searchTerm)) return true;
    return Boolean(normSearch && normalizeTitle(name).includes(normSearch));
  };
  const localMatches = searchTerm ? all.filter((g) => titleMatches(g.name)) : all;
  const hasExactMatch = searchTerm
    ? localMatches.some((g) => normalizeTitle(g.name) === normSearch)
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
        searchSteamStorePublic(searchTerm)
          .then((found) => {
            for (const item of found || []) newlyDiscovered.push(item);
          })
          .catch(() => {}),
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
  const playtimeMap = buildAveragePlaytimeMap();
  const rawPlaytime = String(Q.playtime || '').toLowerCase().trim();
  const playtimeFilter = ['low', 'medium', 'high', 'second_job'].includes(rawPlaytime) ? rawPlaytime : '';
  const scoreVal = (g) => isolatedSortScore(rated.get(String(g.id)), plat);
  const revCount = (g) => totalReviewsCount(rated.get(String(g.id)), plat);
  const matchesText = (field, needle) => !needle || String(field || '').toLowerCase().includes(needle.toLowerCase());
  const yearOf = (g) => String(g.date || '').slice(0, 4);

  const filtered = all.filter(
    (g) =>
      (plat === 'all' || (g.platforms || []).includes(plat)) &&
      titleMatches(g.name) &&
      matchesText(g.developer, Q.dev) &&
      matchesText(g.publisher, Q.pub) &&
      (!Q.from || yearOf(g) >= String(Q.from)) &&
      (!Q.to || yearOf(g) <= String(Q.to)) &&
      (!Q.reviewed || revCount(g) > 0) &&
      (!Q.min || scoreVal(g) >= Number(Q.min)) &&
      (!playtimeFilter || playtimeMap.get(String(g.id))?.playtimeTier === playtimeFilter)
  );

  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare;
  const sortDateDesc = (g) => (isIsoDate(g.date) ? g.date : '0000-00-00');
  const sortDateAsc = (g) => (isIsoDate(g.date) ? g.date : '9999-99-99');
  const comparators = {
    new: (a, b) =>
      sortDateDesc(b).localeCompare(sortDateDesc(a)) || (b.trend || 0) - (a.trend || 0) || revCount(b) - revCount(a),
    old: (a, b) => sortDateAsc(a).localeCompare(sortDateAsc(b)) || (b.trend || 0) - (a.trend || 0),
    trend: (a, b) =>
      (b.trend || 0) - (a.trend || 0) || revCount(b) - revCount(a) || sortDateDesc(b).localeCompare(sortDateDesc(a)),
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
    const pt = playtimeMap.get(String(g.id)) || { avgPlaytime: null, playtimeTier: null };
    return {
      ...g,
      scores: sc,
      reviews: totalReviewsCount(sc, 'all'),
      avgPlaytime: pt.avgPlaytime,
      playtimeTier: pt.playtimeTier,
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
  const sid = getSid(req);
  const s = await getSession(req);
  if (!primaryAccount(s)) return res.status(401).json({ error: 'Sign in first.' });
  const gameId = String(req.params.id);
  const game = byId.get(gameId) || null;
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const refreshPlat = PLATFORM_ORDER.includes(req.query.platform) ? req.query.platform : null;

  const entries = await Promise.all(
    PLATFORM_ORDER.map(async (p) => {
      const released = !game || (game.platforms || []).includes(p);
      const legacyStatus = getLegacyStatus(game, p);

      if (!released) {
        return [
          p,
          {
            released: false,
            connected: Boolean(s.accounts[p]),
            legacy: false,
            owned: false,
            eligible: false,
            hours: 0,
            minHours: MIN_HOURS,
          },
        ];
      }

      if (!s.accounts[p]) {
        return [
          p,
          {
            released: true,
            connected: false,
            legacy: legacyStatus.legacy,
            legacyEra: legacyStatus.era,
            legacyReason: legacyStatus.reason,
            owned: false,
            eligible: false,
            hours: 0,
            minHours: MIN_HOURS,
          },
        ];
      }

      if (legacyStatus.legacy) {
        return [
          p,
          {
            released: true,
            connected: true,
            legacy: true,
            legacyEra: legacyStatus.era,
            legacyReason: legacyStatus.reason,
            owned: true,
            eligible: true,
            hours: 0,
            minHours: 0,
          },
        ];
      }

      try {
        const shouldRefresh = forceRefresh && (!refreshPlat || refreshPlat === p);
        const lib = await getLibraryForPlatform(s, p, { sid, forceRefresh: shouldRefresh });
        const own = findOwnedGameInLibrary(lib, game, gameId);
        if (own && p === 'xbox' && own.needsHoursLookup && own.externalId && OPENXBL_KEY) {
          own.hours = await fetchOpenXblTitleHours(s.accounts.xbox.id, own.externalId, OPENXBL_KEY);
          own.needsHoursLookup = false;
        }
        if (own) {
          const evalRes = await evaluateOwnershipEligibility(s.accounts[p], p, game, own);
          return [
            p,
            {
              released: true,
              connected: true,
              legacy: false,
              owned: true,
              syncedAt: s.accounts[p]?.lib?.t || Date.now(),
              ...evalRes,
            },
          ];
        }
        return [
          p,
          {
            released: true,
            connected: true,
            legacy: false,
            owned: false,
            eligible: false,
            hours: 0,
            minHours: MIN_HOURS,
            syncedAt: s.accounts[p]?.lib?.t || Date.now(),
          },
        ];
      } catch (err) {
        return [
          p,
          {
            released: true,
            connected: true,
            legacy: false,
            error: err.message,
            owned: false,
            eligible: false,
            hours: 0,
            minHours: MIN_HOURS,
          },
        ];
      }
    })
  );
  res.json(Object.fromEntries(entries));
});

// Unified multi-platform user library
app.get('/api/library', async (req, res) => {
  const sid = getSid(req);
  const s = await getSession(req);
  if (!primaryAccount(s)) return res.status(401).json({ error: 'Sign in first.' });

  const requestedPlat = PLATFORM_ORDER.includes(req.query.platform) ? req.query.platform : null;
  const connected = PLATFORM_ORDER.filter((p) => Boolean(s.accounts[p]));
  const activePlat = requestedPlat && s.accounts[requestedPlat] ? requestedPlat : connected[0];
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

  try {
    const lib = await getLibraryForPlatform(s, activePlat, { sid, forceRefresh });
    const acc = s.accounts[activePlat];

    const myReviewsMap = new Map(
      db.reviews
        .filter((r) => r.platform === activePlat && reviewOwnerId(r) === String(acc.id))
        .map((r) => [String(r.gameId), r])
    );

    const enrichedByCanonical = new Map();
    for (const item of lib) {
      const itemIds = [item.externalId, ...(Array.isArray(item.externalIds) ? item.externalIds : [])]
        .filter(Boolean)
        .map(String);
      // Match to existing canonical game so zero duplicates occur
      const itemBaseKey = baseTitleKey(item.name);
      const matched =
        itemIds.map((id) => byId.get(id)).find(Boolean) ||
        itemIds.map((id) => byId.get(`${activePlat}-${id}`)).find(Boolean) ||
        db.games.find(
          (g) =>
            (g.platformIds?.[activePlat] && itemIds.includes(String(g.platformIds[activePlat]))) ||
            (activePlat === 'pc' &&
              Array.isArray(g.platformIds?.steamAlts) &&
              g.platformIds.steamAlts.some((sid) => itemIds.includes(String(sid)))) ||
            (item.canonicalKey && (g.canonicalKey || normalizeTitle(g.name)) === item.canonicalKey) ||
            (itemBaseKey && baseTitleKey(g.name) === itemBaseKey && (!g.date || g.date >= '2010-01-01'))
        );
      const canonicalId = String(matched ? matched.id : item.externalId);
      const rev = myReviewsMap.get(canonicalId);
      const refForShort = matched || { name: item.name, canonicalKey: item.canonicalKey };
      const itemMinHours = getCachedEffectiveMinHours(refForShort, db.hltbCache, MIN_HOURS);
      const prev = enrichedByCanonical.get(canonicalId);
      if (prev) {
        prev.hours = Math.round((prev.hours + (Number(item.hours) || 0)) * 10) / 10;
        prev.eligible = prev.hours >= prev.minHours;
        if (!prev.cover && item.cover) prev.cover = item.cover;
        continue;
      }
      enrichedByCanonical.set(canonicalId, {
        id: canonicalId,
        externalId: item.externalId,
        platform: activePlat,
        name: matched?.name || item.name,
        hours: item.hours,
        minHours: itemMinHours,
        eligible: item.hours >= itemMinHours,
        reviewed: Boolean(rev),
        myScore: rev ? rev.score : null,
        cover: matched?.cover || item.cover || '',
        date: matched?.date || item.releaseDate || null,
        developer: matched?.developer || item.developer || '',
        publisher: matched?.publisher || item.publisher || '',
        platforms: matched?.platforms || [activePlat],
      });
    }
    const enriched = [...enrichedByCanonical.values()].sort((a, b) => b.hours - a.hours);

    res.json({
      minHours: MIN_HOURS,
      activePlatform: activePlat,
      connected,
      syncedAt: acc.lib?.t || Date.now(),
      items: enriched,
    });
  } catch (err) {
    res.status(400).json({ error: err.message, activePlatform: activePlat, connected });
  }
});

// Submit or update a strictly platform-isolated verified review
app.post('/api/review', async (req, res) => {
  const sid = getSid(req);
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
      let lib = await getLibraryForPlatform(s, platform, { sid });
      let own = findOwnedGameInLibrary(lib, game, gameId);
      const cacheAgeMs = Date.now() - (account.lib?.t || 0);

      // If cached session library says not owned and cache is > 60s old, try one fresh sync
      if (!own && cacheAgeMs > 60000) {
        lib = await getLibraryForPlatform(s, platform, { sid, forceRefresh: true }).catch(() => lib);
        own = findOwnedGameInLibrary(lib, game, gameId);
      }

      if (!own) {
        return res.status(403).json({ error: `This game was not found in your verified ${platLabel} library.` });
      }
      if (platform === 'xbox' && own.needsHoursLookup && own.externalId && OPENXBL_KEY) {
        own.hours = await fetchOpenXblTitleHours(account.id, own.externalId, OPENXBL_KEY);
        own.needsHoursLookup = false;
      }
      let evalRes = await evaluateOwnershipEligibility(account, platform, game, own);
      if (!evalRes.eligible && cacheAgeMs > 60000) {
        lib = await getLibraryForPlatform(s, platform, { sid, forceRefresh: true }).catch(() => lib);
        const freshOwn = findOwnedGameInLibrary(lib, game, gameId);
        if (freshOwn) {
          own = freshOwn;
          if (platform === 'xbox' && own.needsHoursLookup && own.externalId && OPENXBL_KEY) {
            own.hours = await fetchOpenXblTitleHours(account.id, own.externalId, OPENXBL_KEY);
            own.needsHoursLookup = false;
          }
          evalRes = await evaluateOwnershipEligibility(account, platform, game, own);
        }
      }
      if (!evalRes.eligible) {
        return res.status(403).json({
          error: `You need at least ${evalRes.minHours}h of verified playtime on ${platLabel} to review. You currently have ${evalRes.hours}h.`,
        });
      }
      verifiedHours = evalRes.hours;

      // Ensure canonical game record exists and includes this verified platform (zero duplication)
      if (!game) {
        if (platform === 'pc' && /^\d+$/.test(own.externalId)) {
          game = await ingestSteamGame(own.externalId).catch(() => null);
        }
        if (!game) {
          // Check existing catalog by normalized title first (without fake today date)
          const ownKey = normalizeTitle(own.name);
          const existingByTitle = ownKey
            ? db.games.find((g) => (normalizeTitle(g.name) || g.canonicalKey) === ownKey)
            : null;
          if (existingByTitle) {
            game = upsertCanonicalGame(db, byId, {
              id: existingByTitle.id,
              name: existingByTitle.name,
              platforms: [platform],
              platformIds: { [platform === 'pc' ? 'steam' : platform]: own.externalId },
            });
          } else {
            const resolved = await resolveRealMetadataForTitle(own.name, platform);
            const cover = resolved.cover || own.cover || (await pickCover(own.externalId, resolved.hdr || '', resolved.name || own.name));
            const validOwnDate = isIsoDate(own.releaseDate) && own.releaseDate <= todayIso() ? own.releaseDate : '';
            const realDate = resolved.date || validOwnDate || '';
            game = upsertCanonicalGame(db, byId, {
              name: resolved.name || cleanDisplayTitle(own.name),
              date: realDate,
              platforms: [...new Set([platform, ...(resolved.platforms || [])])],
              ...(resolved.generations?.length ? { generations: resolved.generations } : {}),
              platformIds: {
                ...(resolved.platformIds || {}),
                [platform === 'pc' ? 'steam' : platform]: own.externalId,
              },
              developer: resolved.developer || own.developer || 'Verified Release',
              publisher: resolved.publisher || own.publisher || '',
              cover,
              hdr: resolved.hdr || '',
            });
          }
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

async function repairCatalogDatesOnBoot() {
  const dirty = [];
  for (const g of db.games) {
    const key = normalizeTitle(g.name) || g.canonicalKey || '';
    const known = KNOWN_TITLE_METADATA[key];
    const isConsolePlaceholder =
      /^(?:ps|xbox)-/.test(String(g.id)) &&
      (g.developer === 'Verified Release' || !isIsoDate(g.date) || g.date >= '2026-11-20');

    if (known && (isConsolePlaceholder || (known.date && g.date !== known.date && g.date.endsWith('-01-01')))) {
      let changed = false;
      if (known.name && g.name !== known.name && isConsolePlaceholder) {
        g.name = known.name;
        changed = true;
      }
      if (known.date && g.date !== known.date) {
        g.date = known.date;
        changed = true;
      }
      if (known.developer && (!g.developer || g.developer === 'Verified Release')) {
        g.developer = known.developer;
        changed = true;
      }
      if (known.publisher && !g.publisher) {
        g.publisher = known.publisher;
        changed = true;
      }
      if (Array.isArray(known.platforms)) {
        const merged = PLATFORM_ORDER.filter((p) => new Set([...(g.platforms || []), ...known.platforms]).has(p));
        if (merged.length !== (g.platforms || []).length) {
          g.platforms = merged;
          changed = true;
        }
      }
      if (changed) {
        g.canonicalKey = normalizeTitle(g.name);
        dirty.push(g);
      }
      continue;
    }

    if (isConsolePlaceholder) {
      const resolved = await resolveRealMetadataForTitle(g.name, (g.platforms || [])[0] || '');
      let changed = false;
      const cleanedName = resolved.name || cleanDisplayTitle(g.name);
      if (cleanedName && cleanedName !== g.name) {
        g.name = cleanedName;
        changed = true;
      }
      if (resolved.date && resolved.date !== g.date) {
        g.date = resolved.date;
        changed = true;
      } else if (!resolved.date && g.date >= '2026-11-20') {
        g.date = '';
        changed = true;
      }
      if (resolved.developer && g.developer === 'Verified Release') {
        g.developer = resolved.developer;
        changed = true;
      }
      if (resolved.publisher && !g.publisher) {
        g.publisher = resolved.publisher;
        changed = true;
      }
      if (changed) {
        g.canonicalKey = normalizeTitle(g.name);
        dirty.push(g);
      }
    }
  }

  if (dirty.length) {
    console.log(`Repaired release dates/metadata for ${dirty.length} catalog record(s).`);
    save();
    if (store.isPostgres) {
      await store.upsertGamesBatch(dirty).catch((err) => console.warn('Date repair DB save skipped:', err.message));
    }
  }
}

// ============================================================================
// RESUMABLE DAILY 1,000-GAME AUTO-INDEXER (Backfill -> Daily New Releases Only)
// Runs gently in the background on Render & locally; persists exact cursors to
// PostgreSQL kv_state so restarts resume cleanly without duplicating work.
// ============================================================================
let dailyIndexRunning = false;

function ensureIndexState() {
  const today = todayIso();
  if (!db.indexState || typeof db.indexState !== 'object') {
    db.indexState = {
      date: today,
      addedToday: 0,
      bucketIdx: 0,
      wikidataDoneBuckets: {},
      steamCursor: 0,
      steamDone: false,
      mode: 'backfill',
      dailyReleasesDate: '',
      lastRunAt: 0,
      totalAddedEver: 0,
    };
  }
  if (db.indexState.date !== today) {
    db.indexState.date = today;
    db.indexState.addedToday = 0;
  }
  return db.indexState;
}

async function persistIndexState(upsertedGames = []) {
  save();
  if (store.isPostgres) {
    if (upsertedGames.length) {
      await store.upsertGamesBatch(upsertedGames).catch(() => {});
    }
    await store.setKv('genOffsets', db.genOffsets).catch(() => {});
    await store.setKv('indexState', db.indexState).catch(() => {});
  }
}

async function refreshDailySteamReleases() {
  const added = [];
  // 1. Live Steam concurrent player trending ranks
  const charts = await fetchJsonSafe('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/');
  const ranks = charts.response?.ranks || [];
  if (ranks.length) {
    TREND = {};
    for (const row of ranks) TREND[String(row.appid)] = row.peak_in_game || 0;
    db.games.forEach((g) => {
      const sid = g.platformIds?.steam || g.id;
      if (TREND[String(sid)]) g.trend = TREND[String(sid)];
    });
  }

  // 2. Today's Steam new releases & top sellers
  const featured = await fetchJsonSafe('https://store.steampowered.com/api/featuredcategories?cc=us&l=english');
  const freshIds = [
    ...new Set(
      ['new_releases', 'top_sellers']
        .flatMap((k) => (featured[k]?.items || []).map((x) => String(x.id)))
        .filter((id) => /^\d+$/.test(id))
    ),
  ];

  for (const sid of freshIds) {
    if (byId.has(sid) && isValidGame(byId.get(sid))) continue;
    try {
      const g = await ingestSteamGame(sid);
      if (g) added.push(g);
    } catch {
      // Transient Steam hiccup — skip
    }
    await sleep(600);
  }
  return added;
}

async function ensureSteamAppListLoaded() {
  if (APPS.length || !STEAM_KEY) return APPS.length;
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
      console.warn('[daily-index] GetAppList interrupted:', err.message);
      break;
    }
  }
  if (apps.length) {
    // Newest Steam AppIDs first so recent releases are indexed ahead of ancient shovelware
    apps.sort((a, b) => Number(b[0]) - Number(a[0]));
    APPS = apps;
  }
  return APPS.length;
}

async function runDailyIndexBatch(maxForThisRun = DAILY_INDEX_LIMIT) {
  if (dailyIndexRunning) return { skipped: true, reason: 'already_running' };
  dailyIndexRunning = true;

  const st = ensureIndexState();
  const today = todayIso();
  let addedThisRun = 0;
  const targetRemaining = Math.min(maxForThisRun, Math.max(0, DAILY_INDEX_LIMIT - st.addedToday));

  try {
    // Step 1: Always sync today's new releases & trending ranks once per day
    if (st.dailyReleasesDate !== today) {
      const fresh = await refreshDailySteamReleases();
      st.dailyReleasesDate = today;
      st.addedToday += fresh.length;
      st.totalAddedEver = (st.totalAddedEver || 0) + fresh.length;
      addedThisRun += fresh.length;
      await persistIndexState(fresh);
      if (fresh.length) {
        console.log(`[daily-index] Synced ${fresh.length} fresh daily Steam releases.`);
      }
    }

    // If we already finished the full historical backfill, stay in daily-new-releases-only mode!
    if (st.mode === 'daily_only' || st.addedToday >= DAILY_INDEX_LIMIT || targetRemaining <= 0) {
      st.lastRunAt = Date.now();
      await persistIndexState([]);
      return { mode: st.mode, addedThisRun, addedToday: st.addedToday, dailyLimit: DAILY_INDEX_LIMIT };
    }

    // Step 2: Wikidata cross-generation backfill (PS1-PS5, Xbox-Series X|S, PC — fast & high quality)
    let pendingBuckets = GENERATION_BUCKETS.filter((b) => !st.wikidataDoneBuckets?.[b.qid]);
    let wdBatchBuffer = [];

    while (pendingBuckets.length && addedThisRun < targetRemaining && st.addedToday < DAILY_INDEX_LIMIT) {
      const bucket = pendingBuckets[st.bucketIdx % pendingBuckets.length];
      st.bucketIdx = (st.bucketIdx + 1) % pendingBuckets.length;
      const offset = Number(db.genOffsets[bucket.qid] || 0);

      try {
        const qids = await fetchGenerationQids(bucket.qid, offset, 50);
        if (!qids.length) {
          st.wikidataDoneBuckets = { ...(st.wikidataDoneBuckets || {}), [bucket.qid]: true };
          pendingBuckets = GENERATION_BUCKETS.filter((b) => !st.wikidataDoneBuckets?.[b.qid]);
          await persistIndexState(wdBatchBuffer);
          wdBatchBuffer = [];
          continue;
        }

        const hydrated = await hydrateWikidataEntities(qids);
        let newlyAdded = 0;
        for (const item of hydrated) {
          if (!isValidGame(item)) continue;
          const before = db.games.length;
          const savedGame = upsertCanonicalGame(db, byId, item);
          if (db.games.length > before) {
            newlyAdded++;
            wdBatchBuffer.push(savedGame);
          }
        }
        db.genOffsets[bucket.qid] = offset + qids.length;
        if (qids.length < 50) {
          st.wikidataDoneBuckets = { ...(st.wikidataDoneBuckets || {}), [bucket.qid]: true };
          pendingBuckets = GENERATION_BUCKETS.filter((b) => !st.wikidataDoneBuckets?.[b.qid]);
        }

        addedThisRun += newlyAdded;
        st.addedToday += newlyAdded;
        st.totalAddedEver = (st.totalAddedEver || 0) + newlyAdded;
        st.lastRunAt = Date.now();

        if (wdBatchBuffer.length >= 25 || !pendingBuckets.length) {
          await persistIndexState(wdBatchBuffer);
          wdBatchBuffer = [];
        }
        await sleep(1600);
      } catch (err) {
        console.warn(`[daily-index] Wikidata [${bucket.label}] paused:`, err.message);
        await persistIndexState(wdBatchBuffer);
        wdBatchBuffer = [];
        break;
      }
    }
    if (wdBatchBuffer.length) {
      await persistIndexState(wdBatchBuffer);
      wdBatchBuffer = [];
    }

    // Step 3: Steam full-catalog backfill (resumes from steamCursor once Wikidata buckets finish or after Wikidata pause)
    if (addedThisRun < targetRemaining && st.addedToday < DAILY_INDEX_LIMIT && STEAM_KEY && !st.steamDone) {
      await ensureSteamAppListLoaded();
      let steamBuffer = [];
      let checkedInLoop = 0;

      while (
        st.steamCursor < APPS.length &&
        addedThisRun < targetRemaining &&
        st.addedToday < DAILY_INDEX_LIMIT &&
        checkedInLoop < targetRemaining * 4
      ) {
        const sid = APPS[st.steamCursor][0];
        st.steamCursor++;
        checkedInLoop++;

        if (isBadId(sid) || (byId.has(sid) && isValidGame(byId.get(sid)))) continue;
        try {
          const before = db.games.length;
          const g = await ingestSteamGame(sid);
          if (g && db.games.length > before) {
            addedThisRun++;
            st.addedToday++;
            st.totalAddedEver = (st.totalAddedEver || 0) + 1;
            steamBuffer.push(g);
          }
          if (steamBuffer.length >= 20) {
            st.lastRunAt = Date.now();
            await persistIndexState(steamBuffer);
            steamBuffer = [];
          }
          await sleep(1400);
        } catch {
          // Transient Steam rate limit — back off cleanly and resume next cycle
          st.steamCursor = Math.max(0, st.steamCursor - 1);
          break;
        }
      }
      if (steamBuffer.length) {
        st.lastRunAt = Date.now();
        await persistIndexState(steamBuffer);
      }
      if (APPS.length && st.steamCursor >= APPS.length) {
        st.steamDone = true;
      }
    }

    // Switch automatically to daily_only once BOTH Wikidata and Steam backfills are caught up!
    const allWdDone = GENERATION_BUCKETS.every((b) => Boolean(st.wikidataDoneBuckets?.[b.qid]));
    if (allWdDone && (st.steamDone || !STEAM_KEY)) {
      st.mode = 'daily_only';
      console.log('[daily-index] Full historical backlog indexed! Switched to daily_only mode.');
    }

    st.lastRunAt = Date.now();
    await persistIndexState([]);
    console.log(
      `[daily-index] Batch finished: +${addedThisRun} games (today ${st.addedToday}/${DAILY_INDEX_LIMIT}, total ${db.games.length}, mode=${st.mode})`
    );
    return { mode: st.mode, addedThisRun, addedToday: st.addedToday, dailyLimit: DAILY_INDEX_LIMIT };
  } finally {
    dailyIndexRunning = false;
  }
}

/**
 * Background Cover Audit & Auto-Repair
 * Prioritizes all reviewed games + top trending/newest games with legacy Steam URLs,
 * replacing Valve's 1,655-byte blank placeholders and 404 covers with verified
 * hashed Steam library_capsule_2x, SteamGridDB 600x900, or Wikipedia covers.
 */
async function repairBrokenCoversBackground() {
  const reviewedIds = new Set(db.reviews.map((r) => String(r.gameId)));
  const targets = [
    ...db.games.filter((g) => reviewedIds.has(String(g.id))),
    ...db.games
      .filter((g) => !reviewedIds.has(String(g.id)) && /library_600x900\.jpg$/i.test(g.cover || ''))
      .sort((a, b) => (b.trend || 0) - (a.trend || 0) || String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 350),
  ];

  // Fast batch lookup via Valve's IStoreBrowseService for all numeric Steam IDs in targets
  const steamTargetIds = targets
    .map((g) => String(g.platformIds?.steam || (/^\d+$/.test(String(g.id)) ? g.id : '')))
    .filter((id) => /^\d+$/.test(id));
  const browseCovers = await fetchSteamBrowseCoversBatch(steamTargetIds).catch(() => new Map());

  const fixed = [];
  for (let i = 0; i < targets.length; i += 10) {
    const slice = targets.slice(i, i + 10);
    await Promise.all(
      slice.map(async (g) => {
        if (await checkImage(g.cover)) return;
        const sid = String(g.platformIds?.steam || (/^\d+$/.test(String(g.id)) ? g.id : ''));
        let nextCover = browseCovers.get(sid) || '';
        if (nextCover && !(await checkImage(nextCover))) nextCover = '';
        if (!nextCover) {
          nextCover = await pickCover(g.id, g.hdr, g.name, sid);
        }
        if (nextCover && nextCover !== g.cover) {
          g.cover = nextCover;
          fixed.push(g);
        }
      })
    );
  }

  if (fixed.length) {
    console.log(`[cover-repair] Fixed ${fixed.length} broken/blank game cover(s).`);
    save();
    if (store.isPostgres) {
      await store.upsertGamesBatch(fixed).catch(() => {});
    }
  }
}

function startDailyIndexScheduler() {
  // Run a polite resumable chunk shortly after boot (if today's 1,000-game quota isn't met yet)
  // and re-check every hour so each new UTC day automatically indexes up to 1,000 new games.
  setTimeout(() => {
    repairBrokenCoversBackground().catch((err) => console.warn('[cover-repair] Skipped:', err.message));
  }, 5000);
  const tick = () => {
    const st = ensureIndexState();
    if (st.addedToday < DAILY_INDEX_LIMIT || st.dailyReleasesDate !== todayIso()) {
      runDailyIndexBatch(DAILY_INDEX_LIMIT).catch((err) =>
        console.warn('[daily-index] Cycle skipped:', err.message)
      );
    }
  };
  setTimeout(tick, 18000);
  setInterval(tick, 3600000);
}

async function startServer() {
  const info = await store.init(db);
  const deduped = deduplicateCatalog(db);
  byId = deduped.byId;

  // Persist any deduplicated/merged placeholder IDs & migrated reviews to PostgreSQL
  if (store.isPostgres && deduped.idRemap && deduped.idRemap.size > 0) {
    const mergedTargets = new Set();
    for (const [oldId, newId] of deduped.idRemap.entries()) {
      await store.migrateReviewsGameId(oldId, newId).catch((e) => console.warn('Review migrate error:', e.message));
      await store.deleteGame(oldId).catch((e) => console.warn('Old game delete error:', e.message));
      const target = byId.get(newId);
      if (target) mergedTargets.add(target);
    }
    if (mergedTargets.size) {
      await store.upsertGamesBatch([...mergedTargets]).catch(() => {});
    }
  }

  await repairCatalogDatesOnBoot();

  const enrichedCount = enrichMultiplatformCatalog(db, byId, upsertCanonicalGame);
  if (deduped.mergedCount > 0 || enrichedCount > 0) {
    console.log(
      `Catalog normalized: ${deduped.mergedCount} duplicate(s) merged, ${enrichedCount} multi-platform record(s) enriched.`
    );
  }

  app.listen(PORT, () => {
    console.log(
      `Playtested running at ${BASE} [storage=${info.mode}, games=${db.games.length}, reviews=${db.reviews.length}]` +
        (IS_CLOUD_HOST ? ' [Cloud managed mode + daily 1k indexer]' : '')
    );
    if (!NO_SYNC) {
      startDailyIndexScheduler();
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start Playtested:', err);
  process.exit(1);
});
