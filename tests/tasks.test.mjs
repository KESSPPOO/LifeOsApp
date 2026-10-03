// Unit tests for src/data/tasks.js — run with `npm test`.
// Everything is relative to a fixed TODAY so results never depend on the
// wall clock (e.g. a run that crosses midnight).
import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey } from '../src/data/helpers.js';
import { TASK_SECTIONS, computeStreak, groupJournal } from '../src/data/tasks.js';

const TODAY = '2026-03-02'; // crosses a month boundary going back (Feb has 28 days)

function dayOffset(n) {
  const d = new Date(2026, 2, 2);
  d.setDate(d.getDate() + n);
  return localDateKey(d);
}

function task(id, date, done = false) {
  return { id, text: `t${id}`, date, done, recurring: false, priority: 'medium' };
}

test('groupJournal returns exactly the TASK_SECTIONS keys', () => {
  assert.deepEqual(Object.keys(groupJournal([], TODAY)).sort(), [...TASK_SECTIONS].sort());
});

test('an unfinished task dated in the past is listed as Overdue', () => {
  const g = groupJournal([task(1, dayOffset(-3))], TODAY);
  assert.deepEqual(g.Overdue.map(t => t.id), [1]);
  assert.equal(g.Today.length + g.Upcoming.length + g['No Date'].length, 0);
});

test('a finished past task stays out of the list, as before', () => {
  const g = groupJournal([task(1, dayOffset(-3), true)], TODAY);
  for (const section of TASK_SECTIONS) assert.equal(g[section].length, 0, section);
});

test('a past task ticked off during this visit stays in Overdue, sunk below open ones', () => {
  const journal = [task(1, dayOffset(-3), true), task(2, dayOffset(-2))];
  const g = groupJournal(journal, TODAY, new Set([1]));
  assert.deepEqual(g.Overdue.map(t => t.id), [2, 1]);
});

test('every unfinished one-off task appears in exactly one section', () => {
  const journal = [
    task(1, dayOffset(-10)), task(2, dayOffset(-1)), task(3, TODAY),
    task(4, dayOffset(1)), task(5, dayOffset(30)), task(6, null),
  ];
  const g = groupJournal(journal, TODAY);
  const ids = TASK_SECTIONS.flatMap(s => g[s].map(t => t.id)).sort();
  assert.deepEqual(ids, [1, 2, 3, 4, 5, 6]);
});

test('Overdue keeps stored order so drag-to-reorder sticks', () => {
  const g = groupJournal([task(1, dayOffset(-1)), task(2, dayOffset(-5))], TODAY);
  assert.deepEqual(g.Overdue.map(t => t.id), [1, 2]);
});

test('Today sinks done items below open ones; Upcoming is sorted by date', () => {
  const g = groupJournal([
    task(1, TODAY, true), task(2, TODAY),
    task(3, dayOffset(5)), task(4, dayOffset(2)),
  ], TODAY);
  assert.deepEqual(g.Today.map(t => t.id), [2, 1]);
  assert.deepEqual(g.Upcoming.map(t => t.id), [4, 3]);
});

test('habits go to Habits regardless of date', () => {
  const g = groupJournal([{ id: 9, recurring: true, date: null, history: {} }], TODAY);
  assert.deepEqual(g.Habits.map(t => t.id), [9]);
});

test('computeStreak counts consecutive days back from today, across month ends', () => {
  const history = { [TODAY]: 1, [dayOffset(-1)]: 1, [dayOffset(-2)]: 1, [dayOffset(-4)]: 1 };
  assert.equal(dayOffset(-2), '2026-02-28');
  assert.equal(computeStreak(history, TODAY), 3);
});

test('computeStreak does not break the streak when today is not done yet', () => {
  const history = { [dayOffset(-1)]: 1, [dayOffset(-2)]: 1 };
  assert.equal(computeStreak(history, TODAY), 2);
});

test('computeStreak is 0 when yesterday was missed', () => {
  assert.equal(computeStreak({ [dayOffset(-2)]: 1 }, TODAY), 0);
  assert.equal(computeStreak({}, TODAY), 0);
});
