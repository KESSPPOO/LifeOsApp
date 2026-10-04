// Kalender (src/features/calendar/logic.js): mode and selected date, weeks
// (Monday first, ISO week numbers, year and DST boundaries), the Dag and
// Uge models over the shared per-date schedule, and what they say to
// screen readers. Fixed dates and times; no clock. Kalender is a view: it
// stores nothing, and its overlaps are Tidshjul's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_MODE, INITIAL_CALENDAR, calendarReducer, selectedDate, weekDates, calendarTitle,
  timeWindow, buildCalendarDay, buildCalendarWeek, HOUR_HEIGHT, MIN_BLOCK_HEIGHT,
  describeCalendarItem, describeUntimedItem, describeWeekDay,
} from '../src/features/calendar/logic.js';
import { buildDay } from '../src/features/timewheel/logic.js';
import { formFromEntry, readTaskForm, addTask } from '../src/features/plan/logic.js';
import { KEYS } from '../src/core/storage/keys.js';
import { timeToMinutes } from '../src/core/time/timeOfDay.js';
import { repoPath, sourceFiles } from './fixtures.mjs';

// Danish time, so the DST tests below cross a real switch (the logic itself
// never reads the clock or the zone).
process.env.TZ = 'Europe/Copenhagen';

const MON = '2026-10-05'; // today in these tests; uge 41
const at = timeToMinutes;
const task = (id, extra = {}) =>
  ({ id, text: `Opgave ${id}`, subject: '', priority: 'medium', date: MON, done: false, recurring: false, ...extra });
const timed = (id, startTime, durationMinutes, extra = {}) =>
  task(id, { startTime, ...(durationMinutes ? { durationMinutes } : {}), ...extra });
const routine = (id, extra = {}) => ({
  id, name: `Rutine ${id}`, enabled: true, activeFrom: '2026-09-01', daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '07:30', durationMinutes: 45, steps: [{ id: 's1', text: 'Et' }], ...extra,
});
const day = (journal, extra = {}) =>
  buildCalendarDay({ journal, routines: [], routineLog: [], date: MON, today: MON, nowMinutes: at('12:00'), ...extra });
const ids = (items) => items.map(item => item.id);

// ── Mode and selected date ──────────────────────────────────────────────────

test('opens in Uge on today; the date is not stored (null = follow today)', () => {
  assert.equal(DEFAULT_MODE, 'week');
  assert.deepEqual(INITIAL_CALENDAR, { mode: 'week', date: null });
  assert.equal(selectedDate(INITIAL_CALENDAR, MON), MON);
  assert.equal(selectedDate(INITIAL_CALENDAR, '2026-10-06'), '2026-10-06', 'follows today across midnight');
});

test('step: a week in Uge (same weekday), a day in Dag; back on today follows today again', () => {
  const r = (state, action) => calendarReducer(state, { today: MON, ...action });
  let s = r(INITIAL_CALENDAR, { type: 'step', direction: 1 });
  assert.equal(s.date, '2026-10-12');
  s = r(s, { type: 'step', direction: -1 });
  assert.equal(s.date, null);
  s = r(s, { type: 'step', direction: -1 });
  assert.equal(s.date, '2026-09-28');
  s = r(s, { type: 'mode', mode: 'day' });
  s = r(s, { type: 'step', direction: 1 });
  assert.deepEqual(s, { mode: 'day', date: '2026-09-29' });
});

test('Dag → Uge → Dag keeps the selected date; select and today', () => {
  const r = (state, action) => calendarReducer(state, { today: MON, ...action });
  let s = r(INITIAL_CALENDAR, { type: 'select', date: '2026-10-08' });
  s = r(s, { type: 'mode', mode: 'day' });
  assert.equal(selectedDate(s, MON), '2026-10-08');
  s = r(s, { type: 'mode', mode: 'week' });
  s = r(s, { type: 'mode', mode: 'day' });
  assert.deepEqual(s, { mode: 'day', date: '2026-10-08' });
  assert.equal(r(s, { type: 'today' }).date, null);
  assert.equal(r(s, { type: 'select', date: MON }).date, null, 'selecting today follows today');
  assert.equal(r(INITIAL_CALENDAR, { type: 'mode', mode: 'week' }), INITIAL_CALENDAR, 'no change, same state');
});

// ── Weeks ───────────────────────────────────────────────────────────────────

test('a week is seven local dates, Monday first; Sunday belongs to the week before Monday', () => {
  const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
  assert.deepEqual(weekDates('2026-10-08'), week);
  assert.deepEqual(weekDates('2026-10-11'), week, 'Sunday is the last day, not the first');
  assert.deepEqual(weekDates(MON), week);
});

test('year boundaries: ISO week numbers and the dates of the week', () => {
  assert.deepEqual(weekDates('2027-01-01'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.deepEqual(calendarTitle('week', '2027-01-01', MON), { title: 'Uge 53', subline: '28. december – 3. januar 2027' });
  assert.deepEqual(calendarTitle('week', '2025-12-31', MON), { title: 'Uge 1', subline: '29. december 2025 – 4. januar' });
  const next = calendarReducer({ mode: 'week', date: '2026-12-30' }, { type: 'step', direction: 1, today: MON });
  assert.equal(next.date, '2027-01-06');
  assert.equal(weekDates(next.date)[0], '2027-01-04');
  assert.deepEqual(calendarTitle('week', next.date, MON).title, 'Uge 1');
});

test('daylight saving: weeks across both switches stay seven whole days', () => {
  assert.notEqual(new Date(2026, 9, 24).getTimezoneOffset(), new Date(2026, 9, 26).getTimezoneOffset(), 'a real switch');
  assert.deepEqual(weekDates('2026-10-25'), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  assert.equal(weekDates('2026-03-29')[0], '2026-03-23');
  assert.equal(calendarReducer({ mode: 'week', date: '2026-10-22' }, { type: 'step', direction: 1, today: MON }).date, '2026-10-29');
  assert.equal(calendarReducer({ mode: 'day', date: '2026-10-25' }, { type: 'step', direction: 1, today: MON }).date, '2026-10-26');
});

test('headings: Dag shows the date and week, Uge the week and its dates', () => {
  assert.deepEqual(calendarTitle('day', MON, MON), { title: 'Mandag den 5. oktober', subline: 'Uge 41' });
  assert.deepEqual(calendarTitle('week', '2026-10-08', MON), { title: 'Uge 41', subline: '5.–11. oktober' });
  assert.deepEqual(calendarTitle('week', '2026-09-30', MON), { title: 'Uge 40', subline: '28. september – 4. oktober' });
});

// ── The time window ─────────────────────────────────────────────────────────

test('the window: the waking day, widened to items and now with an hour around them; never past 00–24', () => {
  assert.deepEqual(timeWindow([]), { start: 480, end: 1200 });
  assert.deepEqual(timeWindow([{ start: at('14:00'), end: at('15:00') }]), { start: 480, end: 1200 });
  assert.deepEqual(timeWindow([{ start: at('06:30'), end: at('07:00') }]), { start: 300, end: 1200 });
  assert.deepEqual(timeWindow([{ start: at('23:30'), end: null }]), { start: 480, end: 1440 });
  assert.deepEqual(timeWindow([{ start: -30, end: 30 }]), { start: 0, end: 1200 });
  assert.deepEqual(timeWindow([], at('21:10')), { start: 480, end: 1380 });
});

// ── Dag ─────────────────────────────────────────────────────────────────────

test('Dag: true positions; a duration sets the height (at least a touch target); a point stays a point', () => {
  const d = day([timed(1, '10:00', 60), timed(2, '12:00'), timed(3, '14:00', 15), task(4)]);
  assert.equal(HOUR_HEIGHT, 72);
  assert.deepEqual(d.window, { start: 480, end: 1200 });
  assert.deepEqual(d.items.map(i => [i.id, i.top, i.height, i.end === null]), [
    [1, 144, 72, false], [2, 288, MIN_BLOCK_HEIGHT, true], [3, 432, MIN_BLOCK_HEIGHT, false],
  ]);
  assert.equal(d.items[1].end, null, 'no length is invented for a point');
  assert.deepEqual(d.hours[0], { minute: 480, label: '08:00', top: 0 });
  assert.deepEqual(d.hours.at(-1), { minute: 1200, label: '20:00', top: 864 });
  assert.equal(d.height, 864);
  assert.equal(d.state, 'scheduled');
});

test('Dag: untimed tasks and routines are apart, never on the axis; finished items stay', () => {
  const routines = [routine('r', { startTime: undefined, durationMinutes: undefined })];
  const d = day([timed(1, '10:00', 60, { done: true }), task(2), task(3, { done: true })], { routines });
  assert.deepEqual(ids(d.items), [1]);
  assert.equal(d.items[0].done, true);
  assert.deepEqual(ids(d.untimed), [2, 3, 'r@2026-10-05']);
  assert.equal(day([task(2)]).state, 'onlyUntimed');
  assert.equal(day([]).state, 'empty');
  assert.equal(day([]).window, null);
});

test('Dag: blocks that would cover each other sit side by side; only real overlaps are conflicts', () => {
  // 15-minute items one after the other: no conflict, but readable blocks touch.
  const touching = day([timed(1, '10:00', 15), timed(2, '10:15', 15)]);
  assert.deepEqual(touching.items.map(i => [i.column, i.columns]), [[0, 2], [1, 2]]);
  assert.deepEqual(touching.conflicts, []);
  const three = day([timed('a', '10:00', 120), timed('b', '10:00', 30), timed('c', '11:00', 30)]);
  assert.deepEqual(three.items.map(i => [i.id, i.column, i.columns]), [['b', 0, 2], ['a', 1, 2], ['c', 0, 2]]);
  assert.equal(three.conflicts.length, 1);
  const apart = day([timed(1, '09:00', 60), timed(2, '13:00', 60)]);
  assert.deepEqual(apart.items.map(i => i.columns), [1, 1]);
});

test('Dag: the NU line only on today, at the current time', () => {
  const journal = [timed(1, '10:00', 60)];
  const today = day(journal);
  assert.equal(today.nowMinute, at('12:00'));
  assert.equal(today.nowTop, 288);
  for (const date of ['2026-10-04', '2026-10-06', '2026-10-12']) {
    const other = day([timed(1, '10:00', 60, { date })], { date });
    assert.equal(other.nowMinute, null, date);
    assert.equal(other.nowTop, null, date);
  }
});

test('Dag: a task from the day before is drawn from 00:00, and its time says so', () => {
  const d = day([timed(1, '23:30', 60, { date: '2026-10-04' })]);
  assert.equal(d.window.start, 0);
  assert.deepEqual([d.items[0].start, d.items[0].top, d.items[0].height], [-30, 0, MIN_BLOCK_HEIGHT]);
  assert.match(describeCalendarItem(d.items[0], d.items), /^fra 23:30 til 00:30, Opgave 1, 1 time, Opgave, fortsat fra i går/);
});

test('conflicts are exactly Tidshjul\'s (task–task, task–routine, routine–routine)', () => {
  const journal = [timed(1, '07:00', 60), timed(2, '07:45', 30), timed(3, '20:00', 30), timed(4, '21:00', 30, { done: true })];
  const routines = [routine('a'), routine('b', { startTime: '20:15', durationMinutes: 30 }), routine('c', { startTime: '21:00', durationMinutes: 30 })];
  for (const date of ['2026-10-04', MON, '2026-10-06']) {
    const args = { journal: journal.map(x => ({ ...x, date })), routines, routineLog: [], date, today: MON, nowMinutes: at('07:50') };
    const calendar = buildCalendarDay(args);
    const wheel = buildDay(args);
    assert.deepEqual(calendar.conflicts.map(g => ids(g)), wheel.conflicts.map(g => ids(g)), date);
    assert.deepEqual(calendar.items.map(i => i.overlapsWith), wheel.items.map(i => i.overlapsWith), date);
  }
});

test('routines on a past date are marked as projected from today\'s routine (ADR-009)', () => {
  const routines = [routine('w')];
  const past = '2026-10-02';
  assert.equal(day([], { date: past, routines }).projected, true);
  assert.equal(day([timed(1, '10:00', 60, { date: past })], { date: past }).projected, false, 'tasks are as stored');
  assert.equal(day([], { routines }).projected, false, 'today is not projected');
  assert.equal(day([], { date: '2026-10-06', routines }).projected, false);
});

// ── Uge ─────────────────────────────────────────────────────────────────────

const WEEK_JOURNAL = [
  timed(1, '09:00', 60),
  timed(2, '09:30', 60),
  task(3, { date: '2026-10-06' }),
  timed(4, '23:30', 60, { date: '2026-10-08' }),
  timed(5, '12:00', 30, { date: '2026-10-11', done: true }),
  timed(6, '10:00', 30, { date: '2026-10-12' }), // the next week
  timed(7, '18:00', undefined, { date: '2026-10-10' }),
];
const week = (extra = {}) => buildCalendarWeek({
  journal: WEEK_JOURNAL, routines: [routine('w')], routineLog: [], date: '2026-10-07', today: MON, ...extra,
});

test('Uge: exactly seven local days, Monday first, with today; the same for every day of the week', () => {
  const w = week();
  assert.deepEqual(w.days.map(d => d.date), weekDates('2026-10-07'));
  assert.deepEqual(w.days.map(d => d.isToday), [true, false, false, false, false, false, false]);
  // The selected day is the screen's, so selecting another day rebuilds nothing.
  for (const date of weekDates('2026-10-07')) assert.deepEqual(week({ date }), w, date);
});

test('Uge: what each day holds; a task past midnight counts on its own day only', () => {
  const w = week();
  assert.deepEqual(w.days.map(d => d.count), [3, 2, 1, 2, 1, 1, 1]);
  assert.deepEqual(w.days.map(d => d.conflictCount), [1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(w.days.map(d => d.doneCount), [0, 0, 0, 0, 0, 0, 1]);
  // Friday draws the tail of Thursday's task (from 00:00) and its own routine.
  assert.deepEqual(ids(w.days[4].items), [4, 'w@2026-10-09']);
  // Routines only on their weekdays; nothing from next week.
  assert.ok(w.days.slice(0, 5).every(d => d.items.some(i => i.routineId === 'w')));
  assert.ok(w.days.slice(5).every(d => !d.items.some(i => i.routineId === 'w')));
  assert.ok(!w.days.some(d => d.items.some(i => i.id === 6)));
  assert.equal(w.empty, false);
  assert.equal(w.projected, false);
});

test('Uge: bars at real minutes on one shared window; points have no width', () => {
  const w = week();
  assert.deepEqual(w.window, { start: 0, end: 1440 }); // Friday starts at 00:00, Thursday ends at 24:00
  const near = (bar, left, width) => assert.ok(Math.abs(bar.left - left) < 1e-9 && Math.abs(bar.width - width) < 1e-9, JSON.stringify(bar));
  near(w.days[0].items.find(i => i.routineId === 'w').bar, 450 / 1440, 45 / 1440);
  near(w.days[5].items[0].bar, 0.75, 0);
  near(w.days[3].items[1].bar, 1410 / 1440, 30 / 1440); // clipped at midnight
  assert.deepEqual(w.axis.map(a => a.label), ['00', '04', '08', '12', '16', '20', '24']);
  // Overlapping items keep separate lines.
  assert.deepEqual(w.days[0].items.filter(i => i.kind === 'task').map(i => i.lane), [0, 1]);
});

test('Uge: an open week, and routines on past days marked as projected', () => {
  const open = buildCalendarWeek({ journal: [], routines: [], routineLog: [], date: '2026-11-04', today: MON });
  assert.equal(open.empty, true);
  assert.ok(open.days.every(d => d.count === 0 && d.items.length === 0));
  assert.deepEqual(open.window, { start: 480, end: 1200 });
  assert.equal(week({ date: '2026-09-30' }).projected, true);
});

test('Uge never depends on the clock (no "now" goes in)', () => {
  assert.deepEqual(week(), week());
  assert.ok(!/nowMinutes\s*[,}]/.test(buildCalendarWeek.toString().split('\n')[0]), 'no nowMinutes parameter');
});

// ── In words ────────────────────────────────────────────────────────────────

test('screen readers: a timed item says start, end, title, type, state and overlap', () => {
  const d = day([timed(1, '10:00', 60, { text: 'Tandlæge' }), timed(2, '10:30', 60, { text: 'Træning' }), timed(3, '15:00', undefined, { text: 'Ring', done: true })],
    { routines: [routine('w', { name: 'Morgen' })] });
  const [morning, dentist, , call] = d.items;
  assert.equal(describeCalendarItem(morning, d.items), 'fra 07:30 til 08:15, Morgen, 45 min, Rutine, Ikke startet');
  assert.equal(describeCalendarItem(dentist, d.items), 'fra 10:00 til 11:00, Tandlæge, 1 time, Opgave, overlapper med Træning');
  assert.equal(describeCalendarItem(call, d.items), 'klokken 15:00, Ring, Uden varighed, Opgave, klaret');
});

test('screen readers: untimed items and week days', () => {
  const d = day([task(1, { text: 'Ring til mor', done: true }), task(2, { text: 'Vigtigt', priority: 'high' })],
    { routines: [routine('r', { name: 'Aften', startTime: undefined })] });
  assert.deepEqual(d.untimed.map(describeUntimedItem), [
    'Ring til mor, Opgave, uden tidspunkt, klaret',
    'Vigtigt, Opgave, uden tidspunkt, Vigtig',
    'Aften, Rutine, uden tidspunkt, Ikke startet',
  ]);
  const w = week();
  assert.equal(describeWeekDay(w.days[0]), 'Mandag den 5. oktober, i dag, 3 planlagte ting, 1 konflikt');
  assert.equal(describeWeekDay(w.days[6]), 'Søndag den 11. oktober, 1 planlagt ting, 1 klaret');
  assert.equal(describeWeekDay({ date: '2026-11-03', isToday: false, count: 0, doneCount: 0, conflictCount: 0 }), 'Tirsdag den 3. november, åben');
});

// ── Actions and data ────────────────────────────────────────────────────────

test('"Ny opgave" uses the Plan task form with the selected date filled in (and no time)', () => {
  const form = formFromEntry({ text: '', date: '2026-10-08' });
  assert.equal(form.date, '2026-10-08');
  assert.equal(form.timeText, '');
  const { fields } = readTaskForm('task', { ...form, text: 'Købe gave' });
  const [created] = addTask([], fields);
  assert.equal(created.date, '2026-10-08');
  assert.ok(!('startTime' in created));
});

const CALENDAR_DIR = repoPath('../src/features/calendar');
const screenSource = readFileSync(repoPath('../src/features/calendar/screens/CalendarScreen.js'), 'utf8');

test('items open the existing flows: task sheet, routine checklist, routine template for a routine\'s time', () => {
  const actions = readFileSync(repoPath('../src/features/schedule/useScheduleItemActions.js'), 'utf8');
  assert.match(screenSource, /useScheduleItemActions\(\{ openEditor, openChecklist \}\)/);
  assert.match(readFileSync(repoPath('../src/features/timewheel/screens/TimewheelScreen.js'), 'utf8'), /useScheduleItemActions\(/, 'the same as Tidshjul');
  assert.match(actions, /openChecklist\(item\)/);
  assert.match(actions, /openEditor\('task', item\.task\)/);
  assert.match(actions, /openEditor\('task', item\.task, \{ focus: 'time' \}\)/);
  assert.match(actions, /navigate\('routines', \{ editId: item\.routineId \}\)/);
  assert.match(screenSource, /openEditor\('task', \{ text: '', date \}\)/);
  assert.ok(!/TaskSheet|RoutineSheet|ChecklistSheet/.test(screenSource), 'no editor of its own');
});

test('Kalender stores nothing: no store, no storage key, no storage access, no new UI framework', () => {
  const files = sourceFiles(CALENDAR_DIR);
  assert.ok(files.length >= 4);
  assert.ok(!files.some(f => f.endsWith('store.js')));
  assert.ok(!Object.keys(KEYS).some(k => /calendar|event/i.test(k)));
  for (const file of [...files, repoPath('../src/features/schedule/day.js')]) {
    const src = readFileSync(file, 'utf8');
    assert.ok(!/core\/storage|AsyncStorage|useSet\w+|createPersistedListStore/.test(src), file);
    for (const [, from] of src.matchAll(/from '([^']+)'/g)) {
      assert.ok(from.startsWith('.') || ['react', 'react-native', '@react-navigation/native'].includes(from), `${file}: ${from}`);
    }
  }
});
