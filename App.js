// App.js — LifeOS root component
import React, { useState, useEffect, useRef } from 'react';
import { View, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { COLORS } from './src/config/colors';
import { todayKey } from './src/data/helpers';
import { saveJSON } from './src/data/storage';
import { appStorage, runMigrations, KEYS } from './src/core/storage';
import { hydrateJournal, JOURNAL_SEED } from './src/features/tasks/store';
import { hydrateGroceries } from './src/features/groceries/store';
import { hydrateGoals } from './src/features/goals/store';
import { hydrateNotes } from './src/features/notes/store';
import { hydrateLinks } from './src/features/links/store';
import { hydrateRoutines } from './src/features/routines/store';
import { ErrorBoundary } from './src/app/ErrorBoundary';
import { AppNavigator } from './src/app/navigation/AppNavigator';
import {
  INIT_EXAMS, INIT_FINANCES,
} from './src/data/seedData';
import { auth } from './src/config/firebase';
import {
  onAuthStateChanged, signInAnonymously, signInWithCredential,
  linkWithCredential, GoogleAuthProvider,
} from 'firebase/auth';
import {
  GoogleOneTapSignIn, isSuccessResponse, isNoSavedCredentialFoundResponse,
} from 'react-native-nitro-google-signin';

// Onboarding is a gate in front of the navigator; every other screen is a
// route in src/app/navigation/AppNavigator.js.
import OnboardingScreen from './src/screens/OnboardingScreen';

function usePersist(key, setter) {
  return (valOrFn) => {
    setter((prev) => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      saveJSON(key, next);
      return next;
    });
  };
}

// SafeAreaProvider must wrap everything so useSafeAreaInsets() in the shell
// (src/app/navigation: ShellLayout, BottomNav) and in GlassSheet etc. gets
// real device insets.
// Previously SafeAreaView from 'react-native' was the root, which on
// Android only accounts for the status bar — it does NOT account for the
// 3-button / gesture navigation bar at the bottom. With React Native 0.81
// and newArchEnabled the app draws edge-to-edge, so the bottom nav bar
// was visually on top of the app's own bottom tab strip.
// ErrorBoundary sits inside it so its fallback can use safe-area insets too.
export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [authUser, setAuthUser] = useState(null);

  // Native library configuration — once only, not on every render.
  useEffect(() => {
    GoogleOneTapSignIn.configure({ webClientId: 'autoDetect' });
  }, []);

  // onAuthStateChanged is the only correct way to know who's logged in:
  // initializeAuth restores the session from AsyncStorage asynchronously,
  // so reading auth.currentUser right after mount is unreliable. If
  // there's still no one at the first event — a true first launch — we
  // immediately start an anonymous session: this is the already-agreed
  // "jump in, decide later" pattern. The user doesn't choose anything,
  // but has a valid Firestore UID from the very first moment regardless.
  // `auth` is null when Firebase isn't configured (see config/firebase.js):
  // the app then simply runs local-only, with no auth session at all.
  useEffect(() => {
    if (!auth) return undefined;
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      if (!u) signInAnonymously(auth).catch(() => {});
    });
    return unsub;
  }, []);

  const [ready, setReady]           = useState(false);
  // Set if boot fails. Rethrown during render so the root ErrorBoundary shows
  // its retry screen (retry remounts and re-runs boot) instead of the app
  // staying on the blank loading view, and instead of marking it ready with
  // partial state that could then be saved over the user's data.
  const [bootError, setBootError]   = useState(null);
  const [isFirstUse, setIsFirstUse] = useState(false);

  // Global Data State
  const [userName,     setUserName]     = useState('');
  const [course,       setCourse]       = useState('');
  const [totalCredits, setTotalCredits] = useState(180);
  const [tipsShown,    setTipsShown]    = useState([]);
  const [exams,        setExams]        = useState([]);
  const [finances,     setFinances]     = useState([]);
  // Migrated modules (src/features/*) are NOT held here: each owns a store
  // that screens read via hooks (ADR-003).
  const [heatmap,      setHeatmap]      = useState({});
  const [loggedSeconds, setLogged]      = useState(0);

  // Global Timer State
  const [timerRunning,  setTimerRunning]  = useState(false);
  const [timerSec,      setTimerSec]      = useState(0);
  const [timerSubject,  setTimerSubject]  = useState('');
  const timerRef = useRef(null);

  // Boot: bring stored data up to the current schema version first (see
  // src/core/storage/migrations.js; this absorbed the old inline
  // habitsMigrated block), then load everything in parallel. Migrated
  // modules (src/features/*) hydrate their own stores; the remaining sections
  // are still held here until they are migrated (ADR-003 template).
  useEffect(() => {
    (async () => {
      try {
        await runMigrations(appStorage, { seedJournal: JOURNAL_SEED });
        const [data] = await Promise.all([
          appStorage.loadMany([
            { key: KEYS.isFirstUse,    fallback: true },
            { key: KEYS.userName,      fallback: '' },
            { key: KEYS.course,        fallback: '' },
            { key: KEYS.totalCredits,  fallback: 180 },
            { key: KEYS.tipsShown,     fallback: [] },
            { key: KEYS.exams,         fallback: INIT_EXAMS },
            { key: KEYS.finances,      fallback: INIT_FINANCES },
            { key: KEYS.heatmap,       fallback: {} },
            { key: KEYS.loggedSeconds, fallback: 0 },
          ]),
          hydrateJournal(),
          hydrateGroceries(),
          hydrateGoals(),
          hydrateNotes(),
          hydrateLinks(),
          hydrateRoutines(),
        ]);
        setIsFirstUse(data.isFirstUse);
        setUserName(data.userName);
        setCourse(data.course);
        setTotalCredits(data.totalCredits);
        setTipsShown(data.tipsShown);
        setExams(data.exams);
        setFinances(data.finances);
        setHeatmap(data.heatmap);
        setLogged(data.loggedSeconds);
        setReady(true);
      } catch (error) {
        setBootError(error);
      }
    })();
  }, []);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSec((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const toggleTimer = () => {
    if (timerRunning) {
      const key = todayKey();
      const hrs = timerSec / 3600;
      const newHeatmap = {
        ...heatmap,
        [key]: Math.round(((heatmap[key] || 0) + hrs) * 10) / 10,
      };
      setHeatmap(newHeatmap);
      saveJSON(KEYS.heatmap, newHeatmap);

      const newLogged = loggedSeconds + timerSec;
      setLogged(newLogged);
      saveJSON(KEYS.loggedSeconds, newLogged);

      setTimerSec(0);
    }
    setTimerRunning((r) => !r);
  };

  const resetTimer = () => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setTimerSec(0);
  };

  const handleOnboardingComplete = (data) => {
    setUserName(data.name);
    setCourse(data.course);
    setTotalCredits(data.totalCredits);
    saveJSON(KEYS.userName, data.name);
    saveJSON(KEYS.course, data.course);
    saveJSON(KEYS.totalCredits, data.totalCredits);
    setIsFirstUse(false);
    saveJSON(KEYS.isFirstUse, false);
  };

  // Full flow: native One Tap → Firebase credential → link (if the user
  // is already anonymous) or direct sign-in. Returns a status object
  // instead of handling the alert here — the caller decides how to
  // present it, same principle as every other alertConfig in the project.
  const signInWithGoogle = async () => {
    // Thrown, not returned: OnboardingScreen's catch already turns any
    // failure into "continue by entering your name manually".
    if (!auth) throw new Error('Firebase is not configured');
    await GoogleOneTapSignIn.checkPlayServices();
    let response = await GoogleOneTapSignIn.signIn();
    if (isNoSavedCredentialFoundResponse(response)) {
      response = await GoogleOneTapSignIn.createAccount();
    }
    if (isNoSavedCredentialFoundResponse(response)) {
      response = await GoogleOneTapSignIn.presentExplicitSignIn();
    }
    if (!isSuccessResponse(response)) return { status: 'cancelled' };

    const { user, idToken } = response.data;
    const credential = GoogleAuthProvider.credential(idToken);
    const current = auth.currentUser;

    if (current?.isAnonymous) {
      try {
        await linkWithCredential(current, credential);
        return { status: 'linked', profile: user };
      } catch (e) {
        if (e.code === 'auth/credential-already-in-use') {
          // This Google account is already tied to a different Firebase
          // user elsewhere. We pass back the ready-made credential:
          // whoever resolves the conflict uses it to sign in directly,
          // if they choose that path.
          return { status: 'conflict', credential, profile: user };
        }
        throw e;
      }
    }

    await signInWithCredential(auth, credential);
    return { status: 'signedIn', profile: user };
  };

  const resolveConflictKeepGoogleAccount = (credential) =>
    signInWithCredential(auth, credential);
  const resolveConflictKeepThisDevice = () => {}; // stays on the current anonymous user, deliberately

  const dismissTip = (tipId) => {
    const updated = [...tipsShown, tipId];
    setTipsShown(updated);
    saveJSON(KEYS.tipsShown, updated);
  };

  const pExams      = usePersist(KEYS.exams,      setExams);
  const pFinances   = usePersist(KEYS.finances,   setFinances);

  const timerProps = {
    timerSec:       loggedSeconds + timerSec,
    timerRunning,
    timerSubject,
    onTimerToggle:  toggleTimer,
    onTimerReset:   resetTimer,
    onTimerSubject: setTimerSubject,
  };

  if (bootError) throw bootError;

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      </View>
    );
  }

  if (isFirstUse) {
    return (
      <OnboardingScreen
        onComplete={handleOnboardingComplete}
        googleSignInAvailable={!!auth}
        onGoogleSignIn={signInWithGoogle}
        onResolveConflictKeepGoogleAccount={resolveConflictKeepGoogleAccount}
        onResolveConflictKeepThisDevice={resolveConflictKeepThisDevice}
      />
    );
  }

  // TEMPORARY wiring (ADR-004): the screens that still need data held
  // here get it through the navigator, keyed by route name. Remove each entry
  // when its domain moves to a feature store. Navigation itself is no longer
  // a prop: screens use useNavigation().
  const legacyProps = {
    today: { userName },
    home: {
      exams, finances, heatmap,
      userName, course, isFirstUse,
      tipsShown, onDismissTip: dismissTip,
      ...timerProps,
    },
    uni:      { exams, setExams: pExams, totalCredits },
    finances: { finances, setFinances: pFinances },
    stats:    { exams, heatmap, finances, loggedSeconds: loggedSeconds + timerSec },
  };

  return <AppNavigator legacyProps={legacyProps} />;
}
