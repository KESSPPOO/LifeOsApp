// src/features/training/components/ExerciseInfoSheet.js
//
// Forklaring: what the library knows about an exercise (category, what is
// logged, muscles, equipment) and the user's own written explanation, if
// any. Nothing is generated or invented here. Opened from Øvelser and from
// an exercise during a workout. `exercise` may be missing (no longer in
// the library); `name` is then the workout's copy.
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { GlassSheet } from '../../../components/GlassSheet';
import { t } from '../../../core/i18n';
import { categoryLabel, trackingLabel, muscleLabel, equipmentLabel } from '../exercises';
import { sheetStyles } from './sheetStyles';

export function ExerciseInfoSheet({ exercise, name, onEdit, onClose }) {
  const rows = exercise ? [
    [t('training.exerciseForm.category'), categoryLabel(exercise.category)],
    [t('training.exerciseInfo.tracking'), trackingLabel(exercise.trackingType)],
    [t('training.exerciseInfo.muscles'), (exercise.muscleGroups ?? []).map(muscleLabel).join(', ') || '–'],
    [t('training.exerciseInfo.equipment'), equipmentLabel(exercise.equipment)],
  ] : [];
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
          <Text style={sheetStyles.title} accessibilityRole="header">{exercise?.name ?? name}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {exercise ? rows.map(([label, value]) => (
              <View key={label} style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.value}>{value}</Text>
              </View>
            )) : <Text style={styles.body}>{t('training.exerciseInfo.notInLibrary')}</Text>}
            {exercise ? (
              <>
                <Text style={[sheetStyles.label, styles.section]} accessibilityRole="header">{t('training.exerciseInfo.instructions')}</Text>
                <Text style={styles.body}>{exercise.instructions || t('training.exerciseInfo.noInstructions')}</Text>
              </>
            ) : null}
            <View style={sheetStyles.buttons}>
              {exercise?.custom && onEdit ? (
                <TouchableOpacity onPress={onEdit} style={sheetStyles.secondaryBtn} accessibilityRole="button">
                  <Text style={sheetStyles.linkText}>{t('training.exerciseInfo.edit')}</Text>
                </TouchableOpacity>
              ) : <View />}
              <TouchableOpacity onPress={onClose} style={sheetStyles.primaryBtn} accessibilityRole="button">
                <Text style={sheetStyles.primaryText}>{t('training.history.close')}</Text>
              </TouchableOpacity>
            </View>
            <View style={sheetStyles.bottomSpace} />
          </ScrollView>
        </GlassSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  label:   { fontSize: 15, color: COLORS.textMuted, marginRight: 12 },
  value:   { flex: 1, fontSize: 16, color: COLORS.text, textAlign: 'right' },
  section: { marginTop: 16 },
  body:    { fontSize: 16, lineHeight: 23, color: COLORS.text, marginBottom: 8 },
});
