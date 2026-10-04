// src/features/training/useExerciseEditor.js
//
// The one place that opens the exercise form and writes its result
// (create, or edit one of the user's own), used by Øvelser, the template
// editor and the exercise picker. Returns { openExerciseEditor(exercise or
// null, { onSaved }), exerciseEditorElement } (render the element once).
// onSaved receives the saved exercise (e.g. to add a new one to a
// template right away).
import React, { useCallback, useRef, useState } from 'react';
import { newId } from '../../core/id';
import { useSetExercises } from './store';
import { addExercise, updateExercise, formFromExercise } from './exercises';
import { ExerciseSheet } from './components/ExerciseSheet';

export function useExerciseEditor() {
  const setExercises = useSetExercises();
  // { key, id (null = new), initial, onSaved }
  const [sheet, setSheet] = useState(null);
  const sheetKey = useRef(0);

  const openExerciseEditor = useCallback((exercise, { onSaved } = {}) => {
    sheetKey.current += 1;
    setSheet({ key: sheetKey.current, id: exercise?.id ?? null, initial: formFromExercise(exercise), onSaved });
  }, []);

  const save = (fields) => {
    const { id, onSaved } = sheet;
    const savedId = id ?? newId();
    setExercises(prev => (id === null ? addExercise(prev, savedId, fields) : updateExercise(prev, id, fields)));
    onSaved?.({ id: savedId, custom: true, ...fields });
    setSheet(null);
  };

  const exerciseEditorElement = sheet ? (
    <ExerciseSheet key={sheet.key} editing={sheet.id !== null} initial={sheet.initial} onSave={save} onClose={() => setSheet(null)} />
  ) : null;

  return { openExerciseEditor, exerciseEditorElement };
}
