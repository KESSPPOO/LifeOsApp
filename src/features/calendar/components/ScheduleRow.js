// src/features/calendar/components/ScheduleRow.js
//
// One item of the selected day as a calm list row: in Uge below the week
// (timed items with their time), and in both modes under "Uden
// tidspunkt". Tapping opens it: a task in the shared task sheet, a routine
// in its day's checklist (the screen's onOpen). Finished items stay, struck
// through and muted.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { t } from '../../../core/i18n';
import { timeRange, itemDetails, overlapText } from '../../schedule/day';
import { describeCalendarItem, describeUntimedItem, untimedDetails } from '../logic';

/** items: the day's timed items (for "overlapper med …"); omit for an untimed item. */
export function ScheduleRow({ item, items, onOpen }) {
  const timed = Boolean(items);
  const { start, end } = timed ? timeRange(item) : {};
  const overlap = timed ? overlapText(item, items) : '';
  const details = (timed ? itemDetails(item) : untimedDetails(item)).join(' · ');
  return (
    <TouchableOpacity
      onPress={() => onOpen(item)}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={timed ? describeCalendarItem(item, items) : describeUntimedItem(item)}
      accessibilityHint={t(item.kind === 'routine' ? 'routine.openHint' : 'timewheel.openHint')}
    >
      {timed ? (
        <View style={styles.timeCol}>
          <Text style={[styles.start, item.done && styles.muted]}>{start}</Text>
          {end ? <Text style={styles.end}>{end}</Text> : null}
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={[styles.title, item.done && styles.doneText]}>{item.done ? '✓ ' : ''}{item.title}</Text>
        {details ? <Text style={styles.meta}>{details}</Text> : null}
        {overlap ? <Text style={styles.conflict}>⚠ {overlap}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  timeCol:  { width: 56, alignSelf: 'flex-start', paddingTop: 1 },
  start:    { fontSize: 15, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  end:      { fontSize: 13, color: COLORS.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
  muted:    { color: COLORS.textMuted },
  body:     { flex: 1, paddingRight: 8 },
  title:    { fontSize: 16, color: COLORS.text },
  meta:     { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },
  conflict: { fontSize: 13, color: COLORS.text, marginTop: 3 },
  doneText: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  chevron:  { fontSize: 22, color: COLORS.textMuted, paddingLeft: 4 },
});
