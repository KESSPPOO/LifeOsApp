// Data-safety tests for the shared createPersistedListStore
// (src/core/state/persistedListStore.js). The whole suite runs once per
// migrated module, against that module's real key and stored format, so the
// guarantees are proven for every store that uses the factory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/core/storage/engine.js';
import { createPersistedListStore } from '../src/core/state/persistedListStore.js';
import {
  LEGACY_JOURNAL, LEGACY_GROCERIES, rawStore, parsed, setupListStore, failReadsOf,
  createMemoryAdapter, quietLogger,
} from './fixtures.mjs';

const MODULES = [
  { name: 'tasks', key: 'journal', stored: LEGACY_JOURNAL,
    seed: [{ id: 900, text: 'demo task', recurring: false, date: null, done: false }] },
  { name: 'groceries', key: 'groceries', stored: LEGACY_GROCERIES,
    seed: [{ id: 900, text: 'demo item', category: 'other', done: false }] },
];

for (const { name, key, stored, seed } of MODULES) {
  const setup = (values) => setupListStore({ key, values, seed });
  const onDisk = (adapter) => parsed(adapter, key);
  const t = (title, fn) => test(`[${name}] ${title}`, fn);

  t("loads today's stored format unchanged, without rewriting it", async () => {
    const { store, adapter } = setup({ [key]: stored });
    const before = adapter.data[`lifeos_${key}`];
    await store.getState().hydrate();
    assert.deepEqual(store.getState().items, stored);
    assert.equal(store.getState().hydrated, true);
    assert.equal(adapter.data[`lifeos_${key}`], before, 'byte-for-byte untouched');
  });

  t('missing key: the seed is shown and not written', async () => {
    const { store, adapter } = setup({});
    await store.getState().hydrate();
    assert.deepEqual(store.getState().items, seed);
    assert.equal(adapter.data[`lifeos_${key}`], undefined);
  });

  t('corrupt value: backed up, empty list shown (not demo data), saving allowed', async () => {
    const { store, adapter } = setup({ [key]: '[{"id":1,' });
    await store.getState().hydrate();
    assert.deepEqual(store.getState().items, []);
    assert.equal(store.getState().persistBlocked, false);
    assert.equal(adapter.data[`lifeos_corrupt_${key}`], '[{"id":1,');
  });

  t('wrong-typed value (not an array) counts as corrupt', async () => {
    const { store, adapter } = setup({ [key]: { not: 'a list' } });
    await store.getState().hydrate();
    assert.deepEqual(store.getState().items, []);
    assert.equal(adapter.data[`lifeos_corrupt_${key}`], '{"not":"a list"}');
  });

  t('corrupt value whose backup fails: saving is blocked and the only copy is kept', async () => {
    const { store, adapter } = setup({ [key]: '[{"id":1,' });
    const setItem = adapter.setItem;
    adapter.setItem = async (k, v) => { if (k.includes('corrupt_')) throw new Error('full'); return setItem(k, v); };
    await store.getState().hydrate();
    assert.equal(store.getState().persistBlocked, true);
    store.getState().setItems([{ id: 1 }]);
    await store.getState().flush();
    assert.equal(adapter.data[`lifeos_${key}`], '[{"id":1,');
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

  t('a later hydrate never replaces live state with a stale read', async () => {
    const { store } = setup({ [key]: stored });
    await store.getState().hydrate();
    store.getState().setItems([]);
    await store.getState().hydrate();
    assert.deepEqual(store.getState().items, []);
  });
}

test('two stores on the same storage only ever touch their own key', async () => {
  const logger = quietLogger();
  const adapter = createMemoryAdapter(rawStore({ journal: LEGACY_JOURNAL, groceries: LEGACY_GROCERIES }));
  const storage = createStorage(adapter, { logger });
  const tasks = createPersistedListStore({ storage, key: 'journal', logger });
  const groceries = createPersistedListStore({ storage, key: 'groceries', logger });
  const journalBefore = adapter.data.lifeos_journal;
  await Promise.all([tasks.getState().hydrate(), groceries.getState().hydrate()]);
  groceries.getState().setItems([]);
  await groceries.getState().flush();
  assert.deepEqual(parsed(adapter, 'groceries'), []);
  assert.equal(adapter.data.lifeos_journal, journalBefore);
  assert.deepEqual(tasks.getState().items, LEGACY_JOURNAL);
});
