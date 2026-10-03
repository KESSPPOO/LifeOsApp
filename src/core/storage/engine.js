// src/core/storage/engine.js
//
// JSON persistence over an injectable key-value adapter. The app passes
// AsyncStorage (see ./index.js); tests pass an in-memory one
// (tests/fixtures.mjs). No React or React Native imports here, so this file
// is unit-testable with node:test.
//
// Guarantees:
// - Never throws. Read failures return a status/fallback, write failures
//   return false (and are logged), exactly like the old loadJSON/saveJSON.
// - Unparsable JSON, or a value of the wrong `type`, is treated as corrupt:
//   the raw string is first copied to `corrupt_<key>` so it is never lost,
//   then the caller's fallback is used. If that backup cannot be written,
//   the read is reported as 'error' instead: the original is then the only
//   copy, and callers must not overwrite it.
// - A read *error* (the adapter itself failed) is reported as status
//   'error', distinct from 'missing', so callers can avoid overwriting data
//   they could not read.
import { STORAGE_PREFIX, corruptBackupKey } from './keys.js';

function matchesType(value, type) {
  switch (type) {
    case undefined: return true;
    case 'array':   return Array.isArray(value);
    case 'object':  return value !== null && typeof value === 'object' && !Array.isArray(value);
    default:        return typeof value === type;
  }
}

/**
 * @typedef {'ok'|'missing'|'corrupt'|'error'} ReadStatus
 * @typedef {{ status: ReadStatus, value: any }} ReadResult
 * @typedef {{ key: string, fallback?: any, type?: string }} LoadEntry
 */

/**
 * @param {{ getItem: Function, setItem: Function, multiGet: Function, multiSet: Function }} adapter
 *   AsyncStorage's method shapes. multiSet must write all pairs together
 *   (saveMany relies on it); AsyncStorage's native implementations do.
 */
export function createStorage(adapter, { prefix = STORAGE_PREFIX, logger = console } = {}) {
  const full = (key) => prefix + key;

  // true when the raw value is safely copied to corrupt_<key>.
  async function backupCorrupt(key, raw) {
    try {
      await adapter.setItem(full(corruptBackupKey(key)), raw);
      return true;
    } catch (e) {
      logger.warn(`storage: could not back up corrupt "${key}"`, e);
      return false;
    }
  }

  // Turns a raw stored string into a ReadResult (backing it up if corrupt).
  async function decode(key, raw, type) {
    if (raw === null || raw === undefined) return { status: 'missing', value: undefined };
    let value;
    let parsed = true;
    try { value = JSON.parse(raw); } catch { parsed = false; }
    if (!parsed || !matchesType(value, type)) {
      const backedUp = await backupCorrupt(key, raw);
      return { status: backedUp ? 'corrupt' : 'error', value: undefined };
    }
    return { status: 'ok', value };
  }

  /** @returns {Promise<ReadResult>} */
  async function read(key, { type } = {}) {
    let raw;
    try {
      raw = await adapter.getItem(full(key));
    } catch (e) {
      logger.warn(`storage: read of "${key}" failed`, e);
      return { status: 'error', value: undefined };
    }
    return decode(key, raw, type);
  }

  /** Value or `fallback` (for missing, corrupt or unreadable data). */
  async function load(key, fallback, opts) {
    const r = await read(key, opts);
    return r.status === 'ok' ? r.value : fallback;
  }

  /**
   * Loads several keys in one adapter round-trip (multiGet) when possible.
   * @param {LoadEntry[]} entries
   * @returns {Promise<Record<string, any>>} key -> value or fallback
   */
  async function loadMany(entries) {
    let raws = null;
    try {
      raws = new Map(await adapter.multiGet(entries.map(e => full(e.key))));
    } catch (e) {
      logger.warn('storage: multiGet failed, falling back to single reads', e);
    }
    const results = await Promise.all(entries.map(async (e) => {
      const r = raws ? await decode(e.key, raws.get(full(e.key)), e.type) : await read(e.key, e);
      return [e.key, r.status === 'ok' ? r.value : e.fallback];
    }));
    return Object.fromEntries(results);
  }

  /** @returns {Promise<boolean>} true when written */
  async function save(key, value) {
    try {
      await adapter.setItem(full(key), JSON.stringify(value));
      return true;
    } catch (e) {
      logger.warn(`storage: save of "${key}" failed`, e);
      return false;
    }
  }

  /**
   * Writes several keys together (multiSet: a single transaction in
   * AsyncStorage's native implementations), so related values cannot end up
   * half-written.
   * @param {Record<string, any>} values
   * @returns {Promise<boolean>}
   */
  async function saveMany(values) {
    const pairs = Object.entries(values).map(([k, v]) => [full(k), JSON.stringify(v)]);
    try {
      await adapter.multiSet(pairs);
      return true;
    } catch (e) {
      logger.warn('storage: saveMany failed', e);
      return false;
    }
  }

  return { read, load, loadMany, save, saveMany };
}

