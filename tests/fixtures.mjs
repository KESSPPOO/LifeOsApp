// Shared fixtures: stored data exactly as builds before versioned storage
// wrote it (raw AsyncStorage strings under the 'lifeos_' prefix).
// Deterministic dates: TODAY is fixed.
import { STORAGE_PREFIX, corruptBackupKey } from '../src/core/storage/keys.js';
import { createStorage } from '../src/core/storage/engine.js';
import { createPersistedListStore } from '../src/core/state/persistedListStore.js';

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

// Demo lists the stores fall back to when a key is missing (test stand-ins
// for INIT_JOURNAL / INIT_GROCERIES, which tests cannot import).
export const JOURNAL_TEST_SEED = [{ id: 900, text: 'demo task', recurring: false, date: null, done: false }];
export const GROCERIES_TEST_SEED = [{ id: 900, text: 'demo item', category: 'other', done: false }];

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
