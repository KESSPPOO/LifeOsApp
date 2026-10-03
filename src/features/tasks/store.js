// src/features/tasks/store.js
//
// App binding for the tasks + habits store: the singleton backed by real
// storage, plus the hooks screens use. Components read the journal here
// instead of receiving it as props from App.js.
import { useStore } from 'zustand';
import { appStorage } from '../../core/storage';
import { INIT_JOURNAL } from '../../data/seedData';
import { createJournalStore } from './journalStore';

/** Demo list for a fresh install; also handed to migrations (one source). */
export const JOURNAL_SEED = INIT_JOURNAL;

export const journalStore = createJournalStore({ storage: appStorage, seed: JOURNAL_SEED });

/** The tasks + habits list. Re-renders only when the list changes. */
export const useJournal = () => useStore(journalStore, s => s.journal);

/** Persisted setter: `setJournal(next)` or `setJournal(prev => next)`. */
export const useSetJournal = () => useStore(journalStore, s => s.setJournal);

/** Call once at boot, after migrations. */
export const hydrateJournal = () => journalStore.getState().hydrate();
