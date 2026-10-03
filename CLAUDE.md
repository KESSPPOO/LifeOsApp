# CLAUDE.md — LifeOS repository guide

Read this first in every session. The long-term plan lives in
[`docs/LIFEOS_PLAN.md`](docs/LIFEOS_PLAN.md). Read the section for the module
you are touching before you change anything.

## Project purpose

LifeOS is becoming a **calm, accessible, Danish personal "life operating
system"** for mobile. It should make daily life easier to understand and manage,
especially when the user has little mental energy or feels overwhelmed. Planned
areas include I dag (Today), calendar, tasks, a timewheel, routines and habits,
training, nutrition, sleep, household and shopping, goals, statistics, XP and a
lightweight companion. See the plan for scope and order.

The codebase is a fork of Mirco Negri's MIT-licensed *LifeOS*, an
Italian-university-oriented app. The upstream `README.md` still describes that
app and is partly outdated; this file and `docs/LIFEOS_PLAN.md` take precedence.
The `LICENSE` copyright notice must be kept.

**The existing app works and is the starting point, not a throwaway
prototype.**

## Technology stack

| Area | Current choice |
|---|---|
| Runtime | Expo SDK 54, React Native 0.81.5, React 19.1, New Architecture on, Hermes |
| Language | JavaScript (ES modules, JSX). `typescript` is a devDependency but there is no `tsconfig.json` and no `.ts` file |
| Navigation | Hand-rolled `useState` screen switcher plus a custom drawer in `App.js`. `@react-navigation/*` is installed but **not used yet** |
| State | All domain state lives in `App.js` (`useState`) and is passed to screens as props |
| Persistence | AsyncStorage through `src/data/storage.js` (`loadJSON` / `saveJSON`, key prefix `lifeos_`). Each collection is one JSON blob |
| Styling | `StyleSheet.create` per file, colour tokens in `src/config/colors.js`, dark UI only |
| Auth (optional) | Firebase Auth (anonymous plus Google One Tap). Disabled unless `EXPO_PUBLIC_FIREBASE_API_KEY` is set; without it the onboarding Google button is hidden. Nothing is synced |
| Tests | Node's built-in test runner, for pure modules only (`tests/*.test.mjs`) |
| Builds | EAS (`eas.json`: `development`, `apk`, `production`) |

## Repository structure

```
App.js                 Root: loads all data, global state, drawer, bottom nav, screen switcher
app.config.js          The ONLY Expo config (there is deliberately no app.json)
metro.config.js        Disables package "exports" resolution (needed by firebase/auth)
eas.json               EAS build profiles
src/
  config/              colors.js (theme tokens), nav.js (screen registry), firebase.js
  data/                Pure logic and persistence; no React in here
    helpers.js         Dates (localDateKey!), grade math, formatting
    tasks.js           Task/habit grouping and streaks (unit-tested)
    storage.js         loadJSON / saveJSON (AsyncStorage)
    seedData.js        Demo data that fills an empty install
  components/          Shared UI (Card, Pill, StatCard, DatePicker, GlassSheet, CustomAlert, DraggableList, …)
  screens/             One file per screen; holds local UI state and calls the setters passed in
tests/                 node:test unit tests for src/data/*
docs/LIFEOS_PLAN.md    Audit, target architecture, roadmap
```

## Commands

```bash
npm ci                    # install (uses package-lock.json)
npm test                  # unit tests (node:test auto-discovers **/*.test.mjs; no device needed)
npm run check:bundle      # Metro production bundle for Android; catches import and syntax errors
npm run validate          # test + check:bundle; run this after every change
npm run doctor            # expo-doctor (some checks need network access)

npm run android           # expo run:android: local native build (Android SDK + google-services.json)
npm start                 # Metro dev server for an installed development build
eas build -p android --profile apk   # installable APK via EAS
```

Things that are easy to get wrong:
- **Expo Go is not supported.** `react-native-nitro-google-signin` and
  `react-native-nitro-modules` are native modules, so you need a development
  build (`expo-dev-client` is installed).
- Android native builds need `google-services.json`. It is gitignored; EAS
  supplies it through the `GOOGLE_SERVICES_JSON` env var. A plain JS bundle
  (`check:bundle`) only warns about it.
- `EXPO_PUBLIC_*` variables are inlined at bundle time. After changing one,
  restart with `npx expo start --clear`, or Metro serves the old value.
  Put local values in `.env.local` (every `.env*` file is gitignored).
  **EAS builds do not upload gitignored files**: set
  `EXPO_PUBLIC_FIREBASE_API_KEY` as an EAS environment variable for the
  build profile, or the build ships with Firebase disabled.
- The cloud and CI sandbox cannot run the app on a device or emulator.
  "Validated" there means `npm run validate` passed; say explicitly that it
  was not run on a device.

## Architecture principles

1. **Prefer extending and refactoring proven existing code over replacing it
   unless replacement has a clearly documented technical reason.**
2. Migrate incrementally: current app → evolvable foundation → LifeOS modules.
   No big-bang rewrites, and no "delete and start over".
3. Preserve working functionality. If a change alters user-visible behaviour,
   say so in the commit message and explain why.
4. Keep logic separate from UI. New domain logic (grouping, streaks,
   calculations, migrations) goes in pure modules with no React or React
   Native imports, so it can be unit-tested. `src/data/tasks.js` is the
   pattern to follow.
5. Local-first and offline-first. All features must work with no network and
   no account. No backend or cloud infrastructure until the plan says so.
6. Danish first for user-facing text, and accessible by default (see below).
7. Do not add dependencies or switch technologies because they are popular.
   A new dependency needs a concrete reason, stated in the commit or PR.

## Rules for working in this repo

- **Read the relevant existing code before implementing.** Check `App.js` for
  how state and persistence are wired, the screen you are touching, and the
  shared components it uses. Many files carry long comments explaining
  device-specific bug fixes (Android keyboard, touch, safe-area and blur
  issues). Do not undo those fixes without understanding them.
- **Run `npm run validate` after every change**, and add or extend
  `tests/*.test.mjs` when you change pure logic. Report honestly what was and
  was not run.
- Large refactors (state management, navigation, database, i18n) each get
  their own session. If one looks necessary mid-task, write it down in
  `docs/LIFEOS_PLAN.md` instead of doing it.
- Do not redesign visual styling unless the task is explicitly a design task.

### Adding a new feature or module
- Put new LifeOS modules in `src/features/<module>/` (`screens/`,
  `components/`, and a pure `logic.js` or `model.js`). Existing screens stay
  in `src/screens/` until a planned session moves them.
- Register screens in `src/config/nav.js` (and the `SCREENS` map in `App.js`,
  until React Navigation is adopted).
- Pure logic gets tests in `tests/<name>.test.mjs`, which `npm test` discovers
  automatically. Make them deterministic: pass dates in, never read the
  clock inside the logic under test. A module imported by a test must import
  its siblings with explicit `.js` extensions (Node's ESM resolver needs
  them; Metro accepts them).
- Start a new module with an empty state, not demo data, unless the plan says
  otherwise.

### Modifying shared components (`src/components/*`)
- They are used by many screens. Grep for every usage before changing props or
  behaviour, and keep the existing props backwards-compatible.
- `DatePicker`, `GradeSelector`, `TagInput`, `DraggableList`, `GlassSheet` and
  `CustomAlert` contain deliberate Android workarounds (documented in their
  headers). Keep them.
- Colours come from `COLORS` in `src/config/colors.js`. Do not hard-code new
  hex values in screens.

### Data persistence
- Always go through `src/data/storage.js` (it adds the `lifeos_` prefix and
  swallows read errors). `HomeScreen`'s direct use of AsyncStorage for the
  section order is legacy; do not copy it.
- **Never rename an existing storage key or change a stored field's meaning
  without a migration.** Keys in use: `isFirstUse`, `userName`, `course`,
  `totalCredits`, `tipsShown`, `exams`, `finances`, `groceries`, `goals`,
  `notes`, `links`, `journal` (tasks *and* habits, shown as "Tasks"),
  `heatmap`, `loggedSeconds`, `habitsMigrated`, `home_section_order`. The
  `journal` id and key must stay, even though the UI calls it Tasks.
- Migrations: until a versioned migration runner exists (planned), follow the
  `habitsMigrated` pattern in `App.js`, i.e. a one-shot flag key, idempotent,
  never destructive.
- Dates are local `'YYYY-MM-DD'` strings built with `localDateKey()`. **Never
  use `toISOString()` for calendar dates**, because it shifts the day in
  Denmark (UTC+1/+2). Avoid `new Date('YYYY-MM-DD')` too: it parses as UTC.
- Persisted setters (`usePersist` in `App.js`) save the entire collection on
  every change. Keep collections modest and do not write in tight loops.

### Danish and accessibility
- New screens and modules should be Danish. Existing screens are still
  English, and translating them is a planned session (see the plan). Until
  then, a small addition to an existing English screen matches that screen's
  language rather than mixing languages; the translation session converts it
  together with the rest. Do not translate piecemeal while doing unrelated
  work.
- Use `da-DK` formatting for new code: Monday-first weeks, comma decimals,
  DKK. Watch for code that drops æ, ø and å (e.g. `TagInput`'s `[^a-z0-9-]`
  sanitiser) or parses `12,50` as `12` (`parseFloat`).
- Give interactive elements an `accessibilityLabel` and `accessibilityRole`,
  especially icon-only buttons (✕, ✎, ☰). Keep touch targets around 44 pt or
  larger, and do not add text smaller than 12.

## Known pitfalls (verified in the audit)
- With an empty Firebase API key, `initializeAuth` throws. `firebase.js`
  therefore exports `auth = null` when the key is unset, and every caller must
  handle `null`.
- The Firebase web API key that was once committed is still in git history.
  Treat it as public: restrict it in the Google Cloud console.
- The study timer and heatmap state in `App.js` is dead code. No screen calls
  the timer props, so "Study Days" stays at 0 for new installs.
- More are listed in `docs/LIFEOS_PLAN.md` § 3.
