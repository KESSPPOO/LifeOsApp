// src/features/tasks/journalStore.js
//
// State container for tasks + habits (the `journal` list), see ADR-001 in
// docs/ARCHITECTURE_DECISIONS.md. A pure factory with injected storage so it
// runs under node:test; the app singleton and React hooks live in ./store.js.
//
// The on-disk format is unchanged: `lifeos_journal` is the same plain array
// App.js used to read and write, so older and newer builds stay compatible.
import { createStore } from 'zustand/vanilla';
import { KEYS } from '../../core/storage/keys.js';

// Drops entries that are not objects (e.g. a stray null in a damaged array).
// Every consumer reads fields like `t.recurring` and would crash on them.
function sanitize(list) {
  return list.filter(t => t !== null && typeof t === 'object' && !Array.isArray(t));
}

/**
 * @param {{ storage: ReturnType<import('../../core/storage/engine.js').createStorage>,
 *           seed?: object[], logger?: Console }} deps
 *   seed: list shown when nothing was ever saved (demo data). Like before, it
 *   is not written to storage until the user changes something.
 */
export function createJournalStore({ storage, seed = [], logger = console }) {
  // Saves are chained so they reach storage in the order they were made:
  // the last change always wins, even if an earlier write is slow.
  let saveChain = Promise.resolve();

  return createStore((set, get) => ({
    journal: [],
    hydrated: false,
    // true when the stored journal could not be read (adapter error). Edits
    // then stay in memory only, so the unread data on disk is never
    // overwritten; the next launch tries again.
    persistBlocked: false,

    /** Loads the stored journal once. Call after runMigrations(). */
    hydrate: async () => {
      if (get().hydrated) return; // never replace live state with a stale read
      const { status, value } = await storage.read(KEYS.journal, { type: 'array' });
      if (status === 'error') logger.warn('journal: read failed; changes will not be saved this session');
      set({
        journal: status === 'ok' ? sanitize(value) : seed,
        hydrated: true,
        persistBlocked: status === 'error',
      });
    },

    /**
     * Same contract as the old persisted setter from App.js: accepts the new
     * list or an updater `prev => next`, updates state, then saves.
     */
    setJournal: (valueOrUpdater) => {
      const { journal: prev, hydrated, persistBlocked } = get();
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
      if (next === prev) return;
      set({ journal: next });
      // Before hydration there is nothing real in memory; saving would
      // overwrite the stored list with a partial one.
      if (!hydrated || persistBlocked) return;
      saveChain = saveChain.then(() => storage.save(KEYS.journal, next));
    },

    /** Resolves when every queued save has finished (used by tests). */
    flush: () => saveChain,
  }));
}
