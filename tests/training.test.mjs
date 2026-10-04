// Træning (src/features/training): exercises, templates, the workout
// session (snapshot, set logging, undo, skip, Alternativ, rest, finish),
// Sidst, history, Danish number input and the safety of the workout in
// progress across restarts. Fixed dates and times; no clock; in-memory
// storage. Example exercises are test fixtures only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDecimalInput, formatTimer, formatNumber } from '../src/core/i18n/index.js';
import {
  TRACKING, addExercise, updateExercise, filterExercises, formFromExercise, readExerciseForm, trackingOf, toggleMuscle,
} from '../src/features/training/exercises.js';
import { fieldsFor, parseSetInput, parseDurationInput, valuesToTexts, formatSetValues, describeSetValues } from '../src/features/training/sets.js';
import {
  DEFAULT_REST, formFromTemplate, addFormExercise, removeFormExercise, moveFormExercise, updateFormExercise,
  readTemplateForm, addTemplate, updateTemplate, deleteTemplate, describeTemplate, restOf,
} from '../src/features/training/templates.js';
import {
  startSession, setDraft, completeSet, undoSet, skipExercise, unskipExercise, replaceExercise, canReplace,
  showExercise, exerciseStatus, nextOpenIndex, restRemaining, extendRest, skipRest, sessionSummary, finishSession, pickActive, setNumber,
} from '../src/features/training/session.js';
import { lastPerformance, sidstForSession, fieldTexts, historyList, durationMinutes } from '../src/features/training/history.js';
import { createWorkoutActions } from '../src/features/training/workouts.js';
import { KEYS } from '../src/core/storage/keys.js';
import {
  STORED_EXERCISES, STORED_TEMPLATES, STORED_WORKOUT_SESSIONS, STORED_ACTIVE_WORKOUT,
  rawStore, createMemoryAdapter, failReadsOf, failWritesOf, parsed, quietLogger, repoPath, sourceFiles,
} from './fixtures.mjs';
import { createStorage } from '../src/core/storage/engine.js';
import { createPersistedListStore } from '../src/core/state/persistedListStore.js';

const T0 = 1790100000000; // a fixed moment (epoch ms)
const SEC = 1000;
const TEMPLATE = STORED_TEMPLATES[0];
const EXERCISES = STORED_EXERCISES;
const deepFreeze = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
};
const fresh = (overrides = {}) => startSession({ id: 'w', template: TEMPLATE, exercises: EXERCISES, date: '2026-10-04', nowMs: T0, ...overrides });
const done = (session, entryId, setId, texts, at = T0) => {
  const result = completeSet(session, entryId, setId, texts, at);
  assert.ok(!result.error, `completed ${entryId}/${setId}: ${result.error}`);
  return result.session;
};

// ── Danish number input ─────────────────────────────────────────────────────

test('weight input: Danish comma decimals, whole numbers, a point; exact digits, no float corruption', () => {
  assert.equal(parseDecimalInput('62,5'), 62.5);
  assert.equal(parseDecimalInput('62.5'), 62.5);
  assert.equal(parseDecimalInput('62'), 62);
  assert.equal(parseDecimalInput(' 62,50 '), 62.5);
  assert.equal(parseDecimalInput('1,25'), 1.25);
  assert.equal(parseDecimalInput('0'), 0);
  // Round trip through the Danish display keeps every typed decimal.
  for (const text of ['62,55', '0,1', '102,25', '7,5']) assert.equal(formatNumber(parseDecimalInput(text), 2), text);
});

test('weight input: invalid values are refused (never a silent guess)', () => {
  for (const text of ['', '   ', 'abc', '-5', '6,2,5', '62,', ',5', '1.250', '62,555', '1e3', '62 kg', null, undefined]) {
    assert.equal(parseDecimalInput(text), null, String(text));
  }
});

test('set input by tracking type; a set with a missing or invalid value is never logged', () => {
  assert.deepEqual(parseSetInput(TRACKING.WEIGHT_REPS, { weightKg: '62,5', reps: '8' }), { values: { weightKg: 62.5, reps: 8 } });
  assert.deepEqual(parseSetInput(TRACKING.BODYWEIGHT_REPS, { reps: '12' }), { values: { reps: 12 } });
  assert.deepEqual(parseSetInput(TRACKING.DURATION, { seconds: '1:30' }), { values: { seconds: 90 } });
  assert.deepEqual(parseSetInput(TRACKING.DISTANCE_DURATION, { distanceKm: '5,2', seconds: '25:00' }), { values: { distanceKm: 5.2, seconds: 1500 } });
  assert.deepEqual(parseSetInput(TRACKING.WEIGHT_REPS, { weightKg: '62,5', reps: '' }), { error: 'training.invalid.reps', field: 'reps' });
  assert.equal(parseSetInput(TRACKING.WEIGHT_REPS, { weightKg: 'x', reps: '8' }).field, 'weightKg');
  assert.equal(parseSetInput(TRACKING.WEIGHT_REPS, { weightKg: '62', reps: '8,5' }).field, 'reps');
  assert.equal(parseSetInput(TRACKING.WEIGHT_REPS, { weightKg: '1001', reps: '8' }).field, 'weightKg');
  assert.equal(parseSetInput(TRACKING.BODYWEIGHT_REPS, { reps: '0' }).field, 'reps');
  assert.equal(parseSetInput(TRACKING.DISTANCE_DURATION, { distanceKm: '0', seconds: '60' }).field, 'distanceKm');
});

test('times: m:ss, h:mm:ss or seconds; shown as m:ss', () => {
  assert.deepEqual(['45', '1:30', '0:45', '25:00', '1:02:03'].map(parseDurationInput), [45, 90, 45, 1500, 3723]);
  for (const bad of ['0', '1:60', '1:5', ':30', 'abc', '1:00:60', '25:00:00:00']) assert.equal(parseDurationInput(bad), null, bad);
  assert.deepEqual([45, 90, 180, 3723, 0, -5].map(formatTimer), ['0:45', '1:30', '3:00', '1:02:03', '0:00', '0:00']);
});

test('values shown compactly and in words', () => {
  assert.equal(formatSetValues(TRACKING.WEIGHT_REPS, { weightKg: 62.5, reps: 8 }), '62,5×8');
  assert.equal(formatSetValues(TRACKING.BODYWEIGHT_REPS, { reps: 12 }), '12');
  assert.equal(formatSetValues(TRACKING.DURATION, { seconds: 45 }), '0:45');
  assert.equal(formatSetValues(TRACKING.DISTANCE_DURATION, { distanceKm: 5, seconds: 1500 }), '5 km · 25:00');
  assert.equal(formatSetValues(TRACKING.WEIGHT_REPS, { reps: 8 }), '', 'incomplete values show nothing');
  assert.equal(describeSetValues(TRACKING.WEIGHT_REPS, { weightKg: 62.5, reps: 8 }), '62,5 kilo, 8 gentagelser');
  assert.equal(describeSetValues(TRACKING.BODYWEIGHT_REPS, { reps: 1 }), '1 gentagelse');
  assert.deepEqual(valuesToTexts(TRACKING.WEIGHT_REPS, { weightKg: 62.5, reps: 8 }), { weightKg: '62,5', reps: '8' });
});

// ── Exercises ───────────────────────────────────────────────────────────────

test('exercises: create (custom), edit only own, instructions only when given', () => {
  const { fields } = readExerciseForm({ ...formFromExercise(null), name: '  Squat  ', muscleGroups: ['quads', 'glutes'], instructions: '' });
  const list = addExercise([], 'x1', fields);
  assert.deepEqual(list[0], { id: 'x1', custom: true, name: 'Squat', category: 'strength', muscleGroups: ['glutes', 'quads'], equipment: 'barbell', trackingType: 'weightReps' });
  const builtIn = { id: 'b', name: 'Indbygget', custom: false, category: 'strength', muscleGroups: [], equipment: 'other', trackingType: 'weightReps' };
  const edited = updateExercise([...list, builtIn], 'x1', { ...fields, name: 'Back squat', instructions: 'Dybt.' });
  assert.equal(edited[0].name, 'Back squat');
  assert.equal(edited[0].instructions, 'Dybt.');
  assert.equal(updateExercise(edited, 'b', { ...fields, name: 'X' })[1], builtIn, 'built-in exercises are not edited');
  assert.deepEqual(readExerciseForm({ ...formFromExercise(null), name: ' ' }), { error: 'training.exerciseForm.missingName' });
  assert.deepEqual(toggleMuscle(toggleMuscle([], 'back'), 'back'), []);
});

test('exercises: search (case-insensitive, æ ø å) and filter by category, in Danish alphabetical order', () => {
  const list = [...EXERCISES, { id: 'ae', name: 'Ærmeløs roning', category: 'strength', muscleGroups: [], equipment: 'cable', trackingType: 'weightReps', custom: true }];
  assert.deepEqual(filterExercises(list).map(e => e.name), ['Bænkpres', 'Løb', 'Planke', 'Pull-ups', 'Ærmeløs roning']);
  assert.deepEqual(filterExercises(list, { query: 'PL' }).map(e => e.id), ['plank']);
  assert.deepEqual(filterExercises(list, { query: 'ærme' }).map(e => e.id), ['ae']);
  assert.deepEqual(filterExercises(list, { query: 'bæn' }).map(e => e.id), ['bench']);
  assert.deepEqual(filterExercises(list, { category: 'strength' }).map(e => e.id), ['bench', 'ae']);
  assert.deepEqual(filterExercises(list, { category: 'cardio', query: 'x' }), []);
});

test('tracking types decide the fields; damaged types fall back to weight and reps', () => {
  assert.deepEqual(fieldsFor(TRACKING.WEIGHT_REPS).map(f => f.key), ['weightKg', 'reps']);
  assert.deepEqual(fieldsFor(TRACKING.BODYWEIGHT_REPS).map(f => f.key), ['reps']);
  assert.deepEqual(fieldsFor(TRACKING.DURATION).map(f => f.key), ['seconds']);
  assert.deepEqual(fieldsFor(TRACKING.DISTANCE_DURATION).map(f => f.key), ['distanceKm', 'seconds']);
  assert.equal(trackingOf({ trackingType: 'weird' }), 'weightReps');
  assert.equal(trackingOf(undefined), 'weightReps');
});

// ── Templates ───────────────────────────────────────────────────────────────

test('templates: build in the editor form, warm-up and work sets distinct, targets on work sets only', () => {
  let form = formFromTemplate(null);
  assert.deepEqual(form.rest, DEFAULT_REST);
  form = addFormExercise({ ...form, name: 'Ben' }, 'e1', 'bench');
  form = addFormExercise(form, 'e2', 'pullup');
  form = updateFormExercise(form, 'e1', { warmupSets: 2, workSets: 3, targetRepsText: '8', targetWeightText: '62,5' });
  const { fields } = readTemplateForm(form);
  assert.deepEqual(fields.exercises[0].sets, [
    { id: 'w1', type: 'warmup' }, { id: 'w2', type: 'warmup' },
    { id: 's1', type: 'work', targetReps: 8, targetWeightKg: 62.5 },
    { id: 's2', type: 'work', targetReps: 8, targetWeightKg: 62.5 },
    { id: 's3', type: 'work', targetReps: 8, targetWeightKg: 62.5 },
  ]);
  assert.deepEqual(fields.exercises[1].sets.map(s => s.type), ['work', 'work', 'work']);
  assert.ok(!('targetReps' in fields.exercises[1].sets[0]), 'no target -> no key');
  const list = addTemplate([], 't1', fields);
  assert.equal(describeTemplate(list[0]), '2 øvelser · 8 sæt');
  // The form reads back what was saved.
  assert.deepEqual(formFromTemplate(list[0]).exercises[0], { id: 'e1', exerciseId: 'bench', warmupSets: 2, workSets: 3, targetRepsText: '8', targetWeightText: '62,5' });
});

test('templates: add, remove, reorder exercises; set counts stay sensible; validation', () => {
  let form = { ...formFromTemplate(null), name: 'X' };
  form = addFormExercise(addFormExercise(addFormExercise(form, 'a', 'bench'), 'b', 'pullup'), 'c', 'plank');
  assert.deepEqual(moveFormExercise(form, 2, -1).exercises.map(e => e.id), ['a', 'c', 'b']);
  assert.deepEqual(moveFormExercise(form, 0, -1), form, 'out of range = unchanged');
  assert.deepEqual(removeFormExercise(form, 'b').exercises.map(e => e.id), ['a', 'c']);
  const clamped = updateFormExercise(form, 'a', { warmupSets: -1, workSets: 0 }).exercises[0];
  assert.deepEqual([clamped.warmupSets, clamped.workSets], [0, 1]);
  assert.equal(updateFormExercise(form, 'a', { workSets: 99 }).exercises[0].workSets, 10);
  assert.deepEqual(readTemplateForm({ ...form, name: ' ' }), { error: 'training.templateForm.missingName' });
  assert.deepEqual(readTemplateForm({ ...form, exercises: [] }), { error: 'training.templateForm.missingExercises' });
  assert.deepEqual(readTemplateForm(updateFormExercise(form, 'a', { targetRepsText: '8,5' })), { error: 'training.templateForm.invalidReps' });
  assert.deepEqual(readTemplateForm(updateFormExercise(form, 'a', { targetWeightText: 'tung' })), { error: 'training.templateForm.invalidWeight' });
});

test('templates never change exercise definitions, and keep their rest settings', () => {
  const exercises = deepFreeze(structuredClone(EXERCISES));
  const form = addFormExercise({ ...formFromTemplate(null), name: 'X' }, 'a', 'bench');
  const { fields } = readTemplateForm(form);
  const list = deepFreeze(addTemplate([], 't', fields));
  assert.doesNotThrow(() => startSession({ id: 's', template: list[0], exercises, date: '2026-10-04', nowMs: T0 }));
  assert.deepEqual(exercises, EXERCISES);
  assert.deepEqual(restOf({ rest: { warmup: 60, work: 'x' } }), { warmup: 60, work: 180 });
  assert.deepEqual(deleteTemplate(updateTemplate(list, 't', { name: 'Y' }), 't'), []);
});

// ── Session ─────────────────────────────────────────────────────────────────

test('starting a workout copies the template: names, tracking types, sets and targets; nothing done', () => {
  const s = fresh();
  assert.equal(s.templateId, 'upper');
  assert.equal(s.name, 'Overkrop A');
  assert.equal(s.startedAt, T0);
  assert.deepEqual(s.rest, { warmup: 60, work: 180 });
  assert.deepEqual(s.exercises.map(e => [e.exerciseId, e.name, e.trackingType]), [['bench', 'Bænkpres', 'weightReps'], ['pullup', 'Pull-ups', 'bodyweightReps']]);
  assert.deepEqual(s.exercises[0].sets[1], { id: 's1', type: 'work', targetReps: 8, targetWeightKg: 62.5 });
  assert.ok(s.exercises.every(e => e.sets.every(set => !set.done)));
  assert.equal(s.timer, null);
  // Missing exercise: keeps its place, neutral name.
  const missing = fresh({ exercises: [] });
  assert.deepEqual(missing.exercises.map(e => e.name), ['Ukendt øvelse', 'Ukendt øvelse']);
});

test('editing or deleting the template after the start does not change the workout', () => {
  const templates = structuredClone(STORED_TEMPLATES);
  const s = startSession({ id: 'w', template: templates[0], exercises: EXERCISES, date: '2026-10-04', nowMs: T0 });
  const snapshot = structuredClone(s);
  const edited = updateTemplate(templates, 'upper', { name: 'Nyt navn', exercises: [] });
  templates[0].exercises[0].sets[1].targetReps = 3; // even a mutation of the stored template object
  assert.equal(edited[0].name, 'Nyt navn');
  assert.deepEqual(s, snapshot);
  // An exercise renamed later does not rename the workout's copy either.
  const renamed = updateExercise(EXERCISES, 'bench', { ...readExerciseForm({ ...formFromExercise(EXERCISES[0]), name: 'Bench' }).fields });
  assert.equal(renamed[0].name, 'Bench');
  assert.equal(s.exercises[0].name, 'Bænkpres');
});

test('logging a set stores the entered values; an invalid set is not completed', () => {
  let s = fresh();
  const bad = completeSet(s, 'e1', 's1', { weightKg: '62,5', reps: '' }, T0);
  assert.deepEqual(bad, { error: 'training.invalid.reps', field: 'reps' });
  s = setDraft(s, 'e1', 's1', 'weightKg', '65');
  assert.deepEqual(s.exercises[0].sets[1].draft, { weightKg: '65' });
  s = done(s, 'e1', 's1', { weightKg: '62,5', reps: '8' });
  assert.deepEqual(s.exercises[0].sets[1], { id: 's1', type: 'work', targetReps: 8, targetWeightKg: 62.5, done: true, values: { weightKg: 62.5, reps: 8 } });
  // Completing again changes nothing.
  assert.equal(completeSet(s, 'e1', 's1', { weightKg: '1', reps: '1' }, T0).session, s);
});

test('completing is reversible: undo reopens the set with its values in the fields', () => {
  let s = done(fresh(), 'e1', 's1', { weightKg: '62,5', reps: '8' });
  s = undoSet(s, 'e1', 's1');
  const set = s.exercises[0].sets[1];
  assert.equal(set.done, undefined);
  assert.equal(set.values, undefined);
  assert.deepEqual(set.draft, { weightKg: '62,5', reps: '8' });
  assert.equal(s.timer, null, 'its rest stops');
  assert.equal(undoSet(s, 'e1', 's1'), s, 'undoing an open set does nothing');
});

test('exercise status, next exercise and showing an exercise', () => {
  let s = fresh();
  assert.equal(exerciseStatus(s.exercises[0]), 'open');
  s = done(s, 'e1', 's1', { weightKg: '60', reps: '8' });
  assert.equal(exerciseStatus(s.exercises[0]), 'started');
  s = done(s, 'e1', 's2', { weightKg: '60', reps: '8' });
  assert.equal(exerciseStatus(s.exercises[0]), 'done', 'warm-ups are optional');
  assert.equal(nextOpenIndex(s, 0), 1);
  assert.equal(showExercise(s, 1).currentIndex, 1);
  assert.equal(showExercise(s, 9).currentIndex, 1, 'clamped');
  assert.equal(nextOpenIndex(skipExercise(s, 'e2'), 0), null);
});

test('Spring over: the exercise is skipped in this workout only, and can be undone', () => {
  const s = skipExercise(fresh(), 'e2');
  assert.equal(s.exercises[1].skipped, true);
  assert.equal(exerciseStatus(s.exercises[1]), 'skipped');
  assert.equal(completeSet(s, 'e2', 's1', { reps: '5' }, T0).session, s, 'a skipped exercise logs nothing');
  assert.equal(unskipExercise(s, 'e2').exercises[1].skipped, undefined);
  assert.deepEqual(STORED_TEMPLATES[0].exercises.map(e => e.exerciseId), ['bench', 'pullup'], 'template untouched');
});

test('Alternativ: another exercise for this workout only; not after a set is logged; can be undone', () => {
  const template = deepFreeze(structuredClone(TEMPLATE));
  let s = startSession({ id: 'w', template, exercises: EXERCISES, date: '2026-10-04', nowMs: T0 });
  s = setDraft(s, 'e2', 's1', 'reps', '9');
  const plank = EXERCISES.find(e => e.id === 'plank');
  s = replaceExercise(s, 'e2', plank);
  assert.deepEqual([s.exercises[1].exerciseId, s.exercises[1].name, s.exercises[1].trackingType], ['plank', 'Planke', 'duration']);
  assert.deepEqual(s.exercises[1].replacedFrom, { exerciseId: 'pullup', name: 'Pull-ups' });
  assert.equal(s.exercises[1].sets[0].draft, undefined, 'drafts for the other exercise are dropped');
  assert.deepEqual(s.exercises[1].sets.map(set => set.id), ['s1', 's2'], 'the planned sets stay');
  // Back to the original: no replacedFrom.
  const back = replaceExercise(s, 'e2', EXERCISES.find(e => e.id === 'pullup'));
  assert.equal(back.exercises[1].replacedFrom, undefined);
  // Not after a set is logged.
  const logged = done(s, 'e2', 's1', { seconds: '0:45' });
  assert.equal(canReplace(logged.exercises[1]), false);
  assert.equal(replaceExercise(logged, 'e2', EXERCISES[0]).exercises[1].exerciseId, 'plank');
  assert.equal(template.exercises[1].exerciseId, 'pullup', 'template untouched');
});

// ── Rest ────────────────────────────────────────────────────────────────────

test('rest starts after a completed set, by the set type and the template\'s settings', () => {
  let s = done(fresh(), 'e1', 'w1', { weightKg: '40', reps: '10' }, T0);
  assert.deepEqual(s.timer, { endsAt: T0 + 60 * SEC, seconds: 60, setKey: 'e1/w1' });
  s = done(s, 'e1', 's1', { weightKg: '60', reps: '8' }, T0 + 70 * SEC);
  assert.deepEqual(s.timer, { endsAt: T0 + 250 * SEC, seconds: 180, setKey: 'e1/s1' }, 'one timer: the new set replaces it');
  const defaults = startSession({ id: 'd', template: { ...TEMPLATE, rest: undefined }, exercises: EXERCISES, date: '2026-10-04', nowMs: T0 });
  assert.deepEqual(defaults.rest, DEFAULT_REST);
  const noRest = startSession({ id: 'n', template: { ...TEMPLATE, rest: { warmup: 0, work: 0 } }, exercises: EXERCISES, date: '2026-10-04', nowMs: T0 });
  assert.equal(done(noRest, 'e1', 's1', { weightKg: '60', reps: '8' }).timer, null);
});

test('rest: time remaining, +30 sek, skip', () => {
  let s = done(fresh(), 'e1', 's1', { weightKg: '60', reps: '8' }, T0);
  assert.equal(restRemaining(s, T0), 180);
  assert.equal(restRemaining(s, T0 + 0.4 * SEC), 180, 'whole seconds, rounded up');
  assert.equal(restRemaining(s, T0 + 179.5 * SEC), 1);
  assert.equal(restRemaining(s, T0 + 200 * SEC), 0);
  s = extendRest(s, T0 + 100 * SEC);
  assert.equal(restRemaining(s, T0 + 100 * SEC), 110);
  const ended = extendRest(s, T0 + 400 * SEC);
  assert.equal(restRemaining(ended, T0 + 400 * SEC), 30, 'after the end: from now');
  assert.equal(skipRest(s).timer, null);
  assert.equal(restRemaining(fresh(), T0), 0);
});

test('rest is one stored deadline: leaving and returning never makes a second timer', () => {
  const clock = readFileSync(repoPath('../src/features/training/useRestClock.js'), 'utf8');
  assert.equal((clock.match(/setInterval\(/g) || []).length, 1, 'one interval');
  assert.match(clock, /clearInterval\(interval\)/, 'cleared on unmount');
  for (const file of sourceFiles(repoPath('../src/features/training'))) {
    if (file.endsWith('useRestClock.js')) continue;
    assert.ok(!/setInterval|setTimeout/.test(readFileSync(file, 'utf8')), `${file}: no other timers`);
  }
});

// ── Sidst ───────────────────────────────────────────────────────────────────

const HISTORY = [
  ...STORED_WORKOUT_SESSIONS,
  { id: 'h0', templateId: 'upper', name: 'Ældre', date: '2026-09-20', startedAt: 1789000000000, completedAt: 1789003000000, rest: DEFAULT_REST, exercises: [
    { id: 'e1', exerciseId: 'bench', name: 'Bænkpres', trackingType: 'weightReps', sets: [{ id: 's1', type: 'work', done: true, values: { weightKg: 55, reps: 8 } }] },
    { id: 'e2', exerciseId: 'pullup', name: 'Pull-ups', trackingType: 'bodyweightReps', sets: [{ id: 's1', type: 'work', done: true, values: { reps: 6 } }] },
  ] },
];

test('Sidst: the most recent completed workout with the exercise; sets matched by type and order', () => {
  const sidst = sidstForSession(fresh(), HISTORY);
  assert.deepEqual(sidst.get('e1/w1'), { weightKg: 40, reps: 10 }, 'warm-up 1 <- warm-up 1');
  assert.deepEqual(sidst.get('e1/s1'), { weightKg: 60, reps: 8 }, 'newest workout, not the older 55 kg');
  assert.deepEqual(sidst.get('e1/s2'), { weightKg: 60, reps: 7 });
  // Pull-ups were skipped last time: the workout before that counts.
  assert.deepEqual(sidst.get('e2/s1'), { reps: 6 });
  assert.equal(sidst.get('e2/s2'), undefined, 'no 2nd work set then: no Sidst');
});

test('Sidst: no history, another exercise, another tracking type, or the workout itself: nothing', () => {
  assert.equal(sidstForSession(fresh(), []).size, 0);
  assert.equal(lastPerformance(HISTORY, 'plank', 'duration'), null);
  assert.equal(lastPerformance(HISTORY, 'bench', 'bodyweightReps'), null);
  const self = { ...HISTORY[0], id: 'w' };
  assert.equal(lastPerformance([self], 'bench', 'weightReps', 'w'), null);
  // Matching is deterministic: undone sets of the old workout are skipped over.
  const gap = [{ ...HISTORY[0], exercises: [{ ...HISTORY[0].exercises[0], sets: [
    { id: 's1', type: 'work' }, { id: 's2', type: 'work', done: true, values: { weightKg: 70, reps: 5 } },
  ] }] }];
  assert.deepEqual(sidstForSession(fresh(), gap).get('e1/s1'), { weightKg: 70, reps: 5 });
});

test('the fields show what was typed, else the target, else Sidst', () => {
  const s = fresh();
  const work = s.exercises[0].sets[1]; // target 8 × 62,5
  assert.deepEqual(fieldTexts(s.exercises[0], work, { weightKg: 60, reps: 7 }), { weightKg: '62,5', reps: '8' });
  const warm = s.exercises[0].sets[0]; // no target
  assert.deepEqual(fieldTexts(s.exercises[0], warm, { weightKg: 40, reps: 10 }), { weightKg: '40', reps: '10' });
  assert.deepEqual(fieldTexts(s.exercises[0], warm, undefined), { weightKg: '', reps: '' });
  assert.deepEqual(fieldTexts(s.exercises[0], { ...work, draft: { weightKg: '65', reps: '' } }, undefined), { weightKg: '65', reps: '' }, 'an emptied field stays empty');
});

// ── Finishing and history ───────────────────────────────────────────────────

test('summary: done, skipped and sets are counted once each', () => {
  let s = fresh();
  s = done(s, 'e1', 's1', { weightKg: '60', reps: '8' });
  s = done(s, 'e2', 's1', { reps: '6' });
  s = skipExercise(s, 'e2'); // skipped after one set: skipped, its set still counts as a set
  assert.deepEqual(sessionSummary(s, T0 + 45 * 60 * SEC), { exercisesDone: 1, exercisesSkipped: 1, exercisesTotal: 2, setsDone: 2, durationMs: 45 * 60 * SEC });
});

test('finishing: completedAt, no timer, drafts or screen position; open sets stay as not done', () => {
  let s = setDraft(done(fresh(), 'e1', 's1', { weightKg: '60', reps: '8' }), 'e1', 's2', 'reps', '5');
  s = finishSession(s, T0 + 3600 * SEC);
  assert.equal(s.completedAt, T0 + 3600 * SEC);
  assert.ok(!('timer' in s) && !('currentIndex' in s));
  assert.ok(s.exercises.every(e => e.sets.every(set => !('draft' in set))));
  assert.equal(s.exercises[0].sets[2].done, undefined);
  assert.equal(durationMinutes(sessionSummary(s).durationMs), 60);
});

test('history: newest first, damaged entries left out; template changes never alter it', () => {
  const list = historyList([...HISTORY, null, { id: 'x' }]);
  assert.deepEqual(list.map(s => s.id), ['h1', 'h0']);
  const frozen = deepFreeze(structuredClone(STORED_WORKOUT_SESSIONS));
  const templates = updateTemplate(STORED_TEMPLATES, 'upper', { name: 'Ændret', exercises: [] });
  assert.equal(templates[0].name, 'Ændret');
  assert.deepEqual(frozen, STORED_WORKOUT_SESSIONS);
  assert.equal(setNumber(frozen[0].exercises[0], frozen[0].exercises[0].sets[2]), 2);
});

// ── The workout in progress, across stores and restarts ─────────────────────

function trainingStores(values = {}, adapter = createMemoryAdapter(rawStore(values))) {
  const logger = quietLogger();
  const storage = createStorage(adapter, { logger });
  const make = (key) => createPersistedListStore({ storage, key, seed: [], logger });
  const stores = { exercisesStore: make(KEYS.exercises), activeStore: make(KEYS.activeWorkout), historyStore: make(KEYS.workoutSessions) };
  let n = 0;
  const actions = createWorkoutActions({ ...stores, newId: () => `id${++n}` });
  const hydrate = () => Promise.all(Object.values(stores).map(store => store.getState().hydrate()));
  return { adapter, stores, actions, hydrate };
}
const flushAll = (stores) => Promise.all(Object.values(stores).map(store => store.getState().flush()));

test('start: one workout in progress at a time; starting again returns it', async () => {
  const { actions, stores, hydrate, adapter } = trainingStores({ [KEYS.exercises]: EXERCISES });
  await hydrate();
  const first = actions.start(TEMPLATE, { date: '2026-10-04', nowMs: T0 });
  const second = actions.start({ ...TEMPLATE, id: 'other', name: 'Andet' }, { date: '2026-10-04', nowMs: T0 + SEC });
  assert.equal(second, first);
  await flushAll(stores);
  assert.equal(parsed(adapter, KEYS.activeWorkout).length, 1);
});

test('the workout in progress survives a restart: sets, typed values, exercise and rest', async () => {
  const app = trainingStores({ [KEYS.exercises]: EXERCISES });
  await app.hydrate();
  app.actions.start(TEMPLATE, { date: '2026-10-04', nowMs: T0 });
  app.actions.update(s => completeSet(s, 'e1', 's1', { weightKg: '62,5', reps: '8' }, T0).session);
  app.actions.update(s => setDraft(s, 'e1', 's2', 'weightKg', '65'));
  app.actions.update(s => showExercise(s, 1));
  await flushAll(app.stores);
  // "Restart": new stores over the same storage.
  const reread = trainingStores({}, app.adapter);
  assert.equal(reread.actions.current(), null, 'nothing before hydration');
  await reread.hydrate();
  const s = reread.actions.current();
  assert.equal(s.currentIndex, 1);
  assert.deepEqual(s.exercises[0].sets[1].values, { weightKg: 62.5, reps: 8 });
  assert.deepEqual(s.exercises[0].sets[2].draft, { weightKg: '65' });
  assert.equal(s.timer.endsAt, T0 + 180 * SEC, 'the same single deadline');
});

test('finish: history first, then the workout in progress is cleared; the template is untouched', async () => {
  const { actions, stores, hydrate, adapter } = trainingStores({ [KEYS.exercises]: EXERCISES, [KEYS.workoutSessions]: STORED_WORKOUT_SESSIONS });
  await hydrate();
  const template = deepFreeze(structuredClone(TEMPLATE));
  actions.start(template, { date: '2026-10-04', nowMs: T0 });
  actions.update(s => completeSet(s, 'e1', 's1', { weightKg: '62,5', reps: '8' }, T0).session);
  const result = await actions.finish(T0 + 3600 * SEC);
  assert.ok(result.session);
  await flushAll(stores);
  const history = parsed(adapter, KEYS.workoutSessions);
  assert.deepEqual(history.map(s => s.id), ['h1', 'id1']);
  assert.equal(history[1].completedAt, T0 + 3600 * SEC);
  assert.deepEqual(parsed(adapter, KEYS.activeWorkout), []);
  assert.equal(actions.current(), null);
  assert.deepEqual((await actions.finish(T0)).error, 'training.finish.none');
});

test('an interrupted finish (already in history) is not shown as in progress again', () => {
  const active = STORED_ACTIVE_WORKOUT;
  assert.equal(pickActive(active, []).id, 'a1');
  assert.equal(pickActive(active, [{ ...active[0], completedAt: T0 }]), null);
  assert.equal(pickActive([null, { id: 'bad' }], []), null, 'damaged entries');
  const older = { ...active[0], id: 'old', startedAt: 1 };
  assert.equal(pickActive([older, active[0]], []).id, 'a1', 'several (damaged data): the latest');
});

test('finish never loses the workout: unreadable history or a failed save keeps it in progress', async () => {
  // History could not be read at boot.
  const blocked = trainingStores({ [KEYS.exercises]: EXERCISES, [KEYS.workoutSessions]: STORED_WORKOUT_SESSIONS });
  failReadsOf(blocked.adapter, KEYS.workoutSessions);
  await blocked.hydrate();
  blocked.actions.start(TEMPLATE, { date: '2026-10-04', nowMs: T0 });
  assert.deepEqual(await blocked.actions.finish(T0 + SEC), { error: 'training.finish.blocked' });
  assert.ok(blocked.actions.current(), 'still in progress');
  // The history save fails.
  const failing = trainingStores({ [KEYS.exercises]: EXERCISES });
  await failing.hydrate();
  failing.actions.start(TEMPLATE, { date: '2026-10-04', nowMs: T0 });
  await flushAll(failing.stores);
  failWritesOf(failing.adapter, `lifeos_${KEYS.workoutSessions}`);
  assert.deepEqual(await failing.actions.finish(T0 + SEC), { error: 'training.finish.blocked' });
  assert.equal(parsed(failing.adapter, KEYS.activeWorkout).length, 1, 'kept on disk');
});

test('discard drops the workout in progress and never touches history', async () => {
  const { actions, stores, hydrate, adapter } = trainingStores({ [KEYS.exercises]: EXERCISES, [KEYS.workoutSessions]: STORED_WORKOUT_SESSIONS });
  await hydrate();
  actions.start(TEMPLATE, { date: '2026-10-04', nowMs: T0 });
  actions.discard();
  await flushAll(stores);
  assert.deepEqual(parsed(adapter, KEYS.activeWorkout), []);
  assert.deepEqual(parsed(adapter, KEYS.workoutSessions), STORED_WORKOUT_SESSIONS);
});

// ── Boundaries ──────────────────────────────────────────────────────────────

test('no side effects on other domains: Training never imports tasks, routines, the calendar or schedule views', () => {
  for (const file of sourceFiles(repoPath('../src/features/training'))) {
    const src = readFileSync(file, 'utf8');
    for (const [, from] of src.matchAll(/from '([^']+)'/g)) {
      assert.ok(!/features\/(tasks|routines|calendar|schedule|timewheel|plan|today)|\.\.\/(tasks|routines|calendar|schedule|timewheel|plan|today)\//.test(from), `${file}: ${from}`);
    }
  }
});

test('the library and templates start empty: no demo exercises or plans', () => {
  const store = readFileSync(repoPath('../src/features/training/store.js'), 'utf8');
  assert.equal((store.match(/seed: \[\]/g) || []).length, 4);
});

test('every Danish label built from a value exists (categories, tracking, muscles, equipment, states, fields)', async () => {
  const { da } = await import('../src/core/i18n/da.js');
  const { CATEGORIES, TRACKING_TYPES, MUSCLE_GROUPS, EQUIPMENT } = await import('../src/features/training/exercises.js');
  const keys = [
    ...CATEGORIES.map(c => `training.category.${c}`), ...TRACKING_TYPES.map(c => `training.tracking.${c}`),
    ...MUSCLE_GROUPS.map(c => `training.muscle.${c}`), ...EQUIPMENT.map(c => `training.equipment.${c}`),
    ...['done', 'skipped', 'started', 'open'].map(s => `training.status.${s}`), ...['warmup', 'work'].map(s => `training.rest.${s}`),
    ...['weightKg', 'reps', 'seconds', 'distanceKm'].flatMap(f => [`training.invalid.${f}`, `training.a11y.${f}`]),
  ];
  assert.deepEqual(keys.filter(k => !(k in da)), []);
});
