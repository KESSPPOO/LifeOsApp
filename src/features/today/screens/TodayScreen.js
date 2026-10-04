// src/features/today/screens/TodayScreen.js
//
// I dag: the start screen. Answers, top to bottom: what is happening now
// (NU), what is next (NÆSTE), and what else today holds. Everything comes
// from the stored tasks, habits, goals and groceries (buildToday in
// ../logic.js decides what goes where); nothing is invented.
//
// The clock (useNow) refreshes every minute and when the app returns to the
// foreground, and is re-read on every tap, so a timed task becomes NU when
// its time comes and a screen left open overnight never shows, or writes
// to, yesterday.
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../../config/colors';
import { Card } from '../../../components/Card';
import { LinkRow } from '../../../components/LinkRow';
import { t, formatDateLong } from '../../../core/i18n';
import { localDateKey, isoWeekNumber } from '../../../core/time/dates';
import { minutesOfDay } from '../../../core/time/timeOfDay';
import { useNow } from '../../../core/time/useNow';
import { useJournal, useTickedThisVisit } from '../../tasks/store';
import { useGoals } from '../../goals/store';
import { useGroceries } from '../../groceries/store';
import { FocusLabel, ItemRow } from '../../tasks/components/ItemRow';
import { describeItem } from '../../tasks/items';
import { buildToday, describeGoal, greetingKey } from '../logic';

const EMPTY_TEXT = {
  empty:   { title: 'today.empty.title',   body: 'today.empty.body' },
  free:    { title: 'today.free.title',    body: 'today.free.body' },
  allDone: { title: 'today.allDone.title', body: 'today.allDone.body' },
};

export default function TodayScreen({ userName }) {
  const navigation = useNavigation();
  const journal = useJournal();
  const goals = useGoals();
  const groceries = useGroceries();

  const [now, sync] = useNow();
  const today = localDateKey(now);
  const nowMinutes = minutesOfDay(now);
  // Tasks ticked during this visit stay visible (dimmed), so a tap can be
  // undone (same rule as Plan and Tidshjul).
  const [keepVisibleIds, tick] = useTickedThisVisit(sync);
  const day = useMemo(
    () => buildToday({ journal, goals, groceries, today, nowMinutes, keepVisibleIds }),
    [journal, goals, groceries, today, nowMinutes, keepVisibleIds],
  );

  const toggle = (item) => tick(item.id);

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
        <ItemRow item={day.now} meta={describeItem(day.now, today)} onToggle={toggle} variant="now" />
      ) : (
        <Card style={styles.emptyNow}>
          <Text style={styles.emptyTitle}>{t(EMPTY_TEXT[day.state].title)}</Text>
          <Text style={styles.emptyBody}>{t(EMPTY_TEXT[day.state].body, { time: day.next?.startTime })}</Text>
          {day.state === 'empty' ? (
            <LinkRow label={t('today.goToPlan')} onPress={() => navigation.navigate('journal')} />
          ) : null}
        </Card>
      )}
      {day.total > 0 ? (
        <Text style={styles.progress}>{t('task.progress', { done: day.done, total: day.total })}</Text>
      ) : null}

      {day.next ? (
        <>
          <FocusLabel text={t('today.next')} />
          <ItemRow item={day.next} meta={describeItem(day.next, today)} onToggle={toggle} variant="next" />
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
              style={styles.divider}
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
              style={styles.divider}
            />
          ))}
        </Section>
      ) : null}

      {day.shoppingCount > 0 ? (
        <View style={styles.section}>
          <LinkRow
            icon="🛒"
            label={t('today.shopping', { count: day.shoppingCount })}
            onPress={() => navigation.navigate('groceries')}
            style={styles.divider}
          />
        </View>
      ) : null}
    </ScrollView>
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

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  header:  { marginBottom: 28 },
  date:    { fontSize: 26, fontWeight: '700', color: COLORS.text, letterSpacing: -0.3 },
  subline: { fontSize: 15, color: COLORS.textMuted, marginTop: 6 },

  emptyNow:   { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptyBody:  { fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginTop: 6, marginBottom: 6 },

  progress: { fontSize: 14, color: COLORS.textMuted, marginBottom: 24, marginLeft: 2 },

  section:      { marginTop: 8, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textMuted, marginBottom: 4 },

  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
});
