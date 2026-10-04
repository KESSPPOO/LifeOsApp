// src/features/schedule/DateHeader.js
//
// The date heading of the schedule views (Tidshjul, Kalender): ‹ title ›
// with a quiet subline, and an "I dag" button below when another date is
// shown (onToday null = already on today). 48 pt step buttons; the screen
// gives their spoken labels (day or week).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../config/colors';
import { t } from '../../core/i18n';

export function DateHeader({ title, subline, prevLabel, nextLabel, onStep, onToday }) {
  return (
    <>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => onStep(-1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={prevLabel}>
          <Text style={styles.stepText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.titleCol}>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.subline}>{subline}</Text>
        </View>
        <TouchableOpacity onPress={() => onStep(1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={nextLabel}>
          <Text style={styles.stepText}>›</Text>
        </TouchableOpacity>
      </View>
      {onToday ? (
        <TouchableOpacity
          onPress={onToday}
          style={styles.todayBtn}
          accessibilityRole="button"
          accessibilityHint={t('timewheel.backToTodayHint')}
        >
          <Text style={styles.todayText}>{t('timewheel.backToToday')}</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  nav:      { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stepBtn:  { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 30, color: COLORS.text, lineHeight: 34 },
  titleCol: { flex: 1, alignItems: 'center' },
  title:    { fontSize: 20, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  subline:  { fontSize: 14, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  todayBtn: {
    alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2, marginBottom: 8,
  },
  todayText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
});
