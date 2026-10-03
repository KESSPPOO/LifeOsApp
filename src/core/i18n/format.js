// src/core/i18n/format.js
//
// Danish (da-DK) formatting for dates, numbers and money. Pure; no React.
//
// Hand-written instead of Intl on purpose: Hermes' Intl output depends on
// the device's ICU data and differs between Android versions (and from
// Node, where the tests run), e.g. "lørdag 3. oktober" vs "lørdag den 3.
// oktober". These rules are small, fixed and tested, so every device shows
// the same text.
import { capitalize } from '../../data/helpers.js';
import { isDateKey, parseDateKey, weekdayIndex, daysBetween } from '../time/dates.js';

/** Monday-first, like the Danish week. Index with weekdayIndex(). */
export const WEEKDAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
export const MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

/** '2026-10-03' -> '3. oktober' (with the year when it differs from `today`'s). */
export function formatDayMonth(key, today) {
  const d = parseDateKey(key);
  const base = `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  return today && key.slice(0, 4) !== today.slice(0, 4) ? `${base} ${d.getFullYear()}` : base;
}

/** '2026-10-03' -> 'Lørdag den 3. oktober' (a heading). */
export function formatDateLong(key) {
  return capitalize(`${WEEKDAYS[weekdayIndex(key)]} den ${formatDayMonth(key)}`);
}

/**
 * A date relative to `today`, lower-case for use inside a sentence:
 * 'i dag', 'i går', 'i morgen', the weekday name within six days either
 * way (unambiguous), otherwise '3. oktober'. Anything that is not a date
 * key is returned unchanged.
 */
export function formatRelativeDay(key, today) {
  if (!isDateKey(key)) return String(key ?? '');
  const diff = daysBetween(today, key);
  if (diff === 0) return 'i dag';
  if (diff === -1) return 'i går';
  if (diff === 1) return 'i morgen';
  if (Math.abs(diff) <= 6) return WEEKDAYS[weekdayIndex(key)];
  return formatDayMonth(key, today);
}

/**
 * 1234.5 -> '1.234,5'. Thousands with '.', decimals with ','; at most
 * `maxDecimals` decimals, trailing zeros dropped. Not a number -> '–'.
 */
export function formatNumber(value, maxDecimals = 2) {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n)) return '–';
  const [int, frac = ''] = Math.abs(n).toFixed(maxDecimals).split('.');
  const decimals = frac.replace(/0+$/, '');
  const negative = n < 0 && Number(int) + Number(decimals || 0) > 0;
  return `${negative ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${decimals ? `,${decimals}` : ''}`;
}

/** 1234.5 -> '1.234,50 kr.' (always two decimals; non-breaking space). */
export function formatMoney(value) {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n)) return '–';
  const fixed = formatNumber(n, 2);
  const [int, frac = ''] = fixed.split(',');
  return `${int},${frac.padEnd(2, '0')} kr.`;
}
