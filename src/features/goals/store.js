// src/features/goals/store.js
//
// Goals: the store singleton backed by real storage, plus the hooks screens
// use. Persistence and data safety come from the shared
// createPersistedListStore; goal operations live in ./logic.js.
import { useStore } from 'zustand';
import { appStorage, KEYS } from '../../core/storage';
import { createPersistedListStore } from '../../core/state/persistedListStore';
import { INIT_GOALS } from '../../data/seedData';

export const goalsStore = createPersistedListStore({ storage: appStorage, key: KEYS.goals, seed: INIT_GOALS });

/** The goal list. Re-renders only when the list changes. */
export const useGoals = () => useStore(goalsStore, s => s.items);

/** Persisted setter: `setGoals(next)` or `setGoals(prev => next)`. */
export const useSetGoals = () => useStore(goalsStore, s => s.setItems);

/** Call once at boot, after migrations. */
export const hydrateGoals = () => goalsStore.getState().hydrate();
