// Shared fixtures: stored data exactly as builds before versioned storage
// wrote it (raw AsyncStorage strings under the 'lifeos_' prefix).
// Deterministic dates: TODAY is fixed.

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
    Object.entries(values).map(([k, v]) => [`lifeos_${k}`, typeof v === 'string' ? v : JSON.stringify(v)])
  );
}

/** A logger that records instead of printing (keeps test output clean). */
export function quietLogger() {
  const warnings = [];
  return { warnings, warn: (...args) => warnings.push(args.map(String).join(' ')), error() {}, log() {} };
}
