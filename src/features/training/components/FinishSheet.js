// src/features/training/components/FinishSheet.js
//
// "Afslut træning?": what the workout holds before it becomes history
// (exercises done / total, skipped, completed sets, duration), with
// Fortsæt (keep training) and Afslut.
import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { GlassSheet } from '../../../components/GlassSheet';
import { t } from '../../../core/i18n';
import { formatWorkoutDuration } from '../history';
import { sheetStyles } from './sheetStyles';

export function FinishSheet({ summary, onConfirm, onClose }) {
  const lines = [
    t('training.summary.exercises', { done: summary.exercisesDone, total: summary.exercisesTotal }),
    summary.exercisesSkipped > 0 ? t('training.summary.skipped', { count: summary.exercisesSkipped }) : null,
    t('training.summary.sets', { count: summary.setsDone }),
    t('training.summary.duration', { duration: formatWorkoutDuration(summary.durationMs) }),
  ].filter(Boolean);
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheetStyles.wrapper}>
        <TouchableOpacity
          style={sheetStyles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('training.summary.keepGoing')}
        />
        <GlassSheet>
          <Text style={sheetStyles.title} accessibilityRole="header">{t('training.summary.title')}</Text>
          {lines.map(line => <Text key={line} style={styles.line}>{line}</Text>)}
          <View style={sheetStyles.buttons}>
            <TouchableOpacity onPress={onClose} style={sheetStyles.secondaryBtn} accessibilityRole="button">
              <Text style={sheetStyles.linkText}>{t('training.summary.keepGoing')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={sheetStyles.primaryBtn} accessibilityRole="button">
              <Text style={sheetStyles.primaryText}>{t('training.summary.confirm')}</Text>
            </TouchableOpacity>
          </View>
          <View style={sheetStyles.bottomSpace} />
        </GlassSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  line: { fontSize: 17, color: COLORS.text, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
});
