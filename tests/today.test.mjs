// I dag (src/features/today/logic.js): NU/NÆSTE selection, overview,
// empty states, goal attention, shopping. Fixed dates; no clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildToday, goalsNeedingAttention, describeGoal, greetingKey,
  REST_LIMIT, GOAL_ATTENTION_DAYS,
} from '../src/features/today/logic.js';
import { describeItem } from '../src/features/tasks/items.js';
import { rankDueTasks } from '../src/features/tasks/focus.js';
import { timeToMinutes } from '../src/core/time/timeOfDay.js';
import { toggleJournalEntry } from '../src/data/tasks.js';

const TODAY = '2026-10-03'; // Saturday
const task = (id, date, priority = 'medium', done = false, text = `Opgave ${id}`) =>
  ({ id, text, date, priority, done, recurring: false });
const habit = (id, history = {}, text = `Vane ${id}`) =>
  ({ id, text, icon: '💧', recurring: true, date: null, priority: 'medium', done: false, history, streak: 0 });

const NOON = 12 * 60;
const day = (journal, extra = {}) =>
  buildToday({ journal, goals: [], groceries: [], today: TODAY, nowMinutes: NOON, ...extra });
const ids = (items) => items.map(i => i.id);

// ── NU / NÆSTE ─────────────────────────────────────────────────────────────

test('NU is the most important due task; NÆSTE the next one', () => {
  const d = day([task(1, TODAY, 'low'), task(2, TODAY, 'high'), task(3, TODAY, 'medium')]);
  assert.equal(d.now.id, 2);
  assert.equal(d.next.id, 3);
  assert.deepEqual(ids(d.rest), [1]);
  assert.equal(d.state, 'active');
});

test('ranking: priority, then oldest date, then the user\'s list order', () => {
  const ranked = rankDueTasks([
    task(1, TODAY, 'medium'), task(2, '2026-10-01', 'medium'), task(3, TODAY, 'medium'),
    task(4, '2026-09-30', 'low'), task(5, TODAY, 'high'), task(6, TODAY, undefined),
  ]);
  assert.deepEqual(ids(ranked), [5, 2, 1, 3, 6, 4]);
});

test('an overdue task is carried over, not dropped; future and undated tasks are not due', () => {
  const d = day([task(1, '2026-10-02'), task(2, '2026-10-05'), task(3, null)]);
  assert.equal(d.now.id, 1);
  assert.equal(d.now.carriedOver, true);
  // Nothing else is due, no habits: NÆSTE is the next planned task.
  assert.equal(d.next.id, 2);
  assert.equal(d.next.planned, true);
  assert.deepEqual(ids(d.rest), []);
});

test('habits follow due tasks; a habit can be NU when no task is due', () => {
  const d = day([habit(101), habit(102, { [TODAY]: 1 }), task(1, TODAY)]);
  assert.deepEqual([d.now.kind, d.now.id], ['task', 1]);
  assert.deepEqual([d.next.kind, d.next.id], ['habit', 101]);
  const onlyHabits = day([habit(101), habit(103)]);
  assert.deepEqual([onlyHabits.now.kind, onlyHabits.now.id, onlyHabits.next.id], ['habit', 101, 103]);
});

test('NÆSTE falls back to the earliest unfinished planned task', () => {
  const d = day([task(1, TODAY), task(2, '2026-10-09'), task(3, '2026-10-05'), task(4, '2026-10-04', 'low', true)]);
  assert.equal(d.now.id, 1);
  assert.equal(d.next.id, 3);
});

test('done items are never NU or NÆSTE', () => {
  const d = day([task(1, TODAY, 'high', true), task(2, TODAY, 'low')]);
  assert.equal(d.now.id, 2);
  assert.equal(d.next, null);
});

test('items in NU/NÆSTE are not repeated in the overview', () => {
  const d = day([task(1, TODAY, 'high'), habit(101), habit(102), task(2, TODAY, 'high', true)]);
  assert.equal(d.now.id, 1);
  assert.equal(d.next.id, 101);
  assert.deepEqual(ids(d.rest), [2]);
  assert.deepEqual(ids(d.habits), [102]);
});

test('overview: open tasks first (ranked, capped), then every done one; the remainder counts open tasks only', () => {
  const journal = Array.from({ length: 9 }, (_, i) => task(i + 1, TODAY, i === 8 ? 'high' : 'medium'));
  journal.push(task(20, TODAY, 'medium', true));
  const d = day(journal);
  assert.equal(d.now.id, 9);
  assert.equal(d.next.id, 1);
  assert.deepEqual(ids(d.rest), [2, 3, 4, 5, 6, 20]);
  assert.equal(d.rest.filter(i => !i.done).length, REST_LIMIT);
  assert.equal(d.restMore, 2); // 7 and 8; the done 20 is not "more to do"
});

test('a task ticked in NU stays on screen (undo) even when the open list is full', () => {
  let journal = Array.from({ length: 9 }, (_, i) => task(i + 1, '2026-10-01', i === 0 ? 'high' : 'medium'));
  journal = toggleJournalEntry(journal, 1, TODAY);
  const d = day(journal, { keepVisibleIds: new Set([1]) });
  assert.equal(d.now.id, 2);
  assert.deepEqual(d.rest.at(-1), { ...d.rest.at(-1), id: 1, done: true });
  assert.equal(d.restMore, 1); // 9
});

test('a ticked overdue task stays visible (dimmed) while keepVisibleIds holds it', () => {
  let journal = [task(1, '2026-10-01'), task(2, TODAY)];
  journal = toggleJournalEntry(journal, 1, TODAY);
  assert.deepEqual(ids(day(journal).rest), []);
  const kept = day(journal, { keepVisibleIds: new Set([1]) });
  assert.equal(kept.now.id, 2);
  assert.deepEqual(kept.rest.map(i => [i.id, i.done]), [[1, true]]);
});

test('ticking NU moves NÆSTE up (the selection follows the data)', () => {
  let journal = [task(1, TODAY, 'high'), task(2, TODAY), task(3, TODAY, 'low')];
  journal = toggleJournalEntry(journal, 1, TODAY);
  const d = day(journal);
  assert.deepEqual([d.now.id, d.next.id], [2, 3]);
  assert.deepEqual(d.rest.map(i => [i.id, i.done]), [[1, true]]);
});

// ── Scheduled tasks ────────────────────────────────────────────────────────

const at = timeToMinutes;
const timed = (id, startTime, durationMinutes, extra = {}) =>
  ({ ...task(id, TODAY, extra.priority ?? 'medium', extra.done ?? false), startTime, ...(durationMinutes ? { durationMinutes } : {}) });

test('an active scheduled task becomes NU, ahead of more important flexible tasks', () => {
  const d = day([task(1, TODAY, 'high'), timed(2, '10:45', 60)], { nowMinutes: at('11:00') });
  assert.equal(d.now.id, 2);
  assert.equal(d.now.status, 'active');
  assert.equal(d.now.endTime, '11:45');
  assert.equal(describeItem(d.now, TODAY), 'I gang til 11:45');
  assert.equal(d.now.timeLabel, '10:45 · 1 time');
  assert.equal(d.next.id, 1);
});

test('the earliest upcoming timed task today becomes NÆSTE; it is never NU before its time', () => {
  const journal = [timed(1, '16:00', 30), task(2, TODAY, 'low'), timed(3, '13:15'), timed(4, '12:30', 15, { priority: 'high' })];
  const d = day(journal, { nowMinutes: at('12:00') });
  assert.equal(d.now.id, 2); // the flexible task: the timed ones are still ahead
  assert.equal(d.next.id, 4);
  assert.deepEqual(ids(d.rest), [3, 1]); // the other upcoming ones, in time order
});

test('only timed tasks later today: no NU ("free"), NÆSTE is the next one', () => {
  const d = day([timed(1, '15:00', 60), timed(2, '10:45', 60)], { nowMinutes: at('08:00') });
  assert.equal(d.now, null);
  assert.equal(d.state, 'free');
  assert.equal(d.next.id, 2);
  assert.equal(d.next.startTime, '10:45');
});

test('a timed task whose time has passed stays visible and actionable', () => {
  const journal = [timed(1, '09:00', 30), timed(2, '20:00', 30)];
  const d = day(journal, { nowMinutes: at('12:00') });
  assert.equal(d.now.id, 1);
  assert.equal(d.now.status, 'past');
  assert.equal(d.now.done, false);
  assert.equal(describeItem(d.now, TODAY), 'Tidspunktet er passeret');
  assert.equal(d.next.id, 2);
});

test('a start time without duration is never active: before it NÆSTE, after it a flexible task', () => {
  const call = timed(1, '14:00');
  assert.equal(day([call], { nowMinutes: at('13:59') }).next.id, 1);
  assert.equal(day([call], { nowMinutes: at('13:59') }).now, null);
  const after = day([call, task(2, TODAY, 'low')], { nowMinutes: at('14:00') });
  assert.equal(after.now.id, 1);
  assert.equal(after.now.status, 'past');
});

test('two active tasks: the one that started first is NU', () => {
  const d = day([timed(1, '10:30', 60), timed(2, '10:00', 120)], { nowMinutes: at('11:00') });
  assert.equal(d.now.id, 2);
  assert.equal(d.next.id, 1);
});

test('a finished timed task is never NU or NÆSTE', () => {
  const d = day([timed(1, '10:45', 60, { done: true }), timed(2, '15:00', 60, { done: true }), task(3, TODAY)], { nowMinutes: at('11:00') });
  assert.equal(d.now.id, 3);
  assert.equal(d.next, null);
});

test('untimed fallback is unchanged when nothing is scheduled', () => {
  const journal = [task(1, TODAY, 'low'), task(2, TODAY, 'high'), task(3, '2026-10-01')];
  assert.deepEqual([day(journal, { nowMinutes: at('07:00') }).now.id, day(journal, { nowMinutes: at('22:00') }).now.id], [2, 2]);
  assert.equal(day(journal).next.id, 3);
});

test('a task from yesterday running past midnight is NU until it ends', () => {
  const night = { ...task(1, '2026-10-02'), startTime: '23:30', durationMinutes: 60 };
  const d = day([night, task(2, TODAY)], { nowMinutes: at('00:15') });
  assert.equal(d.now.id, 1);
  assert.equal(d.now.status, 'active');
  // Once it has ended it is an ordinary carried-over task (oldest first).
  const after = day([night, task(2, TODAY)], { nowMinutes: at('00:45') });
  assert.deepEqual([after.now.id, after.now.status, after.now.carriedOver], [1, 'past', true]);
});

test('NÆSTE on a later day shows its time', () => {
  const later = { ...task(1, '2026-10-05'), startTime: '09:00', durationMinutes: 45 };
  const d = day([later], { nowMinutes: at('10:00') });
  assert.equal(d.next.id, 1);
  assert.equal(d.next.timeLabel, '09:00 · 45 min');
  assert.equal(describeItem(d.next, TODAY), 'Planlagt til mandag');
});

test('regression: a point-in-time task stays on I dag after its start, even with many older tasks', () => {
  const older = Array.from({ length: 8 }, (_, i) => task(i + 10, '2026-10-01', 'high'));
  const d = day([...older, timed(1, '10:00')], { nowMinutes: at('10:00') });
  const shown = [d.now, d.next, ...d.rest].filter(Boolean).map(i => i.id);
  assert.ok(shown.includes(1), 'the appointment is visible');
  assert.equal(d.rest.find(i => i.id === 1).status, 'past');
});

test('regression: later timed tasks do not push open overdue tasks out of the overview', () => {
  const journal = [
    ...Array.from({ length: 6 }, (_, i) => timed(i + 1, `${String(13 + i).padStart(2, '0')}:00`, 30)),
    task(20, '2026-10-01', 'high'), task(21, '2026-10-02', 'high'), task(22, TODAY, 'low'),
  ];
  const d = day(journal, { nowMinutes: at('12:00') });
  assert.equal(d.now.id, 20);
  assert.equal(d.next.id, 1);
  // Timed ones in time order, then the untimed ones (capped separately).
  assert.deepEqual(ids(d.rest), [2, 3, 4, 5, 6, 21, 22]);
  assert.equal(d.restMore, 0);
});

test('ranking: within equal priority and day, a timed task whose time has come leads', () => {
  const ranked = rankDueTasks([task(1, TODAY), timed(2, '15:00'), timed(3, '09:00'), task(4, '2026-10-02')]);
  assert.deepEqual(ids(ranked), [4, 3, 2, 1]);
});

test('scheduling logic does not modify its inputs', () => {
  const journal = [timed(1, '10:45', 60), timed(2, '15:00'), task(3, TODAY)];
  const snapshot = JSON.stringify(journal);
  day(journal, { nowMinutes: at('11:00') });
  assert.equal(JSON.stringify(journal), snapshot);
});

// ── Empty states and progress ──────────────────────────────────────────────

test('an empty install: nothing to show, calm empty state', () => {
  const d = day([]);
  assert.equal(d.now, null);
  assert.equal(d.next, null);
  assert.deepEqual([d.rest, d.habits, d.goals], [[], [], []]);
  assert.equal(d.shoppingCount, 0);
  assert.deepEqual([d.done, d.total, d.state], [0, 0, 'empty']);
});

test('only past done tasks and undated tasks: still "empty" (nothing for today)', () => {
  const d = day([task(1, '2026-09-01', 'high', true), task(2, null)]);
  assert.equal(d.state, 'empty');
  assert.equal(d.total, 0);
});

test('everything for today ticked: "allDone", but NÆSTE can still show what is planned', () => {
  const d = day([task(1, TODAY, 'medium', true), habit(101, { [TODAY]: 1 }), task(2, '2026-10-06')]);
  assert.equal(d.now, null);
  assert.equal(d.state, 'allDone');
  assert.equal(d.next.id, 2);
  assert.deepEqual([d.done, d.total], [2, 2]);
});

test('progress is today\'s own plan (tasks dated today + habits), stable between visits', () => {
  const journal = [task(1, TODAY, 'medium', true), task(2, '2026-10-01'), habit(101, { [TODAY]: 1 }), habit(102)];
  const d = day(journal);
  assert.deepEqual([d.done, d.total], [2, 3]);
  // Ticking the carried-over task changes nothing, during the visit or after.
  const ticked = toggleJournalEntry(journal, 2, TODAY);
  const during = day(ticked, { keepVisibleIds: new Set([2]) });
  const after = day(ticked);
  assert.deepEqual([during.done, during.total], [2, 3]);
  assert.deepEqual([after.done, after.total], [2, 3]);
});

test('only a carried-over task, now ticked: "allDone" rather than "empty"', () => {
  const journal = toggleJournalEntry([task(1, '2026-10-01')], 1, TODAY);
  assert.equal(day(journal, { keepVisibleIds: new Set([1]) }).state, 'allDone');
});

// ── Goals and shopping ─────────────────────────────────────────────────────

const goal = (id, deadline, extra = {}) =>
  ({ id, title: `Mål ${id}`, deadline, progress: 1, target: 4, completed: false, ...extra });

test('goals needing attention: due within the window first (nearest first), then recently passed', () => {
  const goals = [
    goal(1, '2026-10-20'),                     // too far ahead
    goal(2, '2026-10-05'),
    goal(3, '2026-09-30'),                     // passed 3 days ago
    goal(4, TODAY),                            // today: not passed
    goal(5, '2026-10-04', { completed: true }),
    goal(6, ''), goal(7, null), goal(8, 'soon'),
    goal(9, '2026-10-10'),                     // last day ahead in the window
    goal(10, '2026-09-26'),                    // last day behind in the window
    goal(11, '2026-09-25'),                    // passed too long ago
    goal(12, '2025-01-10'),                    // long expired
  ];
  assert.equal(GOAL_ATTENTION_DAYS, 7);
  const result = goalsNeedingAttention(goals, TODAY);
  assert.deepEqual(ids(result), [4, 2, 9, 3, 10]);
  assert.deepEqual(result.map(g => g.passed), [false, false, false, true, true]);
  assert.deepEqual(ids(day([], { goals }).goals), [4, 2, 9]); // capped at 3
});

test('long-expired goals never crowd out a goal that is due soon', () => {
  const goals = [goal(1, '2025-01-10'), goal(2, '2025-06-01'), goal(3, '2026-02-01'), goal(4, '2026-10-04')];
  assert.deepEqual(ids(day([], { goals }).goals), [4]);
});

test('shopping: count of items still to buy, zero when none', () => {
  const groceries = [{ id: 1, done: false }, { id: 2, done: true }, { id: 3, done: false }];
  assert.equal(day([], { groceries }).shoppingCount, 2);
  assert.equal(day([], { groceries: [{ id: 1, done: true }] }).shoppingCount, 0);
});

test('I dag never needs University or Finances data', () => {
  // buildToday takes only journal, goals and groceries; extra inputs are ignored.
  const d = buildToday({ journal: [task(1, TODAY)], goals: [], groceries: [], today: TODAY, nowMinutes: NOON, exams: undefined });
  assert.equal(d.now.id, 1);
});

test('buildToday does not modify its inputs', () => {
  const journal = [task(1, TODAY, 'low'), task(2, TODAY, 'high'), habit(101)];
  const goals = [goal(1, '2026-10-05'), goal(2, '2026-09-01')];
  const snapshot = JSON.stringify({ journal, goals });
  buildToday({ journal, goals, groceries: [], today: TODAY, nowMinutes: NOON });
  assert.equal(JSON.stringify({ journal, goals }), snapshot);
});

// ── Danish text ────────────────────────────────────────────────────────────

test('item descriptions are short Danish lines', () => {
  const d = day([task(1, '2026-10-02', 'high'), task(2, '2026-09-28'), habit(101), task(3, '2026-10-04')]);
  assert.equal(describeItem(d.now, TODAY), 'Fra i går · Vigtig');
  assert.equal(describeItem(d.next, TODAY), 'Fra mandag');
  assert.equal(describeItem({ kind: 'habit' }, TODAY), 'Vane');
  assert.equal(describeItem({ kind: 'task', planned: true, date: '2026-10-04' }, TODAY), 'Planlagt til i morgen');
  assert.equal(describeItem({ kind: 'task', date: TODAY }, TODAY), '');
});

test('goal descriptions', () => {
  assert.equal(describeGoal({ deadline: '2026-10-04', passed: false, progress: 2.5, target: 10 }, TODAY), 'Frist i morgen · 2,5 af 10');
  assert.equal(describeGoal({ deadline: '2026-09-01', passed: true, progress: 0, target: 1000 }, TODAY), 'Fristen er passeret · 0 af 1.000');
});

test('greeting follows the hour', () => {
  assert.deepEqual([0, 4, 5, 9, 10, 11, 12, 17, 18, 23].map(greetingKey), [
    'today.greeting.night', 'today.greeting.night', 'today.greeting.morning', 'today.greeting.morning',
    'today.greeting.forenoon', 'today.greeting.forenoon', 'today.greeting.afternoon',
    'today.greeting.afternoon', 'today.greeting.evening', 'today.greeting.evening',
  ]);
});
