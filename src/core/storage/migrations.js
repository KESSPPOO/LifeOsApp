// src/core/storage/migrations.js
//
// Versioned, idempotent, non-destructive data migrations (ADR-002 in
// docs/ARCHITECTURE_DECISIONS.md).
//
// How to add one:
//   1. Append { version: <last version + 1>, name, up } to MIGRATIONS
//      (SCHEMA_VERSION follows automatically).
//   2. `up(storage, context)` must be safe to run again on data it already
//      migrated (check preconditions, never assume the version key is right),
//      must not delete legacy keys, and should write related keys together
//      with storage.saveMany. Throw to abort: the version is not bumped and
//      the migration is retried on the next launch.
//   3. Add tests in tests/storage.test.mjs, starting from the previous
//      version's on-disk format.
import { KEYS } from './keys.js';

// ── Migration 1 ─────────────────────────────────────────────────────────────
// Formerly an inline one-shot block in App.js guarded by `habitsMigrated`:
// habits used to live under their own `habits` key ({ id, name, icon,
// history, streak }). They are appended to `journal` as recurring entries.
// The result is identical to the old App.js code for readable data, plus
// safety additions: journal and the flag are written in one multiSet; a
// habit whose exact copy (same name and history) is already in the journal
// is not added again (covers a crash between the two separate writes the old
// code made); unreadable data aborts the migration (retried next launch);
// a corrupt journal is merged into an empty list instead of the demo one.
function sameHistory(a = {}, b = {}) {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
}

async function mergeLegacyHabits(storage, { seedJournal = [] } = {}) {
  const [flag, habitsRead, journalRead] = await Promise.all([
    storage.read(KEYS.habitsMigrated),
    storage.read(KEYS.habits, { type: 'array' }),
    storage.read(KEYS.journal, { type: 'array' }),
  ]);
  // Never decide anything from data we could not read: treating an
  // unreadable journal as "missing" would overwrite it with demo data, and an
  // unreadable habits list as "empty" would strand those habits forever.
  if ([flag, habitsRead, journalRead].some(r => r.status === 'error')) {
    throw new Error('legacy data could not be read');
  }

  if (flag.status === 'ok' && flag.value) return; // done by this migration or an older build

  const habits = habitsRead.status === 'ok' ? habitsRead.value : [];
  if (habits.length === 0) {
    if (!(await storage.save(KEYS.habitsMigrated, true))) throw new Error('could not save habitsMigrated');
    return;
  }

  // Never saved -> demo journal plus old habits, as the old
  // `loadJSON('journal', INIT_JOURNAL)` did. Corrupt (already backed up to
  // corrupt_journal by the engine) -> start from an empty list rather than
  // passing demo data off as the user's own.
  const base = journalRead.status === 'ok' ? journalRead.value
    : journalRead.status === 'missing' ? seedJournal
    : [];
  const toAdd = habits.filter(h => h && !base.some(j =>
    j && j.recurring && j.text === h.name && sameHistory(j.history, h.history)));

  const existingIds = new Set(base.map(j => j.id));
  let nextId = Math.max(0, ...base.map(j => j.id || 0), ...toAdd.map(h => h.id || 0)) + 1;
  const migrated = toAdd.map(h => ({
    id: existingIds.has(h.id) ? nextId++ : h.id,
    text: h.name,
    icon: h.icon || '🌟',
    recurring: true,
    history: h.history || {},
    streak: h.streak || 0,
    date: null,
    priority: 'medium',
    done: false,
  }));

  const ok = await storage.saveMany({
    [KEYS.journal]: [...base, ...migrated],
    [KEYS.habitsMigrated]: true,
  });
  if (!ok) throw new Error('could not save merged journal');
}

/** Ordered list; versions must be 1, 2, 3, … without gaps. */
export const MIGRATIONS = [
  { version: 1, name: 'merge-legacy-habits-into-journal', up: mergeLegacyHabits },
];

/** The schema version this build writes: the last migration's version. */
export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/**
 * Brings stored data up to SCHEMA_VERSION. Never throws.
 * @param {ReturnType<import('./engine.js').createStorage>} storage
 * @param {object} context  passed to every migration (e.g. { seedJournal })
 * @returns {Promise<{ from: number, to: number, applied: string[], error?: Error }>}
 */
export async function runMigrations(storage, context = {}, { migrations = MIGRATIONS, logger = console } = {}) {
  const stored = await storage.load(KEYS.schemaVersion, 0, { type: 'number' });
  const from = Number.isInteger(stored) && stored >= 0 ? stored : 0;
  const latest = migrations.length ? migrations[migrations.length - 1].version : 0;

  if (from > latest) {
    // Data written by a newer build (app downgraded). Leave it untouched.
    logger.warn(`storage: schema version ${from} is newer than this build (${latest}); skipping migrations`);
    return { from, to: from, applied: [] };
  }

  const applied = [];
  let current = from;
  for (const m of migrations) {
    if (m.version <= current) continue;
    try {
      await m.up(storage, context);
      if (!(await storage.save(KEYS.schemaVersion, m.version))) {
        throw new Error('could not save schemaVersion');
      }
    } catch (error) {
      logger.warn(`storage: migration ${m.version} (${m.name}) failed; will retry next launch`, error);
      return { from, to: current, applied, error };
    }
    current = m.version;
    applied.push(m.name);
  }
  return { from, to: current, applied };
}
