// src/components/LinkRow.js
//
// A full-width row that opens another screen: optional icon, label, optional
// second line, and a › chevron. At least 56 pt tall; read as one button
// ("label, meta"). Used by I dag and Mere.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../config/colors';

export function LinkRow({ icon, label, meta, onPress, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.row, style]}
      accessibilityRole="button"
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 6 },
  icon:    { fontSize: 20, width: 32 },
  textCol: { flex: 1, paddingRight: 8 },
  label:   { fontSize: 16, color: COLORS.text },
  meta:    { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },
  chevron: { fontSize: 22, color: COLORS.textMuted, paddingLeft: 4 },
});
