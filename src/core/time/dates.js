// src/core/time/dates.js
//
// Calendar-date arithmetic on local 'YYYY-MM-DD' keys (the format every
// stored date uses). Pure; no React. Weeks start on MONDAY (Danish/ISO).
//
// Keys are always parsed as LOCAL dates (new Date(y, m - 1, d)), never with
// new Date('YYYY-MM-DD'), which parses as UTC midnight and lands on the
// previous day west of UTC. Day differences are rounded, so the 23- and
// 25-hour days at a daylight-saving switch still count as one day.

// Builds a 'YYYY-MM-DD' key from a Date's LOCAL year/month/day — never use
// toISOString() for this. toISOString() always converts to UTC first, so
// for any timezone ahead of UTC (Denmark is UTC+1/+2), calling it between
// midnight and 1-2am local time silently returns YESTERDAY's date, and
// calling it on local midnight of a specific day (e.g. the 1st of a month)
// can shift the result back into the previous month entirely. Every place
// in this app that turns a Date into a 'YYYY-MM-DD' or 'YYYY-MM' key goes
// through this function instead, so there's exactly one place to get the
// timezone handling right.
export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
