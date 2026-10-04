// src/features/schedule/ConflictPanel.js
//
// The calm overlap notice: "N ting overlapper", that nothing is moved
// automatically, and (on request) each overlapping item with "Åbn" and
// "Flyt". The screen decides what those open (Tidshjul and Kalender: a
// task's sheet, at the time field for "Flyt"; a routine's checklist, or its
// template for "Flyt"); this panel never changes a schedule itself.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../config/colors';
import { t } from '../../core/i18n';
import { timeRange } from './day';

export function ConflictPanel({ conflicts, onOpen, onMove }) {
  const [expanded, setExpanded] = useState(false);
  const count = conflicts.reduce((sum, group) => sum + group.length, 0);
  return (
    <View style={styles.panel} accessibilityRole="summary">
      <Text style={styles.title}>⚠ {t('timewheel.conflicts', { count })}</Text>
      <Text style={styles.hint}>{t('timewheel.conflictsHint')}</Text>
      <TouchableOpacity
        onPress={() => setExpanded(v => !v)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={styles.toggleText}>{t(expanded ? 'timewheel.hideConflicts' : 'timewheel.showConflicts')}</Text>
      </TouchableOpacity>
      {expanded ? conflicts.map(group => (
        <View key={group.map(item => item.id).join('-')} style={styles.group}>
          {group.map(item => {
            const { start, end } = timeRange(item);
            return (
              <View key={item.id} style={styles.item}>
                <View style={styles.info}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemTime}>{start}–{end}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => onOpen(item)}
                  style={styles.action}
                  accessibilityRole="button"
                  accessibilityLabel={t('timewheel.openLabel', { title: item.title })}
                >
                  <Text style={styles.actionText}>{t('timewheel.open')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onMove(item)}
                  style={styles.action}
                  accessibilityRole="button"
                  accessibilityLabel={t('timewheel.moveLabel', { title: item.title })}
                >
                  <Text style={styles.actionText}>{t('timewheel.move')}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderLeftWidth: 4, borderLeftColor: COLORS.amber, backgroundColor: COLORS.bgElevated,
    borderRadius: 12, padding: 14, marginBottom: 24,
  },
  title:      { fontSize: 16, fontWeight: '700', color: COLORS.text },
  hint:       { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },
  toggle:     { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  toggleText: { fontSize: 15, fontWeight: '600', color: COLORS.text, textDecorationLine: 'underline' },
  group:      { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, paddingTop: 4, marginTop: 4 },
  item:       { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  info:       { flex: 1 },
  itemTitle:  { fontSize: 15, color: COLORS.text },
  itemTime:   { fontSize: 13, color: COLORS.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
  action: {
    minHeight: 44, minWidth: 56, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 12, marginLeft: 6, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2,
  },
  actionText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
});
