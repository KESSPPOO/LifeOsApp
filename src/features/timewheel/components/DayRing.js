// src/features/timewheel/components/DayRing.js
//
// The compact 24-hour overview: orientation, not detail. Midnight at the
// top, time running clockwise (06 right, 12 bottom, 18 left), every mark at
// its real minute of the day (arcPath / ringPoint in ../logic.js).
//   - a task with a duration is an arc; overlapping ones move to inner
//     rings (lanes), so they never draw on top of each other
//   - a task without a duration is a dot on the outer ring (a point, not
//     an interval)
//   - finished tasks are drawn thin and muted; overlapping open tasks amber
//   - on today, the part of the day that has passed is a lighter track and
//     a hand points at the current time
// It is supplemental: screen readers get a one-line summary here, and every
// item with its details in the timeline below.
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Line, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../../../config/colors';
import { t } from '../../../core/i18n';
import { minutesToTime } from '../../../core/time/timeOfDay';
import { arcPath, ringPoint } from '../logic';

const SIZE = 216;
const CENTER = SIZE / 2;
const OUTER = CENTER - 14;   // outermost lane
const LANE_GAP = 13;
const STROKE = 9;
const HOURS = [0, 6, 12, 18];

export function DayRing({ day }) {
  const now = day.nowMinute;
  const lanes = Math.max(1, ...day.items.map(item => item.lane + 1));
  const innermost = OUTER - (lanes - 1) * LANE_GAP;
  const labelRadius = innermost - 26;
  const conflictIds = new Set(day.conflicts.flat().map(item => item.id));

  const summary = [
    t('timewheel.a11y.ring', { count: day.items.length }),
    now !== null ? t('timewheel.a11y.ringNow', { time: minutesToTime(now) }) : null,
  ].filter(Boolean).join('. ');

  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityRole="image" accessibilityLabel={summary}>
      <Svg width={SIZE} height={SIZE}>
        {/* Track for each lane in use */}
        {Array.from({ length: lanes }, (_, lane) => (
          <Circle
            key={`track-${lane}`}
            cx={CENTER} cy={CENTER} r={OUTER - lane * LANE_GAP}
            fill="none" stroke={COLORS.bg3} strokeWidth={STROKE}
          />
        ))}
        {/* Today: the part of the day already behind us */}
        {now !== null && now > 0 ? (
          <Path d={arcPath(0, now, OUTER, CENTER)} fill="none" stroke={COLORS.bg4} strokeWidth={STROKE} />
        ) : null}

        {/* Hour marks: 00, 06, 12, 18 */}
        {HOURS.map(hour => {
          const inner = ringPoint(hour * 60, innermost - 9, CENTER);
          const outer = ringPoint(hour * 60, innermost - 4, CENTER);
          const label = ringPoint(hour * 60, labelRadius, CENTER);
          return (
            <React.Fragment key={hour}>
              <Line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={COLORS.textMuted} strokeWidth={1.5} />
              <SvgText
                x={label.x} y={label.y + 4}
                fontSize={12} fill={COLORS.textMuted} textAnchor="middle"
              >
                {String(hour).padStart(2, '0')}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Tasks with a duration: arcs on their lane */}
        {day.items.filter(item => !item.point).map(item => {
          const d = arcPath(item.start, item.end, OUTER - item.lane * LANE_GAP, CENTER);
          if (!d) return null;
          const stroke = item.done ? COLORS.textMuted : conflictIds.has(item.id) ? COLORS.amber : COLORS.accent;
          return (
            <Path
              key={`arc-${item.id}`}
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={item.done ? 4 : STROKE}
              strokeOpacity={item.done ? 0.6 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* Tasks without a duration: points on the outer ring */}
        {day.items.filter(item => item.point).map(item => {
          const p = ringPoint(item.start, OUTER, CENTER);
          return (
            <Circle
              key={`point-${item.id}`}
              cx={p.x} cy={p.y} r={5.5}
              fill={item.done ? COLORS.bg : COLORS.text}
              stroke={item.done ? COLORS.textMuted : COLORS.bg}
              strokeWidth={2}
            />
          );
        })}

        {/* Now: hand + dot, and the time in the middle */}
        {now !== null ? (() => {
          const tip = ringPoint(now, OUTER + 6, CENTER);
          const base = ringPoint(now, innermost - 14, CENTER);
          return (
            <>
              <Line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke={COLORS.text} strokeWidth={2.5} strokeLinecap="round" />
              <Circle cx={tip.x} cy={tip.y} r={4} fill={COLORS.text} />
              <SvgText
                x={CENTER} y={CENTER + 8}
                fontSize={22} fontWeight="700" fill={COLORS.text} textAnchor="middle"
              >
                {minutesToTime(now)}
              </SvgText>
            </>
          );
        })() : null}
      </Svg>
    </View>
  );
}
