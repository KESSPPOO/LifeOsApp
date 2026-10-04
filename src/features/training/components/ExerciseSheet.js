// src/features/training/components/ExerciseSheet.js
//
// Create or edit one of the user's own exercises: name, category, what a
// set logs (tracking type), muscles, equipment and an optional own
// explanation. Same sheet structure as RoutineSheet (Modal ->
// KeyboardAvoidingView -> GlassSheet -> ScrollView with
// keyboardShouldPersistTaps="always") for the Android keyboard fixes.
// Validation: readExerciseForm in ../exercises.js. The parent remounts the
// sheet (key) for each opening.
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { COLORS } from '../../../config/colors';
import { GlassSheet } from '../../../components/GlassSheet';
import { Choice } from '../../../components/Choice';
import { t } from '../../../core/i18n';
import {
  CATEGORIES, TRACKING_TYPES, MUSCLE_GROUPS, EQUIPMENT,
  categoryLabel, trackingLabel, muscleLabel, equipmentLabel, readExerciseForm, toggleMuscle,
} from '../exercises';
import { sheetStyles } from './sheetStyles';

export function ExerciseSheet({ editing, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);
  const update = (patch) => { setForm(f => ({ ...f, ...patch })); setError(null); };

  const save = () => {
    const result = readExerciseForm(form);
    if (result.error) setError(result.error);
    else onSave(result.fields);
  };

  const chips = (values, label, selected, onPick, role) => values.map(value => (
    <Choice key={value} role={role} label={label(value)} selected={selected(value)} onPress={() => onPick(value)} />
  ));

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
          <Text style={sheetStyles.title} accessibilityRole="header">
            {t(editing ? 'training.exerciseForm.editTitle' : 'training.exerciseForm.newTitle')}
          </Text>
          <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
            <Text style={sheetStyles.label}>{t('training.exerciseForm.name')}</Text>
            <TextInput
              style={sheetStyles.input}
              placeholder={t('training.exerciseForm.namePlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={form.name}
              onChangeText={(name) => update({ name })}
              autoFocus={!editing}
              accessibilityLabel={t('training.exerciseForm.name')}
            />

            <Text style={sheetStyles.label}>{t('training.exerciseForm.category')}</Text>
            <View style={sheetStyles.choices}>
              {chips(CATEGORIES, categoryLabel, c => form.category === c, category => update({ category }))}
            </View>

            <Text style={sheetStyles.label}>{t('training.exerciseForm.tracking')}</Text>
            <View style={sheetStyles.choices}>
              {chips(TRACKING_TYPES, trackingLabel, type => form.trackingType === type, trackingType => update({ trackingType }))}
            </View>

            <Text style={sheetStyles.label}>{t('training.exerciseForm.muscles')}</Text>
            <View style={sheetStyles.choices}>
              {chips(MUSCLE_GROUPS, muscleLabel, m => form.muscleGroups.includes(m),
                m => update({ muscleGroups: toggleMuscle(form.muscleGroups, m) }), 'checkbox')}
            </View>

            <Text style={sheetStyles.label}>{t('training.exerciseForm.equipment')}</Text>
            <View style={sheetStyles.choices}>
              {chips(EQUIPMENT, equipmentLabel, e => form.equipment === e, equipment => update({ equipment }))}
            </View>

            <Text style={sheetStyles.label}>{t('training.exerciseForm.instructions')}</Text>
            <TextInput
              style={[sheetStyles.input, styles.multiline]}
              placeholder={t('training.exerciseForm.instructionsPlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={form.instructions}
              onChangeText={(instructions) => update({ instructions })}
              multiline
              accessibilityLabel={t('training.exerciseForm.instructions')}
            />

            {error ? <Text style={sheetStyles.error} accessibilityRole="alert">{t(error)}</Text> : null}

            <View style={sheetStyles.buttons}>
              <TouchableOpacity onPress={onClose} style={sheetStyles.secondaryBtn} accessibilityRole="button">
                <Text style={sheetStyles.cancelText}>{t('taskForm.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} style={sheetStyles.primaryBtn} accessibilityRole="button">
                <Text style={sheetStyles.primaryText}>{t(editing ? 'taskForm.save' : 'taskForm.create')}</Text>
              </TouchableOpacity>
            </View>
            <View style={sheetStyles.bottomSpace} />
          </ScrollView>
        </GlassSheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
