// src/config/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Values taken from google-services.json (project_info + client_info).
// Not read from that file at runtime: the JS SDK wants its own config
// object, separate from what the native plugin uses at Android build time.
//
// The API key is read from EXPO_PUBLIC_FIREBASE_API_KEY (inlined by Expo at
// bundle time, e.g. from a local .env.local file) instead of being committed.
// Firebase Auth throws `auth/invalid-api-key` during initializeAuth when the
// key is empty, and because App.js imports this module at the top level,
// that used to crash the whole app on launch. Without a key, `auth` is now
// null and the app runs local-only — nothing user-facing depends on Firebase
// apart from the optional "Continue with Google" step in onboarding.
const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';

const firebaseConfig = {
  apiKey,
  authDomain: 'lifeos-93904.firebaseapp.com',
  projectId: 'lifeos-93904',
  storageBucket: 'lifeos-93904.firebasestorage.app',
  messagingSenderId: '611050453713',
  appId: '1:611050453713:android:181b38571ccae8656323f0',
};

function createAuth() {
  if (!apiKey) return null;

  // getApps().length avoids "Firebase App named '[DEFAULT]' already exists"
  // if Fast Refresh reloads this module more than once during development.
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  // initializeAuth (not getAuth) with getReactNativePersistence is
  // mandatory here: without it, the session lives in memory only and is
  // gone the moment the app closes, with no error to flag it.
  return initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

// null when Firebase is not configured — callers must check before use.
export const auth = createAuth();
