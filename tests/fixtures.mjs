// Shared fixtures: stored data exactly as builds before versioned storage
// wrote it (raw AsyncStorage strings under the 'lifeos_' prefix).
// Deterministic dates: TODAY is fixed.
import { STORAGE_PREFIX, corruptBackupKey } from '../src/core/storage/keys.js';
import { createStorage } from '../src/core/storage/engine.js';
import { createPersistedListStore } from '../src/core/state/persistedListStore.js';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of a repo file, relative to tests/. fileURLToPath, not
 *  URL.pathname: works on Windows and in paths with spaces/æøå. */
export const repoPath = (rel) => fileURLToPath(new URL(rel, import.meta.url));

/** Every .js file under `dir`, recursively (for source scans). */
export function sourceFiles(dir) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith('.js') ? [p] : [];
  });
}

export const TODAY = '2026-03-02';

// `journal` as written by the app since tasks and habits were unified
// (v1.4+): one-off tasks plus habits (recurring: true), one array.
export const LEGACY_JOURNAL = [
  { id: 1, text: 'Pay the utility bill', subject: '', priority: 'high', date: '2026-02-27', done: false, recurring: false },
  { id: 2, text: 'Reply to email', subject: '', priority: 'medium', date: TODAY, done: true, recurring: false },
  { id: 3, text: 'Mock exam', subject: 'Big Data', priority: 'high', date: '2026-03-09', done: false, recurring: false },
  { id: 4, text: 'Tidy up the desk', subject: '', priority: 'low', date: null, done: false, recurring: false },
  { id: 5, text: 'Old finished task', subject: '', priority: 'low', date: '2026-02-01', done: true, recurring: false },
  {
    id: 101, text: 'Reading', icon: '📖', recurring: true, date: null, priority: 'medium', done: false,
    history: { '2026-02-27': 1, '2026-02-28': 1, '2026-03-01': 1 }, streak: 3,
  },
];

// `groceries` exactly as GroceriesScreen writes it: newest first.
export const LEGACY_GROCERIES = [
  { id: 4, text: 'Rugbrød', category: 'supermarket', done: false },
  { id: 3, text: 'Panodil', category: 'pharmacy', done: true },
  { id: 2, text: 'Opvasketabs', category: 'home', done: false },
  { id: 1, text: 'Fødselsdagskort', category: 'other', done: false },
];

// `goals` exactly as GoalsScreen writes it: newest first, numbers as numbers,
// deadline '' when unset.
export const LEGACY_GOALS = [
  { id: 3, title: 'Løb 10 km', description: '', target: 10, progress: 4.5, category: 'Sport', priority: 'medium', deadline: '2026-06-01', completed: false },
  { id: 2, title: 'Spar 5000 kr', description: 'Buffer', target: 5000, progress: 5000, category: 'Finance', priority: 'high', deadline: '', completed: true },
  { id: 1, title: 'Læs 12 bøger', description: '', target: 12, progress: 3, category: 'Personal', priority: 'low', deadline: '2026-01-31', completed: false },
];

// `notes` exactly as NotesScreen writes it, in the user's drag order (not
// sorted by id or date), including a note without tags.
export const LEGACY_NOTES = [
  { id: 2, title: 'Indkøb', content: 'Husk æg og mælk', tags: ['hjem', 'liste'], date: '2026-02-20' },
  { id: 3, title: '', content: 'Kun indhold', tags: [], date: '2026-03-01' },
  { id: 1, title: 'Ideer', content: 'Ny app', tags: ['idé', 'hjem'], date: '2026-01-05' },
];

// `links` exactly as LinksScreen writes it, in the user's drag order. New
// links got Date.now() ids, so ids are a mix of small seed ids and large ones.
export const LEGACY_LINKS = [
  { id: 1, name: 'Borger.dk', url: 'https://www.borger.dk', icon: '🏛', starred: true },
  { id: 1759500000000, name: 'DR', url: 'https://www.dr.dk', icon: '📺', starred: false },
  { id: 3, name: 'Rejseplanen', url: 'https://www.rejseplanen.dk', icon: '🚆', starred: true },
];

// Demo lists the stores fall back to when a key is missing (test stand-ins
// for the INIT_* seeds in src/data/seedData.js, which tests cannot import).
export const JOURNAL_TEST_SEED = [{ id: 900, text: 'demo task', recurring: false, date: null, done: false }];
export const GROCERIES_TEST_SEED = [{ id: 900, text: 'demo item', category: 'other', done: false }];
export const LINKS_TEST_SEED = [{ id: 900, name: 'demo', url: 'https://example.com', icon: '🔗', starred: false }];
export const NOTES_TEST_SEED = [{ id: 900, title: 'demo note', content: '', tags: [], date: '2026-01-01' }];
// Routines (Session 9) as the app writes them: templates and the per-date log.
export const STORED_ROUTINES = [
  {
    id: 'r1', name: 'Morgenrutine', enabled: true, activeFrom: '2026-03-01', daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '07:30', durationMinutes: 45,
    steps: [{ id: 's1', text: 'Stå op' }, { id: 's2', text: 'Børst tænder' }, { id: 's3', text: 'Morgenmad' }],
  },
  { id: 'r2', name: 'Aftenrutine', enabled: false, activeFrom: '2026-03-01', daysOfWeek: [1, 2, 3, 4, 5, 6, 7], steps: [{ id: 'a1', text: 'Sluk skærme' }] },
];
export const STORED_ROUTINE_LOG = [
  { routineId: 'r1', date: '2026-03-02', completedStepIds: ['s1', 's2'] },
  { routineId: 'r2', date: '2026-03-01', completedStepIds: ['a1'] },
];
// Training (Session 11): test examples only; the app starts with an empty
// library and no templates.
export const STORED_EXERCISES = [
  { id: 'bench', name: 'Bænkpres', category: 'strength', muscleGroups: ['chest', 'triceps'], equipment: 'barbell', trackingType: 'weightReps', custom: true },
  { id: 'pullup', name: 'Pull-ups', category: 'calisthenics', muscleGroups: ['back', 'biceps'], equipment: 'bodyweight', trackingType: 'bodyweightReps', custom: true },
  { id: 'plank', name: 'Planke', category: 'core', muscleGroups: ['core'], equipment: 'bodyweight', trackingType: 'duration', instructions: 'Spænd maven.', custom: true },
  { id: 'run', name: 'Løb', category: 'cardio', muscleGroups: ['fullBody'], equipment: 'other', trackingType: 'distanceDuration', custom: true },
];
export const STORED_TEMPLATES = [
  { id: 'upper', name: 'Overkrop A', rest: { warmup: 60, work: 180 }, exercises: [
    { id: 'e1', exerciseId: 'bench', sets: [{ id: 'w1', type: 'warmup' }, { id: 's1', type: 'work', targetReps: 8, targetWeightKg: 62.5 }, { id: 's2', type: 'work', targetReps: 8, targetWeightKg: 62.5 }] },
    { id: 'e2', exerciseId: 'pullup', sets: [{ id: 's1', type: 'work' }, { id: 's2', type: 'work' }] },
  ] },
];
export const STORED_WORKOUT_SESSIONS = [
  { id: 'h1', templateId: 'upper', name: 'Overkrop A', date: '2026-10-01', startedAt: 1790000000000, completedAt: 1790003000000, rest: { warmup: 60, work: 180 }, exercises: [
    { id: 'e1', exerciseId: 'bench', name: 'Bænkpres', trackingType: 'weightReps', sets: [
      { id: 'w1', type: 'warmup', done: true, values: { weightKg: 40, reps: 10 } },
      { id: 's1', type: 'work', done: true, values: { weightKg: 60, reps: 8 } },
      { id: 's2', type: 'work', done: true, values: { weightKg: 60, reps: 7 } },
    ] },
    { id: 'e2', exerciseId: 'pullup', name: 'Pull-ups', trackingType: 'bodyweightReps', skipped: true, sets: [{ id: 's1', type: 'work' }] },
  ] },
];
export const STORED_ACTIVE_WORKOUT = [
  { id: 'a1', templateId: 'upper', name: 'Overkrop A', date: '2026-10-04', startedAt: 1790100000000, rest: { warmup: 60, work: 180 }, currentIndex: 0,
    timer: { endsAt: 1790100180000, seconds: 180, setKey: 'e1/s1' }, exercises: [
      { id: 'e1', exerciseId: 'bench', name: 'Bænkpres', trackingType: 'weightReps', sets: [
        { id: 's1', type: 'work', done: true, values: { weightKg: 62.5, reps: 8 } },
        { id: 's2', type: 'work', draft: { weightKg: '65' } },
      ] },
    ] },
];
export const ROUTINES_TEST_SEED = [{ id: 'seed', name: 'demo', enabled: true, activeFrom: '2026-01-01', daysOfWeek: [1], steps: [] }];
export const GOALS_TEST_SEED = [{ id: 900, title: 'demo goal', description: '', target: 1, progress: 0, category: 'Study', priority: 'low', deadline: '', completed: false }];

// The pre-v1.4 separate habits list, migrated into journal by migration 1.
export const LEGACY_HABITS = [
  { id: 1, name: 'Meditation', icon: '🧘', history: { '2026-03-01': 1 }, streak: 1 },
  { id: 7, name: 'Water', history: {}, streak: 0 },
];

/** Raw AsyncStorage contents (prefixed keys). Non-strings are JSON-encoded;
 *  strings are stored as-is (raw), so pass a JSON string like '"Ada"' for a
 *  stored string, or deliberately broken text to simulate corruption. */
export function rawStore(values) {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [STORAGE_PREFIX + k, typeof v === 'string' ? v : JSON.stringify(v)])
  );
}

/** Parsed stored value of `key` in a memory adapter. */
export function parsed(adapter, key) {
  return JSON.parse(adapter.data[STORAGE_PREFIX + key]);
}

/** Raw stored string of `key` (or of its corrupt backup) in a memory adapter. */
export function raw(adapter, key, { backup = false } = {}) {
  return adapter.data[STORAGE_PREFIX + (backup ? corruptBackupKey(key) : key)];
}

/** In-memory adapter with AsyncStorage's method shapes; `data` holds raw strings. */
export function createMemoryAdapter(data = {}) {
  const get = (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null);
  return {
    data,
    async getItem(k) { return get(k); },
    async setItem(k, v) { data[k] = v; },
    async multiGet(keys) { return keys.map(k => [k, get(k)]); },
    async multiSet(pairs) { for (const [k, v] of pairs) data[k] = v; },
  };
}

/** Makes reads of one key fail (simulates an AsyncStorage I/O error). */
export function failReadsOf(adapter, key, times = Infinity) {
  const getItem = adapter.getItem;
  const multiGet = adapter.multiGet;
  const full = STORAGE_PREFIX + key;
  let left = times;
  const fail = () => left-- > 0;
  adapter.getItem = async (k) => {
    if (k === full && fail()) throw new Error(`io error reading ${k}`);
    return getItem(k);
  };
  adapter.multiGet = async (keys) => {
    if (keys.includes(full) && fail()) throw new Error('io error in multiGet');
    return multiGet(keys);
  };
}

/** Makes setItem fail for keys containing `match` (e.g. 'corrupt_'). */
export function failWritesOf(adapter, match) {
  const setItem = adapter.setItem;
  adapter.setItem = async (k, v) => {
    if (k.includes(match)) throw new Error(`write failed: ${k}`);
    return setItem(k, v);
  };
}

/** A logger that records instead of printing (keeps test output clean). */
export function quietLogger() {
  const warnings = [];
  return { warnings, warn: (...args) => warnings.push(args.map(String).join(' ')), error() {}, log() {} };
}

/**
 * A persisted-list store over an in-memory adapter preloaded with `values`
 * (see rawStore). Returns everything a test needs to inspect.
 */
export function setupListStore({ key, values = {}, seed = [] }) {
  const logger = quietLogger();
  const adapter = createMemoryAdapter(rawStore(values));
  const storage = createStorage(adapter, { logger });
  const store = createPersistedListStore({ storage, key, seed, logger });
  return { adapter, storage, store, logger };
}
