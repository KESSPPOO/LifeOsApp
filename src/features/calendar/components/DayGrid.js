// src/features/calendar/components/DayGrid.js
//
// Dag: the day's timed items on a vertical time axis (buildCalendarDay in
// ../logic.js). Only the useful part of the day is drawn (the waking day,
// widened to the items and now), with true positions: a block starts at
// its time and is as long as its duration, never shorter than a readable
// touch target. A point in time (no duration) is a line at its time, not a
// block with an invented length. On today one NU line marks the time.
//
// Every block says in words what it shows (time, title, kind, klaret,
// overlap). Hour lines are decoration and hidden from screen readers.
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { t } from '../../../core/i18n';
import { minutesToTime } from '../../../core/time/timeOfDay';
import { timeRange } from '../../schedule/day';
import { describeCalendarItem } from '../logic';

const GUTTER = 48;

export const DayGrid = memo(function DayGrid({ day, onOpen }) {
  // The NU line sits between the blocks in reading order (before the first
  // item that starts after now).
  const nowIndex = day.nowTop === null ? -1 : day.items.findIndex(item => item.start > day.nowMinute);
  const nowLine = day.nowTop === null ? null : (
    <View
      key="now"
      style={[styles.now, { top: day.nowTop }]}
      pointerEvents="none"
      accessible
      accessibilityLabel={t('calendar.a11y.now', { time: minutesToTime(day.nowMinute) })}
    >
      <Text style={styles.nowText}>{t('today.now')}</Text>
      <View style={styles.nowLine} />
    </View>
  );
  const blocks = day.items.map(item => <Block key={item.id} item={item} items={day.items} onOpen={onOpen} />);
  if (nowLine) blocks.splice(nowIndex === -1 ? blocks.length : nowIndex, 0, nowLine);

  return (
    <View style={[styles.grid, { height: day.height }]}>
      <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {day.hours.map(hour => (
          <View key={hour.minute} style={[styles.hour, { top: hour.top - 8 }]}>
            <Text style={styles.hourLabel}>{hour.label}</Text>
            <View style={styles.hourLine} />
          </View>
        ))}
      </View>
      <View style={styles.blocks}>{blocks}</View>
    </View>
  );
});

function Block({ item, items, onOpen }) {
  const { start, end } = timeRange(item);
  const point = item.end === null;
  const conflict = item.overlapsWith.length > 0; // only open items overlap
  const width = 100 / item.columns;
  return (
    <TouchableOpacity
      onPress={() => onOpen(item)}
      style={[styles.block, { top: item.top, height: item.height, left: `${item.column * width}%`, width: `${width}%` }]}
      accessibilityRole="button"
      accessibilityLabel={describeCalendarItem(item, items)}
      accessibilityHint={t(item.kind === 'routine' ? 'routine.openHint' : 'timewheel.openHint')}
    >
      <View style={point ? styles.point : [styles.interval, conflict && styles.conflict, item.done && styles.done]}>
        {point ? <View style={[styles.pointLine, item.done && styles.pointLineDone]} /> : null}
        <Text style={[styles.title, item.done && styles.doneText]} numberOfLines={item.height >= 72 ? 2 : 1}>
          {item.done ? '✓ ' : ''}{item.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {conflict ? '⚠ ' : ''}{point ? `${start} · ${t('timewheel.point')}` : `${start}–${end}`}
          {item.kindLabel ? ` · ${item.kindLabel}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  grid: { marginTop: 8, marginBottom: 8 },

  hour:      { position: 'absolute', left: 0, right: 0, height: 16, flexDirection: 'row', alignItems: 'center' },
  hourLabel: { width: GUTTER - 6, fontSize: 12, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  hourLine:  { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },

  blocks: { position: 'absolute', top: 0, bottom: 0, left: GUTTER, right: 0 },
  block:  { position: 'absolute', paddingRight: 4, paddingBottom: 2 },

  interval: {
    flex: 1, overflow: 'hidden', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: COLORS.bgElevated, borderLeftWidth: 3, borderLeftColor: COLORS.accent,
  },
  // A point: a line at its exact time, the words below it; no filled block.
  point:         { flex: 1, overflow: 'hidden', paddingHorizontal: 8, paddingTop: 2 },
  pointLine:     { position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: 1, backgroundColor: COLORS.text },
  pointLineDone: { backgroundColor: COLORS.textMuted },
  conflict:      { borderLeftColor: COLORS.amber },
  done:          { backgroundColor: COLORS.bg2, borderLeftColor: COLORS.border2 },

  title:    { fontSize: 14, lineHeight: 18, fontWeight: '600', color: COLORS.text },
  meta:     { fontSize: 12, lineHeight: 16, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  doneText: { color: COLORS.textMuted, textDecorationLine: 'line-through' },

  // In the blocks layer (reading order), drawn across the gutter too.
  now:     { position: 'absolute', left: -GUTTER, right: 0, height: 16, marginTop: -8, flexDirection: 'row', alignItems: 'center' },
  nowText: { width: GUTTER - 6, fontSize: 12, fontWeight: '700', color: COLORS.text, backgroundColor: COLORS.bg },
  nowLine: { flex: 1, height: 2, borderRadius: 1, backgroundColor: COLORS.accent },
});
