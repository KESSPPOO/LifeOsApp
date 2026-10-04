// src/features/timewheel/screens/TimewheelScreen.js
//
// Tidshjul: where am I in the day, what is happening now, what is next,
// and the shape of the day, at a glance. Three layers, top to bottom:
//   1. NU / NÆSTE (the same rule and the same cards as I dag; on another
//      day "Første planlagte" or a short summary, never a fake "now")
//   2. the compact 24-hour ring (orientation)
//   3. the linear timeline (detail; every item is here, with words)
// It is a view over the stored tasks and routines (buildDay in ../logic.js) and stores
// nothing of its own. Tapping an item, or "Åbn" / "Flyt" on an overlap,
// opens the same task sheet as Plan (useEntryEditor). Nothing is ever moved
// automatically.
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../../config/colors';
import { LinkRow } from '../../../components/LinkRow';
import { t, formatDateLong, formatRelativeDay } from '../../../core/i18n';
import { localDateKey, addDays, isoWeekNumber } from '../../../core/time/dates';
import { minutesOfDay } from '../../../core/time/timeOfDay';
import { useNow } from '../../../core/time/useNow';
import { useJournal, useTickedThisVisit } from '../../tasks/store';
import { useRoutines, useRoutineLog } from '../../routines/store';
import { useRoutineChecklist } from '../../routines/useRoutineChecklist';
import { describeItem } from '../../tasks/items';
import { FocusLabel, ItemRow } from '../../tasks/components/ItemRow';
import { useEntryEditor } from '../../plan/useEntryEditor';
import { buildDay, timelineRows } from '../logic';
import { clockFor, relativeDayLabel } from '../../schedule/day';
import { DayRing } from '../components/DayRing';
import { Timeline } from '../components/Timeline';
import { ConflictPanel } from '../../schedule/ConflictPanel';
import { DateHeader } from '../../schedule/DateHeader';
import { useScheduleItemActions } from '../../schedule/useScheduleItemActions';

const FLEXIBLE_SHOWN = 3;

export default function TimewheelScreen() {
  const navigation = useNavigation();
  const journal = useJournal();
  const routines = useRoutines();
  const routineLog = useRoutineLog();
  const { openChecklist, checklistElement } = useRoutineChecklist();
  const [now, sync] = useNow();
  const today = localDateKey(now);
  const nowMinutes = minutesOfDay(now);
  const { openEditor, editorElements } = useEntryEditor({ today, sync });

  // null = follow today (also across midnight); a date once the user steps.
  const [selected, setSelected] = useState(null);
  const date = selected ?? today;
  const step = (days) => {
    const next = addDays(date, days);
    setSelected(next === today ? null : next);
  };

  // Tasks ticked here stay visible in NU/NÆSTE's source list (as on I dag).
  const [keepVisibleIds, tick] = useTickedThisVisit(sync);
  const clock = clockFor(date, today, nowMinutes);
  const day = useMemo(
    () => buildDay({ journal, date, today, nowMinutes: clock, keepVisibleIds, routines, routineLog }),
    [journal, date, today, clock, keepVisibleIds, routines, routineLog],
  );
  const rows = useMemo(() => timelineRows(day), [day]);

  const toggle = (item) => tick(item.id);
  // A task opens the task sheet, a routine its day's checklist; "Flyt" a
  // task's time field or the routine's template (shared with Kalender).
  const { open, move } = useScheduleItemActions({ openEditor, openChecklist });

  const relativeLabel = relativeDayLabel(date, today);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Day navigation ── */}
        <DateHeader
          title={formatDateLong(date)}
          subline={[relativeLabel, t('today.week', { week: isoWeekNumber(date) })].filter(Boolean).join(' · ')}
          prevLabel={t('timewheel.prevDay')}
          nextLabel={t('timewheel.nextDay')}
          onStep={step}
          onToday={date !== today ? () => setSelected(null) : null}
        />

        {/* ── 1. NU / NÆSTE ── */}
        {day.relation === 'today' ? (
          <>
            <FocusLabel text={t('today.now')} accent />
            {day.focus.now ? (
              <ItemRow item={day.focus.now} meta={describeItem(day.focus.now, today)} onToggle={toggle} onOpen={open} variant="now" />
            ) : (
              <Text style={styles.quiet}>{t('timewheel.nothingNow')}</Text>
            )}
            {day.focus.next ? (
              <>
                <FocusLabel text={t('today.next')} />
                <ItemRow item={day.focus.next} meta={describeItem(day.focus.next, today)} onToggle={toggle} onOpen={open} variant="next" />
              </>
            ) : null}
          </>
        ) : null}
        {day.tickedHere.map(item => (
          <ItemRow key={`ticked-${item.id}`} item={item} meta={describeItem(item, today)} onToggle={toggle} />
        ))}
        {day.relation === 'future' && day.focus.first ? (
          <>
            <FocusLabel text={t('timewheel.first')} accent />
            <ItemRow
              item={day.focus.first}
              meta={describeItem(day.focus.first, today, { plannedDay: false })}
              onToggle={toggle}
              onOpen={open}
              variant="next"
            />
          </>
        ) : null}
        {day.relation === 'past' && day.items.length > 0 ? (
          <Text style={styles.quiet}>{t('timewheel.pastSummary', { done: day.done, total: day.items.length })}</Text>
        ) : null}

        {/* ── 2. The 24-hour overview ── */}
        <View style={styles.ring}>
          <DayRing day={day} />
        </View>

        {/* ── Overlaps: shown, never resolved automatically ── */}
        {day.conflicts.length > 0 ? <ConflictPanel conflicts={day.conflicts} onOpen={open} onMove={move} /> : null}

        {/* ── 3. The timeline ── */}
        <Text style={styles.sectionTitle} accessibilityRole="header">{t('timewheel.timeline')}</Text>
        {day.items.length > 0 ? (
          <>
            {day.state === 'allDone' ? <Text style={styles.quiet}>{t('timewheel.allDone')}</Text> : null}
            <Timeline day={day} rows={rows} onOpen={open} />
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('timewheel.empty.title')}</Text>
            <Text style={styles.emptyBody}>
              {t(day.state === 'onlyFlexible' ? 'timewheel.empty.flexible'
                : day.relation === 'past' ? 'timewheel.empty.past' : 'timewheel.empty.open')}
            </Text>
          </View>
        )}

        {/* ── Flexible tasks: secondary, never placed on the timeline ── */}
        {day.flexibleRoutines.length > 0 ? (
          <View style={styles.flexible}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{t('today.routines')}</Text>
            {day.flexibleRoutines.map(item => (
              <ItemRow key={item.id} item={item} meta={describeItem(item, today)} onOpen={open} />
            ))}
          </View>
        ) : null}

        {day.flexible.length > 0 ? (
          <View style={styles.flexible}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t(day.relation === 'today' ? 'timewheel.flexibleToday' : 'timewheel.flexibleDay')}
            </Text>
            {day.flexible.slice(0, FLEXIBLE_SHOWN).map(task => (
              <Text key={task.id} style={styles.flexibleItem} numberOfLines={1}>
                · {task.text}{task.date < date ? ` (${t('task.meta.carriedOver', { day: formatRelativeDay(task.date, today) })})` : ''}
              </Text>
            ))}
            <LinkRow
              label={t('timewheel.seeInPlan')}
              meta={t('timewheel.flexibleCount', { count: day.flexible.length })}
              onPress={() => navigation.navigate('journal')}
            />
          </View>
        ) : null}
      </ScrollView>
      {editorElements}
      {checklistElement}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },

  quiet: { fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginBottom: 16 },

  ring: { marginTop: 4, marginBottom: 20 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },

  empty:      { paddingVertical: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  emptyBody:  { fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginTop: 6 },

  flexible:     { marginTop: 28 },
  flexibleItem: { fontSize: 15, color: COLORS.textMuted, marginBottom: 4 },
});
