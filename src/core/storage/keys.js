// src/core/storage/keys.js
//
// Registry of every persisted key. Each value is stored as JSON in
// AsyncStorage under STORAGE_PREFIX + key (e.g. 'lifeos_journal').
//
// Never rename a key or change what a stored value means without a
// migration in ./migrations.js. `type` documents the expected JSON shape;
// passing it to storage.read/load makes a wrong-shaped value count as
// corrupt (backed up, then replaced by the fallback) instead of reaching UI
// code that would crash on it.

export const STORAGE_PREFIX = 'lifeos_';

/**
 * @typedef {'array'|'object'|'string'|'number'|'boolean'} StoredType
 * @typedef {{ type: StoredType, owner: string, description: string }} KeySpec
 */

/** @type {Readonly<Record<string, KeySpec>>} */
export const KEY_SPECS = Object.freeze({
  // ── Storage system ────────────────────────────────────────────────────
  schemaVersion:      { type: 'number',  owner: 'core/storage', description: 'Highest migration version applied (missing = 0, i.e. pre-versioning data).' },

  // ── Tasks + habits (migrated to features/tasks) ───────────────────────
  journal:            { type: 'array',   owner: 'features/tasks', description: 'Tasks AND habits in one list (UI: "Plan"). Habit = recurring:true with history {YYYY-MM-DD: 1} and cached streak. A dated task may have optional startTime "HH:mm" and durationMinutes (1-1440); absent = untimed / unknown (ADR-006).' },
  habits:             { type: 'array',   owner: 'legacy', description: 'Pre-v1.4 separate habits list. Read once by migration 1; never deleted, never written.' },
  habitsMigrated:     { type: 'boolean', owner: 'legacy', description: 'Set by migration 1 (and by builds before versioned storage) once habits were merged into journal.' },

  // ── Groceries (migrated to features/groceries; future Shopping) ───────
  groceries:          { type: 'array',   owner: 'features/groceries', description: 'Grocery checklist: { id, text, category, done }.' },

  // ── Goals (migrated to features/goals) ────────────────────────────────
  goals:              { type: 'array',   owner: 'features/goals', description: 'Numeric goals: { id, title, description, target, progress, category, priority, deadline, completed }.' },

  // ── Notes (migrated to features/notes) ────────────────────────────────
  notes:              { type: 'array',   owner: 'features/notes', description: "Notes in the user's order: { id, title, content, tags: string[], date: 'YYYY-MM-DD' }." },

  // ── Links (migrated to features/links; also read by Home Quick Links) ──
  links:              { type: 'array',   owner: 'features/links', description: "Bookmarks in the user's order: { id, name, url, icon, starred } (at most 6 starred; shown on Home)." },

  // ── Routines (features/routines, ADR-008) ─────────────────────────────
  routines:           { type: 'array',   owner: 'features/routines', description: 'Routine templates: { id, name, enabled, activeFrom: YYYY-MM-DD, daysOfWeek: [1..7] (1 = Monday), startTime?: "HH:mm", durationMinutes?, steps: [{ id, text }] }. Occurrences are derived, never stored.' },
  routineLog:         { type: 'array',   owner: 'features/routines', description: 'Routine completion per date: { routineId, date: YYYY-MM-DD, completedStepIds: [] }. Kept when a routine is deleted.' },

  // ── Still owned by App.js (not migrated yet) ──────────────────────────
  isFirstUse:         { type: 'boolean', owner: 'App.js', description: 'true until onboarding completes.' },
  userName:           { type: 'string',  owner: 'App.js', description: 'Name from onboarding.' },
  course:             { type: 'string',  owner: 'App.js', description: 'Degree course from onboarding.' },
  totalCredits:       { type: 'number',  owner: 'App.js', description: 'Degree credit total (CFU) from onboarding.' },
  tipsShown:          { type: 'array',   owner: 'App.js', description: 'Ids of dismissed Home tips.' },
  exams:              { type: 'array',   owner: 'App.js', description: 'University exams.' },
  finances:           { type: 'array',   owner: 'App.js', description: 'Income/expense transactions.' },
  heatmap:            { type: 'object',  owner: 'App.js', description: 'Study hours per YYYY-MM-DD (dead timer feature; still read by Home/Stats).' },
  loggedSeconds:      { type: 'number',  owner: 'App.js', description: 'Total study-timer seconds (dead timer feature).' },
  home_section_order: { type: 'array',   owner: 'HomeScreen', description: 'Order of Home sections. Read/written directly via AsyncStorage (legacy).' },
});

/** Key names, so call sites can write KEYS.journal instead of a string literal. */
export const KEYS = Object.freeze(
  Object.fromEntries(Object.keys(KEY_SPECS).map(k => [k, k]))
);

/** Where an unreadable value is copied before it is replaced by a fallback. */
export function corruptBackupKey(key) {
  return `corrupt_${key}`;
}
