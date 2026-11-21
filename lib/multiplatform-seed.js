'use strict';

/**
 * Multi-platform metadata enricher & flagship console catalog seed.
 * Ensures well-known cross-platform games reflect their true PC / PlayStation / Xbox
 * availability and that flagship PlayStation & Xbox titles are indexed cleanly
 * through the canonical deduplicator (never duplicating entries).
 */

// Accurate multi-platform mappings for popular Steam AppIDs already in db.json
const MULTIPLATFORM_MAP = {
  '381210': ['pc', 'ps', 'xbox'],   // Dead by Daylight
  '304390': ['pc', 'ps', 'xbox'],   // FOR HONOR
  '578080': ['pc', 'ps', 'xbox'],   // PUBG: BATTLEGROUNDS
  '1172470': ['pc', 'ps', 'xbox'],  // Apex Legends
  '1938090': ['pc', 'ps', 'xbox'],  // Call of Duty
  '3240220': ['pc', 'ps', 'xbox'],  // Grand Theft Auto V Enhanced
  '271590': ['pc', 'ps', 'xbox'],   // Grand Theft Auto V Legacy
  '236390': ['pc', 'ps', 'xbox'],   // War Thunder
  '250900': ['pc', 'ps', 'xbox'],   // The Binding of Isaac: Rebirth
  '359550': ['pc', 'ps', 'xbox'],   // Tom Clancy's Rainbow Six Siege
  '2767030': ['pc', 'ps', 'xbox'],  // Marvel Rivals
  '230410': ['pc', 'ps', 'xbox'],   // Warframe
  '2357570': ['pc', 'ps', 'xbox'],  // Overwatch
  '252490': ['pc', 'ps', 'xbox'],   // Rust
  '1174180': ['pc', 'ps', 'xbox'],  // Red Dead Redemption 2
  '2507950': ['pc', 'ps', 'xbox'],  // Delta Force
  '105600': ['pc', 'ps', 'xbox'],   // Terraria
  '2807960': ['pc', 'ps', 'xbox'],  // Battlefield 6
  '322330': ['pc', 'ps', 'xbox'],   // Don't Starve Together
  '1203220': ['pc', 'ps', 'xbox'],  // NARAKA: BLADEPOINT
  '4080220': ['pc', 'ps', 'xbox'],  // EA SPORTS FC 27
  '3405690': ['pc', 'ps', 'xbox'],  // EA SPORTS FC 26
  '238960': ['pc', 'ps', 'xbox'],   // Path of Exile
  '1808500': ['pc', 'ps', 'xbox'],  // ARC Raiders
  '489830': ['pc', 'ps', 'xbox'],   // Skyrim Special Edition
  '892970': ['pc', 'xbox'],         // Valheim
  '1665460': ['pc', 'ps', 'xbox'],  // eFootball
  '252950': ['pc', 'ps', 'xbox'],   // Rocket League
  '292030': ['pc', 'ps', 'xbox'],   // The Witcher 3
  '1222670': ['pc', 'ps', 'xbox'],  // The Sims 4
  '1449850': ['pc', 'ps', 'xbox'],  // Yu-Gi-Oh! Master Duel
  '2483190': ['pc', 'xbox'],        // Forza Horizon 6
  '1364780': ['pc', 'ps', 'xbox'],  // Street Fighter 6
  '291550': ['pc', 'ps', 'xbox'],   // Brawlhalla
  '1158310': ['pc', 'ps', 'xbox'],  // Crusader Kings III
  '289070': ['pc', 'ps', 'xbox'],   // Sid Meier's Civilization VI
  '2300320': ['pc', 'ps', 'xbox'],  // Farming Simulator 25
  '1942280': ['pc', 'ps', 'xbox'],  // Brotato
  '244210': ['pc', 'ps', 'xbox'],   // Assetto Corsa
  '221100': ['pc', 'ps', 'xbox'],   // DayZ
  '261550': ['pc', 'ps', 'xbox'],   // Mount & Blade II: Bannerlord
  '813780': ['pc', 'ps', 'xbox'],   // Age of Empires II: Definitive Edition
  '294100': ['pc', 'ps', 'xbox'],   // RimWorld
  '1426210': ['pc', 'ps', 'xbox'],  // It Takes Two
  '1085660': ['pc', 'ps', 'xbox'],  // Destiny 2
  '251570': ['pc', 'ps', 'xbox'],   // 7 Days to Die
  '2073850': ['pc', 'ps', 'xbox'],  // THE FINALS
  '594650': ['pc', 'ps', 'xbox'],   // Hunt: Showdown 1896
  '2246340': ['pc', 'ps', 'xbox'],  // Monster Hunter Wilds
  '739630': ['pc', 'ps', 'xbox'],   // Phasmophobia
  '12210': ['pc', 'ps', 'xbox'],    // Grand Theft Auto IV
  '4115450': ['pc', 'ps'],          // Phantom Blade Zero
  '1623730': ['pc', 'ps', 'xbox'],  // Palworld
  '2358720': ['pc', 'ps', 'xbox'],  // Black Myth: Wukong
  '553850': ['pc', 'ps', 'xbox'],   // HELLDIVERS 2
};

// Flagship PlayStation & Xbox titles with verified covers
const FLAGSHIP_CONSOLE_GAMES = [
  {
    id: '2322010',
    name: 'God of War Ragnarök',
    date: '2022-11-09',
    platforms: ['pc', 'ps'],
    developer: 'Santa Monica Studio',
    publisher: 'PlayStation Publishing LLC',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/2322010/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/2322010/header.jpg',
    trend: 18500,
  },
  {
    id: '2215430',
    name: "Ghost of Tsushima DIRECTOR'S CUT",
    date: '2020-07-17',
    platforms: ['pc', 'ps'],
    developer: 'Sucker Punch Productions',
    publisher: 'PlayStation Publishing LLC',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/2215430/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/2215430/header.jpg',
    trend: 14200,
  },
  {
    id: '2651280',
    name: "Marvel's Spider-Man 2",
    date: '2023-10-20',
    platforms: ['pc', 'ps'],
    developer: 'Insomniac Games',
    publisher: 'PlayStation Publishing LLC',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/2651280/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/2651280/header.jpg',
    trend: 16800,
  },
  {
    id: '2531310',
    name: 'The Last of Us™ Part II Remastered',
    date: '2024-01-19',
    platforms: ['pc', 'ps'],
    developer: 'Naughty Dog LLC',
    publisher: 'PlayStation Publishing LLC',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/2531310/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/2531310/header.jpg',
    trend: 12900,
  },
  {
    id: '1649240',
    name: 'Returnal™',
    date: '2021-04-30',
    platforms: ['pc', 'ps'],
    developer: 'Housemarque',
    publisher: 'PlayStation Publishing LLC',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/1649240/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/1649240/header.jpg',
    trend: 4200,
  },
  {
    id: '1240440',
    name: 'Halo Infinite',
    date: '2021-12-08',
    platforms: ['pc', 'xbox'],
    developer: 'Halo Studios',
    publisher: 'Xbox Game Studios',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/1240440/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/1240440/header.jpg',
    trend: 9800,
  },
  {
    id: '1551360',
    name: 'Forza Horizon 5',
    date: '2021-11-09',
    platforms: ['pc', 'ps', 'xbox'],
    developer: 'Playground Games',
    publisher: 'Xbox Game Studios',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/1551360/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/1551360/header.jpg',
    trend: 21500,
  },
  {
    id: '2440510',
    name: 'Forza Motorsport',
    date: '2023-10-10',
    platforms: ['pc', 'xbox'],
    developer: 'Turn 10 Studios',
    publisher: 'Xbox Game Studios',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/2440510/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/2440510/header.jpg',
    trend: 3800,
  },
  {
    id: '1817230',
    name: 'Hi-Fi RUSH',
    date: '2023-01-25',
    platforms: ['pc', 'ps', 'xbox'],
    developer: 'Tango Gameworks',
    publisher: 'KRAFTON, Inc.',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/1817230/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/1817230/header.jpg',
    trend: 3400,
  },
  {
    id: '2461850',
    name: "Senua's Saga: Hellblade II",
    date: '2024-05-21',
    platforms: ['pc', 'ps', 'xbox'],
    developer: 'Ninja Theory',
    publisher: 'Xbox Game Studios',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/2461850/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/2461850/header.jpg',
    trend: 2900,
  },
  {
    id: '2677660',
    name: 'Indiana Jones and the Great Circle',
    date: '2024-12-09',
    platforms: ['pc', 'ps', 'xbox'],
    developer: 'MachineGames',
    publisher: 'Bethesda Softworks',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/2677660/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/2677660/header.jpg',
    trend: 11200,
  },
  {
    id: '1097840',
    name: 'Gears 5',
    date: '2019-09-10',
    platforms: ['pc', 'xbox'],
    developer: 'The Coalition',
    publisher: 'Xbox Game Studios',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/1097840/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/1097840/header.jpg',
    trend: 2400,
  },
  {
    id: '1716740',
    name: 'Starfield',
    date: '2023-09-06',
    platforms: ['pc', 'xbox'],
    developer: 'Bethesda Game Studios',
    publisher: 'Bethesda Softworks',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/1716740/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/1716740/header.jpg',
    trend: 13500,
  },
  {
    id: '1172620',
    name: 'Sea of Thieves',
    date: '2018-03-20',
    platforms: ['pc', 'ps', 'xbox'],
    developer: 'Rare Ltd',
    publisher: 'Xbox Game Studios',
    cover: 'https://cdn.akamai.steamstatic.com/steam/apps/1172620/library_600x900.jpg',
    hdr: 'https://cdn.akamai.steamstatic.com/steam/apps/1172620/header.jpg',
    trend: 19400,
  },
];

function enrichMultiplatformCatalog(db, byId, upsertCanonicalGame) {
  let enriched = 0;
  for (const [id, plats] of Object.entries(MULTIPLATFORM_MAP)) {
    const g = byId.get(id);
    if (g) {
      const before = (g.platforms || []).join(',');
      upsertCanonicalGame(db, byId, { id, name: g.name, platforms: plats });
      if ((g.platforms || []).join(',') !== before) enriched++;
    }
  }
  for (const seed of FLAGSHIP_CONSOLE_GAMES) {
    upsertCanonicalGame(db, byId, {
      ...seed,
      platformIds: { steam: seed.id },
      checked: Date.now(),
    });
  }
  return enriched;
}

module.exports = {
  enrichMultiplatformCatalog,
};
