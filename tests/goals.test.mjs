// Goals: the operations (src/features/goals/logic.js, moved from GoalsScreen)
// and the same operations persisted through the goals store, as the screen
// calls them. Generic data-safety cases run for goals in
// persistedListStore.test.mjs. Dates are fixed (NOW is passed in).
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS } from '../src/core/storage/keys.js';
import {
  parseGoalNumber, addGoal, updateGoal, stepGoalProgress, setGoalProgress,
  deleteGoal, isGoalExpired, filterGoals,
} from '../src/features/goals/logic.js';
import { LEGACY_GOALS, parsed, setupListStore } from './fixtures.mjs';

const NOW = new Date(Date.UTC(2026, 2, 2, 12)); // 2026-03-02, midday UTC
const FIELDS = { title: 'Ny', description: '', target: 10, progress: 2, category: 'Work', priority: 'high', deadline: '' };

test('parseGoalNumber accepts comma decimals; invalid input is 0', () => {
  assert.equal(parseGoalNumber('2,5'), 2.5);
  assert.equal(parseGoalNumber('7'), 7);
  assert.equal(parseGoalNumber(''), 0);
  assert.equal(parseGoalNumber('abc'), 0);
});

test('add puts the goal first with id = highest id + 1 and clamps progress', () => {
  const next = addGoal(LEGACY_GOALS, { ...FIELDS, progress: 12 });
  assert.deepEqual(next[0], {
    id: 4, title: 'Ny', description: '', target: 10, progress: 10,
    category: 'Work', priority: 'high', deadline: '', completed: true,
  });
  assert.deepEqual(next.slice(1), LEGACY_GOALS);
  assert.equal(addGoal([], FIELDS)[0].id, 1);
  assert.equal(addGoal([{ title: 'no id' }], FIELDS)[0].id, 1, 'missing id counts as 0');
});

test('update replaces the editable fields, keeps id, recomputes completion', () => {
  const next = updateGoal(LEGACY_GOALS, 3, { ...FIELDS, progress: -1 });
  assert.deepEqual(next[0], {
    id: 3, title: 'Ny', description: '', target: 10, progress: 0,
    category: 'Work', priority: 'high', deadline: '', completed: false,
  });
  assert.deepEqual(next.slice(1), LEGACY_GOALS.slice(1));
});

test('stepper: progress stays within 0..target; reaching the target completes', () => {
  assert.equal(stepGoalProgress(LEGACY_GOALS, 3, 1)[0].progress, 5.5);
  assert.equal(stepGoalProgress(LEGACY_GOALS, 3, -10)[0].progress, 0);
  const done = stepGoalProgress(LEGACY_GOALS, 3, 10 - 4.5)[0]; // the "Complete" button
  assert.equal(done.progress, 10);
  assert.equal(done.completed, true);
  assert.equal(stepGoalProgress(LEGACY_GOALS, 2, -1)[1].completed, false, 'stepping down un-completes');
});

test('direct progress input: comma decimals, clamped value, completion from the raw value', () => {
  assert.equal(setGoalProgress(LEGACY_GOALS, 3, '7,5')[0].progress, 7.5);
  const over = setGoalProgress(LEGACY_GOALS, 3, '99')[0];
  assert.equal(over.progress, 10);
  assert.equal(over.completed, true);
  assert.equal(setGoalProgress(LEGACY_GOALS, 3, '')[0].progress, 0);
});

test('delete removes only the chosen goal', () => {
  assert.deepEqual(deleteGoal(LEGACY_GOALS, 2).map(o => o.id), [3, 1]);
});

test('expired: past deadline, not completed; no deadline is never expired (boolean)', () => {
  assert.equal(isGoalExpired(LEGACY_GOALS[2], NOW), true);   // deadline 2026-01-31
  assert.equal(isGoalExpired(LEGACY_GOALS[0], NOW), false);  // deadline in the future
  assert.equal(isGoalExpired(LEGACY_GOALS[1], NOW), false);  // no deadline
  assert.equal(isGoalExpired({ ...LEGACY_GOALS[2], completed: true }, NOW), false);
});

test('filters: All / Active / Completed / Expired', () => {
  assert.deepEqual(filterGoals(LEGACY_GOALS, 'All', NOW).map(o => o.id), [3, 2, 1]);
  assert.deepEqual(filterGoals(LEGACY_GOALS, 'Active', NOW).map(o => o.id), [3, 1]);
  assert.deepEqual(filterGoals(LEGACY_GOALS, 'Completed', NOW).map(o => o.id), [2]);
  assert.deepEqual(filterGoals(LEGACY_GOALS, 'Expired', NOW).map(o => o.id), [1]);
});

test('add, edit, step, type, delete and clear all are persisted in the existing format', async () => {
  const { store, adapter } = setupListStore({ key: KEYS.goals, values: { goals: LEGACY_GOALS } });
  await store.getState().hydrate();
  const { setItems } = store.getState();

  setItems(prev => addGoal(prev, FIELDS));
  setItems(prev => stepGoalProgress(prev, 4, 1));
  setItems(prev => setGoalProgress(prev, 3, '6'));
  setItems(prev => updateGoal(prev, 1, { ...FIELDS, title: 'Læs 10 bøger', target: 10, progress: 3 }));
  setItems(prev => deleteGoal(prev, 2));
  await store.getState().flush();
  assert.deepEqual(parsed(adapter, 'goals'), [
    { id: 4, title: 'Ny', description: '', target: 10, progress: 3, category: 'Work', priority: 'high', deadline: '', completed: false },
    { ...LEGACY_GOALS[0], progress: 6 },
    { id: 1, title: 'Læs 10 bøger', description: '', target: 10, progress: 3, category: 'Work', priority: 'high', deadline: '', completed: false },
  ]);

  setItems([]); // "Clear All"
  await store.getState().flush();
  assert.deepEqual(parsed(adapter, 'goals'), []);
});
