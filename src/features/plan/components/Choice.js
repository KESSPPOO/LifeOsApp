// src/features/plan/components/Choice.js
//
// A selectable chip (date, duration, priority). At least 44 pt tall;
// announced as a radio button with its selected state. Selection shows as
// a ✓ and bold text, not only colour.
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';

export function Choice({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
      accessibilityRole="radio"
      accessibilityState={{ checked: Boolean(selected), selected: Boolean(selected) }}
      accessibilityLabel={label}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{selected ? `✓ ${label}` : label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  choice: {
    minHeight: 44, paddingHorizontal: 14, justifyContent: 'center',
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2, backgroundColor: COLORS.bg3,
    marginRight: 8, marginBottom: 8,
  },
  selected:     { borderColor: COLORS.accent, backgroundColor: COLORS.accentGlow },
  text:         { fontSize: 15, color: COLORS.textMuted },
  textSelected: { color: COLORS.text, fontWeight: '700' },
});
