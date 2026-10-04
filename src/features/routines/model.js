// src/features/routines/model.js
//
// Routines: reusable templates of ordered steps that recur on chosen
// weekdays. Pure; no React; dates and "now" are passed in, ids are passed in.
// See ADR-008 in docs/ARCHITECTURE_DECISIONS.md.
//
// Stored (two lists, src/features/routines/store.js):
//   routine    { id, name, enabled, activeFrom: 'YYYY-MM-DD',
//                daysOfWeek: [1..7] (ISO: 1 = mandag … 7 = søndag),
//                startTime?: 'HH:mm', durationMinutes?: number,
//                steps: [{ id, text }] }
//   log entry  { routineId, date: 'YYYY-MM-DD', completedStepIds: [] }
//              (one per routine and date; created on the first tick)
//
// An OCCURRENCE (a routine on one date) is derived, never stored. It has
// the same date / startTime / durationMinutes fields as a task, so the
// scheduling helpers (src/features/tasks/schedule.js) apply to it as-is.
//
// Known v1 limitation: occurrences are projected from the current
// template, so editing a routine's days, time or steps also changes how
// past dates are shown (their logs are kept, but only steps that still
// exist count). Disabling a routine hides it on every date.
import { isDateKey, weekdayIndex } from '../../core/time/dates.js';
import { isTimeOfDay } from '../../core/time/timeOfDay.js';
import { t, formatDuration } from '../../core/i18n/index.js';
import {
  isValidDuration, scheduleStatus, scheduleFormValues, readScheduleInput, endTime,
} from '../tasks/schedule.js';
import { scheduleLabel, describeRoutineProgress } from '../tasks/items.js';

export const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKEND = [6, 7];
/** Presets offered in the editor, as [i18n key, days]. */
export const DAY_PRESETS = [['routine.days.everyDay', EVERY_DAY], ['routine.days.weekdays', WEEKDAYS], ['routine.days.weekend', WEEKEND]];

/** ISO weekday of a date key: 1 = mandag … 7 = søndag. */
export const isoWeekday = (date) => weekdayIndex(date) + 1;

const daysOf = (routine) => (Array.isArray(routine.daysOfWeek) ? routine.daysOfWeek : []);
const stepsOf = (routine) => (Array.isArray(routine.steps) ? routine.steps : []);
/** Same set of weekdays (order ignored). */
export const sameDays = (a, b) => a.length === b.length && b.every(d => a.includes(d));

/** Does the routine produce an occurrence on `date`? */
export function routineOccursOnDate(routine, date) {
  return Boolean(routine.enabled)
    && isDateKey(date) && isDateKey(routine.activeFrom) && date >= routine.activeFrom
    && daysOf(routine).includes(isoWeekday(date));
}

/** The log entry for a routine on a date, or undefined. */
export const findLog = (log, routineId, date) =>
  log.find(entry => entry.routineId === routineId && entry.date === date);

/**
 * The routine on `date`, with that day's progress from `log`:
 * { kind: 'routine', id: '<routineId>@<date>', routineId, date, title,
 *   startTime, durationMinutes, steps: [{ id, text, done }], doneCount,
 *   stepCount, done, state: 'notStarted' | 'inProgress' | 'complete' }.
 * Only steps that exist now count (a log may name deleted steps).
 * startTime / durationMinutes are only set when valid.
 */
export function occurrenceFor(routine, date, log) {
  const completed = new Set(findLog(log, routine.id, date)?.completedStepIds ?? []);
  const steps = stepsOf(routine).map(step => ({ id: step.id, text: step.text, done: completed.has(step.id) }));
  const doneCount = steps.filter(step => step.done).length;
  const startTime = isTimeOfDay(routine.startTime) ? routine.startTime : null;
  const done = steps.length > 0 && doneCount === steps.length;
  return {
    kind: 'routine',
    id: `${routine.id}@${date}`,
    routineId: routine.id,
    date,
    title: routine.name,
    startTime,
    durationMinutes: startTime && isValidDuration(routine.durationMinutes) ? routine.durationMinutes : null,
    steps,
    doneCount,
    stepCount: steps.length,
    done,
    state: done ? 'complete' : doneCount > 0 ? 'inProgress' : 'notStarted',
  };
}

/** Every routine's occurrence on `date`, in the routines' own order. */
export function occurrencesOn(routines, log, date) {
  return routines.filter(routine => routineOccursOnDate(routine, date)).map(routine => occurrenceFor(routine, date, log));
}

/**
 * An occurrence as a day item for NU / NÆSTE, I dag and Tidshjul: the
 * occurrence plus endTime, timeLabel and status at (today, nowMinutes),
 * like a task item (src/features/tasks/items.js).
 */
export function routineItem(occurrence, today, nowMinutes) {
  return {
    ...occurrence,
    endTime: endTime(occurrence),
    timeLabel: scheduleLabel(occurrence),
    status: scheduleStatus(occurrence, today, nowMinutes),
  };
}

/** 'Ikke startet', '2 af 5 trin' or 'Klaret'. */
export const describeProgress = describeRoutineProgress;

/** 'Hver dag', 'Hverdage', 'Weekend' or 'Man · Ons · Fre'. */
export function describeDays(daysOfWeek) {
  const days = Array.isArray(daysOfWeek) ? daysOfWeek : [];
  const preset = DAY_PRESETS.find(([, presetDays]) => sameDays(days, presetDays));
  if (preset) return t(preset[0]);
  return [...days].sort((a, b) => a - b).map(day => t(`routine.dayShort.${day}`)).join(' · ');
}

/** The quiet line on a routine in the list: '07:30 · 45 min · Hverdage · 4 trin'. */
export function describeRoutine(routine) {
  const time = isTimeOfDay(routine.startTime) ? routine.startTime : null;
  return [
    time,
    time && isValidDuration(routine.durationMinutes) ? formatDuration(routine.durationMinutes) : null,
    describeDays(routine.daysOfWeek),
    t('routine.stepCount', { count: stepsOf(routine).length }),
  ].filter(Boolean).join(' · ');
}

// ── Completion log ───────────────────────────────────────────────────────

/**
 * Ticks or unticks one step of one routine on one date. Only that entry
 * changes (it is created on the first tick); other routines and dates are
 * untouched, and the template never changes.
 */
export function toggleStep(log, routineId, date, stepId) {
  const entry = findLog(log, routineId, date);
  if (!entry) return [...log, { routineId, date, completedStepIds: [stepId] }];
  const ids = Array.isArray(entry.completedStepIds) ? entry.completedStepIds : [];
  const completedStepIds = ids.includes(stepId) ? ids.filter(id => id !== stepId) : [...ids, stepId];
  return log.map(other => (other === entry ? { ...entry, completedStepIds } : other));
}

// ── Templates ────────────────────────────────────────────────────────────

/** fields: from readRoutineForm. New routines are active from `today`. */
export function addRoutine(list, id, fields, today) {
  return [...list, withRoutineFields({ id, activeFrom: today }, fields)];
}

export function updateRoutine(list, id, fields) {
  return list.map(routine => (routine.id === id ? withRoutineFields(routine, fields) : routine));
}

/**
 * Removes the template only. Its completion logs are kept on purpose
 * (history is never deleted automatically); they no longer show anywhere.
 */
export function deleteRoutine(list, id) {
  return list.filter(routine => routine.id !== id);
}

/** Like a task: time fields are only stored when set (none -> no keys). */
function withRoutineFields(base, { name, enabled, daysOfWeek, startTime, durationMinutes, steps }) {
  const next = { ...base, name, enabled, daysOfWeek, steps };
  delete next.startTime;
  delete next.durationMinutes;
  if (startTime) {
    next.startTime = startTime;
    if (durationMinutes) next.durationMinutes = durationMinutes;
  }
  return next;
}

// ── The routine form ─────────────────────────────────────────────────────
// Form values: { name, enabled, daysOfWeek, steps: [{ id, text }],
// timeText, durationChoice, customDuration }.

export function formFromRoutine(routine) {
  return {
    name: routine?.name ?? '',
    enabled: routine?.enabled ?? true,
    daysOfWeek: routine ? [...daysOf(routine)] : [...EVERY_DAY],
    steps: routine ? stepsOf(routine).map(step => ({ ...step })) : [],
    ...scheduleFormValues(routine?.startTime, routine?.durationMinutes),
  };
}

/**
 * Validates the form: { fields } or { error } (i18n key). Needs a name, at
 * least one day and at least one non-empty step; empty steps are dropped.
 */
export function readRoutineForm(form) {
  const name = form.name.trim();
  if (!name) return { error: 'routine.form.missingName' };
  const daysOfWeek = EVERY_DAY.filter(day => form.daysOfWeek.includes(day));
  if (daysOfWeek.length === 0) return { error: 'routine.form.missingDays' };
  const steps = form.steps.map(step => ({ id: step.id, text: step.text.trim() })).filter(step => step.text);
  if (steps.length === 0) return { error: 'routine.form.missingSteps' };
  const schedule = readScheduleInput(form);
  if (schedule.error) return schedule;
  return {
    fields: {
      name, enabled: Boolean(form.enabled), daysOfWeek, steps,
      startTime: schedule.startTime, durationMinutes: schedule.durationMinutes,
    },
  };
}

/** Toggles one weekday in a selection (kept in Monday-first order). */
export function toggleDay(days, day) {
  return days.includes(day) ? days.filter(d => d !== day) : EVERY_DAY.filter(d => d === day || days.includes(d));
}

/** Moves the step at `index` by `delta` (-1 up, +1 down); out of range = unchanged. */
export function moveStep(steps, index, delta) {
  const target = index + delta;
  if (index < 0 || index >= steps.length || target < 0 || target >= steps.length) return steps;
  const next = [...steps];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** A new unique id (time + random). Impure: used by screens, not by the logic above. */
export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
