# CLAUDE.md — LifeOS repository guide

Read this first in every session. The long-term plan lives in
[`docs/LIFEOS_PLAN.md`](docs/LIFEOS_PLAN.md) and accepted architecture
decisions in [`docs/ARCHITECTURE_DECISIONS.md`](docs/ARCHITECTURE_DECISIONS.md).
Read the section for the module you are touching before you change anything.

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
| Navigation | React Navigation 7: one flat bottom-tab navigator (`src/app/navigation/AppNavigator.js`, ADR-004). Bottom bar **I dag · Tidshjul · Plan · Mere** (ADR-005, ADR-007); every other screen is listed on Mere (`MoreScreen`), which replaced the drawer. The top bar is the navigator's `layout` (`ShellLayout`), the bottom bar its `tabBar` (`BottomNav`), and Back uses `backBehavior: 'fullHistory'`. Routes, Danish labels, icons, tabs and Mere groups live in `src/config/nav.js`. The app starts on I dag (`today`) |
| State | **Mid-migration (ADR-001, ADR-003).** All list modules (tasks/habits = `journal`, groceries, goals, notes, links) live in Zustand stores built with the shared `createPersistedListStore` (`src/core/state/`); screens read them with hooks. `App.js` still owns profile/onboarding, Home tips, exams, finances and the dead study-timer data (`useState`, passed as props) |
| Persistence | AsyncStorage through the versioned engine in `src/core/storage/` (key prefix `lifeos_`, `schemaVersion` plus migrations; ADR-002). Each collection is still one JSON blob in its original format. `src/data/storage.js` `saveJSON` is the legacy write path for `App.js`-owned sections |
| Styling | `StyleSheet.create` per file, colour tokens in `src/config/colors.js`, dark UI only |
| Auth (optional) | Firebase Auth (anonymous plus Google One Tap). Disabled unless `EXPO_PUBLIC_FIREBASE_API_KEY` is set; without it the onboarding Google button is hidden. Nothing is synced |
| Tests | Node's built-in test runner, for pure modules and stores (`tests/*.test.mjs`, in-memory storage adapter in `tests/fixtures.mjs`) |
| Lint | ESLint 9 flat config via `expo lint` (`eslint.config.js`, `eslint-config-expo`) |
| Builds | EAS (`eas.json`: `development`, `apk`, `production`) |

## Repository structure

```
App.js                 Root: boot (migrations, then parallel load), auth, onboarding gate, state for not-yet-migrated sections; renders AppNavigator
app.config.js          The ONLY Expo config (there is deliberately no app.json)
metro.config.js        Disables package "exports" resolution (needed by firebase/auth)
eas.json               EAS build profiles
eslint.config.js       Expo ESLint config
src/
  app/                 App-shell pieces: ErrorBoundary (root fallback, Danish)
  app/navigation/      AppNavigator (NavigationContainer + tab navigator), ShellLayout
                       (top bar, "Tilbage" on secondary screens), BottomNav (bottom bar),
                       MoreScreen (Mere: every non-tab screen, grouped)
  core/i18n/           da.js (Danish strings) + t() (index.js); format.js: da-DK dates,
                       numbers, DKK (hand-written, not Intl: same output on every device)
  core/time/           dates.js: localDateKey (home of it) + local 'YYYY-MM-DD' arithmetic,
                       Monday-first weeks, ISO week; timeOfDay.js: 'HH:mm' parsing and
                       arithmetic; useNow.js: the one React hook here (minute tick + resume)
  core/storage/        Versioned persistence: engine.js (adapter-agnostic, never throws),
                       keys.js (documented key registry), migrations.js (SCHEMA_VERSION +
                       ordered migrations), index.js (appStorage = engine over AsyncStorage)
  core/state/          persistedListStore.js: the ONE store factory for persisted lists
                       (hydration, data safety, ordered saves); tested per module
  features/today/      I dag: logic.js (NU/NÆSTE + overview, pure), screens/TodayScreen.js.
                       Reads tasks, goals, groceries stores
  features/timewheel/  Tidshjul (route `timewheel`, ADR-007): logic.js (one date's timed
                       items, lanes, overlaps, timeline rows, ring geometry; pure),
                       screens/TimewheelScreen.js, components/DayRing.js (SVG), Timeline.js,
                       ConflictPanel.js.
                       A view over the tasks store; persists nothing
  features/plan/       Plan (route `journal`): logic.js (grouping, list operations, task
                       form validation, pure), screens/PlanScreen.js, components/TaskSheet.js,
                       Composer.js, Choice.js; useEntryEditor.js (THE task/habit editor,
                       also used by Timewheel)
  features/tasks/      store.js: tasks + habits singleton + useJournal / useSetJournal /
                       useToggleEntry (ticks on the real current day) / useTickedThisVisit;
                       schedule.js: optional startTime/durationMinutes (ADR-006), status,
                       ordering, findOverlaps; focus.js: selectFocus = THE NU/NÆSTE rule
                       (I dag + Timewheel); items.js: the task/habit item + Danish
                       description; components/ItemRow.js: NU/NÆSTE cards and rows
                       (grouping/streaks in src/data/tasks.js)
  features/groceries/  store.js: singleton + useGroceries / useSetGroceries;
                       logic.js: pure list operations (add/toggle/delete/filter)
  features/goals/      store.js + logic.js (progress, completion, expiry, filters)
  features/notes/      store.js + logic.js (add/edit/delete, tag collection)
  features/links/      store.js + logic.js (add/edit/delete, star limit, URL
                       normalisation); also read by HomeScreen (Quick Links)
  config/              colors.js (theme tokens), nav.js (routes: names, Danish labels, icons,
                       tabs, Mere sections, initial route, back behaviour), firebase.js
  data/                Pure logic and persistence; no React in here
    helpers.js         Legacy helpers: re-exports localDateKey, todayKey, grade math, en-US fmt
    tasks.js           Task/habit grouping and streaks (unit-tested)
    storage.js         saveJSON (legacy write path for App.js-owned sections; delegates to core/storage)
    seedData.js        Demo data that fills an empty install
  components/          Shared UI (Card, Pill, StatCard, LinkRow, CheckButton, DatePicker (locale 'da'
                       for new screens), GlassSheet, CustomAlert, DraggableList, …)
  screens/             One file per screen; holds local UI state and calls the setters passed in
tests/                 node:test unit tests (data logic, storage, migrations, stores) + fixtures.mjs
docs/LIFEOS_PLAN.md    Audit, target architecture, roadmap
docs/ARCHITECTURE_DECISIONS.md  ADRs (Zustand stores, versioned storage, shared list store + migration template)
```

## Commands

```bash
npm ci                    # install (uses package-lock.json)
npm test                  # unit tests (node:test auto-discovers **/*.test.mjs; no device needed)
npm run lint              # expo lint (ESLint); errors fail, warnings are known cleanup
npm run check:bundle      # Metro production bundle for Android; catches import and syntax errors
npm run validate          # test + lint + check:bundle; run this after every change
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
- Register a screen by adding its route to `NAV` in `src/config/nav.js` and
  one `<Tab.Screen name=…>` in `src/app/navigation/AppNavigator.js`
  (`tests/navigation.test.mjs` checks that the two match). Navigate with
  `useNavigation().navigate('<route>')`, never with callbacks passed down
  from `App.js`. A new route is either a tab (`tab: true`) or listed in a
  Mere `section`; the tests check that nothing is unreachable. Adding a tab
  or nested stacks is an ADR-level decision (ADR-005), not something to add
  on the side.
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

### State and stores (ADR-001, ADR-003)
- A migrated list module has `src/features/<module>/store.js`, which calls
  `createPersistedListStore({ storage: appStorage, key: KEYS.x, seed })` and
  exports the singleton plus `use<Module>` / `useSet<Module>` /
  `hydrate<Module>`. Domain rules go in a pure `logic.js`. Do not hand-write
  hydration or saving in a module, and do not invent a second pattern.
- Follow the **migration template in ADR-003** step by step, and add the
  module to `MODULES` in `tests/persistedListStore.test.mjs`.
- Non-list data (profile scalars, `heatmap`) does not fit the list factory.
  Do not bend it; decide that pattern when the first such module migrates.
- Screens read with narrow selectors (`useStore(store, s => s.list)`). Never
  return a new object or array from a selector (render loop); use
  `useShallow` if unavoidable.
- No Zustand `persist` middleware (it would change the on-disk format).
  Hydrate explicitly at boot after `runMigrations`; never save during
  hydration, before hydration, or after a failed read (`persistBlocked`).
- Migrate **one module per change**, with tests proving its existing stored
  format still loads. Sections not yet migrated keep the `App.js` pattern.

### Data persistence (ADR-002)
- Use `appStorage` from `src/core/storage` in new code (`read` / `load` /
  `loadMany` / `save` / `saveMany`). It never throws, adds the `lifeos_`
  prefix, backs corrupt values up to `lifeos_corrupt_<key>`, and reports read
  errors as status `'error'` (distinct from `'missing'`). Never overwrite a
  key whose read returned `'error'`. `saveJSON` remains only for `App.js`'s
  legacy sections. `HomeScreen`'s direct AsyncStorage use for the section
  order is legacy; do not copy it.
- Every key is documented in `src/core/storage/keys.js` (type, owner). Add new
  keys there and refer to them as `KEYS.x`, not string literals.
- **Never rename an existing storage key or change a stored field's meaning
  without a migration.** The `journal` key must stay, even though the UI
  calls it Plan. New optional fields are fine without a migration when
  "absent" already means the old behaviour (ADR-006: a task's `startTime` /
  `durationMinutes`); write them only on a user's save, never on load, and
  remove them rather than storing `null`.
- NU/NÆSTE has one implementation (`selectFocus`); a screen that shows
  them calls it rather than ranking tasks itself. Tasks are edited only
  through `useEntryEditor` (one sheet, one save/delete path).
- Times of day are local `'HH:mm'` strings (`src/core/time/timeOfDay.js`).
  No timestamps or UTC for planning; pure logic gets "now" passed in
  (`today` + minutes since midnight), screens get it from `useNow()`.
- Migrations live in `src/core/storage/migrations.js`: append
  `{ version, name, up }`; `SCHEMA_VERSION` follows. Each must be idempotent
  (check its own preconditions), non-destructive (never delete legacy keys),
  write related keys together with `saveMany`, and throw to abort (the
  version is then not bumped and it retries next launch). Add tests that
  start from the previous on-disk format, including running it twice.
- Dates are local `'YYYY-MM-DD'` strings built with `localDateKey()`. **Never
  use `toISOString()` for calendar dates**, because it shifts the day in
  Denmark (UTC+1/+2). Avoid `new Date('YYYY-MM-DD')` too: it parses as UTC.
- Persisted setters (`usePersist` in `App.js`, `setItems` in every
  `createPersistedListStore` store) save the entire collection on every change. Keep collections modest
  and do not write in tight loops.

### Danish and accessibility
- New screens and modules should be Danish. Existing screens are still
  English, and translating them is a planned session (see the plan). Until
  then, a small addition to an existing English screen matches that screen's
  language rather than mixing languages; the translation session converts it
  together with the rest. Do not translate piecemeal while doing unrelated
  work.
- New UI text goes in `src/core/i18n/da.js` and is read with `t('key')`
  (placeholders `{name}`, `{ one, other }` plurals by `count`); a test
  checks that every key used in `src` exists. Format with
  `src/core/i18n` (`formatDateLong`, `formatRelativeDay`, `formatNumber`,
  `formatMoney`) and do date maths with `src/core/time/dates.js`, not
  `Intl`/`toLocale*` (output differs between Hermes builds and Node).
- Use `da-DK` formatting for new code: Monday-first weeks, comma decimals,
  DKK. Watch for code that drops æ, ø and å (e.g. `TagInput`'s `[^a-z0-9-]`
  sanitiser) or parses `12,50` as `12` (`parseFloat`).
- Give interactive elements an `accessibilityLabel` and `accessibilityRole`,
  especially icon-only buttons (✕, ✎, ☰). Keep touch targets around 44 pt or
  larger, and do not add text smaller than 12. Text uses `text` or
  `textMuted`; `textSub` (≈2.9:1) and small `accent` text on `bg2`/cards
  fail WCAG AA (`tests/a11y.test.mjs` checks the new UI).

## Known pitfalls (verified in the audit)
- With an empty Firebase API key, `initializeAuth` throws. `firebase.js`
  therefore exports `auth = null` when the key is unset, and every caller must
  handle `null`.
- The Firebase web API key that was once committed is still in git history.
  Treat it as public: restrict it in the Google Cloud console.
- The study timer and heatmap state in `App.js` is dead code. No screen calls
  the timer props, so "Study Days" stays at 0 for new installs.
- `metro.config.js` disables package `exports` resolution. A new dependency
  must resolve through its root files or `main` (check with
  `npm run check:bundle`); `zustand` and `zustand/vanilla` do.
- Every route stays mounted only while focused (`screenLayout` in
  `AppNavigator`), as the old switcher did: leaving a screen resets its local
  state. Keep it that way unless the design changes.
- Feature stores are module singletons: they survive `ErrorBoundary` retries
  and are re-created by Fast Refresh when their file is edited (dev only;
  reload the app after editing store files).
- `expo lint` / `expo-doctor` may try to reach the Expo API; in a sandbox
  without access use `EXPO_OFFLINE=1`.
- More are listed in `docs/LIFEOS_PLAN.md` § 3.
