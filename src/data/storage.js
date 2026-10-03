// src/data/storage.js
//
// Legacy API kept for the sections App.js still owns (exams, finances, …).
// It now delegates to the versioned storage engine in src/core/storage, so
// there is one implementation of prefixing, parsing and error handling.
// Behaviour is unchanged (missing/unreadable -> fallback, write errors are
// logged and swallowed), except that an unparsable stored value is now
// backed up to `lifeos_corrupt_<key>` before the fallback is used.
// New code should use appStorage from src/core/storage directly.
import { appStorage } from '../core/storage';

export function loadJSON(key, fallback) {
  return appStorage.load(key, fallback);
}

export async function saveJSON(key, value) {
  await appStorage.save(key, value);
}
