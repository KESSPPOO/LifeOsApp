// src/features/routines/components/RoutineSheet.js
//
// Create or edit a routine template: name, days (Hver dag / Hverdage /
// Weekend or single weekdays, Monday first), optional time and duration
// (the same fields as the task sheet), ordered steps (add, edit, move up /
// down, remove) and Aktiv / På pause. Same sheet structure as TaskSheet
// (Modal -> KeyboardAvoidingView -> GlassSheet -> ScrollView with
// keyboardShouldPersistTaps="always") for the Android keyboard fixes.
// Validation: readRoutineForm in ../model.js. The parent remounts the
// sheet (key) for each opening.
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { COLORS } from '../../../config/colors';
import { GlassSheet } from '../../../components/GlassSheet';
import { Choice } from '../../../components/Choice';
import { t, weekdayName } from '../../../core/i18n';
import { MAX_DURATION_MINUTES } from '../../tasks/schedule';
import { ScheduleFields } from '../../tasks/components/ScheduleFields';
import { EVERY_DAY, DAY_PRESETS, readRoutineForm, toggleDay, moveStep, newId, sameDays } from '../model';

export function RoutineSheet({ editing, initial, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);
  // The step just added gets the keyboard.
  const [focusStepId, setFocusStepId] = useState(null);
  const update = (patch) => { setForm(f => ({ ...f, ...patch })); setError(null); };
  const setSteps = (fn) => { setForm(f => ({ ...f, steps: fn(f.steps) })); setError(null); };

  const save = () => {
    const result = readRoutineForm(form);
    if (result.error) setError(result.error);
    else onSave(result.fields);
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('taskForm.cancel')}
        />
        <GlassSheet>
          <Text style={styles.title} accessibilityRole="header">
            {t(editing ? 'routine.form.editTitle' : 'routine.form.newTitle')}
          </Text>
          {/* Opened from a day (Tidshjul, Kalender, a checklist): a change is to the routine, on every day. */}
          {editing ? <Text style={styles.note}>{t('routine.form.templateNote')}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>{t('routine.form.name')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('routine.form.namePlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={form.name}
              onChangeText={(name) => update({ name })}
              autoFocus={!editing}
              accessibilityLabel={t('routine.form.name')}
            />

            <Text style={styles.label}>{t('routine.form.days')}</Text>
            <View style={styles.choices}>
              {DAY_PRESETS.map(([key, days]) => (
                <Choice key={key} label={t(key)} selected={sameDays(form.daysOfWeek, days)} onPress={() => update({ daysOfWeek: [...days] })} />
              ))}
            </View>
            <View style={styles.choices}>
              {EVERY_DAY.map(day => (
                <Choice
                  key={day}
                  role="checkbox"
                  label={weekdayName(day, 'letter')}
                  accessibilityLabel={weekdayName(day)}
                  selected={form.daysOfWeek.includes(day)}
                  onPress={() => update({ daysOfWeek: toggleDay(form.daysOfWeek, day) })}
                />
              ))}
            </View>

            <ScheduleFields form={form} onChange={update} />

            <Text style={styles.label}>{t('routine.form.steps')}</Text>
            {form.steps.map((step, index) => (
              <View key={step.id} style={styles.stepRow}>
                <TextInput
                  style={[styles.input, styles.stepInput]}
                  placeholder={t('routine.form.stepLabel', { n: index + 1 })}
                  placeholderTextColor={COLORS.textMuted}
                  value={step.text}
                  onChangeText={(text) => setSteps(steps => steps.map(s => (s.id === step.id ? { ...s, text } : s)))}
                  autoFocus={step.id === focusStepId}
                  accessibilityLabel={t('routine.form.stepLabel', { n: index + 1 })}
                />
                <StepButton
                  icon="↑"
                  disabled={index === 0}
                  label={t('routine.form.moveUp', { text: step.text || index + 1 })}
                  onPress={() => setSteps(steps => moveStep(steps, index, -1))}
                />
                <StepButton
                  icon="↓"
                  disabled={index === form.steps.length - 1}
                  label={t('routine.form.moveDown', { text: step.text || index + 1 })}
                  onPress={() => setSteps(steps => moveStep(steps, index, 1))}
                />
                <StepButton
                  icon="✕"
                  label={t('routine.form.removeStep', { text: step.text || index + 1 })}
                  onPress={() => setSteps(steps => steps.filter(s => s.id !== step.id))}
                />
              </View>
            ))}
            <TouchableOpacity
              onPress={() => {
                const id = newId();
                setFocusStepId(id);
                setSteps(steps => [...steps, { id, text: '' }]);
              }}
              style={styles.addStep}
              accessibilityRole="button"
            >
              <Text style={styles.addStepText}>+ {t('routine.form.addStep')}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>{t('routine.form.status')}</Text>
            <View style={styles.choices}>
              <Choice label={t('routine.form.active')} selected={form.enabled} onPress={() => update({ enabled: true })} />
              <Choice label={t('routine.paused')} selected={!form.enabled} onPress={() => update({ enabled: false })} />
            </View>

            {error ? (
              <Text style={styles.error} accessibilityRole="alert">{t(error, { max: MAX_DURATION_MINUTES })}</Text>
            ) : null}

            <View style={styles.buttons}>
              {editing ? (
                <TouchableOpacity onPress={onDelete} style={styles.secondaryBtn} accessibilityRole="button">
                  <Text style={styles.deleteText}>{t('taskForm.delete')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={onClose} style={styles.secondaryBtn} accessibilityRole="button">
                  <Text style={styles.cancelText}>{t('taskForm.cancel')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={save} style={styles.primaryBtn} accessibilityRole="button">
                <Text style={styles.primaryText}>{t(editing ? 'taskForm.save' : 'taskForm.create')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bottomSpace} />
          </ScrollView>
        </GlassSheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StepButton({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.stepBtn, disabled && styles.stepBtnDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Text style={styles.stepBtnText}>{icon}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  title:    { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16, textAlign: 'center' },
  note:     { fontSize: 14, lineHeight: 20, color: COLORS.textMuted, marginTop: -8, marginBottom: 16, textAlign: 'center' },
  label:    { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border2, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
    color: COLORS.text, fontSize: 16, marginBottom: 12,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },

  stepRow:         { flexDirection: 'row', alignItems: 'flex-start' },
  stepInput:       { flex: 1, marginBottom: 8 },
  stepBtn:         { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText:     { fontSize: 18, color: COLORS.text },
  addStep:         { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 12 },
  addStepText:     { fontSize: 16, fontWeight: '600', color: COLORS.text },

  error: { fontSize: 15, color: COLORS.text, backgroundColor: COLORS.redDim, borderRadius: 10, padding: 12, marginBottom: 12 },

  buttons:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  secondaryBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  cancelText:   { fontSize: 16, color: COLORS.textMuted },
  deleteText:   { fontSize: 16, color: COLORS.red, fontWeight: '600' },
  primaryBtn:   { minHeight: 48, justifyContent: 'center', backgroundColor: COLORS.accentDim, paddingHorizontal: 28, borderRadius: 12 },
  primaryText:  { fontSize: 16, color: COLORS.text, fontWeight: '700' },
  bottomSpace:  { height: 20 },
});
