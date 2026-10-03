// Data-safety tests for the shared createPersistedListStore
// (src/core/state/persistedListStore.js). The whole suite runs once per
// migrated module, with the module's registered key (KEYS) and a fixture of
// its stored format. (The app's store.js bindings import AsyncStorage and are
// covered by check:bundle, not by these tests.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS } from '../src/core/storage/keys.js';
import { createPersistedListStore } from '../src/core/state/persistedListStore.js';
import {
  LEGACY_JOURNAL, LEGACY_GROCERIES, JOURNAL_TEST_SEED, GROCERIES_TEST_SEED,
  parsed, raw, setupListStore, failReadsOf, failWritesOf,
} from './fixtures.mjs';

const MODULES = [
  { name: 'tasks', key: KEYS.journal, stored: LEGACY_JOURNAL, seed: JOURNAL_TEST_SEED },
  { name: 'groceries', key: KEYS.groceries, stored: LEGACY_GROCERIES, seed: GROCERIES_TEST_SEED },
];

for (const { name, key, stored, seed } of MODULES) {
  const setup = (values) => setupListStore({ key, values, seed });
  const onDisk = (adapter) => parsed(adapter, key);
  const t = (title, fn) => test(`[${name}] ${title}`, fn);

  t("loads today's stored format unchanged, without rewriting it", async () => {
    const { store, adapter } = setup({ [key]: stored });
    const before = raw(adapter, key);
    await store.getState().hydrate();
    assert.deepEqual(store.getState().items, stored);
    assert.equal(store.getState().hydrated, true);
    assert.equal(raw(adapter, key), before, 'byte-for-byte untouched');
  });

  t('missing key: the seed is shown and not written', async () => {
    const { store, adapter } = setup({});
    await store.getState().hydrate();
    assert.deepEqual(store.getState().items, seed);
    assert.equal(raw(adapter, key), undefined);
  });

  t('corrupt value: backed up, empty list shown (not demo data), saving allowed', async () => {
    const { store, adapter } = setup({ [key]: '[{"id":1,' });
    await store.getState().hydrate();
    assert.deepEqual(store.getState().items, []);
    assert.equal(store.getState().persistBlocked, false);
    assert.equal(raw(adapter, key, { backup: true }), '[{"id":1,');
  });

  t('wrong-typed value (not an array) counts as corrupt', async () => {
    const { store, adapter } = setup({ [key]: { not: 'a list' } });
    await store.getState().hydrate();
    assert.deepEqual(store.getState().items, []);
    assert.equal(raw(adapter, key, { backup: true }), '{"not":"a list"}');
  });

  t('corrupt value whose backup fails: saving is blocked and the only copy is kept', async () => {
    const { store, adapter } = setup({ [key]: '[{"id":1,' });
    failWritesOf(adapter, 'corrupt_');
    await store.getState().hydrate();
    assert.equal(store.getState().persistBlocked, true);
    store.getState().setItems([{ id: 1 }]);
    await store.getState().flush();
    assert.equal(raw(adapter, key), '[{"id":1,');
  });

  t('non-object entries in a damaged array are dropped on load', async () => {
    const { store } = setup({ [key]: [null, stored[0], 'x', [1]] });
    await store.getState().hydrate();
    assert.deepEqual(store.getState().items, [stored[0]]);
  });

  t('failed read: empty list, edits stay in memory, stored data is not overwritten', async () => {
    const { store, adapter } = setup({ [key]: stored });
    failReadsOf(adapter, key, 2); // first read and its retry
    await store.getState().hydrate();
    assert.equal(store.getState().persistBlocked, true);
    assert.deepEqual(store.getState().items, []);
    store.getState().setItems(prev => [...prev, { id: 1000 }]);
    await store.getState().flush();
    assert.deepEqual(onDisk(adapter), stored);
  });

  t('a single transient read error is retried at once', async () => {
    const { store, adapter } = setup({ [key]: stored });
    failReadsOf(adapter, key, 1);
    await store.getState().hydrate();
    assert.equal(store.getState().persistBlocked, false);
    assert.deepEqual(store.getState().items, stored);
  });

  t('after a failed read, a later hydrate (retry / next boot) recovers and saving resumes', async () => {
    const { store, adapter } = setup({ [key]: stored });
    failReadsOf(adapter, key, 2);
    await store.getState().hydrate();
    await store.getState().hydrate();
    assert.equal(store.getState().persistBlocked, false);
    assert.deepEqual(store.getState().items, stored);
    store.getState().setItems(prev => prev.slice(1));
    await store.getState().flush();
    assert.deepEqual(onDisk(adapter), stored.slice(1));
  });

  t('persists values and updaters, in the order they were made', async () => {
    const { store, adapter } = setup({ [key]: stored });
    await store.getState().hydrate();
    store.getState().setItems(prev => [...prev, { id: 77 }]);
    store.getState().setItems(prev => prev.filter(x => x.id !== stored[0].id));
    await store.getState().flush();
    const expected = [...stored.slice(1), { id: 77 }];
    assert.deepEqual(onDisk(adapter), expected);
    assert.deepEqual(store.getState().items, expected, 'memory and disk agree');
    store.getState().setItems([]);
    await store.getState().flush();
    assert.deepEqual(onDisk(adapter), []);
  });

  t('an unchanged list (same reference) is not re-saved', async () => {
    const { store, adapter } = setup({ [key]: stored });
    await store.getState().hydrate();
    let writes = 0;
    const setItem = adapter.setItem;
    adapter.setItem = async (k, v) => { writes++; return setItem(k, v); };
    store.getState().setItems(prev => prev);
    await store.getState().flush();
    assert.equal(writes, 0);
  });

  t('changes made before hydration are not saved over stored data', async () => {
    const { store, adapter } = setup({ [key]: stored });
    store.getState().setItems([]);
    await store.getState().flush();
    assert.deepEqual(onDisk(adapter), stored);
  });

  t('overlapping hydrate() calls share one read (no stale result can win)', async () => {
    const { store, adapter } = setup({ [key]: stored });
    let reads = 0;
    const getItem = adapter.getItem;
    adapter.getItem = async (k) => { reads++; return getItem(k); };
    const a = store.getState().hydrate();
    const b = store.getState().hydrate();
    assert.equal(a, b, 'same in-flight promise');
    await Promise.all([a, b]);
    assert.equal(reads, 1);
    assert.deepEqual(store.getState().items, stored);
    await store.getState().hydrate();
    assert.equal(reads, 1, 'no re-read once hydrated');
  });

  t('a later hydrate never replaces live state with a stale read', async () => {
    const { store } = setup({ [key]: stored });
    await store.getState().hydrate();
    store.getState().setItems([]);
    await store.getState().hydrate();
    assert.deepEqual(store.getState().items, []);
  });
}

test('two stores on the same storage only ever touch their own key', async () => {
  const { adapter, storage, logger, store: tasks } = setupListStore({
    key: KEYS.journal, values: { journal: LEGACY_JOURNAL, groceries: LEGACY_GROCERIES },
  });
  const groceries = createPersistedListStore({ storage, key: KEYS.groceries, logger });
  const journalBefore = raw(adapter, KEYS.journal);
  await Promise.all([tasks.getState().hydrate(), groceries.getState().hydrate()]);
  groceries.getState().setItems([]);
  await groceries.getState().flush();
  assert.deepEqual(parsed(adapter, KEYS.groceries), []);
  assert.equal(raw(adapter, KEYS.journal), journalBefore);
  assert.deepEqual(tasks.getState().items, LEGACY_JOURNAL);
});
