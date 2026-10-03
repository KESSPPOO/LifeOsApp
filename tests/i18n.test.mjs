// Danish string lookup and formatting (src/core/i18n). Deterministic: no
// Intl, no clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  t, formatNumber, formatMoney, formatDateLong, formatDayMonth, formatRelativeDay, WEEKDAYS,
} from '../src/core/i18n/index.js';
import { da } from '../src/core/i18n/da.js';

const path = (rel) => fileURLToPath(new URL(rel, import.meta.url));

test('t() looks up, fills placeholders and picks plural forms', () => {
  assert.equal(t('nav.today'), 'I dag');
  assert.equal(t('today.progress', { done: 2, total: 5 }), '2 af 5 klaret i dag');
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

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith('.js') ? [p] : [];
  });
}

test('every i18n key written in src exists in da.js', () => {
  const files = sourceFiles(path('../src')).filter(f => !f.endsWith('da.js'));
  const keyLike = /['"`]((?:nav|shell|more|today)\.[\w.]+)['"`]/g;
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
  assert.equal(formatNumber('42'), '42');
  for (const v of [NaN, Infinity, 'abc', null, undefined, '']) assert.equal(formatNumber(v), '–', String(v));
});

test('formatMoney: DKK with two decimals and "kr."', () => {
  assert.equal(formatMoney(0), '0,00 kr.');
  assert.equal(formatMoney(12.5), '12,50 kr.');
  assert.equal(formatMoney(1234.56), '1.234,56 kr.');
  assert.equal(formatMoney(-1234.5), '-1.234,50 kr.');
  assert.equal(formatMoney(1000000), '1.000.000,00 kr.');
  assert.equal(formatMoney(NaN), '–');
});

test('formatDateLong: Danish weekday and month, Monday-first table', () => {
  assert.equal(formatDateLong('2026-10-03'), 'Lørdag den 3. oktober');
  assert.equal(formatDateLong('2026-09-28'), 'Mandag den 28. september');
  assert.equal(formatDateLong('2027-01-01'), 'Fredag den 1. januar');
  assert.equal(WEEKDAYS[0], 'mandag');
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
