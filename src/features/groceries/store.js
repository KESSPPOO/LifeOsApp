// src/features/groceries/store.js
//
// Groceries (future Shopping module): the store singleton backed by real
// storage, plus the hooks screens use. Persistence and data safety come from
// the shared createPersistedListStore; list operations live in ./logic.js.
import { useStore } from 'zustand';
import { appStorage, KEYS } from '../../core/storage';
import { createPersistedListStore } from '../../core/state/persistedListStore';
import { INIT_GROCERIES } from '../../data/seedData';

export const groceriesStore = createPersistedListStore({ storage: appStorage, key: KEYS.groceries, seed: INIT_GROCERIES });

/** The grocery list. Re-renders only when the list changes. */
export const useGroceries = () => useStore(groceriesStore, s => s.items);

/** Persisted setter: `setGroceries(next)` or `setGroceries(prev => next)`. */
export const useSetGroceries = () => useStore(groceriesStore, s => s.setItems);

/** Call once at boot, after migrations. */
export const hydrateGroceries = () => groceriesStore.getState().hydrate();
