// src/features/timewheel/logic.js
//
// Timewheel is a VIEW over the stored tasks: nothing here is persisted.
// Pure: the selected date and "now" are passed in. Scheduling rules come
// from src/features/tasks (schedule.js: a task's schedule, status and
// overlaps; focus.js: NU / NÆSTE, shared with I dag).
//
// A Timewheel item is a timed task on the selected date: date + startTime
// (+ durationMinutes). Positions (scheduleOn) are minutes from the selected date's
// midnight. A task from the day before that runs past midnight is included
// from 00:00 (its start is negative). A task without a duration is a point
// in time: it has no end and never becomes an interval. Untimed tasks are
// never items; they are listed separately as "flexible".
import { isTimed, scheduleOn, findOverlaps } from '../tasks/schedule.js';
import { taskItem, habitItem } from '../tasks/items.js';
import { selectFocus } from '../tasks/focus.js';
import { addDays, daysBetween } from '../../core/time/dates.js';
import { MINUTES_PER_DAY, minutesToTime } from '../../core/time/timeOfDay.js';
import { t, formatDuration } from '../../core/i18n/index.js';

/** Free time shown as its own row in the timeline from this length on. */
const MIN_GAP_MINUTES = 30;

/**
 * Timed items on `date`, in time order (equal starts: shorter first, then
 * list order). An item is the shared task item (src/features/tasks/items.js:
 * title, done, status, timeLabel, …) plus the stored `task` (for the editor)
 * and `start` / `end` in minutes from `date`'s midnight (end null = a point).
 */
function dayItems(journal, date, today, nowMinutes) {
  const previousDay = addDays(date, -1);
  const items = [];
  for (const task of journal) {
    if (task.date !== date && task.date !== previousDay) continue;
    const span = scheduleOn(task, date);
    // Only what falls on this day: from the day before, what runs past midnight.
    if (!span || span.start >= MINUTES_PER_DAY || (span.start < 0 && !(span.end > 0))) continue;
    items.push({ ...taskItem(task, today, nowMinutes), task, start: span.start, end: span.end });
  }
  return items.sort((a, b) => a.start - b.start || (a.end ?? a.start) - (b.end ?? b.start));
}

/**
 * Adds `lane` (overview ring, 0 = outermost; one per overlapping item, so
 * none is hidden behind another) and `overlapsWith` (ids) to
 * each item, and returns the conflict groups. Only open items with a known
 * duration take part in overlaps: a point in time occupies no interval and
 * a finished task no longer needs the time.
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
 * Everything the Timewheel screen shows for one date:
 *   relation   'today' | 'past' | 'future'
 *   items      timed items (dayItems + lane + overlapsWith)
 *   conflicts  groups of overlapping open items
 *   flexible   open tasks without a place on the timeline: untimed tasks
 *              dated `date` and, on today, every open task carried over
 *              from earlier days (it can be NU, so it must be visible)
 *   tickedHere items ticked during this visit (keepVisibleIds) that are
 *              done now, so a tick on NU / NÆSTE can be undone here
 *   focus      today: { now, next } from selectFocus (the I dag rule);
 *              a future day: { first } (the first open timed task);
 *              a past day: null (no live "now" on another date)
 *   nowMinute  minutes since midnight on today, else null
 *   done       how many timed items are finished
 *   state      'empty' (nothing on the day), 'onlyFlexible', 'allDone'
 *              (every timed item finished) or 'scheduled'
 */
export function buildDay({ journal, date, today, nowMinutes, keepVisibleIds }) {
  const { items, conflicts } = placeItems(dayItems(journal, date, today, nowMinutes));
  const relation = date === today ? 'today' : date < today ? 'past' : 'future';
  const onTimeline = new Set(items.map(item => item.id));
  const flexible = journal.filter(task =>
    !task.recurring && !task.done && !onTimeline.has(task.id)
    && ((task.date === date && !isTimed(task)) || (relation === 'today' && task.date && task.date < today)));
  const tickedHere = journal
    .filter(entry => keepVisibleIds?.has(entry.id))
    .map(entry => (entry.recurring ? habitItem(entry, today) : taskItem(entry, today, nowMinutes)))
    .filter(entry => entry.done);

  let focus = null;
  if (relation === 'today') {
    const { now, next } = selectFocus({ journal, today, nowMinutes, keepVisibleIds });
    focus = { now, next };
  } else if (relation === 'future') {
    focus = { first: items.find(item => !item.done && item.start >= 0) ?? null };
  }

  const done = items.filter(item => item.done).length;
  return {
    date,
    relation,
    items,
    conflicts,
    flexible,
    tickedHere,
    focus,
    nowMinute: relation === 'today' ? nowMinutes : null,
    done,
    state: items.length === 0 ? (flexible.length > 0 ? 'onlyFlexible' : 'empty')
      : done === items.length ? 'allDone' : 'scheduled',
  };
}

/**
 * The minute buildDay needs for `date`: statuses depend on the clock only
 * for today and the days next to it (a task crossing midnight). For other
 * days a fixed value keeps the day model stable, so the screen does not
 * rebuild it every minute.
 */
export function clockFor(date, today, nowMinutes) {
  return Math.abs(daysBetween(today, date)) <= 1 ? nowMinutes : 0;
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
 * least MIN_GAP_MINUTES as { type: 'gap', minutes }, and on today one
 * { type: 'now', minute } marker before the first item that starts after
 * now (free time around it is split in two).
 */
export function timelineRows(day) {
  const entries = day.items.map(item => ({ type: 'item', item, start: item.start, end: item.end ?? item.start }));
  if (day.nowMinute !== null && entries.length > 0) {
    const index = entries.findIndex(entry => entry.start > day.nowMinute);
    const now = { type: 'now', minute: day.nowMinute, start: day.nowMinute, end: day.nowMinute };
    entries.splice(index === -1 ? entries.length : index, 0, now);
  }
  const rows = [];
  let busyUntil = null;
  for (const { start, end, ...row } of entries) {
    if (busyUntil !== null && start - busyUntil >= MIN_GAP_MINUTES) rows.push({ type: 'gap', minutes: start - busyUntil });
    rows.push(row);
    busyUntil = Math.max(busyUntil ?? end, end);
  }
  return rows;
}

/** Height of an item's block: proportional to its duration, within readable limits. */
export function blockHeight(item) {
  if (item.end === null) return 56;
  return Math.max(56, Math.min(160, Math.round((item.end - item.start) * 0.8)));
}

/** The time column: '10:45' and below it the end ('' for a point); clock times on any day. */
export function timeRange(item) {
  return { start: minutesToTime(item.start), end: item.end === null ? '' : minutesToTime(item.end) };
}

/** What an item's bar shows, in words: length, crossing midnight, i gang, klaret. */
export function itemDetails(item) {
  return [
    item.end === null ? t('timewheel.point') : formatDuration(item.end - item.start),
    item.start < 0 ? t('timewheel.fromYesterday') : null,
    item.end > MINUTES_PER_DAY ? t('timewheel.untilTomorrow') : null,
    item.done ? t('timewheel.done') : item.status === 'active' ? t('timewheel.active') : null,
  ].filter(Boolean);
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
  return [
    item.end === null ? t('timewheel.a11y.at', { time: start }) : t('timewheel.a11y.range', { start, end }),
    item.title,
    ...itemDetails(item),
    overlapText(item, day),
  ].filter(Boolean).join(', ');
}
