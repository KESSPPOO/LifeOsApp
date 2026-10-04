// The shared per-date schedule (src/features/schedule/day.js): stored tasks
// plus derived routine occurrences for one date, used by Tidshjul and
// Kalender. Fixed dates and times; no clock. It is a view: nothing is
// modified, nothing is stored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getScheduleForDate, clockFor } from '../src/features/schedule/day.js';
import { buildDay } from '../src/features/timewheel/logic.js';
import { timeToMinutes } from '../src/core/time/timeOfDay.js';

const MON = '2026-10-05';
const SUN = '2026-10-04';
const at = timeToMinutes;
const task = (id, extra = {}) =>
  ({ id, text: `Opgave ${id}`, subject: '', priority: 'medium', date: MON, done: false, recurring: false, ...extra });
const timed = (id, startTime, durationMinutes, extra = {}) =>
  task(id, { startTime, ...(durationMinutes ? { durationMinutes } : {}), ...extra });
const routine = (id, extra = {}) => ({
  id, name: `Rutine ${id}`, enabled: true, activeFrom: '2026-09-01', daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
  startTime: '07:30', durationMinutes: 45, steps: [{ id: 's1', text: 'Et' }, { id: 's2', text: 'To' }], ...extra,
});
const query = (journal, routines = [], routineLog = [], date = MON, nowMinutes = at('12:00')) =>
  getScheduleForDate({ journal, routines, routineLog, date, today: MON, nowMinutes });
const ids = (items) => items.map(item => item.id);
const conflictIds = (conflicts) => conflicts.map(group => ids(group));

test('tasks only: timed items in time order with start / end; untimed tasks of the date apart', () => {
  const journal = [
    timed(1, '14:00', 60), timed(2, '09:00', 30), task(3), timed(4, '11:00'),
    timed(5, '10:00', 30, { date: '2026-10-06' }), // another day
    task(6, { recurring: true, date: undefined }),  // a habit: never on a date
    task(7, { date: undefined }),                   // undated
  ];
  const s = query(journal);
  assert.deepEqual(ids(s.items), [2, 4, 1]);
  assert.deepEqual(s.items.map(i => [i.start, i.end]), [[540, 570], [660, null], [840, 900]]);
  assert.deepEqual(ids(s.untimed), [3]);
  assert.equal(s.untimed[0].kind, 'task');
  assert.equal(s.untimed[0].task, journal[2], 'the stored task, for the editor');
  assert.deepEqual(s.conflicts, []);
});

test('routines only: occurrences of the date, timed on the axis, untimed apart; done ones kept', () => {
  const routines = [routine('a'), routine('b', { startTime: undefined, durationMinutes: undefined }), routine('c', { daysOfWeek: [2] })];
  const log = [{ routineId: 'a', date: MON, completedStepIds: ['s1', 's2'] }];
  const s = query([], routines, log);
  assert.deepEqual(ids(s.items), ['a@2026-10-05']);
  assert.equal(s.items[0].done, true);
  assert.deepEqual([s.items[0].start, s.items[0].end], [450, 495]);
  assert.deepEqual(ids(s.untimed), ['b@2026-10-05']);
  assert.equal(s.untimed[0].kind, 'routine');
});

test('combined: task–task, task–routine and routine–routine overlaps, by the shared findOverlaps', () => {
  const journal = [timed(1, '07:00', 60), timed(2, '07:45', 30), timed(3, '20:00', 30)];
  const routines = [routine('a'), routine('b', { startTime: '20:15', durationMinutes: 30 }), routine('c', { startTime: '20:20', durationMinutes: 10 })];
  const s = query(journal, routines);
  assert.deepEqual(ids(s.items), [1, 'a@2026-10-05', 2, 3, 'b@2026-10-05', 'c@2026-10-05']);
  assert.deepEqual(conflictIds(s.conflicts), [[1, 'a@2026-10-05', 2], [3, 'b@2026-10-05', 'c@2026-10-05']]);
  assert.deepEqual(s.items.find(i => i.id === 2).overlapsWith, [1, 'a@2026-10-05']);
});

test('no routines: the task output is unchanged (omitted and empty are the same)', () => {
  const journal = [timed(1, '10:00', 60), timed(2, '10:30', 60), task(3)];
  const without = getScheduleForDate({ journal, date: MON, today: MON, nowMinutes: at('12:00') });
  assert.deepEqual(query(journal), without);
  assert.ok(without.items.every(item => item.kind === 'task'));
});

test('points stay points: no end, never an overlap; finished items are shown but need no time', () => {
  const journal = [timed(1, '10:00'), timed(2, '09:30', 60), timed(3, '10:00', 30, { done: true })];
  const s = query(journal);
  assert.equal(s.items.find(i => i.id === 1).end, null);
  assert.deepEqual(s.conflicts, [], 'a point and a finished task overlap nothing');
  assert.deepEqual(ids(s.items), [2, 1, 3]);
});

test('crossing midnight: the part after 00:00 is on the next date, once; nothing else from the day before', () => {
  const journal = [
    timed(1, '23:30', 60, { date: SUN }), // runs to 00:30
    timed(2, '23:00', 60, { date: SUN }), // ends exactly at midnight
    timed(3, '23:59', undefined, { date: SUN }), // a point the day before
    timed(4, '00:15', 30),
  ];
  const routines = [routine('n', { startTime: '23:45', durationMinutes: 30 })];
  const monday = query(journal, routines);
  assert.deepEqual(monday.items.map(i => [i.id, i.start, i.end]), [
    ['n@2026-10-04', -15, 15], [1, -30, 30], [4, 15, 45], ['n@2026-10-05', 1425, 1455],
  ].sort((a, b) => a[1] - b[1] || a[2] - b[2]));
  assert.deepEqual(conflictIds(monday.conflicts), [[1, 'n@2026-10-04', 4]]);
  const sunday = query(journal, routines, [], SUN);
  assert.deepEqual(ids(sunday.items), ['n@2026-10-03', 2, 1, 'n@2026-10-04', 3], 'on its own day the item starts there');
  assert.equal(sunday.items.find(i => i.id === 1).end, 1470);
});

test('a view: the stored lists are never modified', () => {
  const deepFreeze = (value) => {
    if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
    return value;
  };
  const journal = deepFreeze([timed(1, '07:00', 60), task(2), timed(3, '23:30', 60, { date: SUN })]);
  const routines = deepFreeze([routine('a')]);
  const log = deepFreeze([{ routineId: 'a', date: MON, completedStepIds: ['s1'] }]);
  const before = JSON.stringify([journal, routines, log]);
  assert.doesNotThrow(() => query(journal, routines, log));
  assert.equal(JSON.stringify([journal, routines, log]), before);
});

test('zero regression: Tidshjul shows exactly the shared schedule (items, overlaps, untimed routines)', () => {
  const journal = [timed(1, '07:00', 60), timed(2, '07:45', 30), task(3), timed(4, '23:30', 60, { date: SUN }), timed(5, '12:00')];
  const routines = [routine('a'), routine('b', { startTime: undefined })];
  for (const date of [SUN, MON, '2026-10-06']) {
    const args = { journal, routines, routineLog: [], date, today: MON, nowMinutes: at('07:50') };
    const shared = getScheduleForDate(args);
    const day = buildDay(args);
    assert.deepEqual(day.items, shared.items, date);
    assert.deepEqual(day.conflicts, shared.conflicts, date);
    assert.deepEqual(day.flexibleRoutines, shared.untimed.filter(i => i.kind === 'routine'), date);
  }
});

test('clockFor: the clock only matters for today and the days next to it', () => {
  assert.equal(clockFor(MON, MON, 754), 754);
  assert.equal(clockFor(SUN, MON, 754), 754);
  assert.equal(clockFor('2026-10-06', MON, 754), 754);
  assert.equal(clockFor('2026-10-08', MON, 754), 0);
});
