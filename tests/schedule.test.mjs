// Task scheduling (src/core/time/timeOfDay.js, src/features/tasks/schedule.js)
// and backwards compatibility of the stored `journal`. Fixed dates and
// times; no clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTimeOfDay, timeToMinutes, minutesToTime, minutesOfDay, parseTimeInput,
} from '../src/core/time/timeOfDay.js';
import {
  getSchedule, isTimed, endTime, scheduleStatus, compareStart, scheduleLabel, withSchedule,
  isValidDuration, DURATION_CHOICES,
} from '../src/features/tasks/schedule.js';
import { formatDuration } from '../src/core/i18n/index.js';
import { toggleJournalEntry } from '../src/data/tasks.js';
import { updateTask } from '../src/features/plan/logic.js';
import { KEYS } from '../src/core/storage/keys.js';
import { LEGACY_JOURNAL, JOURNAL_TEST_SEED, parsed, setupListStore } from './fixtures.mjs';

const DAY = '2026-10-03';
const at = (hhmm) => timeToMinutes(hhmm);
const task = (extra = {}) => ({ id: 1, text: 'Tandlæge', priority: 'medium', date: DAY, done: false, recurring: false, ...extra });

// ── Time of day ────────────────────────────────────────────────────────────

test('isTimeOfDay accepts only canonical HH:mm', () => {
  for (const v of ['00:00', '09:05', '14:30', '23:59']) assert.equal(isTimeOfDay(v), true, v);
  for (const v of ['24:00', '9:05', '09:5', '12:60', '12.30', '', null, undefined, 930, '09:05:00']) {
    assert.equal(isTimeOfDay(v), false, String(v));
  }
});

test('time <-> minutes since midnight', () => {
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('14:30'), 870);
  assert.equal(timeToMinutes('23:59'), 1439);
  assert.equal(timeToMinutes('25:00'), null);
  assert.equal(timeToMinutes(undefined), null);
  assert.equal(minutesToTime(870), '14:30');
  assert.equal(minutesToTime(0), '00:00');
  assert.equal(minutesToTime(1470), '00:30'); // past midnight: next day's clock
  assert.equal(minutesOfDay(new Date(2026, 9, 3, 7, 5)), 425);
});

test('parseTimeInput understands how Danes type times', () => {
  const cases = {
    '10.45': '10:45', '10:45': '10:45', '10,45': '10:45', '10 45': '10:45', '1045': '10:45',
    '945': '09:45', '9': '09:00', '09': '09:00', ' 8.30 ': '08:30', '0': '00:00', '23.59': '23:59',
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(parseTimeInput(input), expected, input);
  for (const input of ['24', '24.00', '10.60', '10.5', 'kl 10', '', '   ', '10:45:00', '-1', null, undefined]) {
    assert.equal(parseTimeInput(input), null, String(input));
  }
});

test('formatDuration: Danish duration labels', () => {
  assert.deepEqual(DURATION_CHOICES.map(formatDuration), ['15 min', '30 min', '45 min', '1 time', '1,5 time', '2 timer']);
  assert.equal(formatDuration(75), '1 t 15 min');
  assert.equal(formatDuration(150), '2,5 timer');
  assert.equal(formatDuration(1), '1 min');
});

// ── A task's schedule ──────────────────────────────────────────────────────

test('getSchedule: start, duration and derived end; nothing invented', () => {
  assert.deepEqual(getSchedule(task({ startTime: '10:45', durationMinutes: 60 })), { start: 645, duration: 60, end: 705 });
  assert.deepEqual(getSchedule(task({ startTime: '14:00' })), { start: 840, duration: null, end: null });
  assert.equal(endTime(task({ startTime: '10:45', durationMinutes: 60 })), '11:45');
  assert.equal(endTime(task({ startTime: '14:00' })), null); // unknown duration: no end time
});

test('untimed: no fields, invalid fields, habits and undated tasks', () => {
  assert.equal(getSchedule(task()), null);
  assert.equal(getSchedule(task({ startTime: null, durationMinutes: null })), null);
  assert.equal(getSchedule(task({ startTime: '25:00' })), null);
  assert.equal(getSchedule(task({ startTime: 'soon' })), null);
  assert.equal(getSchedule(task({ startTime: '10:00', date: null })), null);
  assert.equal(getSchedule({ ...task({ startTime: '10:00' }), recurring: true }), null);
  assert.equal(isTimed(task()), false);
  assert.equal(isTimed(task({ startTime: '10:00' })), true);
});

test('invalid durations count as unknown, never as a guess', () => {
  for (const d of [0, -30, 1.5, '60', NaN, 1441, null, undefined]) {
    assert.equal(isValidDuration(d), false, String(d));
    assert.deepEqual(getSchedule(task({ startTime: '10:00', durationMinutes: d })), { start: 600, duration: null, end: null });
  }
  assert.equal(isValidDuration(1), true);
  assert.equal(isValidDuration(1440), true);
});

test('scheduleStatus: upcoming, active, past; untimed', () => {
  const dentist = task({ startTime: '10:45', durationMinutes: 60 });
  assert.equal(scheduleStatus(dentist, DAY, at('10:44')), 'upcoming');
  assert.equal(scheduleStatus(dentist, DAY, at('10:45')), 'active');
  assert.equal(scheduleStatus(dentist, DAY, at('11:44')), 'active');
  assert.equal(scheduleStatus(dentist, DAY, at('11:45')), 'past'); // end is exclusive
  assert.equal(scheduleStatus(task(), DAY, at('10:00')), 'untimed');
});

test('missing duration: upcoming until its start, then past; never active', () => {
  const call = task({ startTime: '14:00' });
  assert.equal(scheduleStatus(call, DAY, at('13:59')), 'upcoming');
  assert.equal(scheduleStatus(call, DAY, at('14:00')), 'past');
  assert.equal(scheduleStatus(call, DAY, at('14:01')), 'past');
});

test('other days: a later day is upcoming, an earlier day is past', () => {
  const tomorrow = task({ date: '2026-10-04', startTime: '08:00', durationMinutes: 30 });
  const yesterday = task({ date: '2026-10-02', startTime: '08:00', durationMinutes: 30 });
  assert.equal(scheduleStatus(tomorrow, DAY, at('23:00')), 'upcoming');
  assert.equal(scheduleStatus(yesterday, DAY, at('07:00')), 'past');
});

test('midnight: a task running past midnight is active until its end on the next day', () => {
  const night = task({ date: '2026-10-02', startTime: '23:30', durationMinutes: 60 });
  assert.equal(endTime(night), '00:30');
  assert.equal(scheduleStatus(night, '2026-10-02', at('23:45')), 'active');
  assert.equal(scheduleStatus(night, DAY, at('00:15')), 'active'); // next day, still running
  assert.equal(scheduleStatus(night, DAY, at('00:30')), 'past');
  // Across the end of a month and a DST change.
  const dst = task({ date: '2026-10-24', startTime: '23:00', durationMinutes: 120 });
  assert.equal(scheduleStatus(dst, '2026-10-25', at('00:59')), 'active');
  assert.equal(scheduleStatus(dst, '2026-10-25', at('01:00')), 'past');
});

test('compareStart orders by time, untimed last, ties keep list order', () => {
  const list = [
    task({ id: 1 }), task({ id: 2, startTime: '14:00' }), task({ id: 3, startTime: '09:00' }),
    task({ id: 4 }), task({ id: 5, startTime: '09:00' }), task({ id: 6, startTime: 'bad' }),
  ];
  assert.deepEqual([...list].sort(compareStart).map(x => x.id), [3, 5, 2, 1, 4, 6]);
});

test('scheduleLabel', () => {
  assert.equal(scheduleLabel(task({ startTime: '10:45', durationMinutes: 60 })), '10:45 · 1 time');
  assert.equal(scheduleLabel(task({ startTime: '10:45', durationMinutes: 90 })), '10:45 · 1,5 time');
  assert.equal(scheduleLabel(task({ startTime: '10:45' })), '10:45');
  assert.equal(scheduleLabel(task()), '');
});

test('withSchedule stores only valid values and removes the rest', () => {
  assert.deepEqual(withSchedule(task(), { startTime: '10:45', durationMinutes: 60 }), task({ startTime: '10:45', durationMinutes: 60 }));
  assert.deepEqual(withSchedule(task(), { startTime: '10:45', durationMinutes: null }), task({ startTime: '10:45' }));
  // No time: both keys removed (a duration without a time is not kept).
  const cleared = withSchedule(task({ startTime: '10:45', durationMinutes: 60 }), { startTime: null, durationMinutes: 60 });
  assert.deepEqual(cleared, task());
  assert.ok(!('startTime' in cleared) && !('durationMinutes' in cleared));
  // Invalid input is never stored.
  assert.deepEqual(withSchedule(task(), { startTime: '25:00', durationMinutes: -5 }), task());
  // An untimed task stays free of schedule keys.
  assert.deepEqual(Object.keys(withSchedule(task(), {})).sort(), Object.keys(task()).sort());
});

// ── Backwards compatibility of stored tasks ────────────────────────────────

test('existing stored journal loads unchanged and is not rewritten on load', async () => {
  const { store, adapter } = setupListStore({ key: KEYS.journal, values: { journal: LEGACY_JOURNAL }, seed: JOURNAL_TEST_SEED });
  await store.getState().hydrate();
  await store.getState().flush();
  assert.deepEqual(store.getState().items, LEGACY_JOURNAL);
  assert.deepEqual(parsed(adapter, 'journal'), LEGACY_JOURNAL);
  for (const entry of store.getState().items) {
    assert.ok(!('startTime' in entry) && !('durationMinutes' in entry), `${entry.id} gained no fields`);
    assert.equal(isTimed(entry), false);
  }
});

test('saving an old task without changing it invents no schedule values', () => {
  const old = LEGACY_JOURNAL[0];
  const [saved] = updateTask([old], old.id, {
    text: old.text, subject: old.subject, priority: old.priority, date: old.date,
    startTime: null, durationMinutes: null,
  });
  assert.deepEqual(saved, old);
  assert.equal(JSON.stringify(saved), JSON.stringify(old));
});

test('ticking a task or habit keeps its schedule fields as they were', () => {
  const list = [task({ startTime: '10:45', durationMinutes: 60 }), LEGACY_JOURNAL[5]];
  const ticked = toggleJournalEntry(list, 1, DAY);
  assert.deepEqual(ticked[0], { ...list[0], done: true });
  const habit = toggleJournalEntry(list, 101, DAY)[1];
  assert.ok(!('startTime' in habit));
});
