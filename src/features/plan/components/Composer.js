// src/features/plan/components/Composer.js
//
// Plan's always-visible quick add: type and send to add a task for I dag,
// I morgen or without a date (the choice goes back to I dag after each
// add, as before); "Tidspunkt og mere" opens the full sheet with what was
// typed. Keeps its own text, so typing does not re-render the list
// above it.
import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { t } from '../../../core/i18n';
import { addDays } from '../../../core/time/dates';
import { Choice } from './Choice';

/** Day offsets from today; null = no date. */
const DAYS = [
  { label: 'taskForm.today',    offset: 0 },
  { label: 'taskForm.tomorrow', offset: 1 },
  { label: 'taskForm.noDate',   offset: null },
];

/**
 * currentDay(): today's 'YYYY-MM-DD' at the moment of the action.
 * onAdd(text, date). onDetails(text, date, clear): clear() empties the
 * field once the sheet has saved the task.
 */
export function Composer({ currentDay, onAdd, onDetails }) {
  const [text, setText] = useState('');
  const [day, setDay] = useState(DAYS[0]);
  const inputRef = useRef(null);
  const date = () => (day.offset === null ? null : addDays(currentDay(), day.offset));

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed, date());
    setText('');
    setDay(DAYS[0]);
    inputRef.current?.focus();
  };

  return (
    <View style={styles.composer}>
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={t('plan.composer.placeholder')}
          placeholderTextColor={COLORS.textMuted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          returnKeyType="done"
          accessibilityLabel={t('plan.composer.placeholder')}
        />
        <TouchableOpacity
          onPress={submit}
          style={styles.sendBtn}
          accessibilityRole="button"
          accessibilityLabel={t('plan.composer.add')}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
        {DAYS.map(d => (
          <Choice key={d.label} label={t(d.label)} selected={day === d} onPress={() => setDay(d)} />
        ))}
        <TouchableOpacity
          onPress={() => onDetails(text, date(), () => { setText(''); setDay(DAYS[0]); })}
          style={styles.detailsBtn}
          accessibilityRole="button"
        >
          <Text style={styles.detailsText}>🕒 {t('plan.composer.details')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    backgroundColor: COLORS.bg2, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 16 : 8,
  },
  row:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  input: {
    flex: 1, minHeight: 48, color: COLORS.text, fontSize: 16,
    backgroundColor: COLORS.bg3, borderRadius: 12, paddingHorizontal: 14,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.accentDim,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  sendIcon:    { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  detailsBtn:  { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  detailsText: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
});
