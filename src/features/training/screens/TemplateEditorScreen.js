// src/features/training/screens/TemplateEditorScreen.js
//
// Create or edit a workout template (route param id; none = new): name,
// exercises in order (add from the library or create one on the spot,
// move up / down, remove), per exercise the number of warm-up and work
// sets and optional targets for the work sets, and the rest after each
// kind of set. Saving changes the template only: workouts already started
// or finished keep their own copy (ADR-010). Validation: readTemplateForm
// in ../templates.js.
import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../../../config/colors';
import { Choice } from '../../../components/Choice';
import { CustomAlert } from '../../../components/CustomAlert';
import { confirmDelete } from '../../../app/confirmDelete';
import { t, formatTimer } from '../../../core/i18n';
import { newId } from '../../../core/id';
import { useExercises, useTemplates, useSetTemplates } from '../store';
import { findExercise, trackingOf, TRACKING } from '../exercises';
import {
  REST_CHOICES, formFromTemplate, addFormExercise, removeFormExercise, moveFormExercise, updateFormExercise,
  readTemplateForm, addTemplate, updateTemplate, deleteTemplate,
} from '../templates';
import { useExerciseEditor } from '../useExerciseEditor';
import { ExercisePicker } from '../components/ExercisePicker';
import { sheetStyles } from '../components/sheetStyles';

export default function TemplateEditorScreen() {
  const navigation = useNavigation();
  const editId = useRoute().params?.id ?? null;
  const exercises = useExercises();
  const templates = useTemplates();
  const setTemplates = useSetTemplates();
  const existing = editId ? templates.find(template => template.id === editId) : null;

  const [form, setForm] = useState(() => formFromTemplate(existing));
  const [error, setError] = useState(null);
  const [picking, setPicking] = useState(false);
  const [alertConfig, setAlertConfig] = useState(null);
  const { openExerciseEditor, exerciseEditorElement } = useExerciseEditor();
  const update = (fn) => { setForm(fn); setError(null); };

  const leave = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('training'));
  const addExercise = (exercise) => update(f => addFormExercise(f, newId(), exercise.id));

  const save = () => {
    const result = readTemplateForm(form);
    if (result.error) { setError(result.error); return; }
    setTemplates(prev => (editId && existing ? updateTemplate(prev, editId, result.fields) : addTemplate(prev, newId(), result.fields)));
    leave();
  };

  const askDelete = () => setAlertConfig(confirmDelete({
    message: t('training.templateForm.deleteMessage', { name: existing.name }),
    onConfirm: () => { setTemplates(prev => deleteTemplate(prev, editId)); leave(); },
    close: () => setAlertConfig(null),
  }));

  if (editId && !existing) {
    return (
      <View style={styles.root}>
        <Text style={[styles.quiet, styles.scroll]}>{t('training.templateForm.notFound')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">
        <Text style={sheetStyles.label}>{t('training.templateForm.name')}</Text>
        <TextInput
          style={sheetStyles.input}
          placeholder={t('training.templateForm.namePlaceholder')}
          placeholderTextColor={COLORS.textMuted}
          value={form.name}
          onChangeText={(name) => update(f => ({ ...f, name }))}
          autoFocus={!editId}
          accessibilityLabel={t('training.templateForm.name')}
        />

        <Text style={styles.section} accessibilityRole="header">{t('training.templateForm.exercises')}</Text>
        {form.exercises.length === 0 ? <Text style={styles.quiet}>{t('training.templateForm.noExercises')}</Text> : null}
        {form.exercises.map((entry, index) => {
          const exercise = findExercise(exercises, entry.exerciseId);
          const name = exercise?.name ?? t('training.unknownExercise');
          const tracking = trackingOf(exercise);
          const change = (patch) => update(f => updateFormExercise(f, entry.id, patch));
          return (
            <View key={entry.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{index + 1}. {name}</Text>
                <IconButton icon="↑" label={t('training.templateForm.moveUp', { name })} disabled={index === 0}
                  onPress={() => update(f => moveFormExercise(f, index, -1))} />
                <IconButton icon="↓" label={t('training.templateForm.moveDown', { name })} disabled={index === form.exercises.length - 1}
                  onPress={() => update(f => moveFormExercise(f, index, 1))} />
                <IconButton icon="✕" label={t('training.templateForm.remove', { name })}
                  onPress={() => update(f => removeFormExercise(f, entry.id))} />
              </View>
              <Stepper label={t('training.templateForm.warmupSets')} value={entry.warmupSets} min={0}
                onChange={(warmupSets) => change({ warmupSets })} />
              <Stepper label={t('training.templateForm.workSets')} value={entry.workSets} min={1}
                onChange={(workSets) => change({ workSets })} />
              {tracking === TRACKING.WEIGHT_REPS || tracking === TRACKING.BODYWEIGHT_REPS ? (
                <View style={styles.targets}>
                  <TargetInput label={t('training.templateForm.targetReps')} value={entry.targetRepsText} keyboard="number-pad"
                    onChange={(targetRepsText) => change({ targetRepsText })} />
                  {tracking === TRACKING.WEIGHT_REPS ? (
                    <TargetInput label={t('training.templateForm.targetKg')} value={entry.targetWeightText} keyboard="decimal-pad"
                      onChange={(targetWeightText) => change({ targetWeightText })} />
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
        <TouchableOpacity onPress={() => setPicking(true)} style={styles.addBtn} accessibilityRole="button">
          <Text style={styles.addText}>+ {t('training.templateForm.addExercise')}</Text>
        </TouchableOpacity>

        {['warmup', 'work'].map(type => (
          <View key={type}>
            <Text style={sheetStyles.label}>{t(`training.rest.${type}`)}</Text>
            <View style={sheetStyles.choices}>
              {REST_CHOICES.map(seconds => (
                <Choice key={seconds} label={formatTimer(seconds)} selected={form.rest[type] === seconds}
                  onPress={() => update(f => ({ ...f, rest: { ...f.rest, [type]: seconds } }))} />
              ))}
            </View>
          </View>
        ))}

        {error ? <Text style={sheetStyles.error} accessibilityRole="alert">{t(error)}</Text> : null}
        <View style={sheetStyles.buttons}>
          {existing ? (
            <TouchableOpacity onPress={askDelete} style={sheetStyles.secondaryBtn} accessibilityRole="button">
              <Text style={sheetStyles.deleteText}>{t('training.templateForm.delete')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={leave} style={sheetStyles.secondaryBtn} accessibilityRole="button">
              <Text style={sheetStyles.cancelText}>{t('taskForm.cancel')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={save} style={sheetStyles.primaryBtn} accessibilityRole="button">
            <Text style={sheetStyles.primaryText}>{t('training.templateForm.save')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {picking ? (
        <ExercisePicker
          title={t('training.exercises.pick')}
          exercises={exercises}
          onPick={(exercise) => { setPicking(false); addExercise(exercise); }}
          onCreate={() => { setPicking(false); openExerciseEditor(null, { onSaved: addExercise }); }}
          onClose={() => setPicking(false)}
        />
      ) : null}
      {exerciseEditorElement}
      <CustomAlert config={alertConfig} />
    </KeyboardAvoidingView>
  );
}

function IconButton({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.iconBtn, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Text style={styles.iconText}>{icon}</Text>
    </TouchableOpacity>
  );
}

/** "Arbejdssæt  − 3 +", read as an adjustable value. */
function Stepper({ label, value, min, onChange }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <IconButton icon="−" label={t('training.templateForm.fewer', { what: label.toLowerCase() })} disabled={value <= min}
        onPress={() => onChange(value - 1)} />
      <Text style={styles.stepperValue} accessibilityLabel={`${label}: ${value}`}>{value}</Text>
      <IconButton icon="+" label={t('training.templateForm.more', { what: label.toLowerCase() })}
        onPress={() => onChange(value + 1)} />
    </View>
  );
}

function TargetInput({ label, value, keyboard, onChange }) {
  return (
    <View style={styles.target}>
      <Text style={styles.targetLabel}>{label}</Text>
      <TextInput
        style={styles.targetInput}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        placeholder={t('training.templateForm.optional')}
        placeholderTextColor={COLORS.textMuted}
        accessibilityLabel={`${label}, ${t('training.templateForm.optional')}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  quiet:  { fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginBottom: 12 },
  section: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 8, marginBottom: 10 },

  card: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, backgroundColor: COLORS.bg2,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle:  { flex: 1, fontSize: 17, fontWeight: '600', color: COLORS.text },
  iconBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconText:   { fontSize: 20, color: COLORS.text },
  disabled:   { opacity: 0.3 },

  stepper:      { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  stepperLabel: { flex: 1, fontSize: 15, color: COLORS.textMuted },
  stepperValue: { width: 36, textAlign: 'center', fontSize: 18, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },

  targets:     { flexDirection: 'row', marginTop: 4, marginBottom: 4 },
  target:      { flex: 1, marginRight: 8 },
  targetLabel: { fontSize: 13, color: COLORS.textMuted, marginBottom: 4 },
  targetInput: {
    backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border2, borderRadius: 10,
    paddingHorizontal: 12, minHeight: 48, color: COLORS.text, fontSize: 17,
  },

  addBtn:  { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 20 },
  addText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
});
