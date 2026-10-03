// src/features/notes/store.js
//
// Notes: the store singleton backed by real storage, plus the hooks screens
// use. Persistence and data safety come from the shared
// createPersistedListStore; note operations live in ./logic.js.
import { useStore } from 'zustand';
import { appStorage, KEYS } from '../../core/storage';
import { createPersistedListStore } from '../../core/state/persistedListStore';
import { INIT_NOTES } from '../../data/seedData';

export const notesStore = createPersistedListStore({ storage: appStorage, key: KEYS.notes, seed: INIT_NOTES });

/** The note list, in the user's order. Re-renders only when the list changes. */
export const useNotes = () => useStore(notesStore, s => s.items);

/** Persisted setter: `setNotes(next)` or `setNotes(prev => next)`. */
export const useSetNotes = () => useStore(notesStore, s => s.setItems);

/** Call once at boot, after migrations. */
export const hydrateNotes = () => notesStore.getState().hydrate();
