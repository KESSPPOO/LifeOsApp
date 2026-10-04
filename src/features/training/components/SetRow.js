// src/features/training/components/SetRow.js
//
// One set during a workout: its number and type (warm-up rows say "Opv."
// and sit on a darker band; work sets are numbered), SIDST (last time's
// values, or a quiet dash), large fields for what is logged (Kg and Reps,
// or Tid, or Km and Tid) and a big ✓.
//
// Typing stays in this row (local state): nothing is saved and nothing
// else re-renders per keystroke. A field's text is kept in the workout
// (setDraft, via onDraft) when the field is left, so it survives leaving
// the screen. ✓ logs the texts shown (typed, or the suggestion from the
// target or Sidst); an invalid or missing value is not logged and says
// why. A completed set shows its values and a filled ✓; tapping it undoes
// the set. The parent remounts the row (key) when the set's state or the
// exercise changes, so the fields start from the stored state.
import React, { memo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { t } from '../../../core/i18n';
import { fieldsFor, formatSetValues, describeSetValues, setTypeLabel } from '../sets';
import { fieldTexts } from '../history';

export const SetRow = memo(function SetRow({ entryId, trackingType, set, number, sidst, disabled, onComplete, onUndo, onDraft }) {
  // What the fields show at first: typed earlier, else target, else Sidst.
  const initialTexts = fieldTexts({ trackingType }, set, sidst);
  const [texts, setTexts] = useState(initialTexts);
  const [error, setError] = useState(null);
  const fields = fieldsFor(trackingType);
  const typeText = setTypeLabel(set.type);
  const warmup = set.type === 'warmup';
  const sidstText = sidst ? formatSetValues(trackingType, sidst) : '';

  const complete = () => {
    const result = onComplete(entryId, set.id, texts);
    setError(result?.error ?? null);
  };
  const leaveField = (key) => {
    if (texts[key] !== initialTexts[key]) onDraft(entryId, set.id, key, texts[key]);
  };

  return (
    <View style={[styles.wrap, warmup && styles.warmup, set.done && styles.done]}>
      <View style={styles.row}>
        <View style={styles.setCol} accessible accessibilityLabel={t('training.set.label', { type: typeText, n: number })}>
          {warmup ? <Text style={styles.warmupTag}>{t('training.setType.warmupShort')}</Text> : null}
          <Text style={[styles.setNumber, warmup && styles.warmupNumber]}>{number}</Text>
        </View>
        <Text
          style={styles.sidst}
          accessibilityLabel={sidstText ? t('training.set.sidstLabel', { values: describeSetValues(trackingType, sidst) }) : t('training.set.noSidst')}
        >
          {sidstText || '–'}
        </Text>
        {fields.map(field => (set.done ? (
          <Text key={field.key} style={[styles.field, styles.loggedValue]}>{field.toText(set.values[field.key])}</Text>
        ) : (
          <TextInput
            key={field.key}
            style={[styles.field, styles.input, error?.field === field.key && styles.inputError]}
            value={texts[field.key]}
            onChangeText={(text) => { setTexts(prev => ({ ...prev, [field.key]: text })); setError(null); }}
            onBlur={() => leaveField(field.key)}
            keyboardType={field.keyboard}
            selectTextOnFocus
            editable={!disabled}
            placeholder={t(field.label)}
            placeholderTextColor={COLORS.textMuted}
            accessibilityLabel={t('training.set.fieldLabel', { field: t(field.label), type: typeText, n: number })}
          />
        )))}
        <TouchableOpacity
          onPress={set.done ? () => onUndo(entryId, set.id) : complete}
          disabled={disabled}
          style={[styles.check, set.done && styles.checkDone, disabled && styles.disabled]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: Boolean(set.done), disabled: Boolean(disabled) }}
          accessibilityLabel={set.done
            ? t('training.set.undoLabel', { type: typeText, n: number, values: describeSetValues(trackingType, set.values) })
            : t('training.set.completeLabel', { type: typeText.toLowerCase(), n: number })}
        >
          <Text style={[styles.checkMark, set.done && styles.checkMarkDone]}>✓</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{t(error.error)}</Text> : null}
    </View>
  );
});

/** Column headings over the rows: Sæt · Sidst · Kg · Reps. */
export function SetHeader({ trackingType }) {
  return (
    <View style={[styles.row, styles.header]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={[styles.setCol, styles.headText]}>{t('training.col.set')}</Text>
      <Text style={[styles.sidst, styles.headText]}>{t('training.col.sidst')}</Text>
      {fieldsFor(trackingType).map(field => (
        <Text key={field.key} style={[styles.field, styles.headText, styles.center]}>{t(field.label)}</Text>
      ))}
      <View style={styles.checkSpace} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { borderRadius: 12, paddingHorizontal: 6, paddingVertical: 6, marginBottom: 6 },
  warmup:  { backgroundColor: COLORS.bg2 },
  done:    { backgroundColor: COLORS.greenDim },
  row:     { flexDirection: 'row', alignItems: 'center' },
  header:  { paddingHorizontal: 6, marginBottom: 4 },
  headText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  center:  { textAlign: 'center' },

  setCol:       { width: 40, alignItems: 'center' },
  setNumber:    { fontSize: 20, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  warmupTag:    { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  warmupNumber: { fontSize: 16, color: COLORS.textMuted },

  sidst: { width: 64, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', fontVariant: ['tabular-nums'] },

  field: { flex: 1, marginHorizontal: 4 },
  input: {
    minHeight: 52, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border2, backgroundColor: COLORS.bg3,
    color: COLORS.text, fontSize: 20, fontWeight: '600', textAlign: 'center', paddingHorizontal: 6,
    fontVariant: ['tabular-nums'],
  },
  inputError:  { borderColor: COLORS.red, borderWidth: 2 },
  loggedValue: { fontSize: 20, fontWeight: '700', color: COLORS.text, textAlign: 'center', paddingVertical: 14, fontVariant: ['tabular-nums'] },

  check: {
    width: 52, height: 52, borderRadius: 12, marginLeft: 4,
    borderWidth: 2, borderColor: COLORS.textMuted, alignItems: 'center', justifyContent: 'center',
  },
  checkDone:     { backgroundColor: COLORS.green, borderColor: COLORS.green },
  checkMark:     { fontSize: 22, fontWeight: '800', color: COLORS.textMuted },
  checkMarkDone: { color: COLORS.bg },
  checkSpace:    { width: 56 },
  disabled:      { opacity: 0.4 },

  error: { fontSize: 14, color: COLORS.text, backgroundColor: COLORS.redDim, borderRadius: 8, padding: 8, marginTop: 6 },
});
