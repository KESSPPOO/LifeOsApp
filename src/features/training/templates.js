// src/features/training/templates.js
//
// Workout templates: a PLANNED sequence of exercises and sets. A template
// never holds results (those live in sessions, ./session.js) and never
// changes an exercise definition (it only refers to one by id). Pure; ids
// are passed in. See ADR-010.
//
// Stored (key `workoutTemplates`):
//   { id, name, rest: { warmup, work } (seconds),
//     exercises: [{ id, exerciseId,
//                   sets: [{ id, type: 'warmup' | 'work',
//                            targetReps?, targetWeightKg? }] }] }
// The array order is the order (as everywhere in LifeOS). Targets are
// optional and only stored when given. Set ids are 'w1', 'w2' … (warm-up)
// and 's1', 's2' … (work): unique within the exercise.
import { t, formatNumber, parseDecimalInput } from '../../core/i18n/index.js';

/** Rest after a set, by its type (seconds). The template can change them. */
export const DEFAULT_REST = { warmup: 90, work: 180 };
/** The rest choices offered in the editor (seconds). */
export const REST_CHOICES = [60, 90, 120, 180, 240];
export const MAX_SETS = 10;

const isRest = (value) => Number.isInteger(value) && value >= 0 && value <= 3600;

/** A template's rest times, with the defaults for missing or damaged values. */
export function restOf(template) {
  return {
    warmup: isRest(template?.rest?.warmup) ? template.rest.warmup : DEFAULT_REST.warmup,
    work: isRest(template?.rest?.work) ? template.rest.work : DEFAULT_REST.work,
  };
}

const exercisesOf = (template) => (Array.isArray(template?.exercises) ? template.exercises : []);
const setsOf = (entry) => (Array.isArray(entry?.sets) ? entry.sets : []);

/** '4 øvelser · 14 sæt'. */
export function describeTemplate(template) {
  const entries = exercisesOf(template);
  const sets = entries.reduce((sum, entry) => sum + setsOf(entry).length, 0);
  return [t('training.exerciseCount', { count: entries.length }), t('training.setCount', { count: sets })].join(' · ');
}

// ── Templates in the list ────────────────────────────────────────────────

export function addTemplate(list, id, fields) {
  return [...list, { id, ...fields }];
}

export function updateTemplate(list, id, fields) {
  return list.map(template => (template.id === id ? { ...template, ...fields } : template));
}

/** Removes the template only; sessions and history keep their own copy. */
export function deleteTemplate(list, id) {
  return list.filter(template => template.id !== id);
}

// ── The template editor's form ───────────────────────────────────────────
// Form values: { name, rest: { warmup, work }, exercises: [{ id,
// exerciseId, warmupSets, workSets, targetRepsText, targetWeightText }] }.
// The editor sets one target for all work sets of an exercise (warm-ups
// have none); the stored model allows a target per set.

const firstWork = (entry) => setsOf(entry).find(set => set.type === 'work');
const countOf = (entry, type) => setsOf(entry).filter(set => set.type === type).length;

export function formFromTemplate(template) {
  return {
    name: template?.name ?? '',
    rest: restOf(template),
    exercises: exercisesOf(template).map(entry => {
      const target = firstWork(entry);
      return {
        id: entry.id,
        exerciseId: entry.exerciseId,
        warmupSets: countOf(entry, 'warmup'),
        workSets: countOf(entry, 'work'),
        targetRepsText: Number.isInteger(target?.targetReps) ? String(target.targetReps) : '',
        targetWeightText: typeof target?.targetWeightKg === 'number' ? formatNumber(target.targetWeightKg, 2) : '',
      };
    }),
  };
}

/** A new exercise in the form: no warm-up, three work sets, no targets. */
export function addFormExercise(form, id, exerciseId) {
  return {
    ...form,
    exercises: [...form.exercises, { id, exerciseId, warmupSets: 0, workSets: 3, targetRepsText: '', targetWeightText: '' }],
  };
}

export function removeFormExercise(form, id) {
  return { ...form, exercises: form.exercises.filter(entry => entry.id !== id) };
}

/** Moves the exercise at `index` by `delta` (-1 up, +1 down); out of range = unchanged. */
export function moveFormExercise(form, index, delta) {
  const target = index + delta;
  if (index < 0 || target < 0 || index >= form.exercises.length || target >= form.exercises.length) return form;
  const exercises = [...form.exercises];
  [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
  return { ...form, exercises };
}

/** Changes one field of one exercise in the form; set counts stay within 0 … MAX_SETS (work at least 1). */
export function updateFormExercise(form, id, patch) {
  return {
    ...form,
    exercises: form.exercises.map(entry => {
      if (entry.id !== id) return entry;
      const next = { ...entry, ...patch };
      next.warmupSets = Math.min(MAX_SETS, Math.max(0, next.warmupSets));
      next.workSets = Math.min(MAX_SETS, Math.max(1, next.workSets));
      return next;
    }),
  };
}

/** The planned sets of one form exercise: warm-ups first, then work sets with the targets. */
function plannedSets({ warmupSets, workSets }, targets) {
  const warmups = Array.from({ length: warmupSets }, (_, i) => ({ id: `w${i + 1}`, type: 'warmup' }));
  const work = Array.from({ length: workSets }, (_, i) => ({ id: `s${i + 1}`, type: 'work', ...targets }));
  return [...warmups, ...work];
}

/**
 * Validates the form: { fields } (for addTemplate / updateTemplate) or
 * { error } (i18n key). Needs a name and at least one exercise; a target
 * is optional but must be valid when given (reps 1 … 999, kg like '62,5').
 */
export function readTemplateForm(form) {
  const name = form.name.trim();
  if (!name) return { error: 'training.templateForm.missingName' };
  if (form.exercises.length === 0) return { error: 'training.templateForm.missingExercises' };
  const exercises = [];
  for (const entry of form.exercises) {
    const targets = {};
    if (entry.targetRepsText.trim()) {
      const reps = Number(entry.targetRepsText.trim());
      if (!/^\d+$/.test(entry.targetRepsText.trim()) || reps < 1 || reps > 999) return { error: 'training.templateForm.invalidReps' };
      targets.targetReps = reps;
    }
    if (entry.targetWeightText.trim()) {
      const kg = parseDecimalInput(entry.targetWeightText, 2);
      if (kg === null || kg > 1000) return { error: 'training.templateForm.invalidWeight' };
      targets.targetWeightKg = kg;
    }
    exercises.push({ id: entry.id, exerciseId: entry.exerciseId, sets: plannedSets(entry, targets) });
  }
  return { fields: { name, rest: { ...form.rest }, exercises } };
}
