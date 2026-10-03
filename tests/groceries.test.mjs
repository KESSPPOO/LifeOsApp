// Groceries: the list operations (src/features/groceries/logic.js, moved
// verbatim from GroceriesScreen) and the same operations persisted through
// the groceries store, exactly as the screen calls them. Generic data-safety
// cases are covered for groceries in persistedListStore.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS } from '../src/core/storage/keys.js';
import { toggleGrocery, deleteGrocery, addGrocery, filterGroceries } from '../src/features/groceries/logic.js';
import { LEGACY_GROCERIES, parsed, setupListStore } from './fixtures.mjs';

// ── Pure operations ─────────────────────────────────────────────────────────

test('toggle flips only the chosen item and returns a new list', () => {
  const next = toggleGrocery(LEGACY_GROCERIES, 3);
  assert.notEqual(next, LEGACY_GROCERIES);
  assert.equal(next.find(i => i.id === 3).done, false);
  assert.deepEqual(next.filter(i => i.id !== 3), LEGACY_GROCERIES.filter(i => i.id !== 3));
  assert.equal(LEGACY_GROCERIES.find(i => i.id === 3).done, true, 'input not mutated');
});

test('delete removes only the chosen item', () => {
  assert.deepEqual(deleteGrocery(LEGACY_GROCERIES, 2).map(i => i.id), [4, 3, 1]);
  assert.deepEqual(deleteGrocery(LEGACY_GROCERIES, 999), LEGACY_GROCERIES);
});

test('add puts the new item first with id = highest id + 1, not done', () => {
  const next = addGrocery(LEGACY_GROCERIES, 'Kaffe', 'supermarket');
  assert.deepEqual(next[0], { id: 5, text: 'Kaffe', category: 'supermarket', done: false });
  assert.deepEqual(next.slice(1), LEGACY_GROCERIES);
  assert.deepEqual(addGrocery([], 'Æbler', 'other'), [{ id: 1, text: 'Æbler', category: 'other', done: false }]);
});

test('add tolerates a damaged entry without an id (no NaN ids)', () => {
  const next = addGrocery([{ text: 'no id', done: false }, { id: 2, text: 'x', done: false }], 'Ny', 'other');
  assert.equal(next[0].id, 3);
});

test('filter: all / to buy / completed', () => {
  assert.equal(filterGroceries(LEGACY_GROCERIES, 'all').length, 4);
  assert.deepEqual(filterGroceries(LEGACY_GROCERIES, 'to buy').map(i => i.id), [4, 2, 1]);
  assert.deepEqual(filterGroceries(LEGACY_GROCERIES, 'completed').map(i => i.id), [3]);
});

// ── Through the store (what the screen does) ───────────────────────────────

test('add, toggle, delete and clear all are persisted in the existing format', async () => {
  const { store, adapter } = setupListStore({ key: KEYS.groceries, values: { groceries: LEGACY_GROCERIES } });
  await store.getState().hydrate();
  const { setItems } = store.getState();

  setItems(prev => addGrocery(prev, 'Mælk', 'supermarket'));
  setItems(prev => toggleGrocery(prev, 4));
  setItems(prev => deleteGrocery(prev, 2));
  await store.getState().flush();
  assert.deepEqual(parsed(adapter, 'groceries'), [
    { id: 5, text: 'Mælk', category: 'supermarket', done: false },
    { id: 4, text: 'Rugbrød', category: 'supermarket', done: true },
    { id: 3, text: 'Panodil', category: 'pharmacy', done: true },
    { id: 1, text: 'Fødselsdagskort', category: 'other', done: false },
  ]);

  setItems([]); // "Clear All"
  await store.getState().flush();
  assert.deepEqual(parsed(adapter, 'groceries'), []);
});
