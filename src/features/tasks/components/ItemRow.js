// src/features/tasks/components/ItemRow.js
//
// How a task, habit or routine item (../items.js) is shown on I dag and
// Timewheel: the NU card, the NÆSTE outline and plain overview rows, plus
// the small "NU" / "NÆSTE" label above them. Shared so both screens look
// and read the same. A task or habit has a check button; a routine is
// ticked step by step, so its row opens the day's checklist instead.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t } from '../../../core/i18n';
import { COLORS } from '../../../config/colors';
import { CheckButton } from '../../../components/CheckButton';

const displayTitle = (item) => (item.icon ? `${item.icon}  ${item.title}` : item.title);

/** The small uppercase label above NU / NÆSTE; `accent` adds the dot. */
export function FocusLabel({ text, accent }) {
  return (
    <View style={styles.labelRow}>
      {accent ? <View style={styles.dot} /> : null}
      <Text style={styles.label} accessibilityRole="header">{text}</Text>
    </View>
  );
}

/**
 * A task or habit with its check button, or a routine that opens its
 * checklist (onOpen). variant: 'now' (the NU card), 'next' (the NÆSTE
 * outline) or a plain overview row.
 */
export function ItemRow({ item, meta, onToggle, onOpen, variant }) {
  const routine = item.kind === 'routine';
  const Container = routine ? TouchableOpacity : View;
  const containerProps = routine ? {
    onPress: () => onOpen(item),
    accessibilityRole: 'button',
    accessibilityLabel: [item.timeLabel, item.title, meta].filter(Boolean).join(', '),
    accessibilityHint: t('routine.openHint'),
  } : {};
  return (
    <Container style={variant ? [styles.focus, variant === 'now' && styles.focusNow] : styles.row} {...containerProps}>
      <View style={styles.textCol}>
        {item.timeLabel ? (
          <Text style={[styles.timeLabel, variant === 'now' && styles.timeLabelNow]}>{item.timeLabel}</Text>
        ) : null}
        <Text style={[styles.title, variant && styles.focusTitle, variant === 'now' && styles.focusTitleNow, item.done && styles.doneText]}>
          {displayTitle(item)}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {routine ? (
        <Text style={styles.chevron}>›</Text>
      ) : (
        <CheckButton checked={item.done} onPress={() => onToggle(item)} label={item.title} />
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  dot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent, marginRight: 8 },
  label:    { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },

  focus: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 18,
    paddingVertical: 14, paddingLeft: 18, paddingRight: 8,
    marginBottom: 24,
  },
  focusNow: {
    backgroundColor: COLORS.bgElevated, borderColor: COLORS.border2,
    paddingVertical: 20, marginBottom: 10,
  },
  focusTitle:    { fontSize: 17, fontWeight: '600' },
  focusTitleNow: { fontSize: 21, lineHeight: 28 },

  row: {
    flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  textCol: { flex: 1, paddingRight: 8 },
  title:   { fontSize: 16, color: COLORS.text },
  meta:    { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },
  // The time sits above the title ("10:45 · 1 time"), so timed items read
  // differently from untimed ones without relying on colour.
  timeLabel:    { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, marginBottom: 2, fontVariant: ['tabular-nums'] },
  timeLabelNow: { fontSize: 15, color: COLORS.text },
  doneText:     { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  chevron:      { fontSize: 24, color: COLORS.textMuted, paddingHorizontal: 14 },
});
