// src/features/training/screens/TrainingHistoryScreen.js
//
// Historik: every finished workout, newest first (date, name, duration,
// exercises and sets). Opening one shows it read-only. No charts yet.
// Route param openId opens that workout (after finishing one, or from
// Træning's latest workouts).
import React, { useEffect, useMemo, useState } from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../../../config/colors';
import { t } from '../../../core/i18n';
import { useWorkoutHistory } from '../store';
import { historyList } from '../history';
import { HistoryRow } from '../components/HistoryRow';
import { WorkoutDetailSheet } from '../components/WorkoutDetailSheet';

export default function TrainingHistoryScreen() {
  const navigation = useNavigation();
  const openId = useRoute().params?.openId ?? null;
  const history = useWorkoutHistory();
  const sessions = useMemo(() => historyList(history), [history]);
  const [shownId, setShownId] = useState(null);

  useEffect(() => {
    if (!openId) return;
    setShownId(openId);
    navigation.setParams({ openId: null });
  }, [openId, navigation]);

  const shown = shownId ? sessions.find(session => session.id === shownId) : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {sessions.length === 0 ? <Text style={styles.quiet}>{t('training.history.empty')}</Text> : null}
      {sessions.map(session => <HistoryRow key={session.id} session={session} onPress={() => setShownId(session.id)} />)}
      {shown ? <WorkoutDetailSheet session={shown} onClose={() => setShownId(null)} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  quiet:  { fontSize: 15, lineHeight: 22, color: COLORS.textMuted },
});
