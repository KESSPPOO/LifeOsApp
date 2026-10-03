// src/data/storage.js
//
// Legacy write API for the sections App.js still owns (exams, finances, …).
// Delegates to the versioned storage engine in src/core/storage, so there is
// one implementation of prefixing, serialising and error handling (write
// errors are logged and swallowed, as before). Reads go through
// appStorage.loadMany in App.js. New code should use appStorage directly.
import { appStorage } from '../core/storage';

export async function saveJSON(key, value) {
  await appStorage.save(key, value);
}
