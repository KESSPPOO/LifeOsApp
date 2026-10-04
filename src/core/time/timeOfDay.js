// src/core/time/timeOfDay.js
//
// Local wall-clock times of day as 'HH:mm' strings (24-hour, zero-padded:
// '09:05', '14:30'). Pure; no React. No timestamps, UTC or time zones: a
// time belongs to a local 'YYYY-MM-DD' date key (./dates.js).

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MINUTES_PER_DAY = 24 * 60;

/** true for a canonical 'HH:mm' string ('00:00' … '23:59'). */
export function isTimeOfDay(value) {
  return typeof value === 'string' && TIME_OF_DAY.test(value);
}

/** '14:30' -> 870 (minutes since midnight); anything else -> null. */
export function timeToMinutes(value) {
  if (!isTimeOfDay(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

/**
 * 870 -> '14:30'. Minutes past midnight wrap to the next day's clock time
 * (1470 -> '00:30'), which is how an end time after midnight is shown.
 */
export function minutesToTime(minutes) {
  const m = ((Math.floor(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Minutes since local midnight of a Date (the caller passes "now"). */
export function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * What a person types for a time -> canonical 'HH:mm', or null if it is not
 * a time. Accepts the Danish '10.45', '10:45', '10,45', '10 45', '1045', '945' and
 * whole hours ('9', '09').
 */
export function parseTimeInput(text) {
  const match = /^(\d{1,2})(?:[:., ]?(\d{2}))?$/.exec(String(text ?? '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return minutesToTime(hours * 60 + minutes);
}
