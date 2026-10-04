// Routines (src/features/routines/model.js) and how routine occurrences
// take part in NU / NÆSTE, I dag and Tidshjul. Fixed dates and times; no
// clock. 2026-10-05 is a Monday.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  routineOccursOnDate, isoWeekday, occurrenceFor, occurrencesOn, routineItem, toggleStep,
  addRoutine, updateRoutine, deleteRoutine, formFromRoutine, readRoutineForm, toggleDay, moveStep,
  describeDays, describeRoutine, describeProgress, EVERY_DAY, WEEKDAYS, WEEKEND,
} from '../src/features/routines/model.js';
import { selectFocus } from '../src/features/tasks/focus.js';
import { describeItem } from '../src/features/tasks/items.js';
import { buildToday } from '../src/features/today/logic.js';
import { buildDay, timelineRows, itemDetails } from '../src/features/timewheel/logic.js';
import { timeToMinutes } from '../src/core/time/timeOfDay.js';
import { KEYS } from '../src/core/storage/keys.js';
import { createPersistedListStore } from '../src/core/state/persistedListStore.js';
import { quietLogger, setupListStore } from './fixtures.mjs';

const MON = '2026-10-05';
const SAT = '2026-10-10';
const SUN = '2026-10-11';
const at = timeToMinutes;

const routine = (extra = {}) => ({
  id: 'morning', name: 'Morgenrutine', enabled: true, activeFrom: '2026-10-01', daysOfWeek: [...EVERY_DAY],
  startTime: '07:30', durationMinutes: 45,
  steps: [{ id: 's1', text: 'Stå op' }, { id: 's2', text: 'Børst tænder' }, { id: 's3', text: 'Hudpleje' }, { id: 's4', text: 'Morgenmad' }],
  ...extra,
});
const task = (id, extra = {}) =>
  ({ id, text: `Opgave ${id}`, subject: '', priority: 'medium', date: MON, done: false, recurring: false, ...extra });

// ── Recurrence ─────────────────────────────────────────────────────────────

test('weekdays are ISO, Monday first: 1 = mandag … 7 = søndag', () => {
  assert.deepEqual(['2026-10-05', '2026-10-06', '2026-10-09', SAT, SUN].map(isoWeekday), [1, 2, 5, 6, 7]);
});

test('no occurrence before activeFrom; from it on, on the chosen weekdays only', () => {
  const r = routine({ activeFrom: MON, daysOfWeek: [1, 3] });
  assert.equal(routineOccursOnDate(r, '2026-10-04'), false); // Sunday before
  assert.equal(routineOccursOnDate(r, '2026-09-28'), false); // a Monday before activeFrom
  assert.equal(routineOccursOnDate(r, MON), true);
  assert.equal(routineOccursOnDate(r, '2026-10-06'), false); // Tuesday
  assert.equal(routineOccursOnDate(r, '2026-10-07'), true);  // Wednesday
});

test('presets: hver dag, hverdage, weekend', () => {
  const dates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', SAT, SUN];
  const days = (daysOfWeek) => dates.filter(d => routineOccursOnDate(routine({ daysOfWeek }), d)).length;
  assert.deepEqual([days(EVERY_DAY), days(WEEKDAYS), days(WEEKEND)], [7, 5, 2]);
  assert.equal(routineOccursOnDate(routine({ daysOfWeek: WEEKEND }), SAT), true);
  assert.equal(routineOccursOnDate(routine({ daysOfWeek: WEEKDAYS }), SAT), false);
});

test('a paused routine, or damaged data, produces no occurrence', () => {
  assert.equal(routineOccursOnDate(routine({ enabled: false }), MON), false);
  assert.equal(routineOccursOnDate(routine({ daysOfWeek: undefined }), MON), false);
  assert.equal(routineOccursOnDate(routine({ activeFrom: undefined }), MON), false);
});

// ── Occurrences ────────────────────────────────────────────────────────────

test('an occurrence: identity, date, schedule, steps with that day\'s progress', () => {
  const log = [{ routineId: 'morning', date: MON, completedStepIds: ['s2'] }];
  const o = occurrenceFor(routine(), MON, log);
  assert.deepEqual(
    [o.kind, o.id, o.routineId, o.date, o.title, o.startTime, o.durationMinutes, o.doneCount, o.steps.length, o.done, describeProgress(o)],
    ['routine', `morning@${MON}`, 'morning', MON, 'Morgenrutine', '07:30', 45, 1, 4, false, '1 af 4 trin'],
  );
  assert.deepEqual(o.steps.map(s => [s.id, s.done]), [['s1', false], ['s2', true], ['s3', false], ['s4', false]]);
});

test('untimed and point routines: nothing is invented', () => {
  const untimed = occurrenceFor(routine({ startTime: undefined, durationMinutes: undefined }), MON, []);
  assert.deepEqual([untimed.startTime, untimed.durationMinutes], [null, null]);
  const point = occurrenceFor(routine({ durationMinutes: undefined }), MON, []);
  assert.deepEqual([point.startTime, point.durationMinutes], ['07:30', null]);
  const bad = occurrenceFor(routine({ startTime: '25:00', durationMinutes: 45 }), MON, []);
  assert.deepEqual([bad.startTime, bad.durationMinutes], [null, null]);
});

test('a routine item has the schedule of a task: end time, label and status at now', () => {
  const item = routineItem(occurrenceFor(routine(), MON, []), MON, at('07:45'));
  assert.deepEqual([item.endTime, item.timeLabel, item.status], ['08:15', '07:30 · 45 min', 'active']);
  assert.equal(routineItem(occurrenceFor(routine(), MON, []), MON, at('07:00')).status, 'upcoming');
  assert.equal(routineItem(occurrenceFor(routine({ startTime: undefined }), MON, []), MON, 0).status, 'untimed');
});

test('occurrencesOn keeps the routines\' order and never modifies a template', () => {
  const routines = [routine(), routine({ id: 'evening', name: 'Aftenrutine', startTime: '22:30', daysOfWeek: WEEKDAYS })];
  const snapshot = JSON.stringify(routines);
  assert.deepEqual(occurrencesOn(routines, [], MON).map(o => o.routineId), ['morning', 'evening']);
  assert.deepEqual(occurrencesOn(routines, [], SAT).map(o => o.routineId), ['morning']);
  assert.equal(JSON.stringify(routines), snapshot);
});

// ── Completion ─────────────────────────────────────────────────────────────

test('completion: starts empty, tick and untick a step, all steps = complete', () => {
  const r = routine();
  assert.equal(describeProgress(occurrenceFor(r, MON, [])), 'Ikke startet');
  let log = toggleStep([], 'morning', MON, 's1');
  assert.deepEqual(log, [{ routineId: 'morning', date: MON, completedStepIds: ['s1'] }]);
  assert.equal(describeProgress(occurrenceFor(r, MON, log)), '1 af 4 trin');
  log = toggleStep(log, 'morning', MON, 's1');
  assert.equal(describeProgress(occurrenceFor(r, MON, log)), 'Ikke startet');
  for (const id of ['s1', 's2', 's3', 's4']) log = toggleStep(log, 'morning', MON, id);
  const done = occurrenceFor(r, MON, log);
  assert.deepEqual([done.done, describeProgress(done)], [true, 'Klaret']);
});

test('completion is per routine and per date', () => {
  let log = toggleStep([], 'morning', MON, 's1');
  log = toggleStep(log, 'evening', MON, 'e1');
  log = toggleStep(log, 'morning', '2026-10-06', 's2');
  assert.equal(occurrenceFor(routine(), MON, log).doneCount, 1);
  assert.equal(occurrenceFor(routine(), '2026-10-06', log).doneCount, 1);
  assert.equal(occurrenceFor(routine(), '2026-10-04', log).doneCount, 0); // yesterday unaffected
  assert.equal(occurrenceFor(routine(), '2026-10-07', log).doneCount, 0); // the next day starts unticked
  assert.equal(log.length, 3);
});

test('ticking never changes the template; deleted steps no longer count', () => {
  const r = routine();
  const snapshot = JSON.stringify(r);
  const log = toggleStep(toggleStep([], 'morning', MON, 's1'), 'morning', MON, 'gone');
  occurrenceFor(r, MON, log);
  assert.equal(JSON.stringify(r), snapshot);
  const o = occurrenceFor(r, MON, log);
  assert.deepEqual([o.doneCount, o.steps.length], [1, 4]);
});

test('completion survives a restart (persisted log, reloaded)', async () => {
  // (Failed-read and corrupt-log safety: the routineLog row of the
  // MODULES matrix in persistedListStore.test.mjs.)
  const { store: first, storage } = setupListStore({ key: KEYS.routineLog });
  await first.getState().hydrate();
  first.getState().setItems(prev => toggleStep(prev, 'morning', MON, 's1'));
  await first.getState().flush();
  const second = createPersistedListStore({ storage, key: KEYS.routineLog, seed: [], logger: quietLogger() });
  await second.getState().hydrate();
  assert.equal(occurrenceFor(routine(), MON, second.getState().items).doneCount, 1);
});

// ── Editing ────────────────────────────────────────────────────────────────

const form = (extra = {}) => ({ ...formFromRoutine(null), name: 'Aftenrutine', steps: [{ id: 'a', text: 'Børst tænder' }], ...extra });

test('new routine form: every day, active, no time, no steps', () => {
  assert.deepEqual(formFromRoutine(null), {
    name: '', enabled: true, daysOfWeek: EVERY_DAY, steps: [], timeText: '', durationChoice: null, customDuration: '',
  });
});

test('create a routine: active from today, time and duration optional, no empty keys', () => {
  const { fields } = readRoutineForm(form({ daysOfWeek: [5, 1, 3] }));
  const [created] = addRoutine([], 'r1', fields, MON);
  assert.deepEqual(created, {
    id: 'r1', activeFrom: MON, name: 'Aftenrutine', enabled: true, daysOfWeek: [1, 3, 5],
    steps: [{ id: 'a', text: 'Børst tænder' }],
  });
  const timed = readRoutineForm(form({ timeText: '22.30', durationChoice: 30 })).fields;
  assert.deepEqual([timed.startTime, timed.durationMinutes], ['22:30', 30]);
  const point = readRoutineForm(form({ timeText: '22:30' })).fields;
  assert.deepEqual([point.startTime, point.durationMinutes], ['22:30', null]);
  assert.ok(!('durationMinutes' in addRoutine([], 'r2', point, MON)[0]));
});

test('the form needs a name, a day and a step; empty steps are dropped', () => {
  assert.equal(readRoutineForm(form({ name: ' ' })).error, 'routine.form.missingName');
  assert.equal(readRoutineForm(form({ daysOfWeek: [] })).error, 'routine.form.missingDays');
  assert.equal(readRoutineForm(form({ steps: [{ id: 'x', text: '  ' }] })).error, 'routine.form.missingSteps');
  assert.equal(readRoutineForm(form({ timeText: '25' })).error, 'taskForm.timeInvalid');
  assert.deepEqual(readRoutineForm(form({ steps: [{ id: 'x', text: '' }, { id: 'y', text: ' Læs ' }] })).fields.steps, [{ id: 'y', text: 'Læs' }]);
});

test('weekday selection stays Monday-first; steps move up and down', () => {
  assert.deepEqual(toggleDay([3, 5], 1), [1, 3, 5]);
  assert.deepEqual(toggleDay([1, 3, 5], 3), [1, 5]);
  const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(moveStep(steps, 2, -1).map(s => s.id), ['a', 'c', 'b']);
  assert.deepEqual(moveStep(steps, 0, 1).map(s => s.id), ['b', 'a', 'c']);
  assert.equal(moveStep(steps, 0, -1), steps);
  assert.equal(moveStep(steps, 2, 1), steps);
});

test('editing keeps id and activeFrom; removing the time removes the keys', () => {
  const r = routine();
  const [edited] = updateRoutine([r], 'morning', readRoutineForm({ ...formFromRoutine(r), timeText: '', name: 'Morgen' }).fields);
  assert.deepEqual([edited.id, edited.activeFrom, edited.name], ['morning', '2026-10-01', 'Morgen']);
  assert.ok(!('startTime' in edited) && !('durationMinutes' in edited));
  assert.deepEqual(edited.steps, r.steps);
});

test('deleting a routine keeps every log, its own included, and touches nothing else', () => {
  const routines = [routine(), routine({ id: 'evening' })];
  const log = [{ routineId: 'morning', date: MON, completedStepIds: ['s1'] }, { routineId: 'evening', date: MON, completedStepIds: ['e1'] }];
  const after = deleteRoutine(routines, 'morning');
  assert.deepEqual(after.map(r => r.id), ['evening']);
  assert.equal(after[0], routines[1]);
  assert.deepEqual(log.length, 2); // the log is a separate list; deleteRoutine never sees it
  assert.deepEqual(occurrencesOn(after, log, MON).map(o => o.routineId), ['evening']);
});

test('Danish descriptions', () => {
  assert.deepEqual([describeDays(EVERY_DAY), describeDays([5, 4, 3, 2, 1]), describeDays([7, 6]), describeDays([1, 3, 5])],
    ['Hver dag', 'Hverdage', 'Weekend', 'Man · Ons · Fre']);
  assert.equal(describeRoutine(routine({ daysOfWeek: WEEKDAYS })), '07:30 · 45 min · Hverdage · 4 trin');
  assert.equal(describeRoutine(routine({ startTime: undefined, daysOfWeek: [6] })), 'Lør · 4 trin');
  const item = routineItem(occurrenceFor(routine(), MON, toggleStep([], 'morning', MON, 's1')), MON, at('07:45'));
  assert.equal(describeItem(item, MON), 'Rutine · 1 af 4 trin · I gang til 08:15');
});

// ── NU / NÆSTE with routines ───────────────────────────────────────────────

const items = (routines, log, now, date = MON) => occurrencesOn(routines, log, date).map(o => routineItem(o, MON, now));
const focus = (journal, routines, log, now) =>
  selectFocus({ journal, today: MON, nowMinutes: now, routineItems: items(routines, log, now) });

test('regression: with no routines, focus is exactly the task-only result', () => {
  const journal = [task(1, { startTime: '10:00', durationMinutes: 60 }), task(2, { priority: 'high' }), task(3, { startTime: '15:00' })];
  for (const now of [at('06:00'), at('10:30'), at('16:00')]) {
    assert.deepEqual(selectFocus({ journal, today: MON, nowMinutes: now, routineItems: [] }),
      selectFocus({ journal, today: MON, nowMinutes: now }));
  }
});

test('an active routine can be NU; a later one NÆSTE; a finished one neither', () => {
  const morning = routine();
  const evening = routine({ id: 'evening', name: 'Aftenrutine', startTime: '22:30', durationMinutes: 30 });
  const active = focus([task(1, { priority: 'high' })], [morning, evening], [], at('07:45'));
  assert.deepEqual([active.now.kind, active.now.routineId], ['routine', 'morning']);
  assert.deepEqual([active.next.kind, active.next.routineId], ['routine', 'evening']);
  let log = [];
  for (const id of ['s1', 's2', 's3', 's4']) log = toggleStep(log, 'morning', MON, id);
  const done = focus([task(1)], [morning], log, at('07:45'));
  assert.equal(done.now.id, 1);
  assert.equal(done.next, null);
});

test('an untimed routine is a flexible item, never a timed one; no preference by kind', () => {
  const flexible = routine({ startTime: undefined, durationMinutes: undefined });
  const f = focus([task(1)], [flexible], [], at('09:00'));
  assert.equal(f.now.id, 1);              // equal rank: the task (input order) first
  assert.equal(f.next.routineId, 'morning');
  const onlyRoutine = focus([], [flexible], [], at('09:00'));
  assert.equal(onlyRoutine.now.routineId, 'morning');
});

test('two active items: the earlier start is NU, whatever its kind', () => {
  const f = focus([task(1, { startTime: '07:15', durationMinutes: 60 })], [routine()], [], at('07:45'));
  assert.equal(f.now.id, 1);
  assert.equal(f.next.routineId, 'morning');
  const g = focus([task(1, { startTime: '07:40', durationMinutes: 60 })], [routine()], [], at('07:45'));
  assert.equal(g.now.routineId, 'morning');
});

// ── I dag ──────────────────────────────────────────────────────────────────

const today = (journal, routines, log, now, extra = {}) =>
  buildToday({ journal, goals: [], groceries: [], today: MON, nowMinutes: now, routines, routineLog: log, ...extra });

test('regression: I dag with no routines is unchanged', () => {
  const journal = [task(1), task(2, { startTime: '15:00', durationMinutes: 30 }), task(3, { date: '2026-10-03' })];
  const base = buildToday({ journal, goals: [], groceries: [], today: MON, nowMinutes: at('12:00') });
  assert.deepEqual(today(journal, [], [], at('12:00')), { ...base, routines: [] });
});

test('I dag: routines not in NU/NÆSTE are listed with their progress; finished ones too', () => {
  const evening = routine({ id: 'evening', name: 'Aftenrutine', startTime: '22:30', durationMinutes: 30, steps: [{ id: 'e1', text: 'Sluk skærme' }] });
  const log = toggleStep([], 'evening', MON, 'e1');
  const d = today([task(1), task(2)], [routine(), evening], log, at('12:00'));
  // Regression: the morning routine's time has passed. Unlike a task it is
  // not carried over, so it does not take NU; it is listed with its state.
  assert.equal(d.now.id, 1);
  assert.equal(d.next.id, 2);
  assert.deepEqual(d.routines.map(r => [r.routineId, describeItem(r, MON)]), [
    ['morning', 'Rutine · Ikke startet · Tidspunktet er passeret'],
    ['evening', 'Rutine · Klaret'],
  ]);
  // Not featured -> listed with its progress.
  const later = today([task(1), task(2)], [routine({ startTime: '20:00' }), evening], [], at('12:00'));
  assert.deepEqual(later.routines.map(r => [r.routineId, describeItem(r, MON)]), [['evening', 'Rutine · Ikke startet']]);
  assert.equal(later.next.routineId, 'morning');
});

test('I dag: "Intet lige nu" when the next thing is a routine later today', () => {
  const d = today([], [routine({ startTime: '18:00' })], [], at('12:00'));
  assert.deepEqual([d.now, d.next.routineId, d.state], [null, 'morning', 'free']);
});

test('regression: a routine created after its time today never takes NU', () => {
  const d = today([task(1, { priority: 'high' })], [routine({ activeFrom: MON, startTime: '07:00', durationMinutes: 30 })], [], at('20:00'));
  assert.equal(d.now.id, 1);
  assert.equal(d.next, null);
  assert.equal(today([], [routine({ activeFrom: MON })], [], at('20:00')).now, null);
});

test('regression: a routine still running after midnight is NU on I dag and Tidshjul', () => {
  const late = routine({ id: 'late', startTime: '23:00', durationMinutes: 120 });
  const iDag = today([], [late], [], at('00:30'));
  assert.deepEqual([iDag.now?.routineId, iDag.now?.date], ['late', '2026-10-04']);
  const w = wheel([], [late], [], at('00:30')).focus;
  assert.deepEqual(w.now, iDag.now);
  // Once it has ended it is not carried over.
  assert.notEqual(today([], [late], [], at('01:30')).now?.date, '2026-10-04');
});

test('regression: damaged log entries or steps never crash', () => {
  const damaged = [{ routineId: 'morning', date: MON, completedStepIds: {} }, { routineId: 'morning', date: MON, completedStepIds: 3 }];
  assert.equal(occurrenceFor(routine(), MON, damaged).doneCount, 0);
  assert.doesNotThrow(() => today([], [routine()], damaged, at('07:45')));
  const noText = routine({ steps: [{ id: 's1' }, { id: 's2', text: 'Børst tænder' }] });
  const fields = readRoutineForm(formFromRoutine(noText)).fields;
  assert.deepEqual(fields.steps, [{ id: 's2', text: 'Børst tænder' }]);
});

test('regression: a routine stores time fields by the same rule as a task (invalid values never)', () => {
  const [stored] = addRoutine([], 'r', { name: 'X', enabled: true, daysOfWeek: [1], steps: [{ id: 'a', text: 'a' }], startTime: '7', durationMinutes: 'lang' }, MON);
  assert.ok(!('startTime' in stored) && !('durationMinutes' in stored));
});

// ── Tidshjul ───────────────────────────────────────────────────────────────

const wheel = (journal, routines, log, now, date = MON) =>
  buildDay({ journal, date, today: MON, nowMinutes: now, routines, routineLog: log });

test('regression: Tidshjul with no routines is unchanged', () => {
  const journal = [task(1, { startTime: '10:00', durationMinutes: 60 }), task(2, { startTime: '10:30', durationMinutes: 60 }), task(3)];
  const base = buildDay({ journal, date: MON, today: MON, nowMinutes: at('12:00') });
  assert.deepEqual(wheel(journal, [], [], at('12:00')), { ...base, flexibleRoutines: [] });
});

test('Tidshjul: a routine interval and a routine point appear in time order', () => {
  const evening = routine({ id: 'evening', name: 'Aftenrutine', startTime: '22:30', durationMinutes: undefined });
  const d = wheel([task(1, { startTime: '12:00', durationMinutes: 30 })], [routine(), evening], [], at('09:00'));
  assert.deepEqual(d.items.map(i => [i.kind, i.id, i.start, i.end]), [
    ['routine', `morning@${MON}`, 450, 495], ['task', 1, 720, 750], ['routine', `evening@${MON}`, 1350, null],
  ]);
  assert.deepEqual(itemDetails(d.items[0]), ['45 min', 'Rutine', 'Ikke startet']);
  assert.deepEqual(itemDetails(d.items[2]), ['Uden varighed', 'Rutine', 'Ikke startet']);
});

test('Tidshjul: routine progress and a finished routine', () => {
  let log = toggleStep([], 'morning', MON, 's1');
  assert.deepEqual(itemDetails(wheel([], [routine()], log, at('07:45')).items[0]), ['45 min', 'Rutine', '1 af 4 trin', 'i gang']);
  for (const id of ['s2', 's3', 's4']) log = toggleStep(log, 'morning', MON, id);
  const d = wheel([], [routine()], log, at('09:00'));
  assert.deepEqual([d.items[0].done, d.state], [true, 'allDone']);
  assert.deepEqual(itemDetails(d.items[0]), ['45 min', 'Rutine', 'klaret']);
});

test('Tidshjul conflicts: task ↔ routine and routine ↔ routine; a finished routine no longer conflicts', () => {
  const dentist = task(1, { text: 'Tandlæge', startTime: '08:00', durationMinutes: 60 });
  const stretch = routine({ id: 'stretch', name: 'Udstrækning', startTime: '07:50', durationMinutes: 20 });
  const d = wheel([dentist], [routine(), stretch], [], at('06:00'));
  assert.deepEqual(d.conflicts.map(g => g.map(i => i.id)), [[`morning@${MON}`, `stretch@${MON}`, 1]]);
  let log = [];
  for (const id of ['s1', 's2', 's3', 's4']) log = toggleStep(log, 'morning', MON, id);
  const after = wheel([dentist], [routine()], log, at('06:00'));
  assert.deepEqual(after.conflicts, []);
});

test('Tidshjul: an untimed routine is never on the timeline; it is listed apart', () => {
  const d = wheel([], [routine({ startTime: undefined })], [], at('09:00'));
  assert.deepEqual([d.items.length, d.flexibleRoutines.length, d.state], [0, 1, 'onlyFlexible']);
  assert.deepEqual(timelineRows(d), []);
  // Regression: a finished untimed routine is not open work.
  let log = [];
  for (const id of ['s1', 's2', 's3', 's4']) log = toggleStep(log, 'morning', MON, id);
  assert.equal(wheel([], [routine({ startTime: undefined })], log, at('09:00')).state, 'empty');
});

test('Tidshjul: a routine running past midnight shows on the next day too', () => {
  const late = routine({ id: 'late', startTime: '23:30', durationMinutes: 60, daysOfWeek: [7] });
  const d = wheel([], [late], [], at('00:15'), MON); // Sunday 23:30 -> Monday 00:30
  assert.deepEqual(d.items.map(i => [i.id, i.start, i.end, i.status]), [[`late@${SUN.replace('11', '04')}`, -30, 30, 'active']]);
});

test('Tidshjul: NU/NÆSTE with routines match I dag', () => {
  const journal = [task(1, { startTime: '12:00', durationMinutes: 30 }), task(2)];
  const routines = [routine(), routine({ id: 'evening', startTime: '22:30', durationMinutes: 30 })];
  for (const now of [at('07:00'), at('07:45'), at('12:10'), at('23:00')]) {
    const w = wheel(journal, routines, [], now).focus;
    const d = today(journal, routines, [], now);
    assert.deepEqual([w.now, w.next], [d.now, d.next], `at ${now}`);
  }
});
