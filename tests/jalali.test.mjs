import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toJalali,
  toGregorian,
  isLeapJalaliYear,
  formatJalali
} from '../extension/lib/jalali.js';

// Known Gregorian <-> Jalali pairs, including the year-dependent shift the
// original Python prompt called out (28 Shahrivar = 18 Sep in 2024 but
// 19 Sep in 2023).
const PAIRS = [
  { g: [2024, 3, 20], j: [1403, 1, 1] }, // Nowruz 2024
  { g: [2023, 3, 21], j: [1402, 1, 1] }, // Nowruz 2023
  { g: [2021, 3, 21], j: [1400, 1, 1] }, // Nowruz 2021
  { g: [2024, 9, 18], j: [1403, 6, 28] },
  { g: [2023, 9, 19], j: [1402, 6, 28] },
  { g: [2025, 12, 31], j: [1404, 10, 10] },
  { g: [2026, 7, 14], j: [1405, 4, 23] }
];

test('Gregorian -> Jalali known dates', () => {
  for (const { g, j } of PAIRS) {
    const r = toJalali(...g);
    assert.deepEqual([r.jy, r.jm, r.jd], j, `toJalali(${g})`);
  }
});

test('Jalali -> Gregorian known dates', () => {
  for (const { g, j } of PAIRS) {
    const r = toGregorian(...j);
    assert.deepEqual([r.gy, r.gm, r.gd], g, `toGregorian(${j})`);
  }
});

test('round-trip across a decade of days', () => {
  const start = Date.UTC(2020, 0, 1);
  for (let i = 0; i < 3653; i += 1) {
    const d = new Date(start + i * 86400000);
    const gy = d.getUTCFullYear();
    const gm = d.getUTCMonth() + 1;
    const gd = d.getUTCDate();
    const j = toJalali(gy, gm, gd);
    const g = toGregorian(j.jy, j.jm, j.jd);
    assert.deepEqual([g.gy, g.gm, g.gd], [gy, gm, gd], d.toISOString());
  }
});

test('leap years', () => {
  assert.equal(isLeapJalaliYear(1403), true); // 1403 has 366 days
  assert.equal(isLeapJalaliYear(1404), false);
});

test('formatJalali', () => {
  assert.equal(formatJalali(1403, 6, 28), '1403-06-28 (28 Shahrivar 1403)');
});
