// src/features/calendar/screens/CalendarScreen.js
//
// Kalender: what does this day, or this week, look like? Two modes over one
// selected date (kept while the screen is open, never stored): Uge (the
// default; seven days at a glance, the selected day listed below) and Dag
// (the day on a time axis). A view over the stored tasks and the derived
// routine occurrences (../logic.js on the shared per-date schedule); it
// stores nothing of its own (ADR-009).
//
// Everything opens the flows that already exist: a task the shared task
// sheet (useEntryEditor; "Flyt" at its time field), a routine its day's
// checklist, and "Flyt" on a routine its template on Rutiner (a routine's
// time belongs to the routine, on every day). "Ny opgave" opens the same
// sheet with the selected date filled in. Nothing is moved automatically.
import React, { useCallback, useMemo, useReducer } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../../config/colors';
import { Choice } from '../../../components/Choice';
import { capitalize } from '../../../data/helpers';
import { t, formatDateLong, formatRelativeDay } from '../../../core/i18n';
import { localDateKey, daysBetween } from '../../../core/time/dates';
import { minutesOfDay } from '../../../core/time/timeOfDay';
import { useNow } from '../../../core/time/useNow';
import { useJournal } from '../../tasks/store';
import { FocusLabel } from '../../tasks/components/ItemRow';
import { useRoutines, useRoutineLog } from '../../routines/store';
import { useRoutineChecklist } from '../../routines/useRoutineChecklist';
import { useEntryEditor } from '../../plan/useEntryEditor';
import { clockFor } from '../../schedule/day';
import { ConflictPanel } from '../../schedule/ConflictPanel';
import {
  INITIAL_CALENDAR, calendarReducer, selectedDate, calendarTitle, buildCalendarDay, buildCalendarWeek,
} from '../logic';
import { DayGrid } from '../components/DayGrid';
import { WeekStrip } from '../components/WeekStrip';
import { ScheduleRow } from '../components/ScheduleRow';

export default function CalendarScreen() {
  const navigation = useNavigation();
  const journal = useJournal();
  const routines = useRoutines();
  const routineLog = useRoutineLog();
  const [now, sync] = useNow();
  const today = localDateKey(now);
  const nowMinutes = minutesOfDay(now);
  const { openEditor, editorElements } = useEntryEditor({ today, sync });
  const { openChecklist, checklistElement } = useRoutineChecklist();

  const [state, dispatch] = useReducer(calendarReducer, INITIAL_CALENDAR);
  const { mode } = state;
  const date = selectedDate(state, today);
  const week = mode === 'week';

  // The clock matters only around today (clockFor); the week never needs it.
  const clock = clockFor(date, today, nowMinutes);
  const day = useMemo(
    () => buildCalendarDay({ journal, routines, routineLog, date, today, nowMinutes: clock }),
    [journal, routines, routineLog, date, today, clock],
  );
  const weekModel = useMemo(
    () => (week ? buildCalendarWeek({ journal, routines, routineLog, date, today }) : null),
    [week, journal, routines, routineLog, date, today],
  );

  // Stable, so the memoised grid and week do not re-render on every tick.
  const open = useCallback((item) => (item.kind === 'routine'
    ? openChecklist(item)
    : openEditor('task', item.task)), [openChecklist, openEditor]);
  const move = (item) => (item.kind === 'routine'
    ? navigation.navigate('routines', { editId: item.routineId })
    : openEditor('task', item.task, { focus: 'time' }));
  const select = useCallback((key) => dispatch({ type: 'select', date: key, today }), [today]);
  const step = (direction) => dispatch({ type: 'step', direction, today });
  const newTask = () => openEditor('task', { text: '', date });

  const { title, subline } = calendarTitle(mode, date, today);
  const relative = Math.abs(daysBetween(today, date)) <= 1 ? capitalize(formatRelativeDay(date, today)) : null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Date navigation ── */}
        <View style={styles.nav}>
          <TouchableOpacity
            onPress={() => step(-1)}
            style={styles.stepBtn}
            accessibilityRole="button"
            accessibilityLabel={t(week ? 'calendar.prevWeek' : 'calendar.prevDay')}
          >
            <Text style={styles.stepText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.titleCol}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <Text style={styles.subline}>{[week ? null : relative, subline].filter(Boolean).join(' · ')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => step(1)}
            style={styles.stepBtn}
            accessibilityRole="button"
            accessibilityLabel={t(week ? 'calendar.nextWeek' : 'calendar.nextDay')}
          >
            <Text style={styles.stepText}>›</Text>
          </TouchableOpacity>
        </View>
        {state.date !== null ? (
          <TouchableOpacity
            onPress={() => dispatch({ type: 'today' })}
            style={styles.todayBtn}
            accessibilityRole="button"
            accessibilityHint={t('calendar.todayHint')}
          >
            <Text style={styles.todayText}>{t('calendar.today')}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.controls}>
          <View style={styles.modes} accessibilityRole="radiogroup">
            <Choice label={t('calendar.mode.day')} selected={!week} onPress={() => dispatch({ type: 'mode', mode: 'day' })} />
            <Choice label={t('calendar.mode.week')} selected={week} onPress={() => dispatch({ type: 'mode', mode: 'week' })} />
          </View>
          <TouchableOpacity
            onPress={newTask}
            style={styles.newBtn}
            accessibilityRole="button"
            accessibilityLabel={t('calendar.newTaskHint', { day: formatRelativeDay(date, today) })}
          >
            <Text style={styles.newText}>+ {t('calendar.newTask')}</Text>
          </TouchableOpacity>
        </View>

        {week ? (
          <>
            <WeekStrip week={weekModel} onSelect={select} />
            {weekModel.projected ? <Text style={styles.note}>{t('calendar.projected')}</Text> : null}
            {weekModel.empty ? (
              <Text style={styles.quiet}>{t('calendar.weekOpen')}</Text>
            ) : (
              <View style={styles.detail}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle} accessibilityRole="header">
                    {[relative, formatDateLong(date)].filter(Boolean).join(' · ')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => dispatch({ type: 'mode', mode: 'day' })}
                    style={styles.showDay}
                    accessibilityRole="button"
                  >
                    <Text style={styles.showDayText}>{t('calendar.showDay')} ›</Text>
                  </TouchableOpacity>
                </View>
                {day.items.map(item => <ScheduleRow key={item.id} item={item} items={day.items} onOpen={open} />)}
                {day.state === 'empty' ? <EmptyDay day={day} /> : null}
                <Untimed items={day.untimed} onOpen={open} />
              </View>
            )}
          </>
        ) : (
          <>
            {day.projected ? <Text style={styles.note}>{t('calendar.projected')}</Text> : null}
            {day.conflicts.length > 0 ? <ConflictPanel conflicts={day.conflicts} onOpen={open} onMove={move} /> : null}
            {day.state === 'scheduled' ? <DayGrid day={day} onOpen={open} /> : <EmptyDay day={day} />}
            <Untimed items={day.untimed} onOpen={open} />
          </>
        )}
      </ScrollView>
      {editorElements}
      {checklistElement}
    </View>
  );
}

/** Nothing with a time: says so calmly, and whether the day is open. */
function EmptyDay({ day }) {
  if (day.state === 'onlyUntimed') return <Text style={styles.emptyTitle}>{t('calendar.empty.untimed')}</Text>;
  if (day.relation === 'past') return <Text style={styles.quiet}>{t('calendar.empty.past')}</Text>;
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{t('calendar.empty.open')}</Text>
      <Text style={styles.quiet}>{t('calendar.empty.openBody')}</Text>
    </View>
  );
}

function Untimed({ items, onOpen }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.untimed}>
      <FocusLabel text={t('calendar.untimed')} />
      {items.map(item => <ScheduleRow key={item.id} item={item} onOpen={onOpen} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },

  nav:      { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stepBtn:  { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 30, color: COLORS.text, lineHeight: 34 },
  titleCol: { flex: 1, alignItems: 'center' },
  title:    { fontSize: 20, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  subline:  { fontSize: 14, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  todayBtn: {
    alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2, marginBottom: 4,
  },
  todayText: { fontSize: 15, fontWeight: '600', color: COLORS.text },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 8, marginBottom: 8 },
  modes:    { flexDirection: 'row' },
  newBtn: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, marginBottom: 8,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2,
  },
  newText: { fontSize: 15, fontWeight: '600', color: COLORS.text },

  note:  { fontSize: 13, lineHeight: 19, color: COLORS.textMuted, marginTop: 8, marginBottom: 8 },
  quiet: { fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginTop: 8 },

  detail:       { marginTop: 20 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  detailTitle:  { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.text },
  showDay:      { minHeight: 44, justifyContent: 'center', paddingLeft: 12 },
  showDayText:  { fontSize: 15, fontWeight: '600', color: COLORS.text },

  empty:      { paddingVertical: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginTop: 8 },

  untimed: { marginTop: 24 },
});
