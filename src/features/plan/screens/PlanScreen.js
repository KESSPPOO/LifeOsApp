// src/features/plan/screens/PlanScreen.js
//
// Plan: a calm view of the day and everything after it. Replaces the old
// Tasks screen (JournalScreen) on the same route and the same stored list
// (`journal`), with the same abilities: add (bottom composer), edit and
// delete (sheet), tick off, habits with their week, drag to reorder, clear
// all. Grouping and every list change are pure functions in ../logic.js.
//
// Time-bound and flexible items are kept apart: today's timed tasks are a
// time-ordered list with the time in its own column; tasks without a time
// follow under their own heading. Timed tasks never disappear when their
// time passes; they stay, open, with "Tidspunktet er passeret".
//
// Kept from the old screen (see its history for the details):
// - The whole screen, list AND composer, is ONE KeyboardAvoidingView, so the
//   composer is pushed above the keyboard on Android.
// - Tasks ticked during this visit stay visible (dimmed) in "Overskredet",
//   so a tap can be undone (toggledIds -> groupJournal keepVisibleIds).
// - Drag-to-reorder (DraggableList) for the lists whose order is the
//   user's: today's untimed tasks, undated tasks and habits. Those rows
//   have a fixed height, which DraggableList needs.
import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { COLORS } from '../../../config/colors';
import { CheckButton } from '../../../components/CheckButton';
import { CustomAlert } from '../../../components/CustomAlert';
import { DraggableList } from '../../../components/DraggableList';
import { capitalize } from '../../../data/helpers';
import { computeStreak } from '../../../data/tasks';
import { t, formatDateLong, formatRelativeDay, formatDuration } from '../../../core/i18n';
import { localDateKey, addDays } from '../../../core/time/dates';
import { minutesOfDay } from '../../../core/time/timeOfDay';
import { useNow } from '../../../core/time/useNow';
import { useJournal, useSetJournal, useToggleEntry } from '../../tasks/store';
import { taskItem, describeItem } from '../../tasks/items';
import {
  groupPlan, addTask, updateTask, addHabit, updateHabit, deleteEntry, reorderSection, formFromEntry,
} from '../logic';
import { TaskSheet } from '../components/TaskSheet';
import { Composer } from '../components/Composer';

const TASK_ROW_HEIGHT = 64;
const HABIT_ROW_HEIGHT = 88;

export default function PlanScreen() {
  const journal = useJournal();
  const setJournal = useSetJournal();
  const [now, sync] = useNow();
  const toggleEntry = useToggleEntry(sync);
  const today = localDateKey(now);
  const nowMinutes = minutesOfDay(now);

  const [toggledIds, setToggledIds] = useState(() => new Set());
  const plan = useMemo(() => groupPlan(journal, today, toggledIds), [journal, today, toggledIds]);

  // { key, kind: 'task' | 'habit', id (null = new), initial, onSaved }
  const [sheet, setSheet] = useState(null);
  const sheetKey = useRef(0);
  const [alertConfig, setAlertConfig] = useState(null);
  const closeAlert = () => setAlertConfig(null);

  // ── Actions ─────────────────────────────────────────────────────────────
  const toggle = (id) => {
    setToggledIds(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
    toggleEntry(id);
  };

  // Today at the moment of an action (also moves the screen to a new day).
  const currentDay = () => localDateKey(sync());

  const addFromComposer = (text, date) =>
    setJournal(prev => addTask(prev, { text, subject: '', priority: 'medium', date }));

  const openSheet = (kind, entry, onSaved) => {
    sync(); // the sheet's "I dag" / "I morgen" use the current day
    sheetKey.current += 1;
    setSheet({ key: sheetKey.current, kind, id: entry.id ?? null, initial: formFromEntry(entry), onSaved });
  };

  const saveSheet = (fields) => {
    const { kind, id, onSaved } = sheet;
    setJournal(prev => {
      if (kind === 'habit') return id === null ? addHabit(prev, fields) : updateHabit(prev, id, fields);
      return id === null ? addTask(prev, fields) : updateTask(prev, id, fields);
    });
    onSaved?.();
    setSheet(null);
  };

  const confirmDelete = () => {
    const entry = journal.find(x => x.id === sheet.id);
    setAlertConfig({
      title: t('taskForm.delete'),
      message: t('taskForm.deleteMessage', { title: entry?.text ?? '' }),
      buttons: [
        { text: t('taskForm.cancel'), style: 'cancel', onPress: closeAlert },
        { text: t('taskForm.delete'), style: 'destructive', onPress: () => {
          setJournal(prev => deleteEntry(prev, sheet.id));
          closeAlert();
          setSheet(null);
        } },
      ],
    });
  };

  const confirmClearAll = () => setAlertConfig({
    title: t('plan.clearAllTitle'),
    message: t('plan.clearAllMessage', { count: journal.length }),
    buttons: [
      { text: t('taskForm.cancel'), style: 'cancel', onPress: closeAlert },
      { text: t('plan.clearAllTitle'), style: 'destructive', onPress: () => { setJournal([]); closeAlert(); } },
    ],
  });

  const reorder = (reordered) => setJournal(prev => reorderSection(prev, reordered));

  // ── Rows ────────────────────────────────────────────────────────────────
  const renderTask = (task, { timeColumn = false, fixed = false } = {}) => {
    const item = taskItem(task, today, nowMinutes);
    const meta = [
      timeColumn ? null : item.timeLabel,
      describeItem(item, today, { plannedDay: false }),
      task.subject,
    ].filter(Boolean).join(' · ');
    return (
      <TaskRow
        key={task.id}
        item={item}
        meta={meta}
        timeColumn={timeColumn}
        fixed={fixed}
        onToggle={() => toggle(task.id)}
        onOpen={() => openSheet('task', task)}
      />
    );
  };

  const reorderableTasks = (tasks) => (
    <DraggableList
      items={tasks}
      keyExtractor={(task) => String(task.id)}
      onReorder={reorder}
      itemHeight={TASK_ROW_HEIGHT}
      renderItem={(task) => renderTask(task, { fixed: true })}
    />
  );

  const todayTasks = [...plan.timedToday, ...plan.flexibleToday];

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
        <View style={styles.header}>
          <Text style={styles.date} accessibilityRole="header">{formatDateLong(today)}</Text>
          {plan.progress.total > 0 ? (
            <Text style={styles.subline}>{t('task.progress', plan.progress)}</Text>
          ) : null}
        </View>

        <Section title={t('plan.today')}>
          {plan.timedToday.length > 0 ? (
            <>
              <SubLabel text={t('plan.timed')} />
              {plan.timedToday.map(task => renderTask(task, { timeColumn: true }))}
            </>
          ) : null}
          {plan.flexibleToday.length > 0 ? (
            <>
              <SubLabel text={t('plan.flexible')} />
              {reorderableTasks(plan.flexibleToday)}
            </>
          ) : null}
          {todayTasks.length === 0 ? <Text style={styles.muted}>{t('plan.todayEmpty')}</Text> : null}
        </Section>

        {plan.overdue.length > 0 ? (
          <Section title={t('plan.overdue')}>
            {plan.overdue.map(task => renderTask(task))}
          </Section>
        ) : null}

        {plan.upcomingDays.length > 0 ? (
          <Section title={t('plan.upcoming')}>
            {plan.upcomingDays.map(day => (
              <View key={day.date}>
                <SubLabel text={capitalize(formatRelativeDay(day.date, today))} />
                {day.tasks.map(task => renderTask(task))}
              </View>
            ))}
          </Section>
        ) : null}

        {plan.noDate.length > 0 ? (
          <Section title={t('plan.noDate')}>{reorderableTasks(plan.noDate)}</Section>
        ) : null}

        <Section
          title={t('plan.habits')}
          action={{ label: t('plan.addHabit'), onPress: () => openSheet('habit', { text: '', icon: '🌟' }) }}
        >
          <DraggableList
            items={plan.habits}
            keyExtractor={(habit) => String(habit.id)}
            onReorder={reorder}
            itemHeight={HABIT_ROW_HEIGHT}
            renderItem={(habit) => (
              <HabitRow
                habit={habit}
                today={today}
                onToggle={() => toggle(habit.id)}
                onOpen={() => openSheet('habit', habit)}
              />
            )}
          />
        </Section>

        {journal.length === 0 ? (
          <Text style={styles.muted}>{t('plan.empty')}</Text>
        ) : (
          <>
            <Text style={styles.hint}>{t('plan.reorderHint')}</Text>
            <TouchableOpacity onPress={confirmClearAll} style={styles.clearAll} accessibilityRole="button">
              <Text style={styles.clearAllText}>{t('plan.clearAll')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Composer
        currentDay={currentDay}
        onAdd={addFromComposer}
        onDetails={(text, date, clear) => openSheet('task', { text, date }, clear)}
      />

      {sheet ? (
        <TaskSheet
          key={sheet.key}
          kind={sheet.kind}
          editing={sheet.id !== null}
          initial={sheet.initial}
          today={today}
          onSave={saveSheet}
          onDelete={confirmDelete}
          onClose={() => setSheet(null)}
        />
      ) : null}
      <CustomAlert config={alertConfig} />
    </KeyboardAvoidingView>
  );
}

function Section({ title, action, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {action ? (
          <TouchableOpacity onPress={action.onPress} style={styles.sectionAction} accessibilityRole="button" accessibilityLabel={action.label}>
            <Text style={styles.sectionActionText}>+ {action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SubLabel({ text }) {
  return <Text style={styles.subLabel} accessibilityRole="header">{text}</Text>;
}

/**
 * A task: the time in its own column (today's timed list), the title and a
 * quiet description (tap to edit), and the check button.
 */
function TaskRow({ item, meta, timeColumn, fixed, onToggle, onOpen }) {
  const active = !item.done && item.status === 'active';
  return (
    <View style={[styles.row, fixed && styles.fixedTaskRow, active && styles.rowActive]}>
      {timeColumn ? (
        <View style={styles.timeCol}>
          <Text style={[styles.timeText, item.done && styles.doneText]}>{item.startTime}</Text>
          {item.durationMinutes ? <Text style={styles.timeSub}>{formatDuration(item.durationMinutes)}</Text> : null}
        </View>
      ) : null}
      <TouchableOpacity
        style={styles.rowText}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={[timeColumn ? item.timeLabel : null, item.title, meta].filter(Boolean).join(', ')}
        accessibilityHint={t('plan.openHint')}
      >
        <Text style={[styles.rowTitle, item.done && styles.doneText]} numberOfLines={fixed ? 1 : undefined}>
          {item.title}
        </Text>
        {meta ? <Text style={styles.meta} numberOfLines={fixed ? 1 : undefined}>{meta}</Text> : null}
      </TouchableOpacity>
      <CheckButton checked={item.done} onPress={onToggle} label={item.title} />
    </View>
  );
}

/** A habit: name, streak and the last seven days; the check is today's. */
function HabitRow({ habit, today, onToggle, onOpen }) {
  const history = habit.history || {};
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const weekCount = week.filter(d => history[d]).length;
  // Computed, not the cached `streak` field (which goes stale after a
  // missed day; see docs/LIFEOS_PLAN.md § 3).
  const streak = computeStreak(history, today);
  const summary = streak > 0 ? t('plan.streak', { count: streak }) : t('plan.week', { count: weekCount });
  return (
    <View style={[styles.row, styles.fixedHabitRow]}>
      <TouchableOpacity
        style={styles.rowText}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={[habit.text, summary, streak > 0 ? t('plan.week', { count: weekCount }) : null].filter(Boolean).join(', ')}
        accessibilityHint={t('plan.openHint')}
      >
        <Text style={styles.rowTitle} numberOfLines={1}>{habit.icon ? `${habit.icon}  ` : ''}{habit.text}</Text>
        <Text style={styles.meta} numberOfLines={1}>{streak > 0 ? `🔥 ${summary}` : summary}</Text>
        <View style={styles.week}>
          {week.map(d => (
            <View key={d} style={[styles.dot, history[d] && styles.dotDone, d === today && styles.dotToday]} />
          ))}
        </View>
      </TouchableOpacity>
      <CheckButton checked={Boolean(history[today])} onPress={onToggle} label={habit.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  header:  { marginBottom: 20 },
  date:    { fontSize: 24, fontWeight: '700', color: COLORS.text, letterSpacing: -0.3 },
  subline: { fontSize: 15, color: COLORS.textMuted, marginTop: 6 },

  section:           { marginBottom: 24 },
  sectionHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  sectionTitle:      { fontSize: 18, fontWeight: '700', color: COLORS.text },
  sectionAction:     { minHeight: 44, justifyContent: 'center', paddingLeft: 12 },
  sectionActionText: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  subLabel:          { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, marginTop: 8, marginBottom: 2 },
  muted:             { fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginVertical: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center', minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  fixedTaskRow:  { height: TASK_ROW_HEIGHT, backgroundColor: COLORS.bg },
  fixedHabitRow: { height: HABIT_ROW_HEIGHT, backgroundColor: COLORS.bg },
  // The active task gets a quiet surface; "I gang til …" says it in words.
  rowActive: { backgroundColor: COLORS.bgElevated, borderRadius: 12, paddingLeft: 8, marginVertical: 2 },
  timeCol:   { width: 64 },
  timeText:  { fontSize: 16, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  timeSub:   { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  rowText:   { flex: 1, minHeight: 48, justifyContent: 'center', paddingVertical: 6, paddingRight: 8 },
  rowTitle:  { fontSize: 16, color: COLORS.text },
  meta:      { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },
  doneText:  { color: COLORS.textMuted, textDecorationLine: 'line-through' },

  week:     { flexDirection: 'row', marginTop: 8 },
  dot:      { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.bg4, marginRight: 6 },
  dotDone:  { backgroundColor: COLORS.green },
  dotToday: { borderWidth: 2, borderColor: COLORS.textMuted },

  hint:         { fontSize: 13, color: COLORS.textMuted, marginBottom: 8 },
  clearAll:     { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  clearAllText: { fontSize: 15, color: COLORS.red },
});
