// src/features/training/screens/TrainingScreen.js
//
// Træning: start or continue today's training first; then the workout
// templates, the latest finished workouts and the exercise library. Calm
// on purpose: no statistics here. Nothing is created without the user (no
// demo exercises or plans), and nothing here touches tasks, the calendar
// or Tidshjul (ADR-010).
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../../config/colors';
import { LinkRow } from '../../../components/LinkRow';
import { t, formatTimer } from '../../../core/i18n';
import { localDateKey } from '../../../core/time/dates';
import { useActiveWorkout, useExercises, useTemplates, useWorkoutHistory, workouts } from '../store';
import { describeTemplate } from '../templates';
import { restRemaining, sessionSummary } from '../session';
import { historyList } from '../history';
import { useRestClock } from '../useRestClock';
import { HistoryRow } from '../components/HistoryRow';

const RECENT_SHOWN = 3;

export default function TrainingScreen() {
  const navigation = useNavigation();
  const active = useActiveWorkout();
  const templates = useTemplates();
  const exercises = useExercises();
  const history = useWorkoutHistory();
  const recent = historyList(history).slice(0, RECENT_SHOWN);

  const start = (template) => {
    const now = new Date();
    workouts.start(template, { date: localDateKey(now), nowMs: now.getTime() });
    navigation.navigate('workout');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {/* ── Today: continue, or start ── */}
      {active ? <ActiveCard session={active} onContinue={() => navigation.navigate('workout')} /> : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.section} accessibilityRole="header">{t(active ? 'training.templates' : 'training.start')}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('workoutTemplate', { id: null })}
          style={styles.smallBtn}
          accessibilityRole="button"
        >
          <Text style={styles.smallBtnText}>+ {t('training.newTemplate')}</Text>
        </TouchableOpacity>
      </View>
      {active ? <Text style={styles.quiet}>{t('training.oneAtATime')}</Text> : null}
      {templates.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('training.noTemplates.title')}</Text>
          <Text style={styles.quiet}>{t('training.noTemplates.body')}</Text>
        </View>
      ) : templates.map(template => (
        <View key={template.id} style={styles.templateRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('workoutTemplate', { id: template.id })}
            style={styles.templateText}
            accessibilityRole="button"
            accessibilityLabel={`${template.name}, ${describeTemplate(template)}`}
            accessibilityHint={t('training.editTemplateLabel', { name: template.name })}
          >
            <Text style={styles.templateName}>{template.name}</Text>
            <Text style={styles.meta}>{describeTemplate(template)}</Text>
          </TouchableOpacity>
          {active ? null : (
            <TouchableOpacity
              onPress={() => start(template)}
              style={styles.startBtn}
              accessibilityRole="button"
              accessibilityLabel={t('training.startLabel', { name: template.name })}
            >
              <Text style={styles.startText}>{t('training.start')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* ── Latest finished workouts ── */}
      <Text style={[styles.section, styles.spaced]} accessibilityRole="header">{t('training.recent')}</Text>
      {recent.length === 0 ? <Text style={styles.quiet}>{t('training.noHistory')}</Text> : recent.map(session => (
        <HistoryRow key={session.id} session={session} onPress={() => navigation.navigate('trainingHistory', { openId: session.id })} />
      ))}
      {recent.length > 0 ? (
        <LinkRow label={t('training.allHistory')} onPress={() => navigation.navigate('trainingHistory', { openId: null })} />
      ) : null}

      {/* ── The library ── */}
      <View style={styles.spaced}>
        <LinkRow
          icon="📖"
          label={t('training.library')}
          meta={exercises.length ? t('training.libraryMeta', { count: exercises.length }) : t('training.libraryEmptyMeta')}
          onPress={() => navigation.navigate('exercises')}
        />
      </View>
    </ScrollView>
  );
}

/** The workout in progress: where it stands, any rest left, and Fortsæt træning. */
function ActiveCard({ session, onContinue }) {
  const now = useRestClock(session.timer?.endsAt ?? null);
  const rest = restRemaining(session, now);
  const summary = sessionSummary(session, now);
  const meta = t('training.inProgressMeta', {
    index: Math.min((session.currentIndex ?? 0) + 1, session.exercises.length),
    total: session.exercises.length,
    sets: t('training.summary.sets', { count: summary.setsDone }),
  });
  return (
    <View style={styles.activeCard}>
      <Text style={styles.activeLabel}>{t('training.inProgress')}</Text>
      <Text style={styles.activeName} accessibilityRole="header">{session.name}</Text>
      <Text style={styles.meta}>{meta}</Text>
      {rest > 0 ? <Text style={styles.rest}>{t('training.rest.remaining', { time: formatTimer(rest) })}</Text> : null}
      <TouchableOpacity onPress={onContinue} style={styles.continueBtn} accessibilityRole="button">
        <Text style={styles.continueText}>{t('training.continue')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  quiet:  { fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginBottom: 8 },
  meta:   { fontSize: 14, color: COLORS.textMuted, marginTop: 3 },
  spaced: { marginTop: 28 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  section:       { fontSize: 18, fontWeight: '700', color: COLORS.text },
  smallBtn: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 14,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2,
  },
  smallBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.text },

  empty:      { paddingVertical: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginBottom: 4 },

  templateRow: {
    flexDirection: 'row', alignItems: 'center', minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  templateText: { flex: 1, paddingVertical: 10, paddingRight: 8 },
  templateName: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  startBtn: {
    minHeight: 48, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 24, backgroundColor: COLORS.accentDim,
  },
  startText: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  activeCard: {
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border2, borderRadius: 18,
    padding: 18, marginBottom: 24,
  },
  activeLabel:  { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },
  activeName:   { fontSize: 22, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  rest:         { fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 8, fontVariant: ['tabular-nums'] },
  continueBtn:  { minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: COLORS.accentDim, marginTop: 14 },
  continueText: { fontSize: 17, fontWeight: '700', color: COLORS.text },
});
