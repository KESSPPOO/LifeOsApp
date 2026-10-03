// src/core/state/persistedListStore.js
//
// Zustand store for one persisted list (an array of objects stored as JSON
// under one key). Shared by every migrated module (tasks/habits, groceries),
// so the data-safety rules from ADR-002 live in exactly one place.
// ADR-001 / ADR-003 in docs/ARCHITECTURE_DECISIONS.md.
//
// Guarantees:
// - The on-disk format is untouched: the key still holds the same plain array
//   App.js used to read and write. Loading never writes.
// - Seed (demo) data is used only when the key is missing (fresh install). A
//   corrupt value (already backed up by the engine) or an unreadable one
//   shows as an empty list, never as demo data that would then be saved as
//   the user's own.
// - After a failed read, saving is blocked so data that was never read can
//   never be overwritten. hydrate() may run again (next boot, ErrorBoundary
//   retry) to recover.
// - Saves are chained, so they reach storage in the order they were made.
//
// Pure factory with injected storage, so it runs under node:test.
import { createStore } from 'zustand/vanilla';

// Drops entries that are not objects (e.g. a stray null in a damaged array);
// every screen reads fields like `item.id` and would crash on them.
function sanitize(list) {
  return list.filter(t => t !== null && typeof t === 'object' && !Array.isArray(t));
}

/**
 * @param {{ storage: ReturnType<import('../storage/engine.js').createStorage>,
 *           key: string, seed?: object[], logger?: Console }} deps
 *   key: storage key from KEYS (without prefix).
 *   seed: list shown when nothing was ever saved; not written until the user
 *   changes something.
 */
export function createPersistedListStore({ storage, key, seed = [], logger = console }) {
  let saveChain = Promise.resolve();
  // The hydration in progress, if any. Overlapping hydrate() calls (e.g. an
  // ErrorBoundary retry while boot is still reading) share it, so a slower
  // stale or failed read can never overwrite the result of a newer one.
  let inflight = null;

  return createStore((set, get) => ({
    items: [],
    hydrated: false,
    // true when the stored list could not be read (adapter error, or a
    // corrupt value that could not be backed up). Edits then stay in memory
    // only until a later hydrate() succeeds.
    persistBlocked: false,

    /**
     * Loads the stored list. Call after runMigrations(). Runs once; a second
     * call is a no-op (it must never replace live, already-saved state with
     * a stale read) unless the previous read failed.
     */
    hydrate: () => {
      const { hydrated, persistBlocked } = get();
      if (hydrated && !persistBlocked) return Promise.resolve();
      inflight ??= (async () => {
        const readList = () => storage.read(key, { type: 'array' });
        let { status, value } = await readList();
        if (status === 'error') ({ status, value } = await readList()); // one retry for transient errors
        if (status === 'error') logger.warn(`${key}: read failed; changes will not be saved until it can be read`);
        set({
          items: status === 'ok' ? sanitize(value) : status === 'missing' ? seed : [],
          hydrated: true,
          persistBlocked: status === 'error',
        });
      })().finally(() => { inflight = null; });
      return inflight;
    },

    /**
     * Same contract as App.js's old persisted setters: accepts the new list
     * or an updater `prev => next`, updates state, then saves.
     */
    setItems: (valueOrUpdater) => {
      const { items: prev, hydrated, persistBlocked } = get();
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
      if (next === prev) return;
      set({ items: next });
      // Before hydration there is nothing real in memory; saving would
      // overwrite the stored list with a partial one.
      if (!hydrated || persistBlocked) return;
      saveChain = saveChain.then(() => storage.save(key, next));
    },

    /** Resolves when every queued save has finished (used by tests). */
    flush: () => saveChain,
  }));
}
