// src/features/training/components/WorkoutDetailSheet.js
//
// A finished workout, read-only: every exercise as it was done (its own
// copy: a later rename or template change does not show here), what
// replaced what, what was skipped, and each set's logged values (sets not
// done say "ikke lavet").
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { GlassSheet } from '../../../components/GlassSheet';
import { t, formatDateLong } from '../../../core/i18n';
import { localDateKey } from '../../../core/time/dates';
import { formatSetValues, describeSetValues, setTypeLabel } from '../sets';
import { setNumber } from '../session';
import { describeWorkout } from './HistoryRow';
import { sheetStyles } from './sheetStyles';

export function WorkoutDetailSheet({ session, onClose }) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheetStyles.wrapper}>
        <TouchableOpacity
          style={sheetStyles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('training.history.close')}
        />
        <GlassSheet>
          <Text style={sheetStyles.title} accessibilityRole="header">{session.name}</Text>
          <Text style={styles.subline}>{formatDateLong(session.date, localDateKey(new Date()))} · {describeWorkout(session)}</Text>
          <ScrollView style={styles.list}>
            {session.exercises.map(entry => (
              <View key={entry.id} style={styles.exercise}>
                <Text style={styles.name} accessibilityRole="header">{entry.name}</Text>
                {entry.replacedFrom ? <Text style={styles.note}>{t('training.exercise.replacedFrom', { name: entry.replacedFrom.name })}</Text> : null}
                {entry.skipped ? <Text style={styles.note}>⏭ {t('training.exercise.skipped')}</Text> : null}
                {entry.sets.map(set => {
                  const label = `${set.type === 'warmup' ? t('training.setType.warmupShort') : ''} ${setNumber(entry, set)}`.trim();
                  const value = set.done ? formatSetValues(entry.trackingType, set.values) : t('training.history.notDone');
                  return (
                    <View
                      key={set.id}
                      style={styles.set}
                      accessible
                      accessibilityLabel={`${setTypeLabel(set.type)} ${setNumber(entry, set)}, ${set.done ? describeSetValues(entry.trackingType, set.values) : value}`}
                    >
                      <Text style={styles.setLabel}>{label}</Text>
                      <Text style={[styles.setValue, !set.done && styles.notDone]}>{set.done ? `✓ ${value}` : value}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <View style={sheetStyles.buttons}>
            <View />
            <TouchableOpacity onPress={onClose} style={sheetStyles.primaryBtn} accessibilityRole="button">
              <Text style={sheetStyles.primaryText}>{t('training.history.close')}</Text>
            </TouchableOpacity>
          </View>
        </GlassSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  subline:  { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: -8, marginBottom: 12 },
  list:     { maxHeight: 460 },
  exercise: { marginBottom: 16 },
  name:     { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  note:     { fontSize: 14, color: COLORS.textMuted, marginBottom: 4 },
  set:      { flexDirection: 'row', alignItems: 'center', minHeight: 36, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  setLabel: { width: 64, fontSize: 14, color: COLORS.textMuted },
  setValue: { flex: 1, fontSize: 16, color: COLORS.text, fontVariant: ['tabular-nums'] },
  notDone:  { color: COLORS.textMuted },
});
