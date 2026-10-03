// Calendar-date helpers (src/core/time/dates.js): local keys, Monday-first
// weeks, ISO week numbers. The cases around 29 March / 25 October are the
// Danish daylight-saving switches (23- and 25-hour days).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDateKey, addDays, daysBetween, weekdayIndex, startOfWeek, isoWeekNumber,
} from '../src/core/time/dates.js';

test('isDateKey accepts only YYYY-MM-DD strings', () => {
  assert.equal(isDateKey('2026-10-03'), true);
  for (const v of ['2026-10-3', '03-10-2026', '', null, undefined, 20261003]) assert.equal(isDateKey(v), false, String(v));
});

test('addDays crosses month, year and daylight-saving boundaries', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-03-01', -1), '2028-02-29');
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(addDays('2026-10-03', 0), '2026-10-03');
});

test('daysBetween counts calendar days, including across DST', () => {
  assert.equal(daysBetween('2026-10-03', '2026-10-03'), 0);
  assert.equal(daysBetween('2026-10-03', '2026-10-10'), 7);
  assert.equal(daysBetween('2026-10-10', '2026-10-03'), -7);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
});

test('weeks start on Monday', () => {
  // 2026-09-28 is a Monday, 2026-10-04 a Sunday.
  assert.equal(weekdayIndex('2026-09-28'), 0);
  assert.equal(weekdayIndex('2026-10-03'), 5);
  assert.equal(weekdayIndex('2026-10-04'), 6);
  assert.equal(startOfWeek('2026-10-04'), '2026-09-28');
  assert.equal(startOfWeek('2026-09-28'), '2026-09-28');
  assert.equal(startOfWeek('2027-01-01'), '2026-12-28');
});

test('ISO week numbers (Danish "uge")', () => {
  assert.equal(isoWeekNumber('2026-10-03'), 40);
  assert.equal(isoWeekNumber('2026-01-01'), 1);  // Thursday
  assert.equal(isoWeekNumber('2027-01-01'), 53); // Friday: still 2026's week 53
  assert.equal(isoWeekNumber('2027-01-04'), 1);
  assert.equal(isoWeekNumber('2024-12-30'), 1);  // Monday of 2025's week 1
  assert.equal(isoWeekNumber('2026-12-31'), 53);
});
