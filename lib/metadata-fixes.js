'use strict';

/**
 * Authoritative metadata guardrails & overrides for Playtested.
 *
 * Handles:
 * 1. Steam AppID in-place rebrands where even Steam's API keeps the predecessor's
 *    launch date or Wikidata links the old console game (e.g. Counter-Strike 2 on AppID 730).
 * 2. Historical console generation sanity filtering (strips vandalized/anachronistic
 *    PS1/PS2/Xbox/PS3/Xbox 360 tags on games released years after those consoles retired).
 * 3. Filtering vandalized Nintendo-exclusive entries from Wikidata ingestion.
 */

const PLATFORM_ORDER = ['pc', 'ps', 'xbox'];
const GEN_ORDER = ['PC', 'PS1', 'PS2', 'PS3', 'PS4', 'PS5', 'Xbox', 'Xbox 360', 'Xbox One', 'Xbox Series X|S'];

const GEN_TO_PLATFORM = {
  PC: 'pc',
  PS1: 'ps',
  PS2: 'ps',
  PS3: 'ps',
  PS4: 'ps',
  PS5: 'ps',
  Xbox: 'xbox',
  'Xbox 360': 'xbox',
  'Xbox One': 'xbox',
  'Xbox Series X|S': 'xbox',
};

// Maximum plausible initial release year for discontinued console generations.
// Prevents Wikidata vandalism/mismaps (e.g., PS1 on 2022 Frog Detective 3 or Original Xbox on 2020 Lake).
const DISCONTINUED_GEN_MAX_YEAR = {
  PS1: 2006,
  Xbox: 2009,
  PS2: 2014,
  PS3: 2018,
  'Xbox 360': 2018,
};

// Authoritative overrides (exact replacement, not additive merge) keyed by canonical game ID.
const EXACT_GAME_OVERRIDES = {
  '730': {
    name: 'Counter-Strike 2',
    date: '2023-09-27',
    platforms: ['pc'],
    generations: ['PC'],
    developer: 'Valve',
    publisher: 'Valve',
    platformIds: { steam: '730', wikidata: 'Q117268259', igdb: 'counter-strike-2' },
  },
  '227300': {
    // Euro Truck Simulator 2 — PS5/Xbox ports have not shipped yet; PC-only.
    platforms: ['pc'],
    generations: ['PC'],
  },
  '413150': {
    // Stardew Valley — never released on PS3 or Xbox 360.
    platforms: ['pc', 'ps', 'xbox'],
    generations: ['PC', 'PS4', 'Xbox One'],
  },
  '1548850': {
    // Six Days in Fallujah — Wikidata kept delayed 2021 target date + unshipped console ports.
    date: '2023-06-22',
    platforms: ['pc'],
    generations: ['PC'],
  },
  '954850': {
    // Kerbal Space Program 2 — Wikidata kept delayed 2022 target date + cancelled console ports.
    date: '2023-02-24',
    platforms: ['pc'],
    generations: ['PC'],
  },
  '2507950': {
    // Delta Force — Wikidata year-only 2024-01-01 overwrote exact launch date.
    date: '2024-12-04',
  },
  '21680': {
    // Bionic Commando Rearmed — previously merged Wikidata for Rearmed 2.
    platforms: ['pc', 'ps', 'xbox'],
    generations: ['PC', 'PS3', 'Xbox 360'],
    platformIds: { steam: '21680', igdb: 'bionic-commando-rearmed' },
  },
};

const VANDALIZED_WIKIDATA_IDS = new Set([
  'wd-Q105552962', // Mario Golf: Super Rush (Switch exclusive)
  'wd-Q1809250',   // Mario Paint (SNES exclusive)
]);

const NINTENDO_FIRST_PARTY_RE =
  /\b(super\s+mario|mario\s+(?:kart|party|golf|tennis|strikers|paint|bros|maker|odyssey|wonder|rpg)|the\s+legend\s+of\s+zelda|splatoon|animal\s+crossing|super\s+smash\s+bros|metroid|xenoblade|pikmin|kirby|fire\s+emblem|donkey\s+kong|luigi'?s\s+mansion|yoshi'?s|star\s+fox|f-zero)\b/i;

function isVandalizedNintendoExclusive(game) {
  if (!game) return false;
  const id = String(game.id || '');
  if (VANDALIZED_WIKIDATA_IDS.has(id)) return true;
  if (/^\d+$/.test(id) || game.platformIds?.steam) return false;
  const name = String(game.name || '');
  return NINTENDO_FIRST_PARTY_RE.test(name);
}

/**
 * Strips historically impossible retro console generations given the game's release date,
 * and drops any console platform (ps/xbox) that was ONLY present due to stripped bogus generations.
 */
function sanitizeGenerationsAndPlatforms(platforms, generations, dateStr) {
  const cleanPlats = PLATFORM_ORDER.filter((p) => (platforms || []).includes(p));
  const rawGens = Array.isArray(generations) ? generations.filter((g) => GEN_ORDER.includes(g)) : [];
  if (!rawGens.length) {
    return {
      platforms: cleanPlats.length ? cleanPlats : ['pc'],
      generations: rawGens,
      changed: false,
    };
  }

  const m = /^(\d{4})/.exec(String(dateStr || ''));
  const year = m ? Number(m[1]) : 0;

  let nextGens = [...new Set(rawGens)];
  let removedAny = false;
  const removedPlats = new Set();

  if (year > 0) {
    const filtered = [];
    for (const gen of nextGens) {
      const maxYear = DISCONTINUED_GEN_MAX_YEAR[gen];
      if (maxYear && year > maxYear) {
        removedAny = true;
        const fam = GEN_TO_PLATFORM[gen];
        if (fam) removedPlats.add(fam);
        continue;
      }
      filtered.push(gen);
    }
    nextGens = GEN_ORDER.filter((g) => filtered.includes(g));
  } else {
    nextGens = GEN_ORDER.filter((g) => nextGens.includes(g));
  }

  let nextPlats = [...cleanPlats];
  if (removedAny) {
    const remainingFams = new Set(nextGens.map((g) => GEN_TO_PLATFORM[g]).filter(Boolean));
    nextPlats = nextPlats.filter((p) => !removedPlats.has(p) || remainingFams.has(p));
  }
  if (!nextPlats.length) {
    nextPlats = cleanPlats.length ? cleanPlats : ['pc'];
  }

  const changed =
    removedAny ||
    nextGens.join(',') !== rawGens.join(',') ||
    nextPlats.join(',') !== cleanPlats.join(',');

  return { platforms: nextPlats, generations: nextGens, changed };
}

function applyMetadataOverride(game) {
  if (!game) return false;
  const ov = EXACT_GAME_OVERRIDES[String(game.id)] || (game.platformIds?.steam && EXACT_GAME_OVERRIDES[String(game.platformIds.steam)]);
  if (!ov) return false;

  let changed = false;
  if (ov.name && game.name !== ov.name) {
    game.name = ov.name;
    changed = true;
  }
  if (ov.date && game.date !== ov.date) {
    game.date = ov.date;
    changed = true;
  }
  if (ov.developer && game.developer !== ov.developer) {
    game.developer = ov.developer;
    changed = true;
  }
  if (ov.publisher && game.publisher !== ov.publisher) {
    game.publisher = ov.publisher;
    changed = true;
  }
  if (Array.isArray(ov.platforms)) {
    const next = PLATFORM_ORDER.filter((p) => ov.platforms.includes(p));
    if ((game.platforms || []).join(',') !== next.join(',')) {
      game.platforms = next;
      changed = true;
    }
  }
  if (Array.isArray(ov.generations)) {
    const next = GEN_ORDER.filter((g) => ov.generations.includes(g));
    if ((game.generations || []).join(',') !== next.join(',')) {
      game.generations = next;
      changed = true;
    }
  }
  if (ov.platformIds) {
    const before = JSON.stringify(game.platformIds || {});
    const nextPids = { ...ov.platformIds };
    if (JSON.stringify(nextPids) !== before) {
      game.platformIds = nextPids;
      changed = true;
    }
  }
  return changed;
}

module.exports = {
  EXACT_GAME_OVERRIDES,
  sanitizeGenerationsAndPlatforms,
  isVandalizedNintendoExclusive,
  applyMetadataOverride,
};
