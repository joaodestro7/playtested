'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Dual-Mode Persistence Store for Playtested
 *
 * - When DATABASE_URL is set (Google Cloud Run + Neon PostgreSQL):
 *   Stores games, reviews, kv state, and user sessions permanently in PostgreSQL
 *   so containers can scale to zero / redeploy without losing reviews or logins.
 *   Automatically seeds all deduplicated games from db.json on first empty boot.
 *
 * - When DATABASE_URL is NOT set (local development / single VPS):
 *   Uses atomic local db.json + in-memory sessions with zero external dependencies.
 */

class PlaytestedStore {
  constructor({ dbFile, databaseUrl }) {
    this.dbFile = dbFile;
    this.databaseUrl = databaseUrl || '';
    this.isPostgres = Boolean(this.databaseUrl);
    this.pool = null;
    this.memSessions = new Map();
    this._saveTimer = null;
  }

  async init(db) {
    if (!this.isPostgres) {
      if (fs.existsSync(this.dbFile)) {
        const parsed = JSON.parse(fs.readFileSync(this.dbFile, 'utf8'));
        db.games = parsed.games || [];
        db.reviews = parsed.reviews || [];
        db.bad = parsed.bad || {};
        db.genOffsets = parsed.genOffsets || {};
        db.marketing = parsed.marketing || {};
        db.indexState = parsed.indexState || null;
      }
      return { mode: 'json' };
    }

    const { Pool } = require('pg');
    this.pool = new Pool({
      connectionString: this.databaseUrl,
      ssl: this.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 8,
      idleTimeoutMillis: 30000,
    });

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        canonical_key TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        date TEXT NOT NULL DEFAULT '',
        platforms JSONB NOT NULL DEFAULT '["pc"]'::jsonb,
        generations JSONB NOT NULL DEFAULT '[]'::jsonb,
        platform_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
        developer TEXT NOT NULL DEFAULT '',
        publisher TEXT NOT NULL DEFAULT '',
        cover TEXT NOT NULL DEFAULT '',
        hdr TEXT NOT NULL DEFAULT '',
        trend INTEGER NOT NULL DEFAULT 0,
        checked BIGINT NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        account_id TEXT NOT NULL,
        steamid TEXT,
        name TEXT NOT NULL,
        avatar TEXT NOT NULL DEFAULT '',
        score INTEGER NOT NULL,
        text TEXT NOT NULL DEFAULT '',
        hours REAL NOT NULL DEFAULT 0,
        legacy BOOLEAN NOT NULL DEFAULT FALSE,
        legacy_era TEXT NOT NULL DEFAULT '',
        ts BIGINT NOT NULL,
        edited BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_user_platform
        ON reviews (game_id, platform, account_id);

      CREATE TABLE IF NOT EXISTS kv_state (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `);

    const countRes = await this.pool.query('SELECT COUNT(*)::int AS c FROM games');
    const existingCount = countRes.rows[0]?.c || 0;
    const SEED_VERSION = 2;

    // Auto-seed Neon database on first boot OR incrementally merge new games from updated db.json seed
    const seedKvRes = await this.pool.query("SELECT value FROM kv_state WHERE key = 'seedVersion'");
    const currentSeedVersion = Number(seedKvRes.rows[0]?.value || 0);

    if ((existingCount === 0 || currentSeedVersion < SEED_VERSION) && fs.existsSync(this.dbFile)) {
      const seed = JSON.parse(fs.readFileSync(this.dbFile, 'utf8'));
      const seedGames = seed.games || [];
      if (existingCount === 0) {
        console.log('[store] Empty PostgreSQL database detected — seeding initial catalog from db.json...');
        await this.upsertGamesBatch(seedGames);
        if (seed.genOffsets) await this.setKv('genOffsets', seed.genOffsets);
        await this.setKv('bad', {});
        console.log(`[store] Seeded ${seedGames.length} games into PostgreSQL.`);
      } else {
        const idRows = await this.pool.query('SELECT id FROM games');
        const existingIds = new Set(idRows.rows.map((r) => String(r.id)));
        const newSeedGames = seedGames.filter((g) => g && g.id && !existingIds.has(String(g.id)));
        if (newSeedGames.length) {
          console.log(`[store] Merging ${newSeedGames.length} newly pre-indexed seed games into PostgreSQL...`);
          await this.upsertGamesBatch(newSeedGames);
        }
        // Merge genOffsets forward (taking max per bucket) & clear stale adult-blocked bad cache
        if (seed.genOffsets) {
          const curGenRes = await this.pool.query("SELECT value FROM kv_state WHERE key = 'genOffsets'");
          const curGen = curGenRes.rows[0]?.value || {};
          const mergedOffsets = { ...curGen };
          for (const [k, v] of Object.entries(seed.genOffsets)) {
            mergedOffsets[k] = Math.max(Number(curGen[k] || 0), Number(v || 0));
          }
          await this.setKv('genOffsets', mergedOffsets);
        }
        await this.setKv('bad', {});
      }
      await this.setKv('seedVersion', SEED_VERSION);
    }

    // Purge any previously ingested unreleased/future-dated games from PostgreSQL
    const today = new Date().toISOString().slice(0, 10);
    const purged = await this.pool.query('DELETE FROM games WHERE date > $1', [today]);
    if (purged.rowCount > 0) {
      console.log(`[store] Purged ${purged.rowCount} unreleased/future-dated games from PostgreSQL.`);
    }

    // Hydrate in-memory cache from PostgreSQL for sub-millisecond reads
    const [gamesRes, reviewsRes, kvRes] = await Promise.all([
      this.pool.query('SELECT * FROM games'),
      this.pool.query('SELECT * FROM reviews ORDER BY ts DESC'),
      this.pool.query('SELECT key, value FROM kv_state'),
    ]);

    db.games = gamesRes.rows.map((r) => ({
      id: String(r.id),
      canonicalKey: r.canonical_key || '',
      name: r.name,
      date: r.date || '',
      platforms: Array.isArray(r.platforms) ? r.platforms : ['pc'],
      ...(Array.isArray(r.generations) && r.generations.length ? { generations: r.generations } : {}),
      platformIds: r.platform_ids || {},
      developer: r.developer || '',
      publisher: r.publisher || '',
      cover: r.cover || '',
      hdr: r.hdr || '',
      trend: Number(r.trend) || 0,
      checked: Number(r.checked) || 0,
    }));

    db.reviews = reviewsRes.rows.map((r) => ({
      gameId: String(r.game_id),
      platform: r.platform,
      accountId: String(r.account_id),
      ...(r.steamid ? { steamid: String(r.steamid) } : {}),
      name: r.name,
      avatar: r.avatar || '',
      score: Number(r.score),
      text: r.text || '',
      hours: Number(r.hours) || 0,
      ...(r.legacy ? { legacy: true, legacyEra: r.legacy_era || '' } : {}),
      ts: Number(r.ts) || Date.now(),
      edited: Boolean(r.edited),
    }));

    const kvMap = Object.fromEntries(kvRes.rows.map((r) => [r.key, r.value]));
    db.bad = kvMap.bad || {};
    db.genOffsets = kvMap.genOffsets || {};
    db.marketing = kvMap.marketing || {};
    db.indexState = kvMap.indexState || null;

    return { mode: 'postgres', games: db.games.length, reviews: db.reviews.length };
  }

  saveLocalSync(db) {
    if (this.isPostgres) return;
    const tmp = this.dbFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, this.dbFile);
  }

  async upsertGame(g) {
    if (!this.isPostgres || !this.pool) return;
    await this.upsertGamesBatch([g]);
  }

  async upsertGamesBatch(games) {
    if (!this.isPostgres || !this.pool || !games.length) return;
    const CHUNK = 200;
    for (let i = 0; i < games.length; i += CHUNK) {
      const slice = games.slice(i, i + CHUNK);
      const values = [];
      const placeholders = slice.map((g, idx) => {
        const base = idx * 13;
        values.push(
          String(g.id),
          String(g.canonicalKey || ''),
          String(g.name || ''),
          String(g.date || ''),
          JSON.stringify(g.platforms || ['pc']),
          JSON.stringify(g.generations || []),
          JSON.stringify(g.platformIds || {}),
          String(g.developer || ''),
          String(g.publisher || ''),
          String(g.cover || ''),
          String(g.hdr || ''),
          Number(g.trend) || 0,
          Number(g.checked) || Date.now()
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5}::jsonb,$${base + 6}::jsonb,$${base + 7}::jsonb,$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13})`;
      });

      await this.pool.query(
        `INSERT INTO games (id, canonical_key, name, date, platforms, generations, platform_ids, developer, publisher, cover, hdr, trend, checked)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (id) DO UPDATE SET
           canonical_key = EXCLUDED.canonical_key,
           name = EXCLUDED.name,
           date = EXCLUDED.date,
           platforms = EXCLUDED.platforms,
           generations = EXCLUDED.generations,
           platform_ids = EXCLUDED.platform_ids,
           developer = EXCLUDED.developer,
           publisher = EXCLUDED.publisher,
           cover = EXCLUDED.cover,
           hdr = EXCLUDED.hdr,
           trend = EXCLUDED.trend,
           checked = EXCLUDED.checked`,
        values
      );
    }
  }

  async upsertReview(r) {
    if (!this.isPostgres || !this.pool) return;
    const ownerId = String(r.accountId || r.steamid || '');
    const id = `${r.gameId}:${r.platform}:${ownerId}`;
    await this.pool.query(
      `INSERT INTO reviews (id, game_id, platform, account_id, steamid, name, avatar, score, text, hours, legacy, legacy_era, ts, edited)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (game_id, platform, account_id) DO UPDATE SET
         name = EXCLUDED.name,
         avatar = EXCLUDED.avatar,
         score = EXCLUDED.score,
         text = EXCLUDED.text,
         hours = EXCLUDED.hours,
         legacy = EXCLUDED.legacy,
         legacy_era = EXCLUDED.legacy_era,
         ts = EXCLUDED.ts,
         edited = EXCLUDED.edited`,
      [
        id,
        String(r.gameId),
        r.platform,
        ownerId,
        r.steamid || null,
        String(r.name || ''),
        String(r.avatar || ''),
        Number(r.score),
        String(r.text || ''),
        Number(r.hours) || 0,
        Boolean(r.legacy),
        String(r.legacyEra || ''),
        Number(r.ts) || Date.now(),
        Boolean(r.edited),
      ]
    );
  }

  async deleteGame(id) {
    if (!this.isPostgres || !this.pool) return;
    await this.pool.query('DELETE FROM games WHERE id = $1', [String(id)]);
  }

  async migrateReviewsGameId(oldGameId, newGameId) {
    if (!this.isPostgres || !this.pool) return;
    const oldId = String(oldGameId);
    const newId = String(newGameId);
    if (!oldId || !newId || oldId === newId) return;
    const existing = await this.pool.query('SELECT * FROM reviews WHERE game_id = $1', [oldId]);
    for (const row of existing.rows) {
      const nextPk = `${newId}:${row.platform}:${row.account_id}`;
      await this.pool.query(
        `INSERT INTO reviews (id, game_id, platform, account_id, steamid, name, avatar, score, text, hours, legacy, legacy_era, ts, edited)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (game_id, platform, account_id) DO NOTHING`,
        [
          nextPk,
          newId,
          row.platform,
          row.account_id,
          row.steamid,
          row.name,
          row.avatar,
          row.score,
          row.text,
          row.hours,
          row.legacy,
          row.legacy_era,
          row.ts,
          row.edited,
        ]
      );
      await this.pool.query('DELETE FROM reviews WHERE id = $1', [row.id]);
    }
  }

  async deleteReview(gameId, platform, ownerId) {
    if (!this.isPostgres || !this.pool) return;
    await this.pool.query(
      'DELETE FROM reviews WHERE game_id = $1 AND platform = $2 AND account_id = $3',
      [String(gameId), String(platform), String(ownerId)]
    );
  }

  async setKv(key, value) {
    if (!this.isPostgres || !this.pool) return;
    await this.pool.query(
      `INSERT INTO kv_state (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)]
    );
  }

  // ---- Persistent Sessions (survives Render/Cloud Run restarts & keeps session library cached) ----
  async getSession(sid) {
    if (!sid) return null;
    if (this.memSessions.has(sid)) return this.memSessions.get(sid);
    if (!this.isPostgres || !this.pool) return null;
    try {
      const res = await this.pool.query('SELECT data FROM sessions WHERE sid = $1', [sid]);
      if (!res.rows.length) return null;
      const session = res.rows[0].data;
      if (session && session.accounts) {
        const SESSION_LIB_TTL_MS = 6 * 60 * 60 * 1000;
        for (const p of ['pc', 'ps', 'xbox']) {
          const acc = session.accounts[p];
          if (!acc) continue;
          const lib = acc.lib;
          if (!lib || !Array.isArray(lib.d) || !Number.isFinite(lib.t) || Date.now() - lib.t >= SESSION_LIB_TTL_MS) {
            acc.lib = null;
          }
        }
      }
      this.memSessions.set(sid, session);
      return session;
    } catch {
      return null;
    }
  }

  async saveSession(sid, session) {
    if (!sid || !session) return;
    if (this.memSessions.size >= 5000 && !this.memSessions.has(sid)) {
      const oldestKey = this.memSessions.keys().next().value;
      if (oldestKey) this.memSessions.delete(oldestKey);
    }
    this.memSessions.set(sid, session);
    if (!this.isPostgres || !this.pool) return;
    // Strip short-lived OAuth/PSN tokens strictly (RAM-only), while preserving a compact
    // token-free library snapshot so users don't re-sync their entire library across restarts.
    const cleanAccounts = {};
    for (const p of ['pc', 'ps', 'xbox']) {
      const a = session.accounts?.[p];
      if (!a) {
        cleanAccounts[p] = null;
      } else {
        const { lib, accessToken, xstsToken, uhs, ...safe } = a;
        let compactLib = null;
        if (lib && Array.isArray(lib.d) && Number.isFinite(lib.t)) {
          compactLib = {
            t: lib.t,
            d: lib.d.slice(0, 2500).map((it) => ({
              platform: it.platform || p,
              externalId: String(it.externalId || ''),
              ...(Array.isArray(it.externalIds) && it.externalIds.length > 1 ? { externalIds: it.externalIds.map(String) } : {}),
              name: String(it.name || ''),
              canonicalKey: String(it.canonicalKey || ''),
              hours: Number(it.hours) || 0,
              ...(it.achievementPct ? { achievementPct: Number(it.achievementPct) } : {}),
              ...(it.needsHoursLookup ? { needsHoursLookup: true } : {}),
              ...(it.cover ? { cover: String(it.cover) } : {}),
            })),
          };
        }
        cleanAccounts[p] = { ...safe, ...(compactLib ? { lib: compactLib } : {}) };
      }
    }
    const payload = {
      accounts: cleanAccounts,
      psnChallenge: session.psnChallenge || null,
      xboxChallenge: session.xboxChallenge || null,
    };
    try {
      await this.pool.query(
        `INSERT INTO sessions (sid, data, updated_at) VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (sid) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
        [sid, JSON.stringify(payload), Date.now()]
      );
    } catch (err) {
      console.warn('[store] Session persist failed:', err.message);
    }
  }

  async deleteSession(sid) {
    if (!sid) return;
    this.memSessions.delete(sid);
    if (!this.isPostgres || !this.pool) return;
    await this.pool.query('DELETE FROM sessions WHERE sid = $1', [sid]).catch(() => {});
  }

  async close() {
    if (this.pool) await this.pool.end().catch(() => {});
  }
}

module.exports = { PlaytestedStore };
