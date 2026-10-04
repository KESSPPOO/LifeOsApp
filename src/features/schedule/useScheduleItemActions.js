// src/features/schedule/useScheduleItemActions.js
//
// What tapping a scheduled item does, the same in Tidshjul and Kalender:
//   open  a task: the shared task sheet; a routine: that day's checklist
//   move  ("Flyt") a task: the task sheet at its time field; a routine: its
//         template on Rutiner (a routine's time belongs to the routine, on
//         every day; there are no per-day exceptions)
// openEditor / openChecklist come from the screen's useEntryEditor and
// useRoutineChecklist (their sheets render in the screen). `open` is stable,
// so memoised lists do not re-render for it.
import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';

export function useScheduleItemActions({ openEditor, openChecklist }) {
  const navigation = useNavigation();
  const open = useCallback((item) => (item.kind === 'routine'
    ? openChecklist(item)
    : openEditor('task', item.task)), [openChecklist, openEditor]);
  const move = (item) => (item.kind === 'routine'
    ? navigation.navigate('routines', { editId: item.routineId })
    : openEditor('task', item.task, { focus: 'time' }));
  return { open, move };
}
