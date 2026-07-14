/**
 * Jalali (Persian) <-> Gregorian calendar conversion.
 *
 * Algorithm adapted from jalaali-js (https://github.com/jalaali/jalaali-js),
 * MIT licensed, based on the work of Kazimierz M. Borkowski.
 */

export const JALALI_MONTHS = [
  'Farvardin',
  'Ordibehesht',
  'Khordad',
  'Tir',
  'Mordad',
  'Shahrivar',
  'Mehr',
  'Aban',
  'Azar',
  'Dey',
  'Bahman',
  'Esfand'
];

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, 3178
];

function div(a, b) {
  return ~~(a / b);
}

function mod(a, b) {
  return a - ~~(a / b) * b;
}

/**
 * Leap-year and March-day data for a Jalali year.
 * Valid for jy in [-61, 3177] (1 BC to 3797 AD).
 */
function jalCal(jy) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];

  if (jy < jp || jy >= BREAKS[bl - 1]) {
    throw new Error(`Invalid Jalali year ${jy}`);
  }

  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

/** Gregorian date -> Julian Day Number. */
function g2d(gy, gm, gd) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** Julian Day Number -> Gregorian date. */
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

/** Jalali date -> Julian Day Number. */
function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

/** Julian Day Number -> Jalali date. */
function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jm;
  let jd;
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

/**
 * Convert a Gregorian date to Jalali.
 * @returns {{jy: number, jm: number, jd: number}} 1-based month.
 */
export function toJalali(gy, gm, gd) {
  return d2j(g2d(gy, gm, gd));
}

/**
 * Convert a Jalali date to Gregorian.
 * @returns {{gy: number, gm: number, gd: number}} 1-based month.
 */
export function toGregorian(jy, jm, jd) {
  return d2g(j2d(jy, jm, jd));
}

/** True if the Jalali year is a leap year. */
export function isLeapJalaliYear(jy) {
  return jalCal(jy).leap === 0;
}

/** Format a Jalali date as "YYYY-MM-DD (DD MonthName YYYY)". */
export function formatJalali(jy, jm, jd) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${jy}-${pad(jm)}-${pad(jd)} (${jd} ${JALALI_MONTHS[jm - 1]} ${jy})`;
}
