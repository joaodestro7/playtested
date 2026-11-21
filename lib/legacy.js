'use strict';

/**
 * Determines whether a game on a given platform belongs to a pre-API legacy era
 * where digital library & playtime verification is technically impossible.
 *
 * Rules:
 * - PlayStation: Sony's gamelist/v2 API only tracks PS4 and PS5. Games released
 *   exclusively on PS1, PS2, and/or PS3 (or pre-2013 without PS4/PS5) qualify.
 * - Xbox: Xbox TitleHub tracks Xbox 360, Xbox One, and Xbox Series X|S.
 *   Original Xbox (2001-2005) titles without a modern Xbox release qualify.
 * - PC: Any game on Steam requires real Steam ownership + 2h+ playtime. Only
 *   pre-Steam PC classics (before 2005 with no Steam AppID) qualify.
 *
 * Even for legacy classics, the user MUST still be signed in on that exact
 * platform, and is still limited to one editable review per account per game.
 */
function getLegacyStatus(game, platform) {
  if (!game || !(game.platforms || []).includes(platform)) {
    return { legacy: false, era: '', reason: '' };
  }

  const gens = Array.isArray(game.generations) ? game.generations : [];
  const year = Number(String(game.date || '').slice(0, 4)) || 0;

  if (platform === 'ps') {
    const hasModernPs = gens.some((g) => g === 'PS4' || g === 'PS5');
    const classicGens = gens.filter((g) => g === 'PS1' || g === 'PS2' || g === 'PS3');
    if (classicGens.length && !hasModernPs) {
      const era = classicGens.join(' / ');
      return {
        legacy: true,
        era,
        reason: `${era} classic — PlayStation does not expose digital library or playtime records for PS1–PS3`,
      };
    }
    if (!gens.length && year > 0 && year < 2013) {
      return {
        legacy: true,
        era: 'Pre-PS4',
        reason: 'Pre-PS4 PlayStation classic — no digital library or playtime API exists',
      };
    }
    return { legacy: false, era: '', reason: '' };
  }

  if (platform === 'xbox') {
    const hasModernXbox = gens.some(
      (g) => g === 'Xbox 360' || g === 'Xbox One' || g === 'Xbox Series X|S'
    );
    const hasOriginalXbox = gens.includes('Xbox');
    if (hasOriginalXbox && !hasModernXbox) {
      return {
        legacy: true,
        era: 'Original Xbox',
        reason: 'Original Xbox classic — no digital playtime telemetry API exists',
      };
    }
    if (!gens.length && year > 0 && year < 2006) {
      return {
        legacy: true,
        era: 'Original Xbox',
        reason: 'Original Xbox classic — no digital playtime telemetry API exists',
      };
    }
    return { legacy: false, era: '', reason: '' };
  }

  if (platform === 'pc') {
    const hasSteamId = Boolean(game.platformIds?.steam || /^\d+$/.test(String(game.id || '')));
    if (!hasSteamId && year > 0 && year < 2005) {
      return {
        legacy: true,
        era: 'Classic PC',
        reason: 'Pre-Steam PC classic — no Steam library record exists',
      };
    }
    return { legacy: false, era: '', reason: '' };
  }

  return { legacy: false, era: '', reason: '' };
}

module.exports = {
  getLegacyStatus,
};
