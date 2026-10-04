// Danish string lookup and formatting (src/core/i18n). Deterministic: no
// Intl, no clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  t, formatNumber, formatMoney, formatDateLong, formatDayMonth, formatDateRange, formatRelativeDay,
} from '../src/core/i18n/index.js';
import { da } from '../src/core/i18n/da.js';
import { repoPath, sourceFiles } from './fixtures.mjs';

test('t() looks up, fills placeholders and picks plural forms', () => {
  assert.equal(t('nav.today'), 'I dag');
  assert.equal(t('task.progress', { done: 2, total: 5 }), '2 af 5 klaret i dag');
  assert.equal(t('today.restMore', { count: 1 }), '1 opgave mere i Plan');
  assert.equal(t('today.restMore', { count: 3 }), '3 opgaver mere i Plan');
  assert.equal(t('today.restMore', { count: 0 }), '0 opgaver mere i Plan');
  // Numbers in params are formatted the Danish way.
  assert.equal(t('today.shopping', { count: 1200 }), '1.200 ting på indkøbslisten');
  // A missing param stays visible instead of turning into "undefined".
  assert.equal(t('today.greetingName', { greeting: 'Hej' }), 'Hej, {name}');
});

test('t() returns an unknown key unchanged (no crash)', () => {
  assert.equal(t('does.not.exist'), 'does.not.exist');
  assert.equal(t('does.not.exist', { count: 2 }), 'does.not.exist');
});

test('every string entry is non-empty; plural entries have one and other', () => {
  for (const [key, v] of Object.entries(da)) {
    if (typeof v === 'string') assert.ok(v.trim(), key);
    else assert.ok(v.one && v.other, key);
  }
});

test('every i18n key written in src exists in da.js', () => {
  const files = sourceFiles(repoPath('../src')).filter(f => !f.endsWith('da.js'));
  // Every string that starts with one of the table's prefixes ('today.', …).
  const prefixes = [...new Set(Object.keys(da).map(k => k.split('.')[0]))].join('|');
  const keyLike = new RegExp(`['"\`]((?:${prefixes})\\.[\\w.]+)['"\`]`, 'g');
  const used = files.flatMap(f => [...readFileSync(f, 'utf8').matchAll(keyLike)].map(m => [m[1], f]));
  assert.ok(used.length > 20, 'the scan finds the keys');
  for (const [key, file] of used) assert.ok(key in da, `${key} in ${file}`);
});

test('formatNumber: Danish separators, trailing zeros dropped', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(12.5), '12,5');
  assert.equal(formatNumber(1234), '1.234');
  assert.equal(formatNumber(1234567.891), '1.234.567,89');
  assert.equal(formatNumber(-1234.5), '-1.234,5');
  assert.equal(formatNumber(2.004), '2');
  assert.equal(formatNumber(-0.001), '0');
  assert.equal(formatNumber(1.25, 1), '1,3');
  // Half-up on the written value, not on the binary double.
  assert.equal(formatNumber(8.345), '8,35');
  assert.equal(formatNumber(0.1 + 0.2), '0,3');
  assert.equal(formatNumber(1e-7), '0');
  assert.equal(formatNumber('42'), '42');
  for (const v of [NaN, Infinity, 'abc', null, undefined, '']) assert.equal(formatNumber(v), '–', String(v));
});

test('formatMoney: DKK with two decimals and "kr."', () => {
  assert.equal(formatMoney(0), '0,00\u00a0kr.');
  assert.equal(formatMoney(12.5), '12,50\u00a0kr.');
  assert.equal(formatMoney(1234.56), '1.234,56\u00a0kr.');
  assert.equal(formatMoney(-1234.5), '-1.234,50\u00a0kr.');
  assert.equal(formatMoney(1000000), '1.000.000,00\u00a0kr.');
  assert.equal(formatMoney(1.005), '1,01\u00a0kr.');
  assert.equal(formatMoney(-2.675), '-2,68\u00a0kr.');
  assert.equal(formatMoney(1e15), '1.000.000.000.000.000,00\u00a0kr.');
  assert.equal(formatMoney(NaN), '–');
});

test('formatDateLong: Danish weekday and month', () => {
  assert.equal(formatDateLong('2026-10-03'), 'Lørdag den 3. oktober');
  assert.equal(formatDateLong('2026-09-28'), 'Mandag den 28. september');
  assert.equal(formatDateLong('2027-01-01'), 'Fredag den 1. januar');
});

test('formatDateRange: one month, two months, two years', () => {
  assert.equal(formatDateRange('2026-10-05', '2026-10-11', '2026-10-03'), '5.–11. oktober');
  assert.equal(formatDateRange('2026-09-28', '2026-10-04', '2026-10-03'), '28. september – 4. oktober');
  assert.equal(formatDateRange('2026-12-28', '2027-01-03', '2026-10-03'), '28. december – 3. januar 2027');
  assert.equal(formatDateRange('2027-05-03', '2027-05-09', '2026-10-03'), '3.–9. maj 2027');
});

test('formatDayMonth adds the year only when it differs from today', () => {
  assert.equal(formatDayMonth('2026-05-17', '2026-10-03'), '17. maj');
  assert.equal(formatDayMonth('2027-05-17', '2026-10-03'), '17. maj 2027');
  assert.equal(formatDayMonth('2027-05-17'), '17. maj');
});

test('formatRelativeDay: i dag / i går / i morgen / weekday / date', () => {
  const today = '2026-10-03'; // Saturday
  assert.equal(formatRelativeDay('2026-10-03', today), 'i dag');
  assert.equal(formatRelativeDay('2026-10-02', today), 'i går');
  assert.equal(formatRelativeDay('2026-10-04', today), 'i morgen');
  assert.equal(formatRelativeDay('2026-09-28', today), 'mandag');
  assert.equal(formatRelativeDay('2026-10-09', today), 'fredag');
  assert.equal(formatRelativeDay('2026-09-26', today), '26. september');
  assert.equal(formatRelativeDay('2026-10-10', today), '10. oktober');
  assert.equal(formatRelativeDay('2027-01-05', today), '5. januar 2027');
  assert.equal(formatRelativeDay('not a date', today), 'not a date');
  assert.equal(formatRelativeDay(null, today), '');
});
