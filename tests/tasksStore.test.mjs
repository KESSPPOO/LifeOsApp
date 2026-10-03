// Tasks + habits store tests (src/features/tasks/store.js uses the shared
// createPersistedListStore with key 'journal'). The generic data-safety
// guarantees are tested for every module in persistedListStore.test.mjs;
// this file checks what is specific to tasks: migration 1 feeding the store,
// and that the overdue and streak behaviour survives the move out of App.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations } from '../src/core/storage/migrations.js';
import { groupJournal, toggleJournalEntry } from '../src/data/tasks.js';
import { KEYS } from '../src/core/storage/keys.js';
import {
  TODAY, LEGACY_JOURNAL, LEGACY_HABITS, JOURNAL_TEST_SEED, parsed, quietLogger, setupListStore,
} from './fixtures.mjs';

const setup = (values = {}) => setupListStore({ key: KEYS.journal, values, seed: JOURNAL_TEST_SEED });
const storedJournal = (adapter) => parsed(adapter, 'journal');

test('pre-v1.4 install: migrate, then hydrate, shows tasks and the old habits', async () => {
  const { store, storage } = setup({ journal: LEGACY_JOURNAL, habits: LEGACY_HABITS });
  await runMigrations(storage, { seedJournal: JOURNAL_TEST_SEED }, { logger: quietLogger() });
  await store.getState().hydrate();
  const habits = store.getState().items.filter(t => t.recurring).map(t => t.text);
  assert.deepEqual(habits, ['Reading', 'Meditation', 'Water']);
});

// ── Session 1 behaviour, now through the store ─────────────────────────────

test('overdue: an unfinished past task from storage is listed as Overdue; finished ones stay hidden', async () => {
  const { store } = setup({ journal: LEGACY_JOURNAL });
  await store.getState().hydrate();
  const g = groupJournal(store.getState().items, TODAY);
  assert.deepEqual(g.Overdue.map(t => t.id), [1]);
  assert.deepEqual(g.Today.map(t => t.id), [2]);
  assert.ok(!Object.values(g).flat().some(t => t.id === 5));
});

test('overdue: completing a task persists it and it stays visible for this visit', async () => {
  const { store, adapter } = setup({ journal: LEGACY_JOURNAL });
  await store.getState().hydrate();
  store.getState().setItems(prev => toggleJournalEntry(prev, 1, TODAY));
  await store.getState().flush();
  assert.equal(storedJournal(adapter).find(t => t.id === 1).done, true);
  const visit = groupJournal(store.getState().items, TODAY, new Set([1]));
  assert.deepEqual(visit.Overdue.map(t => t.id), [1]);
  assert.deepEqual(groupJournal(store.getState().items, TODAY).Overdue, [], 'gone on the next visit');
});

test('streak: ticking today extends it, unticking restores it, and both are persisted', async () => {
  const { store, adapter } = setup({ journal: LEGACY_JOURNAL });
  await store.getState().hydrate();
  const habit = () => storedJournal(adapter).find(t => t.id === 101);

  store.getState().setItems(prev => toggleJournalEntry(prev, 101, TODAY));
  await store.getState().flush();
  assert.equal(habit().streak, 4);
  assert.equal(habit().history[TODAY], 1);

  store.getState().setItems(prev => toggleJournalEntry(prev, 101, TODAY));
  await store.getState().flush();
  assert.equal(habit().streak, 3, 'today not done yet does not break the streak');
  assert.equal(habit().history[TODAY], undefined);
});
