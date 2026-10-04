// src/features/training/components/HistoryRow.js
//
// A finished workout in a list: the date, its name, and "52 min · 4
// øvelser · 14 sæt" (exercises done and sets completed). Opens the
// workout (read-only).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { t, formatDateLong } from '../../../core/i18n';
import { localDateKey } from '../../../core/time/dates';
import { sessionSummary } from '../session';
import { formatWorkoutDuration } from '../history';

/** "52 min · 4 øvelser · 14 sæt" for a finished workout. */
export function describeWorkout(session) {
  const summary = sessionSummary(session);
  return t('training.history.meta', {
    duration: formatWorkoutDuration(summary.durationMs),
    exercises: t('training.exerciseCount', { count: summary.exercisesDone }),
    sets: t('training.setCount', { count: summary.setsDone }),
  });
}

export function HistoryRow({ session, onPress }) {
  const date = formatDateLong(session.date, localDateKey(new Date()));
  const meta = describeWorkout(session);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${date}, ${session.name}, ${meta}`}
    >
      <View style={styles.text}>
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.name}>{session.name}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  text:    { flex: 1, paddingRight: 8 },
  date:    { fontSize: 13, color: COLORS.textMuted },
  name:    { fontSize: 17, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  meta:    { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: COLORS.textMuted },
});
