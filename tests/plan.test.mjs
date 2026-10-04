// Plan (src/features/plan/logic.js): grouping and ordering, the list
// operations the screen writes, and the task form. Fixed dates; no clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupPlan, addTask, updateTask, addHabit, updateHabit, deleteEntry, reorderSection,
  formFromEntry, readTaskForm,
} from '../src/features/plan/logic.js';
import { toggleJournalEntry } from '../src/data/tasks.js';
import { buildToday } from '../src/features/today/logic.js';

const TODAY = '2026-10-03';
const task = (id, date, extra = {}) =>
  ({ id, text: `Opgave ${id}`, subject: '', priority: 'medium', date, done: false, recurring: false, ...extra });
const habit = (id) => ({ id, text: `Vane ${id}`, icon: '💧', recurring: true, date: null, priority: 'medium', done: false, history: {}, streak: 0 });
const ids = (list) => list.map(x => x.id);

// ── Grouping ───────────────────────────────────────────────────────────────

test('today: timed tasks in time order, untimed ones apart in the user\'s order', () => {
  const plan = groupPlan([
    task(1, TODAY),
    task(2, TODAY, { startTime: '14:00' }),
    task(3, TODAY, { startTime: '09:30', durationMinutes: 30 }),
    task(4, TODAY),
    task(5, TODAY, { startTime: '09:30' }),
    task(6, TODAY, { done: true }),
  ], TODAY);
  assert.deepEqual(ids(plan.timedToday), [3, 5, 2]);
  assert.deepEqual(ids(plan.flexibleToday), [1, 4, 6]); // finished last
});

test('a finished timed task keeps its place in time order', () => {
  const plan = groupPlan([
    task(1, TODAY, { startTime: '15:00' }),
    task(2, TODAY, { startTime: '08:00', done: true }),
  ], TODAY);
  assert.deepEqual(ids(plan.timedToday), [2, 1]);
});

test('overdue: unfinished earlier tasks, oldest first, then time, then list order', () => {
  const plan = groupPlan([
    task(1, '2026-10-02'),
    task(2, '2026-09-30'),
    task(3, '2026-10-02', { startTime: '08:00' }),
    task(4, '2026-10-01', { done: true }), // finished earlier: not shown
    task(5, '2026-10-02', { startTime: '07:00' }),
  ], TODAY);
  assert.deepEqual(ids(plan.overdue), [2, 5, 3, 1]);
});

test('a task ticked in Overskredet during this visit stays (last) until the visit ends', () => {
  const journal = toggleJournalEntry([task(1, '2026-10-01'), task(2, '2026-10-02')], 1, TODAY);
  assert.deepEqual(ids(groupPlan(journal, TODAY, new Set([1])).overdue), [2, 1]);
  assert.deepEqual(ids(groupPlan(journal, TODAY).overdue), [2]);
});

test('upcoming: grouped per day, days in order; timed first by time, untimed in list order, finished last', () => {
  const plan = groupPlan([
    task(1, '2026-10-05'),
    task(2, '2026-10-04', { startTime: '18:00' }),
    task(3, '2026-10-04'),
    task(4, '2026-10-04', { startTime: '08:00' }),
    task(5, '2026-10-05', { done: true, startTime: '07:00' }),
    task(6, '2026-10-04'),
  ], TODAY);
  assert.deepEqual(plan.upcomingDays.map(d => [d.date, ids(d.tasks)]), [
    ['2026-10-04', [4, 2, 3, 6]],
    ['2026-10-05', [1, 5]],
  ]);
});

test('undated tasks and habits keep the user\'s order', () => {
  const plan = groupPlan([task(1, null), habit(101), task(2, null, { done: true }), task(3, null), habit(102)], TODAY);
  assert.deepEqual(ids(plan.noDate), [1, 3, 2]);
  assert.deepEqual(ids(plan.habits), [101, 102]);
});

test('regression: Plan and I dag show the same "X af Y klaret i dag"', () => {
  const journal = [
    task(1, TODAY, { done: true }), task(2, TODAY), task(3, '2026-10-01'),
    { ...habit(101), history: { [TODAY]: 1 } }, habit(102), habit(103),
  ];
  const fromToday = buildToday({ journal, goals: [], groceries: [], today: TODAY, nowMinutes: 600 });
  assert.deepEqual(groupPlan(journal, TODAY).progress, { done: 2, total: 5 });
  assert.deepEqual([fromToday.done, fromToday.total], [2, 5]);
});

test('grouping is deterministic and does not modify the stored list', () => {
  const journal = [task(1, TODAY, { startTime: '10:00' }), task(2, '2026-10-01'), task(3, '2026-10-09'), habit(101)];
  const snapshot = JSON.stringify(journal);
  assert.deepEqual(groupPlan(journal, TODAY), groupPlan(journal, TODAY));
  assert.equal(JSON.stringify(journal), snapshot);
});

// ── List operations ────────────────────────────────────────────────────────

const fields = (extra = {}) =>
  ({ text: 'Tandlæge', subject: '', priority: 'medium', date: TODAY, startTime: null, durationMinutes: null, ...extra });

test('addTask: "Handle ind" with no time, and "Tandlæge" at 10:45 for 60 minutes', () => {
  let list = addTask([task(7, TODAY)], fields({ text: 'Handle ind', date: '2026-10-10' }));
  list = addTask(list, fields({ date: '2026-10-10', startTime: '10:45', durationMinutes: 60 }));
  assert.deepEqual(list[1], {
    id: 8, done: false, recurring: false, text: 'Handle ind', subject: '', priority: 'medium', date: '2026-10-10',
  });
  assert.deepEqual(list[2], {
    id: 9, done: false, recurring: false, text: 'Tandlæge', subject: '', priority: 'medium', date: '2026-10-10',
    startTime: '10:45', durationMinutes: 60,
  });
});

test('a time without a date is not stored; no date is stored as null', () => {
  const [created] = addTask([], fields({ date: '', startTime: '10:45', durationMinutes: 30 }));
  assert.equal(created.date, null);
  assert.ok(!('startTime' in created) && !('durationMinutes' in created));
});

test('updateTask changes only that task, and removing the time removes both fields', () => {
  const list = [task(1, TODAY, { startTime: '10:45', durationMinutes: 60 }), task(2, TODAY)];
  const next = updateTask(list, 1, fields({ text: 'Tandlæge' }));
  assert.ok(!('startTime' in next[0]) && !('durationMinutes' in next[0]));
  assert.equal(next[1], list[1]); // same object: untouched
  const timed = updateTask(list, 2, fields({ startTime: '08:00' }));
  assert.equal(timed[1].startTime, '08:00');
  assert.ok(!('durationMinutes' in timed[1]));
});

test('regression: editing only the title keeps stored schedule values exactly, even ones not understood', () => {
  const odd = task(1, TODAY, { startTime: '9:00', durationMinutes: '30' });
  const form = formFromEntry(odd);
  const { fields: edited } = readTaskForm('task', { ...form, text: 'Nyt navn' });
  const [saved] = updateTask([odd], 1, edited);
  assert.deepEqual(saved, { ...odd, text: 'Nyt navn' });
  // A valid schedule is kept the same way.
  const ok = task(2, TODAY, { startTime: '10:45', durationMinutes: 60 });
  const [kept] = updateTask([ok], 2, readTaskForm('task', { ...formFromEntry(ok), text: 'Tandlæge' }).fields);
  assert.deepEqual(kept, { ...ok, text: 'Tandlæge' });
  // Changing the time, or removing the date, does replace it.
  const [changed] = updateTask([odd], 1, { ...edited, startTime: '10:00' });
  assert.deepEqual([changed.startTime, 'durationMinutes' in changed], ['10:00', false]);
  const [undated] = updateTask([ok], 2, { ...edited, date: null, startTime: '10:45', durationMinutes: 60 });
  assert.ok(!('startTime' in undated) && !('durationMinutes' in undated));
});

test('habits: created with the existing shape; editing keeps history and streak', () => {
  const [created] = addHabit([], { text: 'Gå en tur', icon: '🚶' });
  assert.deepEqual(created, {
    id: 1, text: 'Gå en tur', subject: '', priority: 'medium', date: null,
    done: false, recurring: true, icon: '🚶', history: {}, streak: 0,
  });
  const h = { ...habit(101), history: { [TODAY]: 1 }, streak: 4 };
  const [edited] = updateHabit([h], 101, { text: 'Drik vand', icon: '💧' });
  assert.deepEqual(edited, { ...h, text: 'Drik vand', icon: '💧' });
});

test('deleteEntry and reorderSection', () => {
  const list = [task(1, null), task(2, null), habit(101), task(3, null)];
  assert.deepEqual(ids(deleteEntry(list, 2)), [1, 101, 3]);
  // A drag uses the stored entries, so a change made meanwhile survives.
  const ticked = toggleJournalEntry(list, 3, TODAY);
  const moved = reorderSection(ticked, [list[3], list[0]]);
  assert.deepEqual(ids(moved), [2, 101, 3, 1]);
  assert.equal(moved[2].done, true);
  // A dragged entry deleted meanwhile is not brought back.
  assert.deepEqual(ids(reorderSection(deleteEntry(list, 1), [list[0], list[1]])), [101, 3, 2]);
});

// ── Task form ──────────────────────────────────────────────────────────────

test('formFromEntry: old task, timed task, custom duration, new habit', () => {
  assert.deepEqual(formFromEntry(task(1, TODAY)), {
    text: 'Opgave 1', subject: '', priority: 'medium', date: TODAY,
    timeText: '', durationChoice: null, customDuration: '', icon: '🌟',
  });
  const timed = formFromEntry(task(1, TODAY, { startTime: '10:45', durationMinutes: 90 }));
  assert.deepEqual([timed.timeText, timed.durationChoice, timed.customDuration], ['10:45', 90, '']);
  const custom = formFromEntry(task(1, TODAY, { startTime: '10:45', durationMinutes: 75 }));
  assert.deepEqual([custom.durationChoice, custom.customDuration], ['custom', '75']);
  assert.equal(formFromEntry({ text: '', icon: '🌟' }).date, '');
});

const form = (extra = {}) => ({ ...formFromEntry(task(1, TODAY)), text: 'Tandlæge', ...extra });

test('readTaskForm: time and duration are optional', () => {
  assert.deepEqual(readTaskForm('task', form()).fields, fields());
  assert.deepEqual(readTaskForm('task', form({ timeText: '10.45' })).fields, fields({ startTime: '10:45' }));
  assert.deepEqual(readTaskForm('task', form({ timeText: '10:45', durationChoice: 60 })).fields,
    fields({ startTime: '10:45', durationMinutes: 60 }));
  assert.deepEqual(readTaskForm('task', form({ timeText: '9', durationChoice: 'custom', customDuration: ' 75 ' })).fields,
    fields({ startTime: '09:00', durationMinutes: 75 }));
  // A chosen duration is ignored once the time is removed.
  assert.deepEqual(readTaskForm('task', form({ timeText: '', durationChoice: 60 })).fields, fields());
});

test('readTaskForm: errors', () => {
  assert.equal(readTaskForm('task', form({ text: '  ' })).error, 'taskForm.missingTitle');
  assert.equal(readTaskForm('task', form({ timeText: '25.00' })).error, 'taskForm.timeInvalid');
  assert.equal(readTaskForm('task', form({ date: '', timeText: '10.45' })).error, 'taskForm.timeNeedsDate');
  for (const customDuration of ['', '0', '-5', '1,5', '2000', 'en time']) {
    assert.equal(readTaskForm('task', form({ timeText: '10:00', durationChoice: 'custom', customDuration })).error,
      'taskForm.durationInvalid', customDuration);
  }
});

test('readTaskForm: habits need only a name; the icon falls back', () => {
  assert.deepEqual(readTaskForm('habit', form({ text: ' Læs ', icon: ' ' })).fields, { text: 'Læs', icon: '🌟' });
  assert.equal(readTaskForm('habit', form({ text: '' })).error, 'taskForm.missingTitle');
});
