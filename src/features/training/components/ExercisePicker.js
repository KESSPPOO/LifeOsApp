// src/features/training/components/ExercisePicker.js
//
// Choose an exercise from the library (search by name), or create a new
// one on the spot (onCreate). Used to add an exercise to a template and
// for Alternativ during a workout. `excludeId`: the exercise being
// replaced (not offered).
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { GlassSheet } from '../../../components/GlassSheet';
import { t } from '../../../core/i18n';
import { filterExercises, categoryLabel } from '../exercises';
import { sheetStyles } from './sheetStyles';

export function ExercisePicker({ title, exercises, excludeId, onPick, onCreate, onClose }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(
    () => filterExercises(exercises, { query }).filter(exercise => exercise.id !== excludeId),
    [exercises, query, excludeId],
  );
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={sheetStyles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity
          style={sheetStyles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('taskForm.cancel')}
        />
        <GlassSheet>
          <Text style={sheetStyles.title} accessibilityRole="header">{title}</Text>
          <TextInput
            style={sheetStyles.input}
            placeholder={t('training.exercises.search')}
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
            accessibilityLabel={t('training.exercises.search')}
          />
          <ScrollView keyboardShouldPersistTaps="always" style={styles.list}>
            {shown.map(exercise => (
              <TouchableOpacity
                key={exercise.id}
                onPress={() => onPick(exercise)}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={`${exercise.name}, ${categoryLabel(exercise.category)}`}
                accessibilityHint={t('training.exercises.pickHint')}
              >
                <Text style={styles.name}>{exercise.name}</Text>
                <Text style={styles.meta}>{categoryLabel(exercise.category)}</Text>
              </TouchableOpacity>
            ))}
            {shown.length === 0 ? (
              <Text style={styles.empty}>{t(exercises.length === 0 ? 'training.exercises.empty.title' : 'training.exercises.noMatch')}</Text>
            ) : null}
          </ScrollView>
          <View style={sheetStyles.buttons}>
            <TouchableOpacity onPress={onClose} style={sheetStyles.secondaryBtn} accessibilityRole="button">
              <Text style={sheetStyles.cancelText}>{t('taskForm.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCreate} style={sheetStyles.primaryBtn} accessibilityRole="button">
              <Text style={sheetStyles.primaryText}>+ {t('training.exercises.new')}</Text>
            </TouchableOpacity>
          </View>
        </GlassSheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 380 },
  row: {
    minHeight: 56, justifyContent: 'center', paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  name:  { fontSize: 16, color: COLORS.text },
  meta:  { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  empty: { fontSize: 15, color: COLORS.textMuted, paddingVertical: 16 },
});
