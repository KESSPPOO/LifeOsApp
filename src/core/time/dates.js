// src/core/time/dates.js
//
// Calendar-date arithmetic on local 'YYYY-MM-DD' keys (the format every
// stored date uses). Pure; no React. Weeks start on MONDAY (Danish/ISO).
//
// Keys are always parsed as LOCAL dates (new Date(y, m - 1, d)), never with
// new Date('YYYY-MM-DD'), which parses as UTC midnight and lands on the
// previous day west of UTC. Day differences are rounded, so the 23- and
// 25-hour days at a daylight-saving switch still count as one day.
import { localDateKey } from '../../data/helpers.js';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

/** true for a 'YYYY-MM-DD' string (format only). */
export function isDateKey(value) {
  return typeof value === 'string' && DATE_KEY.test(value);
}

/** 'YYYY-MM-DD' -> Date at LOCAL midnight. */
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The key `n` days after `key` (negative = before). */
export function addDays(key, n) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return localDateKey(d);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from, to) {
  return Math.round((parseDateKey(to) - parseDateKey(from)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key) {
  return (parseDateKey(key).getDay() + 6) % 7;
}

/** The Monday of the week containing `key`. */
export function startOfWeek(key) {
  return addDays(key, -weekdayIndex(key));
}

/**
 * ISO 8601 week number ("uge 40"), as used in Denmark: weeks start on
 * Monday, and week 1 is the week containing 4 January.
 */
export function isoWeekNumber(key) {
  // The ISO year is the year of this week's Thursday.
  const thursday = addDays(key, 3 - weekdayIndex(key));
  const week1Monday = startOfWeek(`${thursday.slice(0, 4)}-01-04`);
  return Math.floor(daysBetween(week1Monday, key) / 7) + 1;
}
