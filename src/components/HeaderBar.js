// src/components/HeaderBar.js
//
// The top bar of the app shell (src/app/navigation/ShellLayout.js): the
// current screen's title, with a "Tilbage" button on secondary screens.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../config/colors';
import { t } from '../core/i18n';

export function HeaderBar({ title, onBack }) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('shell.back')}
          accessibilityHint={t('shell.backHint')}
        >
          <Text style={styles.backText}>‹ {t('shell.back')}</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 52, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.bg,
  },
  backBtn:  { minHeight: 44, justifyContent: 'center', paddingRight: 12, marginLeft: -4 },
  backText: { fontSize: 16, color: COLORS.text },
  title:    { flex: 1, fontSize: 17, fontWeight: '600', color: COLORS.text },
});
