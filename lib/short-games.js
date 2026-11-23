'use strict';

const { normalizeTitle } = require('./dedupe');

/**
 * Curated set of notable short narrative / indie / experience games whose full
 * playthrough is typically under ~2.5 hours. For these titles, Playtested lowers
 * the minimum verified playtime floor from 2.0h to 0.5h (30 minutes) across
 * Steam, PlayStation, and Xbox — blocking 0h drive-by review bombing while
 * letting real players who finished a 1-hour game publish a verified score.
 *
 * In addition, ANY game on Steam or Xbox automatically unlocks at 0.5h+ when
 * the player has unlocked >= 50% of its achievements.
 */
const SHORT_GAME_TITLES = [
  'A Memoir Blue',
  'A Short Hike',
  'Abzu',
  'Abzû',
  'Alba: A Wildlife Adventure',
  'Anatomy',
  'Assemble with Care',
  'Before Your Eyes',
  'Behind the Frame',
  'Bramble: The Mountain King',
  'Brothers: A Tale of Two Sons',
  'Carrion',
  'Cocoon',
  'Dear Esther',
  'Donut County',
  'Emily Is Away',
  'Firewatch',
  'Florence',
  'Flower',
  'Frog Detective 1',
  'Frog Detective 2',
  'Frog Detective 3',
  'Gato Roboto',
  'Gone Home',
  'Gorogoa',
  'Gris',
  'Her Story',
  'Hindsight',
  'Inside',
  'Iron Lung',
  'Journey',
  'Limbo',
  'Little Nightmares',
  'Little Nightmares II',
  'Maquette',
  'Minit',
  'Mouthwashing',
  'Neva',
  'Open Roads',
  'Oxenfree',
  'Portal',
  'Refunct',
  'Sayonara Wild Hearts',
  'Superhot',
  'Tacoma',
  'The Artful Escape',
  'The Beginners Guide',
  "The Beginner's Guide",
  'The Stanley Parable',
  'The Unfinished Swan',
  'Thirty Flights of Loving',
  'To the Moon',
  'Twelve Minutes',
  'Unpacking',
  'Untitled Goose Game',
  'Venba',
  'Viewfinder',
  'What Remains of Edith Finch',
  'Wide Ocean Big Jacket',
];

const SHORT_GAME_KEYS = new Set(SHORT_GAME_TITLES.map((t) => normalizeTitle(t)).filter(Boolean));

const SHORT_MIN_HOURS = 0.5;
const ACHIEVEMENT_UNLOCK_MIN_HOURS = 0.5;
const ACHIEVEMENT_UNLOCK_PCT = 50;

function isShortGame(game) {
  if (!game) return false;
  const key = game.canonicalKey || normalizeTitle(game.name || '');
  return Boolean(key && SHORT_GAME_KEYS.has(key));
}

function getMinHoursForGame(game, defaultMinHours = 2) {
  return isShortGame(game) ? SHORT_MIN_HOURS : defaultMinHours;
}

module.exports = {
  SHORT_MIN_HOURS,
  ACHIEVEMENT_UNLOCK_MIN_HOURS,
  ACHIEVEMENT_UNLOCK_PCT,
  isShortGame,
  getMinHoursForGame,
};
