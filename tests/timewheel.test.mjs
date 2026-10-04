// Timewheel (src/features/timewheel/logic.js) and overlap detection
// (src/features/tasks/schedule.js findOverlaps). Fixed dates and times; no
// clock. Timewheel is a view: these tests also check nothing is modified.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDay, timelineRows, ringPoint, arcPath, blockHeight, timeRange, itemDetails,
  describeTimelineItem, clockFor,
} from '../src/features/timewheel/logic.js';
import { taskItem } from '../src/features/tasks/items.js';
import { findOverlaps } from '../src/features/tasks/schedule.js';
import { buildToday } from '../src/features/today/logic.js';
import { timeToMinutes } from '../src/core/time/timeOfDay.js';

const TODAY = '2026-10-03';
const at = timeToMinutes;
const task = (id, extra = {}) =>
  ({ id, text: `Opgave ${id}`, subject: '', priority: 'medium', date: TODAY, done: false, recurring: false, ...extra });
const timed = (id, startTime, durationMinutes, extra = {}) =>
  task(id, { startTime, ...(durationMinutes ? { durationMinutes } : {}), ...extra });
const habit = (id, history = {}) =>
  ({ id, text: `Vane ${id}`, icon: '💧', recurring: true, date: null, priority: 'medium', done: false, history, streak: 0 });
const day = (journal, extra = {}) =>
  buildDay({ journal, date: TODAY, today: TODAY, nowMinutes: at('12:00'), ...extra });
const ids = (list) => list.map(x => x.id);

// ── Day model ──────────────────────────────────────────────────────────────

test('only timed tasks on the selected date become items, in time order', () => {
  const journal = [
    timed(1, '15:00', 90), task(2), timed(3, '10:45', 60),
    timed(4, '09:00', 30, { date: '2026-10-04' }), timed(5, '08:00'),
    habit(101), timed(6, '10:45', 30),
    task(7, { startTime: '25:00' }), // invalid time: not invented into the day
  ];
  const d = day(journal);
  assert.deepEqual(ids(d.items), [5, 6, 3, 1]); // equal starts: shorter first
  assert.deepEqual(ids(d.flexible), [2, 7]);
});

test('items carry start/end minutes, open/finished state and status at now', () => {
  const [item] = day([timed(1, '10:45', 60)], { nowMinutes: at('11:00') }).items;
  assert.deepEqual(
    [item.start, item.end, item.done, item.status, item.timeLabel, item.endTime],
    [645, 705, false, 'active', '10:45 · 1 time', '11:45'],
  );
  const [finished] = day([timed(1, '10:45', 60, { done: true })]).items;
  assert.equal(finished.done, true);
});

test('a task without a duration is a point: no end, no invented interval', () => {
  const d = day([timed(1, '14:00'), timed(2, '13:30', 60)], { nowMinutes: at('14:10') });
  const point = d.items.find(i => i.id === 1);
  assert.deepEqual([point.end, point.endTime, point.durationMinutes], [null, null, null]);
  assert.deepEqual(itemDetails(point), ['Uden varighed']);
  assert.equal(point.status, 'past'); // never 'active'
  assert.deepEqual(point.overlapsWith, []); // a point never overlaps
  assert.equal(timeRange(point).end, '');
});

test('a task from yesterday running past midnight shows from 00:00 of today', () => {
  const night = timed(1, '23:30', 60, { date: '2026-10-02' });
  const notOver = timed(2, '22:00', 60, { date: '2026-10-02' }); // ended before midnight
  const d = day([night, notOver], { nowMinutes: at('00:15') });
  assert.deepEqual(ids(d.items), [1]);
  const [item] = d.items;
  assert.deepEqual([item.start, item.end, item.status], [-30, 30, 'active']);
  assert.deepEqual(timeRange(item), { start: '23:30', end: '00:30' });
  assert.deepEqual(itemDetails(item), ['1 time', 'fortsat fra i går', 'i gang']);
  // ... and on its own day it is marked as running into tomorrow.
  const own = buildDay({ journal: [night], date: '2026-10-02', today: TODAY, nowMinutes: 0 }).items[0];
  assert.deepEqual([own.start, own.end], [1410, 1470]);
  assert.deepEqual(itemDetails(own), ['1 time', 'slutter i morgen', 'i gang']);
});

test('the day model does not modify the stored tasks', () => {
  const journal = [timed(1, '10:00', 60), timed(2, '10:30', 60), task(3), habit(101)];
  const snapshot = JSON.stringify(journal);
  const d = day(journal);
  timelineRows(d);
  assert.equal(JSON.stringify(journal), snapshot);
  assert.equal(d.items[0].task, journal[0]); // the same stored object, for the editor
});

// ── States ─────────────────────────────────────────────────────────────────

test('states: empty, only flexible, scheduled, all done', () => {
  assert.equal(day([]).state, 'empty');
  assert.equal(day([habit(101)]).state, 'empty');
  assert.equal(day([task(1)]).state, 'onlyFlexible');
  assert.equal(day([task(1), timed(2, '10:00', 30)]).state, 'scheduled');
  const done = day([timed(1, '10:00', 30, { done: true }), timed(2, '14:00', null, { done: true })]);
  assert.deepEqual([done.state, done.done, done.items.length], ['allDone', 2, 2]);
  assert.equal(done.items.length, 2); // finished items stay, subdued
});

test('finished flexible tasks are not listed as flexible', () => {
  assert.deepEqual(ids(day([task(1, { done: true }), task(2)]).flexible), [2]);
});

// ── NU / NÆSTE: the same rule as I dag ─────────────────────────────────────

test('on today NU/NÆSTE are exactly I dag\'s for the same date and time', () => {
  const journal = [
    timed(1, '10:45', 60), timed(2, '13:00', 30), task(3, { priority: 'high' }),
    task(4, { date: '2026-10-01' }), habit(101), timed(5, '09:00'),
  ];
  for (const minute of [at('06:00'), at('11:00'), at('12:59'), at('13:10'), at('23:00')]) {
    const wheel = day(journal, { nowMinutes: minute }).focus;
    const iDag = buildToday({ journal, goals: [], groceries: [], today: TODAY, nowMinutes: minute });
    assert.deepEqual(wheel.now, iDag.now, `NU at ${minute}`);
    assert.deepEqual(wheel.next, iDag.next, `NÆSTE at ${minute}`);
  }
});

test('another day has no live "now": future shows the first planned, past a summary', () => {
  const journal = [timed(1, '15:00', 60, { date: '2026-10-05' }), timed(2, '08:00', 30, { date: '2026-10-05' })];
  const future = buildDay({ journal, date: '2026-10-05', today: TODAY, nowMinutes: at('12:00') });
  assert.equal(future.relation, 'future');
  assert.equal(future.nowMinute, null);
  assert.equal(future.focus.first.id, 2);
  const past = buildDay({ journal: [timed(1, '09:00', 30, { date: '2026-10-01', done: true })], date: '2026-10-01', today: TODAY, nowMinutes: at('12:00') });
  assert.deepEqual([past.relation, past.focus, past.nowMinute, past.done, past.items.length], ['past', null, null, 1, 1]);
  assert.ok(!timelineRows(past).some(r => r.type === 'now'));
});

// ── The 24-hour overview ───────────────────────────────────────────────────

test('ring positions: midnight top, then clockwise through the day', () => {
  const r = 100, c = 110;
  assert.deepEqual(ringPoint(at('00:00'), r, c), { x: 110, y: 10 });   // top
  assert.deepEqual(ringPoint(at('06:00'), r, c), { x: 210, y: 110 });  // right
  assert.deepEqual(ringPoint(at('12:00'), r, c), { x: 110, y: 210 });  // bottom
  assert.deepEqual(ringPoint(at('18:00'), r, c), { x: 10, y: 110 });   // left
  const lateNight = ringPoint(at('23:00'), r, c);                       // just left of the top
  assert.ok(lateNight.x < 110 && lateNight.x > 80 && lateNight.y < 20, JSON.stringify(lateNight));
  const morning = ringPoint(at('09:00'), r, c);                          // lower right
  assert.ok(morning.x > 110 && morning.y > 110);
});

test('arcs follow the real minutes, clipped to the day', () => {
  assert.equal(arcPath(at('00:00'), at('06:00'), 100, 110), 'M 110 10 A 100 100 0 0 1 210 110');
  assert.equal(arcPath(at('06:00'), at('20:00'), 100, 110).split(' ')[7], '1'); // > 12 h: large arc
  assert.equal(arcPath(-30, 30, 100, 110), arcPath(0, 30, 100, 110));           // from yesterday
  assert.equal(arcPath(1410, 1470, 100, 110), arcPath(1410, 1440, 100, 110));   // into tomorrow
  assert.equal(arcPath(-60, -10, 100, 110), null);
  assert.ok(arcPath(0, 1440, 100, 110));                                         // whole day still draws
});

test('current time: today has nowMinute, other days do not', () => {
  assert.equal(day([], { nowMinutes: 754 }).nowMinute, 754);
  assert.equal(buildDay({ journal: [], date: '2026-10-04', today: TODAY, nowMinutes: 754 }).nowMinute, null);
});

test('overlapping items move to inner lanes; none shares a lane with an overlapping one', () => {
  const d = day([
    timed(1, '10:00', 120), timed(2, '10:30', 60), timed(3, '11:00', 60), timed(4, '11:15', 30), timed(5, '13:00', 30),
  ]);
  // Regression: a fourth overlapping item used to be clamped onto lane 2 and hidden.
  assert.deepEqual(d.items.map(i => [i.id, i.lane]), [[1, 0], [2, 1], [3, 2], [4, 3], [5, 0]]);
});

// ── Regressions from /code-review ──────────────────────────────────────────

test('regression: a carried-over task that is NU is visible on Tidshjul (flexible list)', () => {
  const overdue = timed(1, '14:00', 30, { date: '2026-10-02' });
  const d = day([overdue], { nowMinutes: at('09:00') });
  assert.equal(d.focus.now.id, 1);
  assert.deepEqual(ids(d.flexible), [1]);
  assert.equal(d.state, 'onlyFlexible');
  // Only on today: another day does not list older tasks.
  assert.deepEqual(buildDay({ journal: [overdue], date: '2026-10-05', today: TODAY, nowMinutes: 0 }).flexible, []);
});

test('regression: a tick on NU can be undone on Tidshjul (ticked items stay listed)', () => {
  const journal = [{ ...task(1), done: true }, habit(101, { [TODAY]: 1 }), task(2)];
  const d = day(journal, { keepVisibleIds: new Set([1, 101, 2]) });
  assert.deepEqual(d.tickedHere.map(i => [i.id, i.done]), [[1, true], [101, true]]); // 2 is open again
  assert.deepEqual(day(journal).tickedHere, []);
});

test('regression: other days do not depend on the minute, so they are not rebuilt every minute', () => {
  assert.equal(clockFor(TODAY, TODAY, 754), 754);
  assert.equal(clockFor('2026-10-02', TODAY, 754), 754); // a task may cross midnight into today
  assert.equal(clockFor('2026-10-04', TODAY, 754), 754);
  assert.equal(clockFor('2026-10-08', TODAY, 754), 0);
  const journal = [timed(1, '09:00', 60, { date: '2026-10-08' })];
  const build = (minute) => buildDay({ journal, date: '2026-10-08', today: TODAY, nowMinutes: clockFor('2026-10-08', TODAY, minute) });
  assert.deepEqual(build(at('08:00')), build(at('20:00')));
});

// ── Timeline ───────────────────────────────────────────────────────────────

test('timeline: items, free time between them, and the NU marker in place', () => {
  const d = day([timed(1, '08:00', 60), timed(2, '09:00', 30), timed(3, '14:00', 90), timed(4, '16:00')], { nowMinutes: at('12:00') });
  assert.deepEqual(timelineRows(d).map(r => r.type === 'item' ? r.item.id : `${r.type}:${r.minutes ?? r.minute}`), [
    1, 2, 'gap:150', 'now:720', 'gap:120', 3, 'gap:30', 4,
  ]);
});

test('timeline: touching items have no gap; NU after everything at the end of the day', () => {
  const d = day([timed(1, '08:00', 60), timed(2, '09:00', 60)], { nowMinutes: at('22:00') });
  assert.deepEqual(timelineRows(d).map(r => r.type === 'item' ? r.item.id : r.type), [1, 2, 'gap', 'now']);
});

test('timeline: an active item comes before the NU marker', () => {
  const d = day([timed(1, '11:30', 60), timed(2, '15:00', 30)], { nowMinutes: at('12:00') });
  assert.deepEqual(timelineRows(d).map(r => r.type === 'item' ? r.item.id : r.type), [1, 'now', 'gap', 2]);
});

test('block heights follow the duration within readable limits; points are compact', () => {
  const [short, mid, long, point] = day([timed(1, '01:00', 15), timed(2, '03:00', 120), timed(3, '06:00', 600), timed(4, '20:00')]).items;
  assert.deepEqual([blockHeight(short), blockHeight(mid), blockHeight(long), blockHeight(point)], [56, 96, 160, 56]);
});

test('screen-reader text says time, length, state and overlap in words', () => {
  const d = day([timed(1, '15:00', 90, { text: 'Træning' }), timed(2, '15:45', 30, { text: 'Tandlæge' }), timed(3, '18:00', null, { text: 'Ring', done: true })], { nowMinutes: at('15:10') });
  assert.equal(describeTimelineItem(d.items[0], d), 'fra 15:00 til 16:30, Træning, 1,5 time, i gang, overlapper med Tandlæge');
  assert.equal(describeTimelineItem(d.items[2], d), 'klokken 18:00, Ring, Uden varighed, klaret');
});

// ── Overlaps ───────────────────────────────────────────────────────────────

const iv = (id, start, end) => ({ id, start: at(start), end: at(end) });

test('overlaps: none, simple, touching boundaries are not an overlap', () => {
  assert.deepEqual(findOverlaps([iv('a', '09:00', '10:00'), iv('b', '11:00', '12:00')]), { pairs: [], groups: [] });
  assert.deepEqual(findOverlaps([iv('a', '15:00', '16:30'), iv('b', '15:45', '16:15')]),
    { pairs: [['a', 'b']], groups: [['a', 'b']] });
  assert.deepEqual(findOverlaps([iv('a', '10:00', '11:00'), iv('b', '11:00', '12:00')]), { pairs: [], groups: [] });
});

test('overlaps: nested, chains and several separate conflicts', () => {
  const result = findOverlaps([
    iv('outer', '08:00', '12:00'), iv('inner', '09:00', '09:30'),
    iv('x', '14:00', '15:00'), iv('y', '14:30', '15:30'), iv('z', '15:15', '16:00'),
    iv('alone', '18:00', '19:00'),
  ]);
  assert.deepEqual(result.pairs, [['outer', 'inner'], ['x', 'y'], ['y', 'z']]);
  assert.deepEqual(result.groups, [['outer', 'inner'], ['x', 'y', 'z']]);
});

test('overlaps: deterministic regardless of input order; input not modified', () => {
  const list = [iv('b', '10:30', '11:30'), iv('a', '10:00', '11:00'), iv('c', '10:00', '10:15')];
  const snapshot = JSON.stringify(list);
  const result = findOverlaps(list);
  assert.deepEqual(result.groups, [['c', 'a', 'b']]);
  assert.deepEqual(findOverlaps([...list].reverse()).groups, result.groups);
  assert.equal(JSON.stringify(list), snapshot);
});

test('day conflicts: open intervals only; points and finished tasks never conflict', () => {
  const d = day([
    timed(1, '15:00', 90), timed(2, '15:45', 30),
    timed(3, '15:30'),                          // point inside: ignored
    timed(4, '15:10', 30, { done: true }),      // finished: ignored
  ]);
  assert.deepEqual(d.conflicts.map(group => ids(group)), [[1, 2]]);
  assert.deepEqual(d.items.map(i => [i.id, i.overlapsWith]), [[1, [2]], [4, []], [3, []], [2, [1]]]);
});

test('day conflicts across midnight: yesterday\'s late task against an early one today', () => {
  const d = day([timed(1, '23:00', 120, { date: '2026-10-02' }), timed(2, '00:30', 30)], { nowMinutes: at('00:10') });
  assert.deepEqual(d.conflicts.map(group => ids(group)), [[1, 2]]);
});

test('items share the I dag/Plan item shape, so all screens describe a task the same way', () => {
  const stored = timed(1, '10:45', 60);
  const [item] = day([stored], { nowMinutes: at('11:00') }).items;
  const { task: _task, start: _start, end: _end, lane: _lane, overlapsWith: _overlaps, ...shared } = item;
  assert.deepEqual(shared, taskItem(stored, TODAY, at('11:00')));
});
