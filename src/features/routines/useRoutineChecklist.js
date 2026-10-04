// src/features/routines/useRoutineChecklist.js
//
// Opens a routine's checklist for a date, from any screen (I dag, Tidshjul,
// Plan, Rutiner). The sheet is derived from the stores on every render, so
// a tick shows at once here and on every screen reading the same log.
// Returns { openChecklist(routineId, date), checklistElement } (render the
// element once). onEdit(routineId) is offered as "Rediger rutinen"; by
// default it opens the routine on the Rutiner screen.
import React, { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useRoutines, useRoutineLog, useSetRoutineLog } from './store';
import { occurrenceFor, toggleStep } from './model';
import { ChecklistSheet } from './components/ChecklistSheet';

export function useRoutineChecklist({ onEdit } = {}) {
  const navigation = useNavigation();
  const routines = useRoutines();
  const log = useRoutineLog();
  const setLog = useSetRoutineLog();
  // { routineId, date } of the open checklist
  const [open, setOpen] = useState(null);
  const openChecklist = useCallback((routineId, date) => setOpen({ routineId, date }), []);

  const routine = open ? routines.find(r => r.id === open.routineId) : null;
  const edit = (routineId) => {
    setOpen(null);
    if (onEdit) onEdit(routineId);
    else navigation.navigate('routines', { editId: routineId });
  };

  const checklistElement = routine ? (
    <ChecklistSheet
      occurrence={occurrenceFor(routine, open.date, log)}
      onToggle={(stepId) => setLog(prev => toggleStep(prev, routine.id, open.date, stepId))}
      onEdit={() => edit(routine.id)}
      onClose={() => setOpen(null)}
    />
  ) : null;

  return { openChecklist, checklistElement };
}
