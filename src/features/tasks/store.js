// src/features/tasks/store.js
//
// Tasks + habits (the `journal` list): the store singleton backed by real
// storage, plus the hooks screens use. Persistence and data safety come from
// the shared createPersistedListStore (src/core/state); the task/habit
// domain logic lives in src/data/tasks.js.
import { useStore } from 'zustand';
import { appStorage, KEYS } from '../../core/storage';
import { createPersistedListStore } from '../../core/state/persistedListStore';
import { INIT_JOURNAL } from '../../data/seedData';

/** Demo list for a fresh install; also handed to migrations (one source). */
export const JOURNAL_SEED = INIT_JOURNAL;

export const journalStore = createPersistedListStore({ storage: appStorage, key: KEYS.journal, seed: JOURNAL_SEED });

/** The tasks + habits list. Re-renders only when the list changes. */
export const useJournal = () => useStore(journalStore, s => s.items);

/** Persisted setter: `setJournal(next)` or `setJournal(prev => next)`. */
export const useSetJournal = () => useStore(journalStore, s => s.setItems);

/** Call once at boot, after migrations. */
export const hydrateJournal = () => journalStore.getState().hydrate();
