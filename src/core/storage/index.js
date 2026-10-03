// src/core/storage/index.js
//
// App binding: the storage engine backed by AsyncStorage. Import persistence
// from here in app code. Tests import ./engine.js and ./migrations.js
// directly with an in-memory adapter instead (this file pulls in a native
// module).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStorage } from './engine';

export const appStorage = createStorage(AsyncStorage);

export { KEYS, KEY_SPECS, STORAGE_PREFIX } from './keys';
export { SCHEMA_VERSION, runMigrations } from './migrations';
