// Links: the operations (src/features/links/logic.js, moved from LinksScreen
// and Home's Quick Links filter) and the same operations persisted through
// the links store, as the screen calls them. Generic data-safety cases run
// for links in persistedListStore.test.mjs. Ids are passed in (the screen
// uses Date.now()), so everything here is deterministic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS } from '../src/core/storage/keys.js';
import {
  MAX_STARRED_LINKS, normalizeLinkUrl, addLink, updateLink, deleteLink,
  starLimitReached, toggleLinkStar, starredLinks,
} from '../src/features/links/logic.js';
import { LEGACY_LINKS, parsed, setupListStore } from './fixtures.mjs';

const NEW_ID = 1760000000000;

test('normalizeLinkUrl adds https:// unless the URL starts with "http"', () => {
  assert.equal(normalizeLinkUrl('dr.dk'), 'https://dr.dk');
  assert.equal(normalizeLinkUrl('http://x.dk'), 'http://x.dk');
  assert.equal(normalizeLinkUrl('https://x.dk'), 'https://x.dk');
});

test('add appends an unstarred link with trimmed fields and the default icon', () => {
  const next = addLink(LEGACY_LINKS, { name: '  Netto ', url: ' netto.dk ', icon: '  ' }, NEW_ID);
  assert.deepEqual(next.at(-1), { id: NEW_ID, name: 'Netto', url: 'https://netto.dk', icon: '🔗', starred: false });
  assert.deepEqual(next.slice(0, -1), LEGACY_LINKS);
});

test('update edits name, url and icon; id, star and position are kept', () => {
  const next = updateLink(LEGACY_LINKS, 1, { name: 'Borger', url: 'borger.dk', icon: '🏠' });
  assert.deepEqual(next[0], { id: 1, name: 'Borger', url: 'https://borger.dk', icon: '🏠', starred: true });
  assert.deepEqual(next.slice(1), LEGACY_LINKS.slice(1));
});

test('delete removes only the chosen link', () => {
  assert.deepEqual(deleteLink(LEGACY_LINKS, 1759500000000).map(l => l.id), [1, 3]);
});

test('star limit: at most MAX_STARRED_LINKS starred; unstarring is always allowed', () => {
  const full = Array.from({ length: MAX_STARRED_LINKS + 1 }, (_, i) =>
    ({ id: i + 1, name: `L${i}`, url: 'https://x.dk', icon: '🔗', starred: i < MAX_STARRED_LINKS }));
  assert.equal(starLimitReached(full, MAX_STARRED_LINKS + 1), true, 'a 7th star is refused');
  assert.equal(starLimitReached(full, 1), false, 'unstarring is fine');
  assert.equal(starLimitReached(LEGACY_LINKS, 1759500000000), false);
  assert.equal(starLimitReached(LEGACY_LINKS, 999), false, 'unknown id');
});

test('toggleLinkStar flips only the chosen link', () => {
  const next = toggleLinkStar(LEGACY_LINKS, 3);
  assert.equal(next[2].starred, false);
  assert.deepEqual(next.slice(0, 2), LEGACY_LINKS.slice(0, 2));
});

test('starredLinks (Home Quick Links): starred, in list order, capped', () => {
  assert.deepEqual(starredLinks(LEGACY_LINKS).map(l => l.id), [1, 3]);
  const many = Array.from({ length: 9 }, (_, i) => ({ id: i, starred: true }));
  assert.equal(starredLinks(many).length, MAX_STARRED_LINKS);
});

test('add, edit, star, reorder, delete and clear all are persisted in the existing format', async () => {
  const { store, adapter } = setupListStore({ key: KEYS.links, values: { links: LEGACY_LINKS } });
  await store.getState().hydrate();
  const { setItems } = store.getState();

  setItems(prev => addLink(prev, { name: 'Netto', url: 'netto.dk', icon: '🛒' }, NEW_ID));
  setItems(prev => toggleLinkStar(prev, NEW_ID));
  setItems(prev => updateLink(prev, 3, { name: 'Rejseplan', url: 'https://www.rejseplanen.dk', icon: '🚆' }));
  setItems(prev => [prev[3], prev[0], prev[1], prev[2]]); // drag-to-reorder hands back the whole list
  setItems(prev => deleteLink(prev, 1759500000000));
  await store.getState().flush();
  assert.deepEqual(parsed(adapter, 'links'), [
    { id: NEW_ID, name: 'Netto', url: 'https://netto.dk', icon: '🛒', starred: true },
    LEGACY_LINKS[0],
    { id: 3, name: 'Rejseplan', url: 'https://www.rejseplanen.dk', icon: '🚆', starred: true },
  ]);

  setItems([]); // "Clear All"
  await store.getState().flush();
  assert.deepEqual(parsed(adapter, 'links'), []);
});
