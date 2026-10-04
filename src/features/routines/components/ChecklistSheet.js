// src/features/routines/components/ChecklistSheet.js
//
// One routine on one date: its steps as a checklist. Ticking a step only
// changes that day's log entry (never the routine itself). Opened through
// useRoutineChecklist, so I dag, Tidshjul, Plan and Rutiner share it.
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { GlassSheet } from '../../../components/GlassSheet';
import { CheckButton } from '../../../components/CheckButton';
import { ProgressBar } from '../../../components/ProgressBar';
import { t, formatDateLong } from '../../../core/i18n';
import { endTime } from '../../tasks/schedule';
import { describeRoutineProgress } from '../../tasks/items';

export function ChecklistSheet({ occurrence, onToggle, onEdit, onClose }) {
  const end = endTime(occurrence);
  const time = occurrence.startTime ? (end ? `${occurrence.startTime}–${end}` : occurrence.startTime) : null;
  const pct = occurrence.stepCount ? (occurrence.doneCount / occurrence.stepCount) * 100 : 0;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.wrapper}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('routine.checklist.done')}
        />
        <GlassSheet>
          <Text style={styles.title} accessibilityRole="header">{occurrence.title}</Text>
          <Text style={styles.subline}>{[formatDateLong(occurrence.date), time].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.progress} accessibilityLiveRegion="polite">{describeRoutineProgress(occurrence)}</Text>
          <ProgressBar pct={pct} color={COLORS.green} />

          <ScrollView style={styles.steps}>
            {occurrence.steps.map(step => (
              <View key={step.id} style={styles.step}>
                <Text style={[styles.stepText, step.done && styles.stepDone]}>{step.text}</Text>
                <CheckButton checked={step.done} onPress={() => onToggle(step.id)} label={step.text} />
              </View>
            ))}
          </ScrollView>

          <View style={styles.buttons}>
            {onEdit ? (
              <TouchableOpacity onPress={onEdit} style={styles.secondaryBtn} accessibilityRole="button">
                <Text style={styles.secondaryText}>{t('routine.checklist.edit')}</Text>
              </TouchableOpacity>
            ) : <View />}
            <TouchableOpacity onPress={onClose} style={styles.primaryBtn} accessibilityRole="button">
              <Text style={styles.primaryText}>{t('routine.checklist.done')}</Text>
            </TouchableOpacity>
          </View>
        </GlassSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  title:    { fontSize: 22, fontWeight: '700', color: COLORS.text },
  subline:  { fontSize: 15, color: COLORS.textMuted, marginTop: 4 },
  progress: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 14, marginBottom: 8 },
  steps:    { marginTop: 12, maxHeight: 420 },
  step: {
    flexDirection: 'row', alignItems: 'center', minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  stepText: { flex: 1, fontSize: 17, color: COLORS.text, paddingRight: 8 },
  stepDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  buttons:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  secondaryBtn:  { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  secondaryText: { fontSize: 16, color: COLORS.text, textDecorationLine: 'underline' },
  primaryBtn:    { minHeight: 48, justifyContent: 'center', backgroundColor: COLORS.accentDim, paddingHorizontal: 28, borderRadius: 12 },
  primaryText:   { fontSize: 16, color: COLORS.text, fontWeight: '700' },
});
