// src/features/tasks/components/ScheduleFields.js
//
// The optional time and duration fields of the task sheet and the routine
// sheet: a typed time ('10.45', normalised to '10:45' on leaving the
// field), "Intet tidspunkt" to clear it, and, once a valid time is typed,
// duration chips (Ved ikke, 15 min … 2 timer, Andet + minutes). Reads and
// writes the form values described in ../schedule.js (readScheduleInput).
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { Choice } from '../../../components/Choice';
import { t, formatDuration } from '../../../core/i18n';
import { parseTimeInput } from '../../../core/time/timeOfDay';
import { DURATION_CHOICES } from '../schedule';

/** form: { timeText, durationChoice, customDuration }; onChange(patch). */
export function ScheduleFields({ form, onChange, autoFocusTime }) {
  const timeValid = parseTimeInput(form.timeText) !== null;
  const clear = () => onChange({ timeText: '', durationChoice: null, customDuration: '' });
  const normalise = () => {
    const parsed = parseTimeInput(form.timeText);
    if (parsed) onChange({ timeText: parsed });
  };

  return (
    <>
      <Text style={styles.label}>{t('taskForm.time')}</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.grow, styles.timeInput]}
          placeholder={t('taskForm.timePlaceholder')}
          placeholderTextColor={COLORS.textMuted}
          value={form.timeText}
          onChangeText={(timeText) => onChange({ timeText })}
          onEndEditing={normalise}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          autoFocus={autoFocusTime}
          accessibilityLabel={t('taskForm.time')}
          accessibilityHint={t('taskForm.timePlaceholder')}
        />
        {form.timeText ? (
          <TouchableOpacity onPress={clear} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel={t('taskForm.noTime')}>
            <Text style={styles.clearText}>{t('taskForm.noTime')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {timeValid ? (
        <>
          <Text style={styles.label}>{t('taskForm.duration')}</Text>
          <View style={styles.choices}>
            <Choice
              label={t('taskForm.durationUnknown')}
              selected={form.durationChoice === null}
              onPress={() => onChange({ durationChoice: null })}
            />
            {DURATION_CHOICES.map(m => (
              <Choice key={m} label={formatDuration(m)} selected={form.durationChoice === m} onPress={() => onChange({ durationChoice: m })} />
            ))}
            <Choice
              label={t('taskForm.durationCustom')}
              selected={form.durationChoice === 'custom'}
              onPress={() => onChange({ durationChoice: 'custom' })}
            />
          </View>
          {form.durationChoice === 'custom' ? (
            <TextInput
              style={[styles.input, styles.minutesInput]}
              placeholder={t('taskForm.durationMinutes')}
              placeholderTextColor={COLORS.textMuted}
              value={form.customDuration}
              onChangeText={(customDuration) => onChange({ customDuration })}
              keyboardType="number-pad"
              maxLength={4}
              accessibilityLabel={`${t('taskForm.duration')}, ${t('taskForm.durationMinutes')}`}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, marginBottom: 8, marginTop: 4 },
  row:   { flexDirection: 'row', alignItems: 'center' },
  grow:  { flex: 1 },
  input: {
    backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border2, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
    color: COLORS.text, fontSize: 16, marginBottom: 12,
  },
  timeInput:    { fontVariant: ['tabular-nums'] },
  minutesInput: { width: 140 },
  choices:      { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  clearBtn:     { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, marginLeft: 6, marginBottom: 12 },
  clearText:    { fontSize: 15, color: COLORS.text, textDecorationLine: 'underline' },
});
