// src/features/training/history.js
//
// Completed workouts as history: "Sidst" (what was done last time), the
// values suggested in a set's fields, and the history list. Pure; history
// is read, never changed. See ADR-010.
import { formatDuration } from '../../core/i18n/index.js';
import { valuesToTexts, fieldsFor } from './sets.js';
import { setKey } from './session.js';

const byNewest = (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0);

/**
 * The exercise as it was done in the most recent completed workout that
 * did it (same exerciseId, not skipped, at least one set completed, same
 * tracking type), or null. `excludeId`: the workout being shown.
 */
export function lastPerformance(history, exerciseId, trackingType, excludeId = null) {
  for (const session of [...history].sort(byNewest)) {
    if (session.id === excludeId || !session.completedAt || !Array.isArray(session.exercises)) continue;
    const entry = session.exercises.find(e =>
      e.exerciseId === exerciseId && !e.skipped && e.trackingType === trackingType && e.sets?.some(set => set.done));
    if (entry) return entry;
  }
  return null;
}

/**
 * SIDST for every set of a session: Map setKey -> values. Sets are matched
 * by type and position: the nth warm-up (work) set of an exercise gets the
 * nth COMPLETED warm-up (work) set of that exercise last time. No match,
 * no entry (the screen shows a quiet dash).
 */
export function sidstForSession(session, history) {
  const sidst = new Map();
  for (const entry of session.exercises) {
    const last = lastPerformance(history, entry.exerciseId, entry.trackingType, session.id);
    if (!last) continue;
    const doneByType = { warmup: [], work: [] };
    for (const set of last.sets) if (set.done && doneByType[set.type]) doneByType[set.type].push(set.values);
    const seen = { warmup: 0, work: 0 };
    for (const set of entry.sets) {
      const values = doneByType[set.type]?.[seen[set.type]++];
      if (values) sidst.set(setKey(entry, set), values);
    }
  }
  return sidst;
}

/**
 * The texts in a set's fields: what was typed (draft), else the
 * template's target, else Sidst, else ''. Completing the set logs exactly
 * these, so repeating last time is one tap.
 */
export function fieldTexts(entry, set, sidstValues) {
  const target = valuesToTexts(entry.trackingType, { weightKg: set.targetWeightKg, reps: set.targetReps });
  const last = valuesToTexts(entry.trackingType, sidstValues);
  const texts = {};
  for (const { key } of fieldsFor(entry.trackingType)) texts[key] = set.draft?.[key] ?? target[key] ?? last[key] ?? '';
  return texts;
}

/** Minutes of a workout, at least 1: for '1 t 15 min'. */
export const durationMinutes = (ms) => Math.max(1, Math.round(ms / 60000));

/** '1 t 15 min' for a duration in milliseconds. */
export const formatWorkoutDuration = (ms) => formatDuration(durationMinutes(ms));

/** Completed workouts, newest first (damaged entries left out). */
export function historyList(history) {
  return history.filter(session => session?.completedAt && Array.isArray(session.exercises)).sort(byNewest);
}
