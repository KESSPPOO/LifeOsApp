// src/features/training/exercises.js
//
// The exercise library: reusable exercise DEFINITIONS (what an exercise
// is), never what was performed. Pure; ids are passed in. See ADR-010.
//
// Stored (src/features/training/store.js, key `exercises`):
//   { id, name, category, muscleGroups: [], equipment, trackingType,
//     instructions?: string, custom: true }
// The library starts empty: no exercise is created without the user.
// `custom` marks the user's own exercises; a future built-in library will
// add entries with custom: false (read-only here).
import { t } from '../../core/i18n/index.js';

/** Broad categories (a plain field, not a taxonomy). */
export const CATEGORIES = [
  'strength', 'calisthenics', 'cardio', 'mobility', 'core',
  'balance', 'plyometrics', 'functional', 'rehabilitation', 'other',
];

/** What a set of the exercise records (see ./sets.js). */
export const TRACKING = {
  WEIGHT_REPS: 'weightReps',
  BODYWEIGHT_REPS: 'bodyweightReps',
  DURATION: 'duration',
  DISTANCE_DURATION: 'distanceDuration',
};
export const TRACKING_TYPES = Object.values(TRACKING);

export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core',
  'glutes', 'quads', 'hamstrings', 'calves', 'fullBody',
];

export const EQUIPMENT = [
  'barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'band', 'cardioMachine', 'other',
];

export const categoryLabel = (category) => t(`training.category.${CATEGORIES.includes(category) ? category : 'other'}`);
export const trackingLabel = (type) => t(`training.tracking.${TRACKING_TYPES.includes(type) ? type : TRACKING.WEIGHT_REPS}`);
export const muscleLabel = (muscle) => t(`training.muscle.${muscle}`);
export const equipmentLabel = (equipment) => t(`training.equipment.${EQUIPMENT.includes(equipment) ? equipment : 'other'}`);

/** The exercise with this id, or undefined. */
export const findExercise = (exercises, id) => exercises.find(exercise => exercise.id === id);

/** A stored tracking type, or the default for damaged data. */
export const trackingOf = (exercise) =>
  (TRACKING_TYPES.includes(exercise?.trackingType) ? exercise.trackingType : TRACKING.WEIGHT_REPS);

// ── The library list ─────────────────────────────────────────────────────

/** Lower-case for searching; keeps æ, ø and å. */
const fold = (text) => String(text ?? '').trim().toLowerCase();

/**
 * The exercises shown for a search text and a category (null = all), sorted
 * by name (Danish letters after z, as in the alphabet).
 */
export function filterExercises(exercises, { query = '', category = null } = {}) {
  const q = fold(query);
  return exercises
    .filter(exercise => (category === null || exercise.category === category) && (!q || fold(exercise.name).includes(q)))
    .sort((a, b) => compareDanish(fold(a.name), fold(b.name)));
}

const DANISH_ORDER = 'abcdefghijklmnopqrstuvwxyzæøå';
/** Alphabetical, with æ, ø, å last (not by char code, where å < æ). */
function compareDanish(a, b) {
  const rank = (ch) => {
    const i = DANISH_ORDER.indexOf(ch);
    return i === -1 ? ch.charCodeAt(0) - 1000 : i; // digits and others first
  };
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const diff = rank(a[i]) - rank(b[i]);
    if (diff !== 0) return diff;
  }
  return a.length - b.length;
}

// ── Create and edit ──────────────────────────────────────────────────────

/** fields: from readExerciseForm. User-created exercises are custom. */
export function addExercise(list, id, fields) {
  return [...list, withExerciseFields({ id, custom: true }, fields)];
}

/** Only the user's own exercises can be edited. */
export function updateExercise(list, id, fields) {
  return list.map(exercise => (exercise.id === id && exercise.custom ? withExerciseFields(exercise, fields) : exercise));
}

/** Instructions are only stored when given (absent, never empty or null). */
function withExerciseFields(base, { name, category, muscleGroups, equipment, trackingType, instructions }) {
  const next = { ...base, name, category, muscleGroups, equipment, trackingType };
  if (instructions) next.instructions = instructions;
  else delete next.instructions;
  return next;
}

// ── The exercise form ────────────────────────────────────────────────────
// Form values: { name, category, muscleGroups, equipment, trackingType, instructions }.

export function formFromExercise(exercise) {
  return {
    name: exercise?.name ?? '',
    category: CATEGORIES.includes(exercise?.category) ? exercise.category : 'strength',
    muscleGroups: Array.isArray(exercise?.muscleGroups) ? exercise.muscleGroups.filter(m => MUSCLE_GROUPS.includes(m)) : [],
    equipment: EQUIPMENT.includes(exercise?.equipment) ? exercise.equipment : 'barbell',
    trackingType: trackingOf(exercise),
    instructions: typeof exercise?.instructions === 'string' ? exercise.instructions : '',
  };
}

/** { fields } or { error } (i18n key). Needs a name; muscle groups keep their list order. */
export function readExerciseForm(form) {
  const name = form.name.trim();
  if (!name) return { error: 'training.exerciseForm.missingName' };
  return {
    fields: {
      name,
      category: CATEGORIES.includes(form.category) ? form.category : 'other',
      muscleGroups: MUSCLE_GROUPS.filter(m => form.muscleGroups.includes(m)),
      equipment: EQUIPMENT.includes(form.equipment) ? form.equipment : 'other',
      trackingType: trackingOf(form),
      instructions: form.instructions.trim(),
    },
  };
}

/** Toggles one muscle group in a selection. */
export function toggleMuscle(selected, muscle) {
  return selected.includes(muscle) ? selected.filter(m => m !== muscle) : [...selected, muscle];
}
