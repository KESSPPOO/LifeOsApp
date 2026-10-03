// Tests for src/core/storage (engine + versioned migrations).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, createMemoryAdapter } from '../src/core/storage/engine.js';
import { runMigrations, SCHEMA_VERSION, MIGRATIONS } from '../src/core/storage/migrations.js';
import { KEYS, KEY_SPECS } from '../src/core/storage/keys.js';
import { LEGACY_JOURNAL, LEGACY_HABITS, rawStore, quietLogger } from './fixtures.mjs';

function setup(values = {}) {
  const logger = quietLogger();
  const adapter = createMemoryAdapter(rawStore(values));
  return { adapter, logger, storage: createStorage(adapter, { logger }) };
}
const parsed = (adapter, key) => JSON.parse(adapter.data[`lifeos_${key}`]);

// ── Engine ──────────────────────────────────────────────────────────────────

test('load: missing key gives the fallback; stored JSON is parsed', async () => {
  const { storage } = setup({ userName: '"Ada"' });
  assert.equal(await storage.load('userName', ''), 'Ada');
  assert.deepEqual(await storage.load('goals', ['seed']), ['seed']);
  assert.deepEqual(await storage.read('goals'), { status: 'missing', value: undefined });
});

test('corrupt JSON falls back and the raw value is backed up, not lost', async () => {
  const { storage, adapter } = setup({ journal: '[{"id":1,' });
  assert.deepEqual(await storage.load('journal', [], { type: 'array' }), []);
  assert.equal(adapter.data.lifeos_corrupt_journal, '[{"id":1,');
  assert.equal(adapter.data.lifeos_journal, '[{"id":1,', 'original is left in place');
});

test('a value of the wrong type counts as corrupt when a type is given', async () => {
  const { storage, adapter } = setup({ journal: { not: 'an array' } });
  const r = await storage.read('journal', { type: 'array' });
  assert.equal(r.status, 'corrupt');
  assert.equal(adapter.data.lifeos_corrupt_journal, '{"not":"an array"}');
  // Without a type the legacy behaviour is kept: any valid JSON is returned.
  assert.deepEqual(await storage.load('journal', []), { not: 'an array' });
});

test('an adapter read error is reported as "error" and nothing is backed up', async () => {
  const { storage, adapter } = setup({ journal: [] });
  adapter.getItem = async () => { throw new Error('disk'); };
  assert.equal((await storage.read('journal')).status, 'error');
  assert.equal(await storage.load('journal', 'fb'), 'fb');
  assert.equal(adapter.data.lifeos_corrupt_journal, undefined);
});

test('loadMany reads all keys in one multiGet and applies fallbacks', async () => {
  const { storage, adapter } = setup({ userName: '"Ada"', exams: 'not json' });
  let multiGetCalls = 0;
  const original = adapter.multiGet;
  adapter.multiGet = async (keys) => { multiGetCalls++; return original(keys); };
  const data = await storage.loadMany([
    { key: 'userName', fallback: '' },
    { key: 'exams', fallback: ['seed'] },
    { key: 'goals', fallback: [] },
  ]);
  assert.equal(multiGetCalls, 1);
  assert.deepEqual(data, { userName: 'Ada', exams: ['seed'], goals: [] });
  assert.equal(adapter.data.lifeos_corrupt_exams, 'not json');
});

test('loadMany falls back to single reads if multiGet fails', async () => {
  const { storage, adapter } = setup({ userName: '"Ada"' });
  adapter.multiGet = async () => { throw new Error('boom'); };
  assert.deepEqual(await storage.loadMany([{ key: 'userName', fallback: '' }]), { userName: 'Ada' });
});

test('save / saveMany report failure instead of throwing', async () => {
  const { storage, adapter } = setup();
  assert.equal(await storage.save('a', [1]), true);
  assert.equal(await storage.saveMany({ b: 1, c: 'x' }), true);
  assert.deepEqual([parsed(adapter, 'a'), parsed(adapter, 'b'), parsed(adapter, 'c')], [[1], 1, 'x']);
  adapter.setItem = async () => { throw new Error('full'); };
  adapter.multiSet = async () => { throw new Error('full'); };
  assert.equal(await storage.save('a', [2]), false);
  assert.equal(await storage.saveMany({ b: 2 }), false);
});

test('every key used in KEYS has a documented type and owner', () => {
  for (const [k, spec] of Object.entries(KEY_SPECS)) {
    assert.equal(KEYS[k], k);
    assert.ok(spec.type && spec.owner && spec.description, k);
  }
});

// ── Migrations ──────────────────────────────────────────────────────────────

test('migration versions are contiguous and end at SCHEMA_VERSION', () => {
  MIGRATIONS.forEach((m, i) => assert.equal(m.version, i + 1));
  assert.equal(MIGRATIONS.at(-1).version, SCHEMA_VERSION);
});

test('fresh install: version is recorded, journal is not written (demo data stays unsaved)', async () => {
  const { storage, adapter } = setup();
  const r = await runMigrations(storage, { seedJournal: [{ id: 99 }] });
  assert.deepEqual(r, { from: 0, to: SCHEMA_VERSION, applied: ['merge-legacy-habits-into-journal'] });
  assert.equal(parsed(adapter, 'schemaVersion'), SCHEMA_VERSION);
  assert.equal(parsed(adapter, 'habitsMigrated'), true);
  assert.equal(adapter.data.lifeos_journal, undefined);
});

test("today's format (habitsMigrated already set): journal is left byte-for-byte untouched", async () => {
  const before = rawStore({ journal: LEGACY_JOURNAL, habitsMigrated: true, habits: LEGACY_HABITS });
  const { storage, adapter } = setup({ journal: LEGACY_JOURNAL, habitsMigrated: true, habits: LEGACY_HABITS });
  await runMigrations(storage);
  assert.equal(adapter.data.lifeos_journal, before.lifeos_journal);
  assert.equal(adapter.data.lifeos_habits, before.lifeos_habits, 'legacy key kept');
  assert.equal(parsed(adapter, 'schemaVersion'), SCHEMA_VERSION);
});

test('pre-v1.4 data: old habits are appended to journal exactly like the old App.js code', async () => {
  const { storage, adapter } = setup({ journal: LEGACY_JOURNAL, habits: LEGACY_HABITS });
  await runMigrations(storage);
  const journal = parsed(adapter, 'journal');
  assert.deepEqual(journal.slice(0, LEGACY_JOURNAL.length), LEGACY_JOURNAL, 'existing entries unchanged');
  // id 1 collides with a task, so it gets max(all ids)+1 = 102; id 7 is free.
  assert.deepEqual(journal.slice(LEGACY_JOURNAL.length), [
    { id: 102, text: 'Meditation', icon: '🧘', recurring: true, history: { '2026-03-01': 1 }, streak: 1, date: null, priority: 'medium', done: false },
    { id: 7, text: 'Water', icon: '🌟', recurring: true, history: {}, streak: 0, date: null, priority: 'medium', done: false },
  ]);
  assert.equal(parsed(adapter, 'habitsMigrated'), true);
  assert.deepEqual(parsed(adapter, 'habits'), LEGACY_HABITS, 'legacy key kept');
});

test('pre-v1.4 data with no saved journal: demo journal plus old habits', async () => {
  const { storage, adapter } = setup({ habits: LEGACY_HABITS.slice(0, 1) });
  await runMigrations(storage, { seedJournal: [{ id: 50, text: 'demo', recurring: false }] });
  assert.deepEqual(parsed(adapter, 'journal').map(j => j.id), [50, 1]);
});

test('running migrations twice changes nothing the second time', async () => {
  const { storage, adapter } = setup({ journal: LEGACY_JOURNAL, habits: LEGACY_HABITS });
  await runMigrations(storage);
  const snapshot = { ...adapter.data };
  const second = await runMigrations(storage);
  assert.deepEqual(second.applied, []);
  assert.deepEqual(adapter.data, snapshot);
});

test('migration 1 re-run on already-merged data (lost flag) does not duplicate habits', async () => {
  const { storage, adapter } = setup({ journal: LEGACY_JOURNAL, habits: LEGACY_HABITS });
  await runMigrations(storage);
  const merged = parsed(adapter, 'journal');
  // Simulate an older build that wrote the journal but crashed before the flag.
  delete adapter.data.lifeos_habitsMigrated;
  delete adapter.data.lifeos_schemaVersion;
  await runMigrations(storage);
  assert.deepEqual(parsed(adapter, 'journal'), merged);
});

test('a corrupt schemaVersion is backed up and treated as 0 (migrations are idempotent)', async () => {
  const { storage, adapter } = setup({ schemaVersion: 'garbage{', journal: LEGACY_JOURNAL, habitsMigrated: true });
  const r = await runMigrations(storage);
  assert.equal(r.from, 0);
  assert.equal(adapter.data.lifeos_corrupt_schemaVersion, 'garbage{');
  assert.deepEqual(parsed(adapter, 'journal'), LEGACY_JOURNAL);
});

test('data from a newer build is left alone and the version is never lowered', async () => {
  const { storage, adapter, logger } = setup({ schemaVersion: 99, habits: LEGACY_HABITS });
  const r = await runMigrations(storage, {}, { logger });
  assert.match(logger.warnings[0], /newer than this build/);
  assert.deepEqual(r, { from: 99, to: 99, applied: [] });
  assert.equal(parsed(adapter, 'schemaVersion'), 99);
  assert.equal(adapter.data.lifeos_journal, undefined);
});

test('a failed migration keeps the old version and succeeds on the next launch', async () => {
  const { storage, adapter, logger } = setup({ journal: LEGACY_JOURNAL, habits: LEGACY_HABITS });
  const multiSet = adapter.multiSet;
  adapter.multiSet = async () => { throw new Error('disk full'); };
  const failed = await runMigrations(storage, {}, { logger });
  assert.ok(failed.error);
  assert.equal(adapter.data.lifeos_schemaVersion, undefined);
  assert.deepEqual(parsed(adapter, 'journal'), LEGACY_JOURNAL, 'nothing half-written');

  adapter.multiSet = multiSet;
  const retried = await runMigrations(storage, {}, { logger });
  assert.equal(retried.to, SCHEMA_VERSION);
  assert.equal(parsed(adapter, 'journal').length, LEGACY_JOURNAL.length + LEGACY_HABITS.length);
});
