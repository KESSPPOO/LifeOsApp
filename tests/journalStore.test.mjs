// Tests for the tasks + habits store (src/features/tasks/journalStore.js),
// including end-to-end checks that the Session 1 overdue and streak
// behaviour survives the move out of App.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/core/storage/engine.js';
import { runMigrations } from '../src/core/storage/migrations.js';
import { createJournalStore } from '../src/features/tasks/journalStore.js';
import { groupJournal, toggleJournalEntry } from '../src/data/tasks.js';
import { TODAY, LEGACY_JOURNAL, LEGACY_HABITS, rawStore, parsed, quietLogger, createMemoryAdapter, failReadsOf } from './fixtures.mjs';

const SEED = [{ id: 900, text: 'demo task', recurring: false, date: null, done: false }];

function setup(values = {}) {
  const logger = quietLogger();
  const adapter = createMemoryAdapter(rawStore(values));
  const storage = createStorage(adapter, { logger });
  const store = createJournalStore({ storage, seed: SEED, logger });
  return { adapter, storage, store, logger };
}
const storedJournal = (adapter) => parsed(adapter, 'journal');

test("hydrate loads today's stored format unchanged", async () => {
  const { store } = setup({ journal: LEGACY_JOURNAL, habitsMigrated: true });
  await store.getState().hydrate();
  assert.deepEqual(store.getState().journal, LEGACY_JOURNAL);
  assert.equal(store.getState().hydrated, true);
});

test('missing journal shows the seed and does not write it', async () => {
  const { store, adapter } = setup();
  await store.getState().hydrate();
  assert.deepEqual(store.getState().journal, SEED);
  assert.equal(adapter.data.lifeos_journal, undefined);
});

test('corrupt journal: an empty list is shown (not demo data), the damaged value is backed up', async () => {
  const { store, adapter } = setup({ journal: '[{"id":1,' });
  await store.getState().hydrate();
  assert.deepEqual(store.getState().journal, []);
  assert.equal(store.getState().persistBlocked, false);
  assert.equal(adapter.data.lifeos_corrupt_journal, '[{"id":1,');
});

test('non-object entries in a damaged array are dropped on load', async () => {
  const { store } = setup({ journal: [null, LEGACY_JOURNAL[0], 'x', [1]] });
  await store.getState().hydrate();
  assert.deepEqual(store.getState().journal, [LEGACY_JOURNAL[0]]);
});

test('setJournal persists both values and updaters, in the order they were made', async () => {
  const { store, adapter } = setup({ journal: LEGACY_JOURNAL });
  const { hydrate } = store.getState();
  await hydrate();
  store.getState().setJournal(prev => [...prev, { id: 6, text: 'new', recurring: false, date: null, done: false }]);
  store.getState().setJournal(prev => prev.filter(t => t.id !== 1));
  await store.getState().flush();
  const ids = storedJournal(adapter).map(t => t.id);
  assert.deepEqual(ids, [2, 3, 4, 5, 101, 6]);
  assert.deepEqual(store.getState().journal.map(t => t.id), ids, 'memory and disk agree');

  store.getState().setJournal([]);
  await store.getState().flush();
  assert.deepEqual(storedJournal(adapter), []);
});

test('a later hydrate never replaces live state with a stale read', async () => {
  const { store } = setup({ journal: LEGACY_JOURNAL });
  await store.getState().hydrate();
  store.getState().setJournal([]);
  await store.getState().hydrate();
  assert.deepEqual(store.getState().journal, []);
});

test('changes made before hydration are not saved over stored data', async () => {
  const { store, adapter } = setup({ journal: LEGACY_JOURNAL });
  store.getState().setJournal([]);
  await store.getState().flush();
  assert.deepEqual(storedJournal(adapter), LEGACY_JOURNAL);
});

test('if the journal cannot be read, edits stay in memory and stored data is not overwritten', async () => {
  const { store, adapter } = setup({ journal: LEGACY_JOURNAL });
  failReadsOf(adapter, 'journal', 2); // first read and its retry
  await store.getState().hydrate();
  assert.equal(store.getState().persistBlocked, true);
  assert.deepEqual(store.getState().journal, [], 'no demo data shown');
  store.getState().setJournal(prev => [...prev, { id: 1000, text: 'x' }]);
  await store.getState().flush();
  assert.deepEqual(storedJournal(adapter), LEGACY_JOURNAL);
});

test('a single transient read error is retried at once', async () => {
  const { store, adapter } = setup({ journal: LEGACY_JOURNAL });
  failReadsOf(adapter, 'journal', 1);
  await store.getState().hydrate();
  assert.equal(store.getState().persistBlocked, false);
  assert.deepEqual(store.getState().journal, LEGACY_JOURNAL);
});

test('after a failed read, a later hydrate (retry / next boot) recovers and saving resumes', async () => {
  const { store, adapter } = setup({ journal: LEGACY_JOURNAL });
  failReadsOf(adapter, 'journal', 2);
  await store.getState().hydrate();
  assert.equal(store.getState().persistBlocked, true);
  await store.getState().hydrate();
  assert.equal(store.getState().persistBlocked, false);
  assert.deepEqual(store.getState().journal, LEGACY_JOURNAL);
  store.getState().setJournal(prev => prev.slice(1));
  await store.getState().flush();
  assert.deepEqual(storedJournal(adapter), LEGACY_JOURNAL.slice(1));
});

test('pre-v1.4 install: migrate, then hydrate, shows tasks and the old habits', async () => {
  const { store, storage } = setup({ journal: LEGACY_JOURNAL, habits: LEGACY_HABITS });
  await runMigrations(storage, { seedJournal: SEED }, { logger: quietLogger() });
  await store.getState().hydrate();
  const habits = store.getState().journal.filter(t => t.recurring).map(t => t.text);
  assert.deepEqual(habits, ['Reading', 'Meditation', 'Water']);
});

// ── Session 1 behaviour, now through the store ─────────────────────────────

test('overdue: an unfinished past task from storage is listed as Overdue; finished ones stay hidden', async () => {
  const { store } = setup({ journal: LEGACY_JOURNAL });
  await store.getState().hydrate();
  const g = groupJournal(store.getState().journal, TODAY);
  assert.deepEqual(g.Overdue.map(t => t.id), [1]);
  assert.deepEqual(g.Today.map(t => t.id), [2]);
  assert.ok(!Object.values(g).flat().some(t => t.id === 5));
});

test('overdue: completing a task persists it and it stays visible for this visit', async () => {
  const { store, adapter } = setup({ journal: LEGACY_JOURNAL });
  await store.getState().hydrate();
  store.getState().setJournal(prev => toggleJournalEntry(prev, 1, TODAY));
  await store.getState().flush();
  assert.equal(storedJournal(adapter).find(t => t.id === 1).done, true);
  const visit = groupJournal(store.getState().journal, TODAY, new Set([1]));
  assert.deepEqual(visit.Overdue.map(t => t.id), [1]);
  assert.deepEqual(groupJournal(store.getState().journal, TODAY).Overdue, [], 'gone on the next visit');
});

test('streak: ticking today extends it, unticking restores it, and both are persisted', async () => {
  const { store, adapter } = setup({ journal: LEGACY_JOURNAL });
  await store.getState().hydrate();
  const habit = () => storedJournal(adapter).find(t => t.id === 101);

  store.getState().setJournal(prev => toggleJournalEntry(prev, 101, TODAY));
  await store.getState().flush();
  assert.equal(habit().streak, 4);
  assert.equal(habit().history[TODAY], 1);

  store.getState().setJournal(prev => toggleJournalEntry(prev, 101, TODAY));
  await store.getState().flush();
  assert.equal(habit().streak, 3, 'today not done yet does not break the streak');
  assert.equal(habit().history[TODAY], undefined);
});
