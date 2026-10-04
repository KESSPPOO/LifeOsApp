// src/features/training/store.js
//
// Training: four persisted lists through the shared createPersistedListStore
// (src/core/state), all empty by default (no demo exercises or plans):
//   exercises         the exercise library
//   workoutTemplates  planned workouts
//   activeWorkout     the workout in progress: a list of at most ONE session,
//                     saved on every logged set (small: one workout)
//   workoutSessions   completed workouts (history), written once per finish
// Keeping the workout in progress apart means a set tap never rewrites the
// whole history. Rules for the workout in progress: ./workouts.js; the
// rest of the logic: the pure modules next to this file (ADR-010).
import { useStore } from 'zustand';
import { appStorage, KEYS } from '../../core/storage';
import { createPersistedListStore } from '../../core/state/persistedListStore';
import { newId } from '../../core/id';
import { pickActive } from './session';
import { createWorkoutActions } from './workouts';

export const exercisesStore = createPersistedListStore({ storage: appStorage, key: KEYS.exercises, seed: [] });
export const templatesStore = createPersistedListStore({ storage: appStorage, key: KEYS.workoutTemplates, seed: [] });
export const activeWorkoutStore = createPersistedListStore({ storage: appStorage, key: KEYS.activeWorkout, seed: [] });
export const historyStore = createPersistedListStore({ storage: appStorage, key: KEYS.workoutSessions, seed: [] });

export const workouts = createWorkoutActions({
  exercisesStore, activeStore: activeWorkoutStore, historyStore, newId,
});

export const useExercises = () => useStore(exercisesStore, s => s.items);
export const useSetExercises = () => useStore(exercisesStore, s => s.setItems);
export const useTemplates = () => useStore(templatesStore, s => s.items);
export const useSetTemplates = () => useStore(templatesStore, s => s.setItems);
export const useWorkoutHistory = () => useStore(historyStore, s => s.items);

/** The workout in progress, or null (the same object until it changes). */
export function useActiveWorkout() {
  const list = useStore(activeWorkoutStore, s => s.items);
  const history = useWorkoutHistory();
  return pickActive(list, history);
}

/** Call once at boot, after migrations. */
export const hydrateTraining = () => Promise.all(
  [exercisesStore, templatesStore, activeWorkoutStore, historyStore].map(store => store.getState().hydrate()),
);
