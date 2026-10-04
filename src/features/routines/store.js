// src/features/routines/store.js
//
// Routines: two persisted lists through the shared createPersistedListStore
// (src/core/state): the templates and the per-date completion log. Both
// start empty: no routine is ever created without the user. Logic (what
// occurs when, progress, toggling) lives in ./model.js.
import { useStore } from 'zustand';
import { appStorage, KEYS } from '../../core/storage';
import { createPersistedListStore } from '../../core/state/persistedListStore';

export const routinesStore = createPersistedListStore({ storage: appStorage, key: KEYS.routines, seed: [] });
export const routineLogStore = createPersistedListStore({ storage: appStorage, key: KEYS.routineLog, seed: [] });

export const useRoutines = () => useStore(routinesStore, s => s.items);
export const useSetRoutines = () => useStore(routinesStore, s => s.setItems);
export const useRoutineLog = () => useStore(routineLogStore, s => s.items);
export const useSetRoutineLog = () => useStore(routineLogStore, s => s.setItems);

/** Call once at boot, after migrations. */
export const hydrateRoutines = () => Promise.all([
  routinesStore.getState().hydrate(),
  routineLogStore.getState().hydrate(),
]);
