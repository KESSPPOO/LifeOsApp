// src/features/today/components/CheckButton.js
//
// The round "done" checkbox used on I dag. A 48 pt touch target around a
// 28 pt circle; announced as a checkbox with its checked state.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { t } from '../../../core/i18n';

export function CheckButton({ checked, onPress, label }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.hit}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      accessibilityHint={t(checked ? 'today.a11y.uncheckHint' : 'today.a11y.checkHint')}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.mark}>✓</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hit: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  // textMuted keeps the empty circle above 3:1 against the background.
  box: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: COLORS.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  boxChecked: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  mark: { color: COLORS.bg, fontSize: 16, fontWeight: '800' },
});
