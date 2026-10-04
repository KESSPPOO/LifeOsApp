// src/features/plan/components/TaskSheet.js
//
// The bottom sheet for creating and editing a task or a habit on Plan.
// Same Modal -> KeyboardAvoidingView -> GlassSheet -> ScrollView
// (keyboardShouldPersistTaps="always") structure as every other form in the
// app, which carries the Android keyboard fixes. Validation is
// readTaskForm in ../logic.js.
//
// Time is optional: an empty time field means "no time". Duration choices
// appear only once a valid time is typed, and "Ved ikke" (unknown) is a
// valid answer. The parent remounts the sheet (key) for each opening, so
// the form starts from `initial`.
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView,
  Platform, StyleSheet,
} from 'react-native';
import { COLORS } from '../../../config/colors';
import { GlassSheet } from '../../../components/GlassSheet';
import { DatePicker } from '../../../components/DatePicker';
import { t, formatDuration } from '../../../core/i18n';
import { addDays } from '../../../core/time/dates';
import { parseTimeInput } from '../../../core/time/timeOfDay';
import { DURATION_CHOICES, MAX_DURATION_MINUTES } from '../../tasks/schedule';
import { readTaskForm } from '../logic';
import { Choice } from './Choice';

const PRIORITIES = ['low', 'medium', 'high'];

const TITLES = {
  task:  { new: 'taskForm.newTask',  edit: 'taskForm.editTask' },
  habit: { new: 'taskForm.newHabit', edit: 'taskForm.editHabit' },
};

export function TaskSheet({ kind, editing, initial, today, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);
  const set = (field) => (value) => { setForm(f => ({ ...f, [field]: value })); setError(null); };

  const timeValid = parseTimeInput(form.timeText) !== null;
  const tomorrow = addDays(today, 1);

  const save = () => {
    const result = readTaskForm(kind, form);
    if (result.error) setError(result.error);
    else onSave(result.fields);
  };

  const clearTime = () => setForm(f => ({ ...f, timeText: '', durationChoice: null, customDuration: '' }));
  // Show the canonical form ('9' -> '09:00') once the user leaves the field.
  const normaliseTime = () => {
    const parsed = parseTimeInput(form.timeText);
    if (parsed) setForm(f => ({ ...f, timeText: parsed }));
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
            {t(TITLES[kind][editing ? 'edit' : 'new'])}
          </Text>

          <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
            {kind === 'habit' ? (
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.iconInput]}
                  value={form.icon}
                  onChangeText={set('icon')}
                  maxLength={2}
                  accessibilityLabel={t('taskForm.icon')}
                />
                <TextInput
                  style={[styles.input, styles.grow]}
                  placeholder={t('taskForm.habitName')}
                  placeholderTextColor={COLORS.textMuted}
                  value={form.text}
                  onChangeText={set('text')}
                  autoFocus={!editing}
                  accessibilityLabel={t('taskForm.habitName')}
                />
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder={t('taskForm.title')}
                  placeholderTextColor={COLORS.textMuted}
                  value={form.text}
                  onChangeText={set('text')}
                  autoFocus={!editing}
                  accessibilityLabel={t('taskForm.title')}
                />

                <FieldLabel text={t('taskForm.date')} />
                <View style={styles.choices}>
                  <Choice label={t('taskForm.today')} selected={form.date === today} onPress={() => set('date')(today)} />
                  <Choice label={t('taskForm.tomorrow')} selected={form.date === tomorrow} onPress={() => set('date')(tomorrow)} />
                  <Choice label={t('taskForm.noDate')} selected={!form.date} onPress={() => { set('date')(''); clearTime(); }} />
                </View>
                <DatePicker
                  value={form.date}
                  onChange={(d) => { set('date')(d); if (!d) clearTime(); }}
                  mode="any"
                  label={t('taskForm.date')}
                  locale="da"
                />

                {form.date ? (
                  <>
                    <FieldLabel text={t('taskForm.time')} />
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, styles.grow, styles.timeInput]}
                        placeholder={t('taskForm.timePlaceholder')}
                        placeholderTextColor={COLORS.textMuted}
                        value={form.timeText}
                        onChangeText={set('timeText')}
                        onEndEditing={normaliseTime}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                        accessibilityLabel={t('taskForm.time')}
                        accessibilityHint={t('taskForm.timePlaceholder')}
                      />
                      {form.timeText ? (
                        <TouchableOpacity
                          onPress={clearTime}
                          style={styles.clearBtn}
                          accessibilityRole="button"
                          accessibilityLabel={t('taskForm.noTime')}
                        >
                          <Text style={styles.clearText}>{t('taskForm.noTime')}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {timeValid ? (
                      <>
                        <FieldLabel text={t('taskForm.duration')} />
                        <View style={styles.choices}>
                          <Choice
                            label={t('taskForm.durationUnknown')}
                            selected={form.durationChoice === null}
                            onPress={() => set('durationChoice')(null)}
                          />
                          {DURATION_CHOICES.map(m => (
                            <Choice
                              key={m}
                              label={formatDuration(m)}
                              selected={form.durationChoice === m}
                              onPress={() => set('durationChoice')(m)}
                            />
                          ))}
                          <Choice
                            label={t('taskForm.durationCustom')}
                            selected={form.durationChoice === 'custom'}
                            onPress={() => set('durationChoice')('custom')}
                          />
                        </View>
                        {form.durationChoice === 'custom' ? (
                          <TextInput
                            style={[styles.input, styles.minutesInput]}
                            placeholder={t('taskForm.durationMinutes')}
                            placeholderTextColor={COLORS.textMuted}
                            value={form.customDuration}
                            onChangeText={set('customDuration')}
                            keyboardType="number-pad"
                            maxLength={4}
                            accessibilityLabel={`${t('taskForm.duration')}, ${t('taskForm.durationMinutes')}`}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}

                <FieldLabel text={t('taskForm.priority')} />
                <View style={styles.choices}>
                  {PRIORITIES.map(p => (
                    <Choice key={p} label={t(`priority.${p}`)} selected={form.priority === p} onPress={() => set('priority')(p)} />
                  ))}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder={t('taskForm.category')}
                  placeholderTextColor={COLORS.textMuted}
                  value={form.subject}
                  onChangeText={set('subject')}
                  accessibilityLabel={t('taskForm.category')}
                />
              </>
            )}

            {error ? <Text style={styles.error} accessibilityRole="alert">{t(error, { max: MAX_DURATION_MINUTES })}</Text> : null}

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

function FieldLabel({ text }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

const styles = StyleSheet.create({
  wrapper:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  title:    { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16, textAlign: 'center' },

  row:  { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  input: {
    backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border2, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
    color: COLORS.text, fontSize: 16, marginBottom: 12,
  },
  iconInput:    { width: 64, marginRight: 10, textAlign: 'center' },
  timeInput:    { fontVariant: ['tabular-nums'] },
  minutesInput: { width: 140 },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, marginBottom: 8, marginTop: 4 },

  choices: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },

  clearBtn:  { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, marginLeft: 6, marginBottom: 12 },
  clearText: { fontSize: 15, color: COLORS.text, textDecorationLine: 'underline' },

  error: { fontSize: 15, color: COLORS.text, backgroundColor: COLORS.redDim, borderRadius: 10, padding: 12, marginBottom: 12 },

  buttons:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  secondaryBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  cancelText:   { fontSize: 16, color: COLORS.textMuted },
  deleteText:   { fontSize: 16, color: COLORS.red, fontWeight: '600' },
  // accentDim, not accent: white text on accent is only ~4:1.
  primaryBtn:   { minHeight: 48, justifyContent: 'center', backgroundColor: COLORS.accentDim, paddingHorizontal: 28, borderRadius: 12 },
  primaryText:  { fontSize: 16, color: COLORS.text, fontWeight: '700' },
  bottomSpace:  { height: 20 },
});
