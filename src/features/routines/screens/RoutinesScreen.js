// src/features/routines/screens/RoutinesScreen.js
//
// Rutiner: the routine templates. Create, edit, pause, delete (with
// confirmation; the routine's history in the log is kept), and open
// today's checklist for a routine that occurs today. Reached from Mere,
// Plan, and "Rediger rutinen" on a checklist (route param editId opens that
// routine's editor). Nothing is created without the user: no demo routines.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../../../config/colors';
import { CustomAlert } from '../../../components/CustomAlert';
import { confirmDelete } from '../../../app/confirmDelete';
import { t } from '../../../core/i18n';
import { localDateKey } from '../../../core/time/dates';
import { useNow } from '../../../core/time/useNow';
import { useRoutines, useSetRoutines, useRoutineLog } from '../store';
import {
  addRoutine, updateRoutine, deleteRoutine, formFromRoutine, occurrencesOn, describeRoutine, describeProgress, newId,
} from '../model';
import { useRoutineChecklist } from '../useRoutineChecklist';
import { RoutineSheet } from '../components/RoutineSheet';

export default function RoutinesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const routines = useRoutines();
  const setRoutines = useSetRoutines();
  const log = useRoutineLog();
  const [now] = useNow();
  const today = localDateKey(now);

  // { key, id (null = new), initial }
  const [editor, setEditor] = useState(null);
  const editorKey = useRef(0);
  const [alertConfig, setAlertConfig] = useState(null);
  const closeAlert = () => setAlertConfig(null);

  const openEditor = (routine) => {
    editorKey.current += 1;
    setEditor({ key: editorKey.current, id: routine?.id ?? null, initial: formFromRoutine(routine) });
  };
  const { openChecklist, checklistElement } = useRoutineChecklist();
  // Today's occurrence per routine (those that occur today).
  const todayById = useMemo(
    () => new Map(occurrencesOn(routines, log, today).map(o => [o.routineId, o])),
    [routines, log, today],
  );

  // "Rediger rutinen" from a checklist elsewhere arrives as route param editId.
  const editId = route.params?.editId;
  useEffect(() => {
    if (!editId) return;
    const routine = routines.find(r => r.id === editId);
    if (routine) openEditor(routine);
    navigation.setParams({ editId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const save = (fields) => {
    const { id } = editor;
    setRoutines(prev => (id === null ? addRoutine(prev, newId(), fields, localDateKey(new Date())) : updateRoutine(prev, id, fields)));
    setEditor(null);
  };

  const askDelete = () => {
    const { id, initial } = editor;
    setAlertConfig(confirmDelete({
      message: t('routine.form.deleteMessage', { name: initial.name }),
      onConfirm: () => { setRoutines(prev => deleteRoutine(prev, id)); setEditor(null); },
      close: closeAlert,
    }));
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => openEditor(null)} style={styles.newBtn} accessibilityRole="button">
          <Text style={styles.newText}>+ {t('routines.new')}</Text>
        </TouchableOpacity>

        {routines.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('routines.empty.title')}</Text>
            <Text style={styles.emptyBody}>{t('routines.empty.body')}</Text>
          </View>
        ) : routines.map(routine => {
          const occurrence = todayById.get(routine.id);
          const progress = occurrence ? describeProgress(occurrence) : null;
          const meta = describeRoutine(routine);
          return (
            <View key={routine.id} style={styles.row}>
              <TouchableOpacity
                onPress={() => openEditor(routine)}
                style={styles.rowText}
                accessibilityRole="button"
                accessibilityLabel={[routine.name, meta, routine.enabled ? null : t('routine.paused'),
                  progress ? t('routines.today', { progress }) : null].filter(Boolean).join(', ')}
                accessibilityHint={t('routines.editHint')}
              >
                <Text style={styles.name}>{routine.name}</Text>
                <Text style={styles.meta}>{meta}</Text>
                {!routine.enabled ? <Text style={styles.meta}>⏸ {t('routine.paused')}</Text> : null}
                {progress ? <Text style={styles.today}>{t('routines.today', { progress })}</Text> : null}
              </TouchableOpacity>
              {occurrence ? (
                <TouchableOpacity
                  onPress={() => openChecklist(occurrence)}
                  style={styles.todayBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('routines.openTodayLabel', { name: routine.name })}
                >
                  <Text style={styles.todayBtnText}>{t('routines.openToday')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {editor ? (
        <RoutineSheet
          key={editor.key}
          editing={editor.id !== null}
          initial={editor.initial}
          onSave={save}
          onDelete={askDelete}
          onClose={() => setEditor(null)}
        />
      ) : null}
      {checklistElement}
      <CustomAlert config={alertConfig} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  newBtn: {
    alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2, marginBottom: 16,
  },
  newText: { fontSize: 16, fontWeight: '600', color: COLORS.text },

  empty:      { paddingVertical: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptyBody:  { fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginTop: 6 },

  row: {
    flexDirection: 'row', alignItems: 'center', minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  rowText: { flex: 1, paddingVertical: 10, paddingRight: 8 },
  name:    { fontSize: 17, fontWeight: '600', color: COLORS.text },
  meta:    { fontSize: 14, color: COLORS.textMuted, marginTop: 3 },
  today:   { fontSize: 14, color: COLORS.text, marginTop: 4 },
  todayBtn: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 14,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2,
  },
  todayBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
});
