// src/features/plan/useEntryEditor.js
//
// The one place that opens the task/habit sheet and writes its result:
// create, edit, delete (with confirmation). Used by Plan and Timewheel, so
// there is a single task editor and a single save/delete behaviour.
//
// Returns { openEditor, showAlert, closeAlert, editorElements }. Render
// editorElements once in the screen. openEditor(kind, entry, options):
// kind 'task' | 'habit'; entry is a stored entry (edit) or a draft without
// an id (new); options.onSaved runs after a save; options.focus 'time'
// starts in the time field (the "Flyt" action).
import React, { useCallback, useRef, useState } from 'react';
import { CustomAlert } from '../../components/CustomAlert';
import { t } from '../../core/i18n';
import { useSetJournal } from '../tasks/store';
import { addTask, updateTask, addHabit, updateHabit, deleteEntry, formFromEntry } from './logic';
import { TaskSheet } from './components/TaskSheet';

/** today: the screen's current day (for the sheet's I dag / I morgen); sync: useNow()'s. */
export function useEntryEditor({ today, sync }) {
  const setJournal = useSetJournal();
  // { key, kind, id (null = new), initial, onSaved, focus }
  const [sheet, setSheet] = useState(null);
  const sheetKey = useRef(0);
  const [alertConfig, setAlertConfig] = useState(null);
  const closeAlert = () => setAlertConfig(null);

  const openEditor = useCallback((kind, entry, { onSaved, focus } = {}) => {
    sync(); // the sheet's "I dag" / "I morgen" use the current day
    sheetKey.current += 1;
    setSheet({ key: sheetKey.current, kind, id: entry.id ?? null, initial: formFromEntry(entry), onSaved, focus });
  }, [sync]);

  const save = (fields) => {
    const { kind, id, onSaved } = sheet;
    setJournal(prev => {
      if (kind === 'habit') return id === null ? addHabit(prev, fields) : updateHabit(prev, id, fields);
      return id === null ? addTask(prev, fields) : updateTask(prev, id, fields);
    });
    onSaved?.();
    setSheet(null);
  };

  const confirmDelete = () => setAlertConfig({
    title: t('taskForm.delete'),
    message: t('taskForm.deleteMessage', { title: sheet.initial.text }),
    buttons: [
      { text: t('taskForm.cancel'), style: 'cancel', onPress: closeAlert },
      { text: t('taskForm.delete'), style: 'destructive', onPress: () => {
        setJournal(prev => deleteEntry(prev, sheet.id));
        closeAlert();
        setSheet(null);
      } },
    ],
  });

  const editorElements = (
    <>
      {sheet ? (
        <TaskSheet
          key={sheet.key}
          kind={sheet.kind}
          editing={sheet.id !== null}
          initial={sheet.initial}
          focus={sheet.focus}
          today={today}
          onSave={save}
          onDelete={confirmDelete}
          onClose={() => setSheet(null)}
        />
      ) : null}
      <CustomAlert config={alertConfig} />
    </>
  );

  return { openEditor, showAlert: setAlertConfig, closeAlert, editorElements };
}
