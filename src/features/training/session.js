// src/features/training/session.js
//
// A workout SESSION: one actual workout, started from a template. Pure;
// ids, the date and the time ("nowMs", epoch milliseconds) are passed in.
// See ADR-010.
//
// Starting copies (snapshots) everything the workout needs, so editing or
// deleting the template, or editing an exercise, never changes a started
// or finished workout:
//   { id, templateId, name, date: 'YYYY-MM-DD', startedAt, completedAt?,
//     rest: { warmup, work }, currentIndex, timer: { endsAt, seconds, setKey } | null,
//     exercises: [{ id, exerciseId, name, trackingType, skipped?, replacedFrom?: { exerciseId, name },
//                   sets: [{ id, type, targetReps?, targetWeightKg?,
//                            done?, values?, draft? }] }] }
// The exercise's name and tracking type are copied (history must read
// the same after a rename); muscles, equipment and instructions are not
// (Forklaring shows the library's current text). `draft` holds what was
// typed for a set that is not completed yet (texts, kept across screens);
// `values` what was logged (numbers). Times are epoch milliseconds: a
// workout log records real moments, unlike planning (local 'HH:mm').
//
// One set's address is a setKey: '<session exercise id>/<set id>'.
import { t } from '../../core/i18n/index.js';
import { findExercise, trackingOf } from './exercises.js';
import { parseSetInput, valuesToTexts } from './sets.js';
import { restOf } from './templates.js';

export const setKey = (entry, set) => `${entry.id}/${set.id}`;

/** A set's number among the exercise's sets of its type: warm-up 1, 2 …; work 1, 2 … */
export const setNumber = (entry, set) => entry.sets.filter(s => s.type === set.type).indexOf(set) + 1;
export const EXTEND_SECONDS = 30;

const copySet = ({ id, type, targetReps, targetWeightKg }) => {
  const set = { id, type: type === 'warmup' ? 'warmup' : 'work' };
  if (Number.isInteger(targetReps)) set.targetReps = targetReps;
  if (typeof targetWeightKg === 'number') set.targetWeightKg = targetWeightKg;
  return set;
};

/**
 * A new session from a template: its own copy of the exercises (name and
 * tracking type from the library now) and planned sets, nothing done.
 * An exercise missing from the library keeps its place with a neutral name.
 */
export function startSession({ id, template, exercises, date, nowMs }) {
  return {
    id,
    templateId: template.id,
    name: template.name,
    date,
    startedAt: nowMs,
    rest: restOf(template),
    currentIndex: 0,
    timer: null,
    exercises: (Array.isArray(template.exercises) ? template.exercises : []).map(entry => {
      const exercise = findExercise(exercises, entry.exerciseId);
      return {
        id: entry.id,
        exerciseId: entry.exerciseId,
        name: exercise?.name ?? t('training.unknownExercise'),
        trackingType: trackingOf(exercise),
        sets: (Array.isArray(entry.sets) ? entry.sets : []).map(copySet),
      };
    }),
  };
}

/** The session with one exercise changed by `fn` (others untouched). */
function mapEntry(session, entryId, fn) {
  return { ...session, exercises: session.exercises.map(entry => (entry.id === entryId ? fn(entry) : entry)) };
}

/** The session with one set changed by `fn`. */
function mapSet(session, entryId, setId, fn) {
  return mapEntry(session, entryId, entry => ({ ...entry, sets: entry.sets.map(set => (set.id === setId ? fn(set, entry) : set)) }));
}

/** Keeps what was typed into a set's field (a text; parsed only on completion). */
export function setDraft(session, entryId, setId, field, text) {
  return mapSet(session, entryId, setId, set => ({ ...set, draft: { ...set.draft, [field]: text } }));
}

/**
 * Completes a set with the texts shown in its fields (typed, or suggested
 * from the target or Sidst): { session } or { error, field } when a value
 * is missing or invalid (then nothing changes). Starts the rest for the
 * set's type (the session's rest times; 0 = no rest).
 */
export function completeSet(session, entryId, setId, texts, nowMs) {
  const entry = session.exercises.find(e => e.id === entryId);
  const set = entry?.sets.find(s => s.id === setId);
  if (!set || set.done || entry.skipped) return { session };
  const parsed = parseSetInput(entry.trackingType, texts);
  if (parsed.error) return parsed;
  const next = mapSet(session, entryId, setId, ({ draft, ...rest }) => ({ ...rest, done: true, values: parsed.values }));
  const seconds = restOf(session)[set.type];
  return { session: { ...next, timer: seconds > 0 ? { endsAt: nowMs + seconds * 1000, seconds, setKey: setKey(entry, set) } : null } };
}

/**
 * Undoes a completed set: it is open again with its logged values back in
 * the fields (so a typo is quick to fix). Its rest, if running, stops.
 */
export function undoSet(session, entryId, setId) {
  const entry = session.exercises.find(e => e.id === entryId);
  const set = entry?.sets.find(s => s.id === setId);
  if (!set?.done) return session;
  const next = mapSet(session, entryId, setId, ({ done, values, ...rest }) => ({ ...rest, draft: valuesToTexts(entry.trackingType, values) }));
  return session.timer?.setKey === setKey(entry, set) ? { ...next, timer: null } : next;
}

// ── Exercises in the session ─────────────────────────────────────────────

/** Spring over: this exercise is skipped in this workout (sets already logged stay). Undo with unskip. */
export const skipExercise = (session, entryId) => mapEntry(session, entryId, entry => ({ ...entry, skipped: true }));

export const unskipExercise = (session, entryId) => mapEntry(session, entryId, ({ skipped, ...entry }) => entry);

/** Whether Alternativ is possible: nothing logged on the exercise yet. */
export const canReplace = (entry) => !entry.sets.some(set => set.done);

/**
 * Alternativ: this session does `exercise` instead (the template is not
 * touched). Only before a set is logged; the planned sets stay, typed
 * drafts go (they were for the other exercise). The original is kept in
 * `replacedFrom` (the first one, if replaced twice; cleared when replaced
 * back).
 */
export function replaceExercise(session, entryId, exercise) {
  return mapEntry(session, entryId, entry => {
    if (!canReplace(entry) || entry.exerciseId === exercise.id) return entry;
    const original = entry.replacedFrom ?? { exerciseId: entry.exerciseId, name: entry.name };
    const next = {
      ...entry,
      exerciseId: exercise.id,
      name: exercise.name,
      trackingType: trackingOf(exercise),
      sets: entry.sets.map(({ draft, ...set }) => set),
      replacedFrom: original,
    };
    if (original.exerciseId === exercise.id) delete next.replacedFrom;
    return next;
  });
}

/** Shows exercise `index` (kept in the session, so Fortsæt træning returns to it). */
export function showExercise(session, index) {
  const currentIndex = Math.min(Math.max(0, index), Math.max(0, session.exercises.length - 1));
  return currentIndex === session.currentIndex ? session : { ...session, currentIndex };
}

/**
 * Where an exercise stands: 'skipped'; 'done' (every work set completed;
 * warm-ups are optional); 'started' (a set completed); 'open'.
 */
export function exerciseStatus(entry) {
  if (entry.skipped) return 'skipped';
  const work = entry.sets.filter(set => set.type === 'work');
  if (work.length > 0 && work.every(set => set.done)) return 'done';
  return entry.sets.some(set => set.done) ? 'started' : 'open';
}

/** The next exercise after `index` that is neither done nor skipped (then any before it), or null. */
export function nextOpenIndex(session, index) {
  const order = [...session.exercises.keys()].filter(i => i !== index);
  const after = [...order.filter(i => i > index), ...order.filter(i => i < index)];
  const found = after.find(i => !['done', 'skipped'].includes(exerciseStatus(session.exercises[i])));
  return found ?? null;
}

// ── Rest ─────────────────────────────────────────────────────────────────
// The rest timer is a deadline (timer.endsAt) in the session, not a
// running interval: every screen computes the remaining time from the
// clock, so leaving and returning (or restarting the app) never starts a
// second timer, and nothing drifts.

/** Whole seconds of rest left at nowMs (0 when over or none). */
export function restRemaining(session, nowMs) {
  if (!session?.timer) return 0;
  return Math.max(0, Math.ceil((session.timer.endsAt - nowMs) / 1000));
}

/** +30 sek: from the current end, or from now if it has already ended. */
export function extendRest(session, nowMs, seconds = EXTEND_SECONDS) {
  if (!session.timer) return session;
  const from = Math.max(session.timer.endsAt, nowMs);
  return { ...session, timer: { ...session.timer, endsAt: from + seconds * 1000, seconds: session.timer.seconds + seconds } };
}

/** Skip / stop the rest. */
export const skipRest = (session) => (session.timer ? { ...session, timer: null } : session);

// ── Finishing ────────────────────────────────────────────────────────────

/**
 * The summary shown before finishing (and in history):
 *   exercisesDone     not skipped, at least one set completed
 *   exercisesSkipped  marked Spring over (whatever was logged before)
 *   exercisesTotal, setsDone (every completed set), durationMs
 * Each exercise counts as done, skipped or neither, never twice.
 */
export function sessionSummary(session, nowMs) {
  const exercises = session.exercises;
  return {
    exercisesDone: exercises.filter(entry => !entry.skipped && entry.sets.some(set => set.done)).length,
    exercisesSkipped: exercises.filter(entry => entry.skipped).length,
    exercisesTotal: exercises.length,
    setsDone: exercises.reduce((sum, entry) => sum + entry.sets.filter(set => set.done).length, 0),
    durationMs: Math.max(0, (session.completedAt ?? nowMs) - session.startedAt),
  };
}

/**
 * The finished workout, as history keeps it: completedAt set, no rest
 * timer, no typed drafts, no screen position. Sets not completed stay as
 * planned (not done), so history shows what was left.
 */
export function finishSession(session, nowMs) {
  const { timer, currentIndex, ...rest } = session;
  return {
    ...rest,
    completedAt: nowMs,
    exercises: session.exercises.map(entry => ({ ...entry, sets: entry.sets.map(({ draft, ...set }) => set) })),
  };
}

/**
 * The workout in progress, from the stored list of at most one: null when
 * there is none, or when it already reached history (an interrupted
 * finish); with damaged data holding several, the latest started.
 */
export function pickActive(activeList, history) {
  const finished = new Set(history.map(session => session.id));
  const open = activeList.filter(session => session && Array.isArray(session.exercises) && !finished.has(session.id) && !session.completedAt);
  return open.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0] ?? null;
}
