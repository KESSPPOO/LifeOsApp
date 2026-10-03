// src/features/links/store.js
//
// Links: the store singleton backed by real storage, plus the hooks screens
// use (LinksScreen, and HomeScreen's Quick Links). Persistence and data
// safety come from the shared createPersistedListStore; link operations
// live in ./logic.js.
import { useStore } from 'zustand';
import { appStorage, KEYS } from '../../core/storage';
import { createPersistedListStore } from '../../core/state/persistedListStore';
import { INIT_LINKS } from '../../data/seedData';

export const linksStore = createPersistedListStore({ storage: appStorage, key: KEYS.links, seed: INIT_LINKS });

/** The link list, in the user's order. Re-renders only when the list changes. */
export const useLinks = () => useStore(linksStore, s => s.items);

/** Persisted setter: `setLinks(next)` or `setLinks(prev => next)`. */
export const useSetLinks = () => useStore(linksStore, s => s.setItems);

/** Call once at boot, after migrations. */
export const hydrateLinks = () => linksStore.getState().hydrate();
