// src/features/timewheel/components/Timeline.js
//
// The readable day: every timed item in time order (timelineRows in
// ../logic.js), with free time between items as quiet rows and, on today,
// a NU marker at the current time. Only the parts of the day that hold
// something are drawn; there is no empty 24-hour grid to scroll through.
//
// An item with a duration has a bar whose height follows its length
// (within readable limits); a point in time (no duration) has a dot and
// says "Uden varighed". Every row says in words what the bar and colour
// show (time, length, i gang, klaret, overlap), and tapping it opens the
// task in the shared editor.
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { t, formatDuration } from '../../../core/i18n';
import { minutesToTime } from '../../../core/time/timeOfDay';
import { timeRange, itemDetails, overlapText, describeScheduledItem } from '../../schedule/day';
import { blockHeight } from '../logic';

export const Timeline = memo(function Timeline({ day, rows, onOpen }) {
  return (
    <View>
      {rows.map((row, index) => {
        if (row.type === 'now') {
          return (
            <View key={`now-${index}`} style={styles.nowRow} accessibilityRole="text">
              <Text style={styles.nowText}>{t('timewheel.nowMarker', { time: minutesToTime(row.minute) })}</Text>
              <View style={styles.nowLine} />
            </View>
          );
        }
        if (row.type === 'gap') {
          return (
            <View key={`gap-${index}`} style={styles.gapRow}>
              <View style={styles.timeCol} />
              <View style={styles.rail}><View style={styles.gapRail} /></View>
              <Text style={styles.gapText}>{t('timewheel.free', { duration: formatDuration(row.minutes) })}</Text>
            </View>
          );
        }
        return <TimelineItem key={`item-${row.item.id}`} item={row.item} day={day} onOpen={onOpen} />;
      })}
    </View>
  );
});

function TimelineItem({ item, day, onOpen }) {
  const { start, end } = timeRange(item);
  const conflict = item.overlapsWith.length > 0; // only open items overlap
  const active = !item.done && item.status === 'active';
  const point = item.end === null;

  return (
    <TouchableOpacity
      onPress={() => onOpen(item)}
      style={[styles.itemRow, { minHeight: blockHeight(item) }, active && styles.itemActive]}
      accessibilityRole="button"
      accessibilityLabel={describeScheduledItem(item, day.items)}
      accessibilityHint={t(item.kind === 'routine' ? 'routine.openHint' : 'timewheel.openHint')}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.startText, item.done && styles.doneText]}>{start}</Text>
        {end ? <Text style={styles.endText}>{end}</Text> : null}
      </View>
      <View style={styles.rail}>
        {point ? (
          <View style={[styles.pointDot, item.done && styles.pointDone]} />
        ) : (
          <View style={[styles.bar, conflict && styles.barConflict, item.done && styles.barDone]} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, item.done && styles.doneText]}>{item.title}</Text>
        <Text style={styles.meta}>{item.done ? '✓ ' : ''}{itemDetails(item).join(' · ')}</Text>
        {conflict ? <Text style={styles.conflictText}>⚠ {overlapText(item, day.items)}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row', alignItems: 'stretch', paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  itemActive: { backgroundColor: COLORS.bgElevated, borderRadius: 12 },

  timeCol:   { width: 56, paddingTop: 2, paddingLeft: 4 },
  startText: { fontSize: 16, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  endText:   { fontSize: 13, color: COLORS.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] },

  rail:        { width: 20, alignItems: 'center' },
  bar:         { flex: 1, width: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  barConflict: { backgroundColor: COLORS.amber },
  barDone:     { backgroundColor: COLORS.bg4 },
  pointDot:    { width: 12, height: 12, borderRadius: 6, marginTop: 5, backgroundColor: COLORS.text },
  pointDone:   { backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.textMuted },

  body:         { flex: 1, paddingLeft: 8, paddingRight: 4 },
  title:        { fontSize: 16, fontWeight: '600', color: COLORS.text },
  meta:         { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },
  conflictText: { fontSize: 13, color: COLORS.text, marginTop: 4 },
  doneText:     { color: COLORS.textMuted, textDecorationLine: 'line-through' },

  gapRow:  { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  gapRail: { width: 2, height: 24, backgroundColor: COLORS.border2 },
  gapText: { fontSize: 13, color: COLORS.textMuted, paddingLeft: 8 },

  nowRow:  { flexDirection: 'row', alignItems: 'center', minHeight: 32, marginVertical: 4 },
  nowText: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginRight: 8, letterSpacing: 0.5 },
  nowLine: { flex: 1, height: 2, backgroundColor: COLORS.accent, borderRadius: 1 },
});
