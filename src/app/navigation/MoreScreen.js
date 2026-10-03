// src/app/navigation/MoreScreen.js
//
// Mere: every screen that is not a bottom-bar tab, in the groups defined by
// MORE_SECTIONS in src/config/nav.js (ADR-005). Replaces the old drawer.
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../config/colors';
import { MORE_SECTIONS } from '../../config/nav';

export default function MoreScreen() {
  const navigation = useNavigation();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {MORE_SECTIONS.map(section => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">{section.title}</Text>
          {section.note ? <Text style={styles.note}>{section.note}</Text> : null}
          <View style={styles.group}>
            {section.items.map((n, i) => (
              <TouchableOpacity
                key={n.id}
                onPress={() => navigation.navigate(n.id)}
                style={[styles.row, i > 0 && styles.rowDivider]}
                accessibilityRole="button"
                accessibilityLabel={n.label}
              >
                <Text style={styles.icon}>{n.icon}</Text>
                <Text style={styles.label}>{n.label}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  section:      { marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textMuted, marginBottom: 8 },
  note:         { fontSize: 14, lineHeight: 20, color: COLORS.textMuted, marginBottom: 10 },

  group: {
    backgroundColor: COLORS.bgElevated, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  row:        { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  icon:       { fontSize: 20, width: 32 },
  label:      { flex: 1, fontSize: 16, color: COLORS.text },
  chevron:    { fontSize: 22, color: COLORS.textMuted },
});
