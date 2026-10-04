// src/features/tasks/store.js
//
// Tasks + habits (the `journal` list): the store singleton backed by real
// storage, plus the hooks screens use. Persistence and data safety come from
// the shared createPersistedListStore (src/core/state); the task/habit
// domain logic lives in src/data/tasks.js.
import { useCallback, useState } from 'react';
import { useStore } from 'zustand';
import { appStorage, KEYS } from '../../core/storage';
import { createPersistedListStore } from '../../core/state/persistedListStore';
import { INIT_JOURNAL } from '../../data/seedData';
import { toggleJournalEntry } from '../../data/tasks';
import { localDateKey } from '../../core/time/dates';

/** Demo list for a fresh install; also handed to migrations (one source). */
export const JOURNAL_SEED = INIT_JOURNAL;

export const journalStore = createPersistedListStore({ storage: appStorage, key: KEYS.journal, seed: JOURNAL_SEED });

/** The tasks + habits list. Re-renders only when the list changes. */
export const useJournal = () => useStore(journalStore, s => s.items);

/** Persisted setter: `setJournal(next)` or `setJournal(prev => next)`. */
export const useSetJournal = () => useStore(journalStore, s => s.setItems);

/** Call once at boot, after migrations. */
export const hydrateJournal = () => journalStore.getState().hydrate();

/**
 * The tick on a task or habit (I dag and Plan). It always uses the real
 * current day: `sync` is useNow()'s, so a tap just after midnight marks
 * the new day, and the screen moves to that day too.
 */
export function useToggleEntry(sync) {
  const setJournal = useSetJournal();
  return useCallback((id) => {
    const today = localDateKey(sync());
    setJournal(prev => toggleJournalEntry(prev, id, today));
  }, [setJournal, sync]);
}

/**
 * useToggleEntry plus the set of entries ticked during this visit, which
 * the screen passes to groupJournal as keepVisibleIds: a task ticked off
 * stays visible (dimmed) so the tap can be undone. Not persisted; it
 * resets when the screen is left. Returns [keepVisibleIds, toggle(id)].
 */
export function useTickedThisVisit(sync) {
  const toggleEntry = useToggleEntry(sync);
  const [ids, setIds] = useState(() => new Set());
  const toggle = useCallback((id) => {
    setIds(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
    toggleEntry(id);
  }, [toggleEntry]);
  return [ids, toggle];
}
