// src/features/training/components/RestBar.js
//
// The rest countdown after a completed set, pinned to the bottom of the
// workout: "Pause 2:41" with +30 sek and Spring pause over; when it is
// over, "Pausen er slut" with OK. The countdown is derived from the
// workout's stored deadline (useRestClock), so it is the same wherever it
// is shown and never doubles. Screen readers hear the start (announced by
// the screen) and the end, not every second. In-app only.
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, AccessibilityInfo, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { t, formatTimer } from '../../../core/i18n';
import { restRemaining } from '../session';
import { useRestClock } from '../useRestClock';

export function RestBar({ timer, onExtend, onSkip }) {
  const now = useRestClock(timer.endsAt);
  const remaining = restRemaining({ timer }, now);
  const over = remaining === 0;

  // Announce the end once, when the countdown reaches it here.
  const wasRunning = useRef(!over);
  useEffect(() => {
    if (over && wasRunning.current) AccessibilityInfo.announceForAccessibility(t('training.rest.over'));
    wasRunning.current = !over;
  }, [over]);

  return (
    <View style={[styles.bar, over && styles.barOver]}>
      <View
        style={styles.textCol}
        accessible
        accessibilityLabel={over ? t('training.rest.over') : t('training.rest.a11y', { time: formatTimer(remaining) })}
      >
        <Text style={styles.time}>{over ? t('training.rest.over') : t('training.rest.remaining', { time: formatTimer(remaining) })}</Text>
        <Text style={styles.note}>{t('training.rest.inApp')}</Text>
      </View>
      {over ? null : (
        <TouchableOpacity onPress={onExtend} style={styles.btn} accessibilityRole="button" accessibilityLabel={t('training.rest.extendLabel')}>
          <Text style={styles.btnText}>{t('training.rest.extend')}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onSkip} style={styles.btn} accessibilityRole="button">
        <Text style={styles.btnText}>{t(over ? 'training.rest.ok' : 'training.rest.skip')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.bgElevated, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border2,
  },
  barOver: { borderTopColor: COLORS.green, borderTopWidth: 2 },
  textCol: { flex: 1 },
  time:    { fontSize: 22, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  note:    { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  btn: {
    minHeight: 48, minWidth: 64, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, marginLeft: 8,
    borderRadius: 24, borderWidth: 1, borderColor: COLORS.border2,
  },
  btnText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
});
