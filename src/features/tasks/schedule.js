// src/features/tasks/schedule.js
//
// Optional scheduling on one-off tasks. Pure; no React; "now" is passed in.
//
// The helpers below read only `date`, `startTime`, `durationMinutes` (and
// `recurring`), so they work for anything shaped like that: a stored task,
// or a routine occurrence (src/features/routines/model.js). That small
// shape is the shared contract of everything that can be on the timeline.
//
// Stored fields (both optional, added only when the user sets a time):
//   startTime        'HH:mm' local wall-clock time on the task's `date`
//   durationMinutes  whole minutes, 1 … MAX_DURATION_MINUTES
// Missing, null or invalid values mean "no time" / "duration unknown"; they
// are never repaired or rewritten on load. The end time is derived, never
// stored. Habits (recurring) and undated tasks are never timed.
import { isTimeOfDay, timeToMinutes, minutesToTime, parseTimeInput, MINUTES_PER_DAY } from '../../core/time/timeOfDay.js';
import { isDateKey, daysBetween } from '../../core/time/dates.js';

export const MAX_DURATION_MINUTES = MINUTES_PER_DAY;
/** The quick choices offered in the task form. */
export const DURATION_CHOICES = [15, 30, 45, 60, 90, 120];

export function isValidDuration(value) {
  return Number.isInteger(value) && value > 0 && value <= MAX_DURATION_MINUTES;
}

/**
 * { start, duration, end } in minutes from midnight of the task's date
 * (`end` may pass 1440 when the task runs past midnight), or null for an
 * untimed task. `duration`/`end` are null when the duration is unknown.
 */
export function getSchedule(task) {
  if (!canBeTimed(task)) return null;
  const start = timeToMinutes(task.startTime);
  if (start === null) return null;
  const duration = isValidDuration(task.durationMinutes) ? task.durationMinutes : null;
  return { start, duration, end: duration === null ? null : start + duration };
}

export const isTimed = (task) => getSchedule(task) !== null;

/** Whether a task can carry a time at all: a dated one-off task. */
const canBeTimed = (task) => !task.recurring && isDateKey(task.date);

/** Derived 'HH:mm' end time (next day's clock time after midnight), or null. */
export function endTime(task) {
  const end = getSchedule(task)?.end;
  return end == null ? null : minutesToTime(end);
}

/**
 * The task's schedule in minutes from midnight of `date` (any date): start
 * and end shift by whole days, so a task from the day before that runs past
 * midnight starts below 0 and one running into the next day ends above
 * 1440. null for an untimed task.
 */
export function scheduleOn(task, date) {
  const schedule = getSchedule(task);
  if (!schedule) return null;
  const offset = daysBetween(date, task.date) * MINUTES_PER_DAY;
  return { start: schedule.start + offset, end: schedule.end === null ? null : schedule.end + offset };
}

/**
 * Where a task is in time at `now` = (today: 'YYYY-MM-DD', nowMinutes:
 * minutes since today's midnight):
 *   'untimed'  no valid time
 *   'upcoming' its start is still ahead
 *   'active'   start <= now < end; only with a known duration (a task from
 *              yesterday that runs past midnight can still be active)
 *   'past'     its interval is over, or, without a duration, its start
 *              time has come (no interval is invented)
 */
export function scheduleStatus(task, today, nowMinutes) {
  const schedule = scheduleOn(task, today);
  if (!schedule) return 'untimed';
  if (nowMinutes < schedule.start) return 'upcoming';
  if (schedule.end !== null && nowMinutes < schedule.end) return 'active';
  return 'past';
}

/**
 * Sort comparator for tasks on the same day: earlier start first, untimed
 * after timed. Equal keys return 0, so a stable sort keeps the user's order.
 */
export function compareStart(a, b) {
  const sa = getSchedule(a)?.start ?? MINUTES_PER_DAY;
  const sb = getSchedule(b)?.start ?? MINUTES_PER_DAY;
  return sa - sb;
}

/** Tasks on any days: earlier date first, then compareStart. */
export function compareDateStart(a, b) {
  return a.date.localeCompare(b.date) || compareStart(a, b);
}

/**
 * The task with the form's time fields applied. A field without a valid
 * value is REMOVED (never stored as null), so saving a task that has no
 * time leaves no schedule keys behind; a duration is only kept together
 * with a start time, and a time only on a task that can be timed (dated,
 * not a habit).
 */
export function withSchedule(task, { startTime, durationMinutes }) {
  const next = { ...task };
  delete next.startTime;
  delete next.durationMinutes;
  if (!canBeTimed(next) || !isTimeOfDay(startTime)) return next;
  next.startTime = startTime;
  if (isValidDuration(durationMinutes)) next.durationMinutes = durationMinutes;
  return next;
}

/**
 * Which intervals overlap. intervals: [{ id, start, end }] in minutes on a
 * common day axis (end exclusive, end > start). Intervals that only touch
 * (10:00–11:00 and 11:00–12:00) do not overlap. Deterministic: ordered by
 * start, then end, then input order; the input is not modified.
 *
 * Returns { pairs, groups }:
 *   pairs   every overlapping pair [earlierId, laterId]
 *   groups  sets of ids joined by overlaps (A–B and B–C make one group of
 *           three), each with at least two ids
 */
export function findOverlaps(intervals) {
  const sorted = intervals
    .map((interval, index) => ({ ...interval, index }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index);
  const pairs = [];
  const groups = [];
  let open = [];
  let group = [];
  let groupEnd = -Infinity;
  for (const current of sorted) {
    open = open.filter(prev => prev.end > current.start);
    for (const prev of open) pairs.push([prev.id, current.id]);
    open.push(current);

    if (current.start < groupEnd) {
      group.push(current.id);
      groupEnd = Math.max(groupEnd, current.end);
    } else {
      if (group.length > 1) groups.push(group);
      group = [current.id];
      groupEnd = current.end;
    }
  }
  if (group.length > 1) groups.push(group);
  return { pairs, groups };
}

// ── Time and duration in forms (task sheet, routine sheet) ──────────────
// Form values: { timeText, durationChoice, customDuration }. durationChoice
// is null (unknown), one of DURATION_CHOICES, or 'custom' (customDuration
// holds the typed minutes).

/** Form values for a stored startTime / durationMinutes (invalid -> empty). */
export function scheduleFormValues(startTime, durationMinutes) {
  const time = isTimeOfDay(startTime) ? startTime : '';
  const duration = time && isValidDuration(durationMinutes) ? durationMinutes : null;
  const preset = DURATION_CHOICES.includes(duration);
  return {
    timeText: time,
    durationChoice: duration === null ? null : preset ? duration : 'custom',
    customDuration: duration !== null && !preset ? String(duration) : '',
  };
}

/**
 * Reads those form values: { startTime, durationMinutes } (each null when
 * not given) or { error } with the i18n key to show. A duration is only
 * read when there is a time.
 */
export function readScheduleInput({ timeText, durationChoice, customDuration }) {
  if (!timeText.trim()) return { startTime: null, durationMinutes: null };
  const startTime = parseTimeInput(timeText);
  if (!startTime) return { error: 'taskForm.timeInvalid' };
  if (durationChoice === 'custom') {
    const minutes = Number(customDuration.trim());
    if (!customDuration.trim() || !isValidDuration(minutes)) return { error: 'taskForm.durationInvalid' };
    return { startTime, durationMinutes: minutes };
  }
  return { startTime, durationMinutes: isValidDuration(durationChoice) ? durationChoice : null };
}

