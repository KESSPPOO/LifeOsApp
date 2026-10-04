// src/features/training/screens/WorkoutScreen.js
//
// The workout in progress, built for a phone in the gym: one exercise at a
// time (name large, "Øvelse 2 af 5", ‹ › between exercises), its sets as
// large rows (Sæt · Sidst · Kg · Reps · ✓), the rest countdown pinned to
// the bottom, and "Næste øvelse" as soon as the exercise's work sets are
// done (never automatic: a half-typed set is never left behind). Below:
// every exercise with its state (tap to jump), Afslut and Kassér.
//
// Everything is stored in the workout in progress (../workouts.js through
// ../store.js) as it happens: leaving the screen, switching tabs or
// restarting the app returns to the same exercise, sets, typed values and
// rest. Spring over and Alternativ change this workout only; the template
// is never touched. One default view for now: a future Simpel / Avanceret
// would be another view over the same session functions.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, AccessibilityInfo, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../../config/colors';
import { CustomAlert } from '../../../components/CustomAlert';
import { confirmDelete } from '../../../app/confirmDelete';
import { t, formatTimer } from '../../../core/i18n';
import { useActiveWorkout, useExercises, useWorkoutHistory, workouts } from '../store';
import { findExercise } from '../exercises';
import { describeSetValues, setTypeLabel } from '../sets';
import {
  setKey, setNumber, completeSet, undoSet, setDraft, skipExercise, unskipExercise, replaceExercise, canReplace,
  showExercise, exerciseStatus, nextOpenIndex, extendRest, skipRest, sessionSummary,
} from '../session';
import { sidstForSession } from '../history';
import { useExerciseEditor } from '../useExerciseEditor';
import { SetRow, SetHeader } from '../components/SetRow';
import { RestBar } from '../components/RestBar';
import { FinishSheet } from '../components/FinishSheet';
import { ExerciseInfoSheet } from '../components/ExerciseInfoSheet';
import { ExercisePicker } from '../components/ExercisePicker';

// Stable handlers for the memoised set rows: they act on the stored workout.
const draft = (entryId, setId, field, text) => workouts.update(s => setDraft(s, entryId, setId, field, text));
const undo = (entryId, setId) => workouts.update(s => undoSet(s, entryId, setId));

export default function WorkoutScreen() {
  const navigation = useNavigation();
  const session = useActiveWorkout();
  const exercises = useExercises();
  const history = useWorkoutHistory();
  // 'info' | 'alternative' | 'finish' | null
  const [sheet, setSheet] = useState(null);
  const [alertConfig, setAlertConfig] = useState(null);
  const closeAlert = () => setAlertConfig(null);
  const { openExerciseEditor, exerciseEditorElement } = useExerciseEditor();

  const sidst = useMemo(() => (session ? sidstForSession(session, history) : new Map()), [session, history]);

  const complete = useCallback((entryId, setId, texts) => {
    const current = workouts.current();
    if (!current) return null;
    const result = completeSet(current, entryId, setId, texts, Date.now());
    if (result.error) return result;
    workouts.update(() => result.session);
    // Say what was logged and how long the rest is (the countdown itself is not read out every second).
    const entry = result.session.exercises.find(e => e.id === entryId);
    const set = entry.sets.find(s => s.id === setId);
    const { timer } = result.session;
    AccessibilityInfo.announceForAccessibility([
      t('training.set.done', { type: setTypeLabel(set.type), n: setNumber(entry, set), values: describeSetValues(entry.trackingType, set.values) }),
      timer ? t('training.rest.started', { time: formatTimer(timer.seconds) }) : null,
    ].filter(Boolean).join(' '));
    return null;
  }, []);

  if (!session) {
    return (
      <View style={[styles.root, styles.scroll]}>
        <Text style={styles.emptyTitle}>{t('training.none.title')}</Text>
        <Text style={styles.quiet}>{t('training.none.body')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('training')} style={styles.outlineBtn} accessibilityRole="button">
          <Text style={styles.outlineText}>{t('training.none.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const index = Math.min(session.currentIndex ?? 0, Math.max(0, session.exercises.length - 1));
  const entry = session.exercises[index];
  const status = entry ? exerciseStatus(entry) : 'open';
  const nextIndex = nextOpenIndex(session, index);
  const show = (i) => workouts.update(s => showExercise(s, i));

  const skip = () => workouts.update(s => {
    const skipped = skipExercise(s, entry.id);
    const next = nextOpenIndex(skipped, index);
    return next === null ? skipped : showExercise(skipped, next);
  });

  const finish = async () => {
    setSheet(null);
    const result = await workouts.finish(Date.now());
    if (result.error) setAlertConfig({ title: t('training.finish'), message: t(result.error), buttons: [{ text: 'OK', style: 'cancel', onPress: closeAlert }] });
    else navigation.navigate('trainingHistory', { openId: result.session.id });
  };

  const askDiscard = () => setAlertConfig(confirmDelete({
    title: t('training.discardTitle'),
    message: t('training.discardMessage'),
    confirmText: t('training.discard'),
    onConfirm: () => { workouts.discard(); navigation.navigate('training'); },
    close: closeAlert,
  }));

  const replaceWith = (exercise) => { setSheet(null); workouts.update(s => replaceExercise(s, entry.id, exercise)); };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {entry ? (
          <>
            {/* ── The exercise ── */}
            <View style={styles.exerciseNav}>
              <NavButton icon="‹" label={t('training.exercise.prev')} disabled={index === 0} onPress={() => show(index - 1)} />
              <View style={styles.exerciseTitle}>
                <Text style={styles.position}>{t('training.exercise.position', { index: index + 1, total: session.exercises.length })}</Text>
                <Text style={styles.exerciseName} accessibilityRole="header">{entry.name}</Text>
                {entry.replacedFrom ? <Text style={styles.position}>{t('training.exercise.replacedFrom', { name: entry.replacedFrom.name })}</Text> : null}
                {entry.skipped ? <Text style={styles.skippedTag}>⏭ {t('training.exercise.skipped')}</Text> : null}
              </View>
              <NavButton icon="›" label={t('training.exercise.next')} disabled={index >= session.exercises.length - 1} onPress={() => show(index + 1)} />
            </View>

            <View style={styles.actions}>
              <Pill label={t('training.explain')} a11y={t('training.explainLabel', { name: entry.name })} onPress={() => setSheet('info')} />
              {!entry.skipped ? (
                <Pill
                  label={t('training.alternative')}
                  a11y={canReplace(entry) ? t('training.alternativeLabel', { name: entry.name }) : t('training.alternativeLocked')}
                  disabled={!canReplace(entry)}
                  onPress={() => setSheet('alternative')}
                />
              ) : null}
              {entry.skipped ? (
                <Pill label={t('training.unskip')} onPress={() => workouts.update(s => unskipExercise(s, entry.id))} />
              ) : (
                <Pill label={t('training.skip')} a11y={t('training.skipLabel', { name: entry.name })} onPress={skip} />
              )}
            </View>

            {/* ── Sets ── */}
            <SetHeader trackingType={entry.trackingType} />
            {entry.sets.map(set => {
              const last = sidst.get(setKey(entry, set));
              return (
                <SetRow
                  key={`${entry.exerciseId}/${set.id}/${set.done ? 1 : 0}`}
                  entryId={entry.id}
                  trackingType={entry.trackingType}
                  set={set}
                  number={setNumber(entry, set)}
                  sidst={last}
                  disabled={Boolean(entry.skipped)}
                  onComplete={complete}
                  onUndo={undo}
                  onDraft={draft}
                />
              );
            })}

            {status === 'done' ? (
              nextIndex !== null ? (
                <TouchableOpacity onPress={() => show(nextIndex)} style={styles.primaryBtn} accessibilityRole="button">
                  <Text style={styles.primaryText}>{t('training.nextExercise')} ›</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.allDone}>{t('training.allExercisesDone')}</Text>
              )
            ) : null}
          </>
        ) : null}

        {/* ── Every exercise ── */}
        <Text style={styles.section} accessibilityRole="header">{t('training.overview')}</Text>
        {session.exercises.map((other, i) => {
          const state = exerciseStatus(other);
          const work = other.sets.filter(s => s.type === 'work');
          const statusText = state === 'started'
            ? t('training.status.started', { done: other.sets.filter(s => s.done).length, total: other.sets.length })
            : t(`training.status.${state}`);
          return (
            <TouchableOpacity
              key={other.id}
              onPress={() => show(i)}
              style={[styles.overviewRow, i === index && styles.overviewCurrent]}
              accessibilityRole="button"
              accessibilityState={{ selected: i === index }}
              accessibilityLabel={t('training.overviewItem', { name: other.name, status: statusText })}
            >
              <Text style={styles.overviewMark}>{state === 'done' ? '✓' : state === 'skipped' ? '⏭' : `${i + 1}`}</Text>
              <Text style={[styles.overviewName, state === 'skipped' && styles.muted]}>{other.name}</Text>
              <Text style={styles.overviewStatus}>{state === 'open' ? t('training.setCount', { count: work.length }) : statusText}</Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity onPress={() => setSheet('finish')} style={[styles.primaryBtn, styles.finishBtn]} accessibilityRole="button">
          <Text style={styles.primaryText}>{t('training.finish')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={askDiscard} style={styles.discardBtn} accessibilityRole="button">
          <Text style={styles.discardText}>{t('training.discard')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {session.timer ? (
        <RestBar
          timer={session.timer}
          onExtend={() => workouts.update(s => extendRest(s, Date.now()))}
          onSkip={() => workouts.update(skipRest)}
        />
      ) : null}

      {sheet === 'info' && entry ? (
        <ExerciseInfoSheet
          exercise={findExercise(exercises, entry.exerciseId)}
          name={entry.name}
          onEdit={() => { setSheet(null); openExerciseEditor(findExercise(exercises, entry.exerciseId)); }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'alternative' && entry ? (
        <ExercisePicker
          title={t('training.alternative')}
          exercises={exercises}
          excludeId={entry.exerciseId}
          onPick={replaceWith}
          onCreate={() => { setSheet(null); openExerciseEditor(null, { onSaved: replaceWith }); }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'finish' ? (
        <FinishSheet summary={sessionSummary(session, Date.now())} onConfirm={finish} onClose={() => setSheet(null)} />
      ) : null}
      {exerciseEditorElement}
      <CustomAlert config={alertConfig} />
    </KeyboardAvoidingView>
  );
}

function NavButton({ icon, label, disabled, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.navBtn, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Text style={styles.navText}>{icon}</Text>
    </TouchableOpacity>
  );
}

function Pill({ label, a11y, disabled, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.pill, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Text style={styles.pillText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 },
  quiet:  { fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginTop: 6, marginBottom: 16 },
  muted:  { color: COLORS.textMuted },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },

  exerciseNav:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  navBtn:        { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  navText:       { fontSize: 30, lineHeight: 34, color: COLORS.text },
  disabled:      { opacity: 0.3 },
  exerciseTitle: { flex: 1, alignItems: 'center' },
  position:      { fontSize: 13, color: COLORS.textMuted },
  exerciseName:  { fontSize: 24, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginVertical: 2 },
  skippedTag:    { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 2 },

  actions: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 },
  pill: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, margin: 4,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2,
  },
  pillText: { fontSize: 15, fontWeight: '600', color: COLORS.text },

  primaryBtn: {
    minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 14,
    backgroundColor: COLORS.accentDim, marginTop: 12, paddingHorizontal: 20,
  },
  primaryText: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  allDone:     { fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center', marginTop: 14 },

  section: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 28, marginBottom: 6 },
  overviewRow: {
    flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  overviewCurrent: { backgroundColor: COLORS.bgElevated, borderRadius: 10 },
  overviewMark:    { width: 28, fontSize: 16, fontWeight: '700', color: COLORS.text },
  overviewName:    { flex: 1, fontSize: 16, color: COLORS.text },
  overviewStatus:  { fontSize: 14, color: COLORS.textMuted },

  finishBtn: { marginTop: 24 },
  discardBtn: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  discardText: { fontSize: 15, color: COLORS.red, fontWeight: '600' },

  outlineBtn: {
    alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2,
  },
  outlineText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
});
