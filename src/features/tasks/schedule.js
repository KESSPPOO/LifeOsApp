// src/features/tasks/schedule.js
//
// Optional scheduling on one-off tasks. Pure; no React; "now" is passed in.
//
// Stored fields (both optional, added only when the user sets a time):
//   startTime        'HH:mm' local wall-clock time on the task's `date`
//   durationMinutes  whole minutes, 1 … MAX_DURATION_MINUTES
// Missing, null or invalid values mean "no time" / "duration unknown"; they
// are never repaired or rewritten on load. The end time is derived, never
// stored. Habits (recurring) and undated tasks are never timed.
import { isTimeOfDay, timeToMinutes, minutesToTime, MINUTES_PER_DAY } from '../../core/time/timeOfDay.js';
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
  const schedule = getSchedule(task);
  if (!schedule) return 'untimed';
  const dayOffset = daysBetween(today, task.date) * MINUTES_PER_DAY;
  if (nowMinutes < dayOffset + schedule.start) return 'upcoming';
  if (schedule.end !== null && nowMinutes < dayOffset + schedule.end) return 'active';
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
