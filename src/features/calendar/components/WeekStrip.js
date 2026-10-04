// src/features/calendar/components/WeekStrip.js
//
// Uge: seven rows, Monday first. Each row is the day (Man 5.), a thin track
// where every timed item is a bar at its real time (a point in time is a
// short upright tick; overlapping items get their own line, so none hides
// another) and what the day holds in words ("3 ting", "⚠ 1"). No titles:
// the selected day's items are listed below the strip. Tapping a row
// selects that day. Every row is read as one sentence
// ("Mandag den 5. oktober, 3 planlagte ting, 1 konflikt") with its
// selected state; the hour labels and the bars are decoration.
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { t, weekdayName } from '../../../core/i18n';
import { weekdayIndex } from '../../../core/time/dates';
import { describeWeekDay } from '../logic';

const LANE_TOP = [5, 13, 21];
const pct = (fraction) => `${fraction * 100}%`;

export const WeekStrip = memo(function WeekStrip({ week, selectedDate, onSelect }) {
  return (
    <View>
      <View style={styles.axisRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.labelCol} />
        <View style={styles.axis}>
          {week.axis.map(mark => (
            <Text key={mark.label} style={[styles.axisText, { left: pct(mark.left) }]}>{mark.label}</Text>
          ))}
        </View>
        <View style={styles.countCol} />
      </View>
      {week.days.map(day => (
        <WeekRow key={day.date} day={day} selected={day.date === selectedDate} axis={week.axis} onSelect={onSelect} />
      ))}
    </View>
  );
});

function WeekRow({ day, selected, axis, onSelect }) {
  return (
    <TouchableOpacity
      onPress={() => onSelect(day.date)}
      style={[styles.row, selected && styles.rowSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={describeWeekDay(day)}
      accessibilityHint={t('calendar.a11y.weekHint')}
    >
      <View style={styles.labelCol}>
        <Text style={[styles.weekday, selected && styles.strong]}>{weekdayName(weekdayIndex(day.date) + 1, 'short')}</Text>
        {/* Today: the date sits in a filled pill (a shape, not only a colour). */}
        <Text style={[styles.dayNumber, day.isToday && styles.todayNumber]}>{Number(day.date.slice(8))}.</Text>
      </View>
      <View style={styles.track}>
        {axis.map(mark => <View key={mark.label} style={[styles.gridLine, { left: pct(mark.left) }]} />)}
        {day.items.map(item => (item.end === null ? (
          <View key={item.id} style={[styles.tick, item.done && styles.barDone, { left: pct(item.bar.left) }]} />
        ) : (
          <View
            key={item.id}
            style={[
              styles.bar,
              item.overlapsWith.length > 0 && styles.barConflict,
              item.done && styles.barDone,
              { left: pct(item.bar.left), width: pct(item.bar.width), top: LANE_TOP[Math.min(item.lane, LANE_TOP.length - 1)] },
            ]}
          />
        )))}
      </View>
      <View style={styles.countCol}>
        <Text style={styles.count}>{day.count > 0 ? t('calendar.count', { count: day.count }) : t('calendar.dayOpen')}</Text>
        {day.conflictCount > 0 ? <Text style={styles.conflict}>⚠ {day.conflictCount}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  axisRow:  { flexDirection: 'row', height: 20, paddingHorizontal: 8 },
  axis:     { flex: 1 },
  axisText: { position: 'absolute', width: 24, marginLeft: -12, textAlign: 'center', fontSize: 12, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },

  row: {
    flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 8, marginBottom: 2,
    borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
  },
  rowSelected: { backgroundColor: COLORS.bgElevated, borderColor: COLORS.border2 },

  labelCol:    { width: 52 },
  weekday:     { fontSize: 14, color: COLORS.text },
  strong:      { fontWeight: '700' },
  dayNumber:   { alignSelf: 'flex-start', fontSize: 13, color: COLORS.textMuted, marginTop: 1, paddingHorizontal: 4, marginLeft: -4, borderRadius: 8, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  todayNumber: { backgroundColor: COLORS.accentDim, color: COLORS.text, fontWeight: '700' },

  track:       { flex: 1, height: 32, borderRadius: 6, backgroundColor: COLORS.bg2 },
  gridLine:    { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  bar:         { position: 'absolute', height: 6, minWidth: 3, borderRadius: 3, backgroundColor: COLORS.accent },
  barConflict: { backgroundColor: COLORS.amber },
  barDone:     { backgroundColor: COLORS.border2 },
  tick:        { position: 'absolute', top: 4, bottom: 4, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: COLORS.text },

  countCol: { width: 64, paddingLeft: 8 },
  count:    { fontSize: 13, color: COLORS.textMuted },
  conflict: { fontSize: 13, color: COLORS.text, marginTop: 2 },
});
