'use strict';

/**
 * Mandatory 4-question weighted scoring model for Playtested.
 *
 * Each question is scored 0–10 (whole integers, all 4 required):
 *   Q1 Fun           (0–10) -> 0–50 pts  (weight 5.0)
 *   Q2 Performance   (0–10) -> 0–15 pts  (weight 1.5, cumulative max 65)
 *   Q3 Gameplay loop (0–10) -> 0–20 pts  (weight 2.0, cumulative max 85)
 *   Q4 Visuals       (0–10) -> 0–15 pts  (weight 1.5, cumulative max 100)
 */
const REVIEW_QUESTIONS = [
  {
    key: 'fun',
    label: 'Is the game fun?',
    shortLabel: 'Fun',
    tooltip:
      'Games are made primarily so we can have fun, so tell here how much you enjoyed your time in this game.',
    maxPoints: 50,
    weight: 5,
  },
  {
    key: 'performance',
    label: 'Is the game performance good?',
    shortLabel: 'Performance',
    tooltip: 'Consider minimum and recommended specs.',
    maxPoints: 15,
    weight: 1.5,
  },
  {
    key: 'gameplay',
    label: 'Is the gameplay loop good?',
    shortLabel: 'Gameplay loop',
    tooltip: 'Consider the main premises and mechanics here and how engaging they are.',
    maxPoints: 20,
    weight: 2,
  },
  {
    key: 'visuals',
    label: 'Does the game look good?',
    shortLabel: 'Visuals',
    tooltip:
      'Keep in mind that the art direction can be pixel art and a game can still look good in that design.',
    maxPoints: 15,
    weight: 1.5,
  },
];

function parseAndValidateBreakdown(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'All 4 rating questions must be answered (0–10 each).' };
  }
  const breakdown = {};
  for (const q of REVIEW_QUESTIONS) {
    const val = raw[q.key];
    if (val === undefined || val === null || val === '') {
      return { ok: false, error: `Please answer: "${q.label}" (0–10).` };
    }
    const num = Number(val);
    if (!Number.isInteger(num) || num < 0 || num > 10) {
      return { ok: false, error: `"${q.label}" must be a whole number between 0 and 10.` };
    }
    breakdown[q.key] = num;
  }
  return { ok: true, breakdown };
}

function computeWeightedScore(breakdown) {
  let raw = 0;
  for (const q of REVIEW_QUESTIONS) {
    raw += breakdown[q.key] * q.weight;
  }
  return Math.min(100, Math.max(0, Math.round(raw)));
}

function normalizeStoredBreakdown(raw) {
  const res = parseAndValidateBreakdown(raw);
  return res.ok ? res.breakdown : null;
}

module.exports = {
  REVIEW_QUESTIONS,
  parseAndValidateBreakdown,
  computeWeightedScore,
  normalizeStoredBreakdown,
};
