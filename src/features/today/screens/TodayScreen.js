// src/features/today/screens/TodayScreen.js
//
// I dag: the start screen. Answers, top to bottom: what is happening now
// (NU), what is next (NÆSTE), and what else today holds. Everything comes
// from the stored tasks, habits, goals and groceries (buildToday in
// ../logic.js decides what goes where); nothing is invented.
//
// The screen mounts on every visit (AppNavigator), so the date and greeting
// are current whenever it is opened.
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../../config/colors';
import { localDateKey } from '../../../data/helpers';
import { toggleJournalEntry } from '../../../data/tasks';
import { t, formatDateLong } from '../../../core/i18n';
import { isoWeekNumber } from '../../../core/time/dates';
import { useJournal, useSetJournal } from '../../tasks/store';
import { useGoals } from '../../goals/store';
import { useGroceries } from '../../groceries/store';
import { buildToday, describeItem, describeGoal, greetingKey } from '../logic';
import { CheckButton } from '../components/CheckButton';

const EMPTY_TEXT = {
  empty:   { title: 'today.empty.title',   body: 'today.empty.body' },
  allDone: { title: 'today.allDone.title', body: 'today.allDone.body' },
};

const displayTitle = (item) => (item.icon ? `${item.icon}  ${item.title}` : item.title);

export default function TodayScreen({ userName }) {
  const navigation = useNavigation();
  const journal = useJournal();
  const setJournal = useSetJournal();
  const goals = useGoals();
  const groceries = useGroceries();

  const now = new Date();
  const today = localDateKey(now);
  // Tasks ticked during this visit stay visible (dimmed), so a tap can be
  // undone (same rule as the Tasks screen).
  const [keepVisibleIds, setKeepVisibleIds] = useState(() => new Set());
  const day = useMemo(
    () => buildToday({ journal, goals, groceries, today, keepVisibleIds }),
    [journal, goals, groceries, today, keepVisibleIds],
  );

  const toggle = (item) => {
    if (item.kind === 'task') {
      setKeepVisibleIds(prev => (prev.has(item.id) ? prev : new Set(prev).add(item.id)));
    }
    setJournal(prev => toggleJournalEntry(prev, item.id, today));
  };

  const greeting = t(greetingKey(now.getHours()));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.date} accessibilityRole="header">{formatDateLong(today)}</Text>
        <Text style={styles.subline}>
          {t('today.week', { week: isoWeekNumber(today) })}
          {' · '}
          {userName ? t('today.greetingName', { greeting, name: userName }) : greeting}
        </Text>
      </View>

      {/* NU / NÆSTE. The future Timewheel (day ring + timeline) takes this
          slot; it will feed timed items into the same NU/NÆSTE logic. */}
      <FocusLabel text={t('today.now')} accent />
      {day.now ? (
        <FocusItem item={day.now} meta={describeItem(day.now, today)} onToggle={toggle} primary />
      ) : (
        <View style={styles.emptyNow}>
          <Text style={styles.emptyTitle}>{t(EMPTY_TEXT[day.state].title)}</Text>
          <Text style={styles.emptyBody}>{t(EMPTY_TEXT[day.state].body)}</Text>
          {day.state === 'empty' ? (
            <LinkRow label={t('today.goToPlan')} onPress={() => navigation.navigate('journal')} />
          ) : null}
        </View>
      )}
      {day.total > 0 ? (
        <Text style={styles.progress}>{t('today.progress', { done: day.done, total: day.total })}</Text>
      ) : null}

      {day.next ? (
        <>
          <FocusLabel text={t('today.next')} />
          <FocusItem item={day.next} meta={describeItem(day.next, today)} onToggle={toggle} />
        </>
      ) : null}

      {/* ── Calm overview of the rest of today ── */}
      {day.rest.length > 0 ? (
        <Section title={t('today.rest')}>
          {day.rest.map(item => (
            <ItemRow key={item.id} item={item} meta={describeItem(item, today)} onToggle={toggle} />
          ))}
          {day.restMore > 0 ? (
            <LinkRow
              label={t('today.restMore', { count: day.restMore })}
              onPress={() => navigation.navigate('journal')}
            />
          ) : null}
        </Section>
      ) : null}

      {day.habits.length > 0 ? (
        <Section title={t('today.habits')}>
          {day.habits.map(item => (
            <ItemRow key={item.id} item={item} onToggle={toggle} />
          ))}
        </Section>
      ) : null}

      {day.goals.length > 0 ? (
        <Section title={t('today.goals')}>
          {day.goals.map(goal => (
            <LinkRow
              key={goal.id}
              label={goal.title}
              meta={describeGoal(goal, today)}
              onPress={() => navigation.navigate('goals')}
            />
          ))}
        </Section>
      ) : null}

      {day.shoppingCount > 0 ? (
        <View style={styles.section}>
          <LinkRow
            label={`🛒  ${t('today.shopping', { count: day.shoppingCount })}`}
            accessibilityLabel={t('today.shopping', { count: day.shoppingCount })}
            onPress={() => navigation.navigate('groceries')}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function FocusLabel({ text, accent }) {
  return (
    <View style={styles.focusLabelRow}>
      {accent ? <View style={styles.focusDot} /> : null}
      <Text style={styles.focusLabel} accessibilityRole="header">{text}</Text>
    </View>
  );
}

function FocusItem({ item, meta, onToggle, primary }) {
  return (
    <View style={[styles.focus, primary && styles.focusPrimary]}>
      <View style={styles.textCol}>
        <Text style={[styles.focusTitle, primary && styles.focusTitlePrimary, item.done && styles.doneText]}>
          {displayTitle(item)}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <CheckButton checked={item.done} onPress={() => onToggle(item)} label={item.title} />
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

function ItemRow({ item, meta, onToggle }) {
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={[styles.rowTitle, item.done && styles.doneText]}>{displayTitle(item)}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <CheckButton checked={item.done} onPress={() => onToggle(item)} label={item.title} />
    </View>
  );
}

/** A full-width row that opens another screen. */
function LinkRow({ label, meta, onPress, accessibilityLabel }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={[accessibilityLabel ?? label, meta].filter(Boolean).join(', ')}
    >
      <View style={styles.textCol}>
        <Text style={styles.rowTitle}>{label}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  header:  { marginBottom: 28 },
  date:    { fontSize: 26, fontWeight: '700', color: COLORS.text, letterSpacing: -0.3 },
  subline: { fontSize: 15, color: COLORS.textMuted, marginTop: 6 },

  focusLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  focusDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent, marginRight: 8 },
  focusLabel:    { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },

  focus: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 18,
    paddingVertical: 14, paddingLeft: 18, paddingRight: 8,
    marginBottom: 24,
  },
  focusPrimary: {
    backgroundColor: COLORS.bgElevated, borderColor: COLORS.border2,
    paddingVertical: 20, marginBottom: 10,
  },
  focusTitle:        { fontSize: 17, fontWeight: '600', color: COLORS.text },
  focusTitlePrimary: { fontSize: 21, lineHeight: 28 },

  emptyNow: {
    backgroundColor: COLORS.bgElevated, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8, marginBottom: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptyBody:  { fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginTop: 6, marginBottom: 6 },

  progress: { fontSize: 14, color: COLORS.textMuted, marginBottom: 24, marginLeft: 2 },

  section:      { marginTop: 8, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textMuted, marginBottom: 4 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 56, paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  textCol:  { flex: 1, paddingRight: 8 },
  rowTitle: { fontSize: 16, color: COLORS.text },
  meta:     { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },
  doneText: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  chevron:  { fontSize: 22, color: COLORS.textMuted, paddingHorizontal: 12 },
});
