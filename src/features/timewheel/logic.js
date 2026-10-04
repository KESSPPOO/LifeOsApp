// src/features/timewheel/logic.js
//
// Timewheel is a VIEW over the stored tasks and routines: nothing here is
// persisted.
// Pure: the selected date and "now" are passed in. The day's timed items,
// untimed items and overlaps come from the shared per-date schedule
// (src/features/schedule/day.js, also used by Kalender), so both views
// always agree; NU / NÆSTE is src/features/tasks/focus.js (shared with
// I dag). This module adds what only Timewheel shows: NU / NÆSTE on the
// selected day, the "flexible" list, the 24-hour ring and the timeline rows.
import { isTimed } from '../tasks/schedule.js';
import { taskItem, habitItem } from '../tasks/items.js';
import { selectFocus } from '../tasks/focus.js';
import { focusRoutineItems } from '../routines/model.js';
import { getScheduleForDate, dayRelation } from '../schedule/day.js';
import { MINUTES_PER_DAY } from '../../core/time/timeOfDay.js';

/** Free time shown as its own row in the timeline from this length on. */
const MIN_GAP_MINUTES = 30;

/**
 * Everything the Timewheel screen shows for one date:
 *   relation   'today' | 'past' | 'future'
 *   items      timed items (getScheduleForDate: start / end, lane, overlapsWith)
 *   conflicts  groups of overlapping open items
 *   flexible   open tasks without a place on the timeline: untimed tasks
 *              dated `date` and, on today, every open task carried over
 *              from earlier days (it can be NU, so it must be visible)
 *   flexibleRoutines  routine occurrences on `date` without a time (items;
 *              never placed on the timeline)
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
export function buildDay({ journal, date, today, nowMinutes, keepVisibleIds, routines = [], routineLog = [] }) {
  const { items, conflicts, untimed } = getScheduleForDate({ journal, routines, routineLog, date, today, nowMinutes });
  const flexibleRoutines = untimed.filter(item => item.kind === 'routine');
  const relation = dayRelation(date, today);
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
    const { now, next } = selectFocus({
      journal, today, nowMinutes, keepVisibleIds,
      routineItems: focusRoutineItems(routines, routineLog, today, nowMinutes),
    });
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
    flexibleRoutines,
    tickedHere,
    focus,
    nowMinute: relation === 'today' ? nowMinutes : null,
    done,
    state: items.length === 0 ? (flexible.length + flexibleRoutines.filter(r => !r.done).length > 0 ? 'onlyFlexible' : 'empty')
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
