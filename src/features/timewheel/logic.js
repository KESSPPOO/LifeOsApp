// src/features/timewheel/logic.js
//
// Timewheel is a VIEW over the stored tasks: nothing here is persisted.
// Pure: the selected date and "now" are passed in. Scheduling rules come
// from src/features/tasks (schedule.js: a task's schedule, status and
// overlaps; focus.js: NU / NÆSTE, shared with I dag).
//
// A Timewheel item is a timed task on the selected date: date + startTime
// (+ durationMinutes). Positions are minutes from the selected date's
// midnight. A task from the day before that runs past midnight is included
// from 00:00 (its start is negative). A task without a duration is a point
// in time: it has no end and never becomes an interval. Untimed tasks are
// never items; they are listed separately as "flexible".
import { getSchedule, scheduleStatus, findOverlaps, endTime } from '../tasks/schedule.js';
import { taskItem, scheduleLabel } from '../tasks/items.js';
import { selectFocus } from '../tasks/focus.js';
import { addDays } from '../../core/time/dates.js';
import { MINUTES_PER_DAY, minutesToTime } from '../../core/time/timeOfDay.js';
import { t, formatDuration } from '../../core/i18n/index.js';

/** Parallel rings on the overview before overlapping items share the last one. */
export const MAX_LANES = 3;
/** Free time shown as its own row in the timeline from this length on. */
export const MIN_GAP_MINUTES = 30;

/** Timed items on `date`, in time order (equal starts keep list order). */
export function dayItems(journal, date, today, nowMinutes) {
  const previousDay = addDays(date, -1);
  const items = [];
  for (const task of journal) {
    if (task.date !== date && task.date !== previousDay) continue;
    const schedule = getSchedule(task);
    if (!schedule) continue;
    const offset = task.date === date ? 0 : -MINUTES_PER_DAY;
    const end = schedule.end === null ? null : schedule.end + offset;
    // From the day before, only what is still running after midnight.
    if (offset !== 0 && !(end > 0)) continue;
    items.push({
      id: task.id,
      task,
      title: task.text,
      done: Boolean(task.done),
      start: schedule.start + offset,
      end,
      point: end === null,
      durationMinutes: schedule.duration,
      startTime: task.startTime,
      endTime: endTime(task),
      timeLabel: scheduleLabel(task),
      fromPreviousDay: offset !== 0,
      untilNextDay: end !== null && end > MINUTES_PER_DAY,
      status: scheduleStatus(task, today, nowMinutes),
    });
  }
  return items.sort((a, b) => a.start - b.start || (a.end ?? a.start) - (b.end ?? b.start));
}

/**
 * Adds `lane` (overview ring, 0 = outermost) and `overlapsWith` (ids) to
 * each item, and returns the conflict groups. Only open items with a known
 * duration take part in overlaps: a point in time occupies no interval and
 * a finished task no longer needs the time.
 */
function placeItems(items) {
  const laneEnds = [];
  const intervals = [];
  const placed = items.map(item => {
    if (item.point) return { ...item, lane: 0 };
    let lane = laneEnds.findIndex(end => end <= item.start);
    if (lane === -1) lane = laneEnds.push(item.end) - 1;
    else laneEnds[lane] = item.end;
    if (!item.done) intervals.push({ id: item.id, start: item.start, end: item.end });
    return { ...item, lane: Math.min(lane, MAX_LANES - 1) };
  });
  const { pairs, groups } = findOverlaps(intervals);
  const byId = new Map(placed.map(item => [item.id, { ...item, overlapsWith: [] }]));
  for (const [a, b] of pairs) {
    byId.get(a).overlapsWith.push(b);
    byId.get(b).overlapsWith.push(a);
  }
  const result = placed.map(item => byId.get(item.id));
  return { items: result, conflicts: groups.map(ids => ids.map(id => byId.get(id))) };
}

/**
 * Everything the Timewheel screen shows for one date:
 *   relation   'today' | 'past' | 'future'
 *   items      timed items (dayItems + lane + overlapsWith)
 *   conflicts  groups of overlapping open items
 *   flexible   open untimed tasks dated `date`
 *   focus      today: { now, next } from selectFocus (the I dag rule);
 *              a future day: { first } (the first open timed task);
 *              a past day: null (no live "now" on another date)
 *   nowMinute  minutes since midnight on today, else null
 *   done/total timed items finished / all timed items
 *   state      'empty' (nothing on the day), 'onlyFlexible', 'allDone'
 *              (every timed item finished) or 'scheduled'
 */
export function buildDay({ journal, date, today, nowMinutes, keepVisibleIds }) {
  const { items, conflicts } = placeItems(dayItems(journal, date, today, nowMinutes));
  const flexible = journal.filter(task =>
    !task.recurring && task.date === date && !task.done && getSchedule(task) === null);
  const relation = date === today ? 'today' : date < today ? 'past' : 'future';

  let focus = null;
  if (relation === 'today') {
    const { now, next } = selectFocus({ journal, today, nowMinutes, keepVisibleIds });
    focus = { now, next };
  } else if (relation === 'future') {
    const first = items.find(item => !item.done && !item.fromPreviousDay);
    focus = { first: first ? taskItem(first.task, today, nowMinutes) : null };
  }

  const done = items.filter(item => item.done).length;
  return {
    date,
    relation,
    items,
    conflicts,
    flexible,
    focus,
    nowMinute: relation === 'today' ? nowMinutes : null,
    done,
    total: items.length,
    state: items.length === 0 ? (flexible.length > 0 ? 'onlyFlexible' : 'empty')
      : done === items.length ? 'allDone' : 'scheduled',
  };
}

// ── The 24-hour overview ─────────────────────────────────────────────────
// Midnight at the top, time running clockwise: 06:00 right, 12:00 bottom,
// 18:00 left. Coordinates are rounded to 0.01 so output is deterministic.

const round = (n) => Math.round(n * 100) / 100;

/** The point on a ring of `radius` around (center, center) for a minute of the day. */
export function ringPoint(minute, radius, center) {
  const angle = (minute / MINUTES_PER_DAY) * 2 * Math.PI - Math.PI / 2;
  return { x: round(center + radius * Math.cos(angle)), y: round(center + radius * Math.sin(angle)) };
}

/**
 * SVG path for the part of the day from `start` to `end` (minutes), clipped
 * to this day; null if nothing of it falls on the day. A full day is drawn
 * as just under a full circle (one SVG arc cannot be a full circle).
 */
export function arcPath(start, end, radius, center) {
  const from = Math.max(0, start);
  const to = Math.min(MINUTES_PER_DAY, end);
  if (to <= from) return null;
  const span = Math.min(to - from, MINUTES_PER_DAY - 0.5);
  const a = ringPoint(from, radius, center);
  const b = ringPoint(from + span, radius, center);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${span > MINUTES_PER_DAY / 2 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

// ── The linear timeline ──────────────────────────────────────────────────

/**
 * The rows of the timeline, top to bottom: each item, free time of at
 * least MIN_GAP_MINUTES between items as { type: 'gap', minutes }, and on
 * today one { type: 'now', minute } marker placed before the first item
 * that starts after now (a free stretch around it is split in two).
 */
export function timelineRows(day) {
  const rows = [];
  let busyUntil = null;
  let nowPlaced = day.nowMinute === null || day.items.length === 0;
  const pushGap = (until) => {
    if (busyUntil !== null && until - busyUntil >= MIN_GAP_MINUTES) rows.push({ type: 'gap', minutes: until - busyUntil });
  };
  for (const item of day.items) {
    if (!nowPlaced && item.start > day.nowMinute) {
      pushGap(day.nowMinute);
      rows.push({ type: 'now', minute: day.nowMinute });
      busyUntil = Math.max(busyUntil ?? day.nowMinute, day.nowMinute);
      nowPlaced = true;
    }
    pushGap(item.start);
    rows.push({ type: 'item', item });
    busyUntil = Math.max(busyUntil ?? -Infinity, item.end ?? item.start);
  }
  if (!nowPlaced) rows.push({ type: 'now', minute: day.nowMinute });
  return rows;
}

/** Height of an item's block: proportional to its duration, within readable limits. */
export function blockHeight(item) {
  if (item.point) return 56;
  return Math.max(56, Math.min(160, Math.round((item.end - item.start) * 0.8)));
}

/** The time column text: '10:45' and, below it, '11:45' (or '' for a point). */
export function timeRange(item) {
  return {
    start: item.fromPreviousDay ? minutesToTime(item.start) : item.startTime,
    end: item.point ? '' : item.endTime,
  };
}

/** 'overlapper med Tandlæge, Træning' (titles in time order), or ''. */
export function overlapText(item, day) {
  if (!item.overlapsWith.length) return '';
  const titles = day.items.filter(other => item.overlapsWith.includes(other.id)).map(other => other.title);
  return t('timewheel.overlapsWith', { titles: titles.join(', ') });
}

/** One line for screen readers that says everything the block shows. */
export function describeTimelineItem(item, day) {
  const { start, end } = timeRange(item);
  const parts = [
    item.point ? t('timewheel.a11y.at', { time: start }) : t('timewheel.a11y.range', { start, end }),
    item.title,
    item.point ? t('timewheel.point') : formatDuration(item.durationMinutes),
  ];
  if (item.fromPreviousDay) parts.push(t('timewheel.fromYesterday'));
  if (item.untilNextDay) parts.push(t('timewheel.untilTomorrow'));
  if (item.done) parts.push(t('timewheel.done'));
  else if (item.status === 'active') parts.push(t('timewheel.active'));
  if (item.overlapsWith.length) parts.push(overlapText(item, day));
  return parts.join(', ');
}
