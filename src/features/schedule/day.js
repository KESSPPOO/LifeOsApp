// src/features/schedule/day.js
//
// THE schedule of one date, shared by the views that show it (Tidshjul,
// Kalender): stored tasks plus derived routine occurrences, combined on the
// fly. A view, nothing more: nothing here is persisted, nothing is copied
// into a store, and neither tasks nor routines know about it (it depends on
// them, never the other way round). See ADR-009.
//
// Pure: the date and "now" are passed in. The rules for one item come from
// src/features/tasks/schedule.js (date / startTime / durationMinutes, the
// contract tasks and routine occurrences share); occurrences come from
// src/features/routines/model.js.
//
// Positions (scheduleOn) are minutes from the date's midnight. A task or
// routine from the day before that runs past midnight is included from
// 00:00 (its start is negative). Without a duration an item is a point in
// time: it has no end and never becomes an interval.
import { isTimed, scheduleOn, findOverlaps } from '../tasks/schedule.js';
import { taskItem } from '../tasks/items.js';
import { routineItemsOn } from '../routines/model.js';
import { addDays, daysBetween } from '../../core/time/dates.js';
import { MINUTES_PER_DAY, minutesToTime } from '../../core/time/timeOfDay.js';
import { t, formatDuration } from '../../core/i18n/index.js';

/**
 * Timed items on `date`, in time order (equal starts: shorter first, then
 * tasks before routines in list order). A task item is the shared task
 * item (src/features/tasks/items.js) plus the stored `task` (for the
 * editor); a routine item is routineItem (kind 'routine'). Both get
 * `start` / `end` in minutes from `date`'s midnight (end null = a point).
 * `routineItems`: routine items of `date` and the day before.
 */
function timedItems(journal, routineItems, date, today, nowMinutes) {
  const previousDay = addDays(date, -1);
  const items = [];
  const add = (source, toItem) => {
    if (source.date !== date && source.date !== previousDay) return;
    const span = scheduleOn(source, date);
    // Only what falls on this day: from the day before, what runs past midnight.
    if (!span || span.start >= MINUTES_PER_DAY || (span.start < 0 && !(span.end > 0))) return;
    items.push({ ...toItem(source), start: span.start, end: span.end });
  };
  for (const task of journal) add(task, (source) => ({ ...taskItem(source, today, nowMinutes), task: source }));
  for (const routine of routineItems) add(routine, (source) => source);
  return items.sort((a, b) => a.start - b.start || (a.end ?? a.start) - (b.end ?? b.start));
}

/**
 * Adds `lane` (0 = first; one per overlapping item, so none is hidden
 * behind another) and `overlapsWith` (ids) to each item, and returns the
 * conflict groups. Only open items with a known duration take part in
 * overlaps: a point in time occupies no interval and a finished task no
 * longer needs the time.
 */
function placeItems(items) {
  const laneEnds = [];
  const intervals = [];
  const placed = items.map(item => {
    let lane = 0;
    if (item.end !== null) {
      lane = laneEnds.findIndex(end => end <= item.start);
      if (lane === -1) lane = laneEnds.push(item.end) - 1;
      else laneEnds[lane] = item.end;
      if (!item.done) intervals.push({ id: item.id, start: item.start, end: item.end });
    }
    return { ...item, lane, overlapsWith: [] };
  });
  const byId = new Map(placed.map(item => [item.id, item]));
  const { pairs, groups } = findOverlaps(intervals);
  for (const [a, b] of pairs) {
    byId.get(a).overlapsWith.push(b);
    byId.get(b).overlapsWith.push(a);
  }
  return { items: placed, conflicts: groups.map(ids => ids.map(id => byId.get(id))) };
}

/**
 * The schedule of `date`:
 *   items      timed tasks and routine occurrences on the date, including
 *              the part after midnight of those from the day before; time
 *              order; each with start / end, lane and overlapsWith
 *   conflicts  groups of overlapping open items (task–task, task–routine,
 *              routine–routine alike)
 *   untimed    what belongs to the date without a time: one-off tasks
 *              dated `date` (task items with `task`, list order), then
 *              routine occurrences without a time (done ones included)
 * Statuses are at (today, nowMinutes); nothing else depends on the clock.
 */
export function getScheduleForDate({ journal, routines = [], routineLog = [], date, today, nowMinutes }) {
  const routineItems = routineItemsOn(routines, routineLog, date, today, nowMinutes);
  const routinesBefore = routineItemsOn(routines, routineLog, addDays(date, -1), today, nowMinutes);
  const { items, conflicts } = placeItems(timedItems(journal, [...routinesBefore, ...routineItems], date, today, nowMinutes));
  const untimed = [
    ...journal
      .filter(task => task.date === date && !task.recurring && !isTimed(task))
      .map(task => ({ ...taskItem(task, today, nowMinutes), task })),
    ...routineItems.filter(item => item.startTime === null),
  ];
  return { items, conflicts, untimed };
}

/**
 * The minute a day model needs for `date`: statuses depend on the clock
 * only for today and the days next to it (a task crossing midnight). For
 * other days a fixed value keeps the model stable, so a screen does not
 * rebuild it every minute.
 */
export function clockFor(date, today, nowMinutes) {
  return Math.abs(daysBetween(today, date)) <= 1 ? nowMinutes : 0;
}

// ── One scheduled item, in words (both views say the same) ───────────────

/** '10:45' and the end ('' for a point); clock times on any day. */
export function timeRange(item) {
  return { start: minutesToTime(item.start), end: item.end === null ? '' : minutesToTime(item.end) };
}

/** What an item's bar shows, in words: length, kind + progress (a routine), crossing midnight, i gang, klaret. */
export function itemDetails(item) {
  return [
    item.end === null ? t('timewheel.point') : formatDuration(item.end - item.start),
    item.kindLabel ?? null,
    item.done ? null : item.progressText ?? null,
    item.start < 0 ? t('timewheel.fromYesterday') : null,
    item.end > MINUTES_PER_DAY ? t('timewheel.untilTomorrow') : null,
    item.done ? t('timewheel.done') : item.status === 'active' ? t('timewheel.active') : null,
  ].filter(Boolean);
}

/** 'overlapper med Tandlæge, Træning' (titles in time order), or ''. `items`: the day's items. */
export function overlapText(item, items) {
  if (!item.overlapsWith.length) return '';
  const titles = items.filter(other => item.overlapsWith.includes(other.id)).map(other => other.title);
  return t('timewheel.overlapsWith', { titles: titles.join(', ') });
}

/** One line for screen readers that says everything the item's block shows. */
export function describeScheduledItem(item, items) {
  const { start, end } = timeRange(item);
  return [
    item.end === null ? t('timewheel.a11y.at', { time: start }) : t('timewheel.a11y.range', { start, end }),
    item.title,
    ...itemDetails(item),
    overlapText(item, items),
  ].filter(Boolean).join(', ');
}
