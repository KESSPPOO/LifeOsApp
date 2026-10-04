// src/features/routines/useRoutineChecklist.js
//
// Opens a routine's checklist for a date, from any screen (I dag, Tidshjul, Kalender,
// Plan, Rutiner). The sheet is derived from the stores on every render, so
// a tick shows at once here and on every screen reading the same log.
// Returns { openChecklist(occurrence or item), checklistElement } (render
// the element once). "Rediger rutinen" opens the routine on the Rutiner
// screen (route param editId).
import React, { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useRoutines, useRoutineLog, useSetRoutineLog } from './store';
import { occurrenceFor, toggleStep } from './model';
import { ChecklistSheet } from './components/ChecklistSheet';

export function useRoutineChecklist() {
  const navigation = useNavigation();
  const routines = useRoutines();
  const log = useRoutineLog();
  const setLog = useSetRoutineLog();
  // { routineId, date } of the open checklist
  const [open, setOpen] = useState(null);
  const openChecklist = useCallback(({ routineId, date }) => setOpen({ routineId, date }), []);

  const routine = open ? routines.find(r => r.id === open.routineId) : null;

  const checklistElement = routine ? (
    <ChecklistSheet
      occurrence={occurrenceFor(routine, open.date, log)}
      onToggle={(stepId) => setLog(prev => toggleStep(prev, routine.id, open.date, stepId))}
      onEdit={() => { setOpen(null); navigation.navigate('routines', { editId: routine.id }); }}
      onClose={() => setOpen(null)}
    />
  ) : null;

  return { openChecklist, checklistElement };
}
