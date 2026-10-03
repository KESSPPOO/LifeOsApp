// src/features/notes/logic.js
//
// Pure note operations (no React), moved from NotesScreen so they can be
// unit-tested. Results are identical to the old inline code. A note is
// { id, title, content, tags: string[], date: 'YYYY-MM-DD' }, stored as a
// plain array under `lifeos_notes` in the user's own (drag) order.

/** Every tag used on any note, deduplicated and sorted (TagInput suggestions). */
export function collectTags(list) {
  const set = new Set();
  list.forEach(n => (n.tags || []).forEach(t => set.add(t)));
  return Array.from(set).sort();
}

/**
 * New notes go to the top, with id = highest id + 1. `date` is the creation
 * day ('YYYY-MM-DD'), passed in by the caller (todayKey()).
 */
export function addNote(list, { title, content, tags }, date) {
  const newId = Math.max(0, ...list.map(n => n.id || 0)) + 1;
  return [{ id: newId, title, content, tags, date }, ...list];
}

/** Edits title, content and tags; id and creation date are kept. */
export function updateNote(list, id, { title, content, tags }) {
  return list.map(n => n.id === id ? { ...n, title, content, tags } : n);
}

export function deleteNote(list, id) {
  return list.filter(n => n.id !== id);
}
