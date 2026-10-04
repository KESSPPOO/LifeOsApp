// src/core/i18n/format.js
//
// Danish (da-DK) formatting for dates, numbers and money. Pure; no React.
//
// Hand-written instead of Intl on purpose: Hermes' Intl output depends on
// the device's ICU data and differs between Android versions (and from
// Node, where the tests run), e.g. "lørdag 3. oktober" vs "lørdag den 3.
// oktober". These rules are small, fixed and tested, so every device shows
// the same text.
import { isDateKey, parseDateKey, weekdayIndex, daysBetween } from '../time/dates.js';

/** Monday-first, like the Danish week. Index with weekdayIndex(). */
const WEEKDAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
const MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

/**
 * The name of an ISO weekday (1 = mandag … 7 = søndag), capitalised:
 * 'long' 'Mandag', 'short' 'Man', 'letter' 'M'.
 */
export function weekdayName(isoDay, form = 'long') {
  const name = WEEKDAYS[isoDay - 1];
  const text = form === 'letter' ? name.slice(0, 1) : form === 'short' ? name.slice(0, 3) : name;
  return text[0].toUpperCase() + text.slice(1);
}

/** '2026-10-03' -> '3. oktober' (with the year when it differs from `today`'s). */
export function formatDayMonth(key, today) {
  const d = parseDateKey(key);
  const base = `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  return today && key.slice(0, 4) !== today.slice(0, 4) ? `${base} ${d.getFullYear()}` : base;
}

/**
 * A span of days, e.g. a week: '5.–11. oktober' within one month,
 * otherwise '28. september – 4. oktober' (each date with its year when it
 * differs from `today`'s, so '29. december 2025 – 4. januar').
 */
export function formatDateRange(from, to, today) {
  if (from.slice(0, 7) === to.slice(0, 7)) return `${parseDateKey(from).getDate()}.–${formatDayMonth(to, today)}`;
  return `${formatDayMonth(from, today)} – ${formatDayMonth(to, today)}`;
}

/** (2026, 9) -> 'oktober 2026' (monthIndex 0 = januar). */
export function formatMonthYear(year, monthIndex) {
  return `${MONTHS[monthIndex]} ${year}`;
}

/**
 * '2026-10-03' -> 'Lørdag den 3. oktober' (a heading); with `today`, the
 * year is added when it differs ('Fredag den 1. januar 2027').
 */
export function formatDateLong(key, today) {
  const text = `${WEEKDAYS[weekdayIndex(key)]} den ${formatDayMonth(key, today)}`;
  return text[0].toUpperCase() + text.slice(1);
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

// x * 10^e done on the decimal string ('1.005e2' -> 100.5), so rounding is
// half-up on the written value: toFixed alone rounds the binary double,
// turning 1.005 into '1.00'.
function shiftDecimal(x, e) {
  const [mantissa, exp = '0'] = String(x).split('e');
  return Number(`${mantissa}e${Number(exp) + e}`);
}

/**
 * 1234.5 -> '1.234,5'. Thousands with '.', decimals with ','; at most
 * `maxDecimals` decimals, trailing zeros dropped down to `minDecimals`.
 * Not a number -> '–'.
 */
export function formatNumber(value, maxDecimals = 2, minDecimals = 0) {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n)) return '–';
  const rounded = shiftDecimal(Math.round(shiftDecimal(Math.abs(n), maxDecimals)), -maxDecimals);
  const [int, frac = ''] = rounded.toFixed(maxDecimals).split('.');
  const decimals = frac.replace(/0+$/, '').padEnd(minDecimals, '0');
  const negative = n < 0 && Number(int) + Number(decimals || 0) > 0;
  return `${negative ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${decimals ? `,${decimals}` : ''}`;
}

/** 1234.5 -> '1.234,50 kr.' (always two decimals; non-breaking space). */
export function formatMoney(value) {
  const text = formatNumber(value, 2, 2);
  return text === '–' ? text : `${text}\u00a0kr.`;
}

/**
 * A duration in minutes, the way it is said: 15 -> '15 min', 60 -> '1 time',
 * 90 -> '1,5 time', 120 -> '2 timer', 75 -> '1 t 15 min'.
 */
export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 30 === 0) {
    const hours = minutes / 60;
    return `${formatNumber(hours, 1)} ${hours < 2 ? 'time' : 'timer'}`;
  }
  return `${Math.floor(minutes / 60)} t ${minutes % 60} min`;
}

