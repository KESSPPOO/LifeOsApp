// Notes: the operations (src/features/notes/logic.js, moved from
// NotesScreen) and the same operations persisted through the notes store,
// as the screen calls them. Generic data-safety cases run for notes in
// persistedListStore.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS } from '../src/core/storage/keys.js';
import { collectTags, addNote, updateNote, deleteNote } from '../src/features/notes/logic.js';
import { LEGACY_NOTES, TODAY, parsed, setupListStore } from './fixtures.mjs';

test('collectTags: every tag once, sorted, tolerant of notes without tags', () => {
  assert.deepEqual(collectTags(LEGACY_NOTES), ['hjem', 'idé', 'liste']);
  assert.deepEqual(collectTags([{ id: 1, title: 'x' }]), []);
});

test('add puts the note first with id = highest id + 1 and the given date', () => {
  const next = addNote(LEGACY_NOTES, { title: 'Ny', content: 'Tekst', tags: ['a'] }, TODAY);
  assert.deepEqual(next[0], { id: 4, title: 'Ny', content: 'Tekst', tags: ['a'], date: TODAY });
  assert.deepEqual(next.slice(1), LEGACY_NOTES, 'existing order kept');
  assert.equal(addNote([{ title: 'no id' }], { title: 'a', content: '', tags: [] }, TODAY)[0].id, 1);
});

test('update edits title, content and tags; id, date and position are kept', () => {
  const next = updateNote(LEGACY_NOTES, 3, { title: 'Titel', content: 'Ny tekst', tags: ['x'] });
  assert.deepEqual(next[1], { id: 3, title: 'Titel', content: 'Ny tekst', tags: ['x'], date: '2026-03-01' });
  assert.deepEqual([next[0], next[2]], [LEGACY_NOTES[0], LEGACY_NOTES[2]]);
});

test('delete removes only the chosen note', () => {
  assert.deepEqual(deleteNote(LEGACY_NOTES, 3).map(n => n.id), [2, 1]);
});

test('add, edit, reorder, delete and clear all are persisted in the existing format', async () => {
  const { store, adapter } = setupListStore({ key: KEYS.notes, values: { notes: LEGACY_NOTES } });
  await store.getState().hydrate();
  const { setItems } = store.getState();

  setItems(prev => addNote(prev, { title: 'Ny', content: '', tags: [] }, TODAY));
  setItems(prev => updateNote(prev, 1, { title: 'Ideer', content: 'Ny app 2', tags: ['idé'] }));
  setItems(prev => [prev[3], prev[0], prev[1], prev[2]]); // drag-to-reorder hands back the whole list
  setItems(prev => deleteNote(prev, 3));
  await store.getState().flush();
  assert.deepEqual(parsed(adapter, 'notes'), [
    { id: 1, title: 'Ideer', content: 'Ny app 2', tags: ['idé'], date: '2026-01-05' },
    { id: 4, title: 'Ny', content: '', tags: [], date: TODAY },
    LEGACY_NOTES[0],
  ]);

  setItems([]); // "Clear All"
  await store.getState().flush();
  assert.deepEqual(parsed(adapter, 'notes'), []);
});
