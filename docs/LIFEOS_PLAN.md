# LifeOS: audit and roadmap

Status: written in the first Cloud Session (repository audit, 2026-10-03).
Keep this document current. When a session finishes a step or learns
something new, update the relevant section in the same commit.

Goal: **current app → evolvable foundation → LifeOS modules**. No rewrite.

---

## 1. Current-state architecture summary

**What it is:** an Expo SDK 54 / React Native 0.81 app in plain JavaScript,
about 6,700 lines across `App.js` and 30 files in `src/`. It began as a
personal dashboard for an Italian university student: exams graded 18–30L,
CFU credits, a degree mark out of 110, plus tasks, finances, groceries, goals,
notes and links. The UI is English, the theme is dark only, and seeded demo
data fills every section on first launch.

**How it was wired at the Session 1 audit** (for the current state see
`CLAUDE.md` and § 12):

```
expo/AppEntry.js → App.js (SafeAreaProvider)
  AppContent
    ├─ loads ~14 AsyncStorage keys sequentially on mount (storage.js, prefix "lifeos_")
    ├─ holds ALL domain state in useState (exams, finances, groceries, goals, notes,
    │   journal [= tasks + habits], links, heatmap, profile, tips, timer)
    ├─ usePersist(key, setter) → wraps setters so every change re-saves the whole collection
    ├─ Firebase anonymous auth + Google One Tap (optional; nothing is synced)
    ├─ screen = useState('home'); history stack ref for the Android back button
    ├─ custom animated drawer (Modal) + bottom tab strip, both driven by src/config/nav.js
    └─ SCREENS map: each screen receives its slice + persisted setter as props
src/screens/*      one big component per screen (200–600 lines): UI + local form state + domain logic
src/components/*   shared UI primitives with many documented Android workarounds
src/data/*         helpers (dates, grade math), storage wrapper, seed data, tasks logic
```

**Validation tooling before this session:** none. There were no tests, no
lint, no type checking, and no validation scripts.

**Runtime status found in the audit:** at HEAD the app **crashed at launch**.
The Firebase API key had been blanked in `src/config/firebase.js`, and
Firebase Auth throws `auth/invalid-api-key` from `initializeAuth` when the key
is empty. Because that module is imported at the top of `App.js`, nothing ran.
This session fixed it (see § 12).

### Inventory of user-facing features

| Feature | Where | Classification | Notes |
|---|---|---|---|
| Onboarding (name, degree, year, credit total, "what matters" goals) | `OnboardingScreen` | **REPLACE LATER** | Italian-university specific (Triennale/Magistrale, CFU). Year and goals are collected but **discarded** (`handleOnboardingComplete` ignores them). Becomes a short Danish onboarding. |
| "Continue with Google" during onboarding | `App.js`, Firebase | **UNCERTAIN** | Only pre-fills the name; no sync exists. Needs a native build and `google-services.json`; disabled unless the API key env var is set. Keep it until a sync decision is made. |
| Home dashboard: greeting, "Mission Control" stats, next exam, pending tasks preview, quick links | `HomeScreen` | **REFACTOR LATER** | Natural seed for **I dag (Today)**. The pending-tasks logic (overdue first, capped list) is reusable. |
| Home section drag-to-reorder (persisted) | `HomeScreen` + `DraggableList` | **UNCERTAIN** | Works but is reported as unreliable (README Known Issues). Re-evaluate when Today is designed. |
| First-use tip bubbles | `HomeScreen`, `TipBubble` | **REMOVE LATER** | **Never shown:** Home only renders after onboarding, when `isFirstUse` is already false, so `tipToShow` is always null. |
| Tasks: Overdue / Today / Upcoming / No Date sections, bottom composer, edit modal, priorities, drag-to-reorder, clear all | `JournalScreen` (key `journal`) | **KEEP** (refactor later) | Core of the future Tasks module. The Overdue section was added in this session. |
| Habits: recurring items with a 7-day dot row and streak | `JournalScreen` | **REFACTOR LATER** | Seed of Routines/Habits. The streak is a cached field, recomputed only on toggle, so it goes stale after missed days. Today-only toggling. |
| University: exams CRUD, statuses, 18–30L grade picker, CFU progress, averages, grade simulator, degree projection | `UniScreen`, `GradeSelector` | **UNCERTAIN → likely REMOVE LATER** | Italian grading system. Not part of the LifeOS module list. If education tracking is wanted, it would need Danish grades (7-trinsskala) and ECTS, which is a new design. Needs a product decision. |
| Finances: income/expense CRUD, categories, balance, 6-month chart | `FinancesScreen` | **UNCERTAIN** | Not on the LifeOS list, but works. Hard-coded €, `parseFloat` turns "12,50" into 12, and only the latest 15 transactions are visible. Keep as-is until a decision. |
| Statistics: tasks/7 days, grade trend, university progress, spending by category, habit leaderboard | `StatsScreen` | **REFACTOR LATER** | Becomes Personal statistics. Currently university-heavy. "Study Days" is always 0 (see timer). |
| Groceries: checklist, category tags, filters | `GroceriesScreen` | **KEEP** (refactor later) | Seed of Shopping. No edit, no quantities, no reorder. |
| Goals: numeric target/progress, stepper, priority, deadline, filters, edit | `GoalsScreen` | **KEEP** (refactor later) | Seed of Goals. Deadlines are compared with `new Date('YYYY-MM-DD')` (UTC). |
| Notes: title/content, tag autocomplete, reorder, edit | `NotesScreen`, `TagInput` | **KEEP** | Not on the module list but cheap and useful. `TagInput` strips æ, ø, å. |
| Links: bookmarks, emoji, star up to 6 for Home quick links | `LinksScreen` | **UNCERTAIN** | Not on the module list. Low maintenance cost. |
| Study timer and heatmap | `App.js` only | **REMOVE LATER** | Dead code: no UI calls the timer since upstream v1.0. `heatmap` and `loggedSeconds` are still read by Home and Stats. Remove together with the "Study Days" stats. |
| Pre-seeded demo data | `seedData.js` | **REPLACE LATER** | Italian-student content. LifeOS should start empty (calm first run), with demo data at most as an explicit option. |
| "Clear All" on every list screen | all list screens | **KEEP** | |
| Drawer and bottom navigation, Android back history | `App.js`, `nav.js` | **REPLACE LATER** | Replace with React Navigation (already installed); see § 4. |

### Reusable shared components

| Component | Verdict | Notes |
|---|---|---|
| `Card`, `StatCard`, `Pill`, `ProgressBar` | KEEP | Simple, token-based |
| `GlassSheet` | KEEP | Bottom sheet with safe-area handling; the standard modal container |
| `CustomAlert` | KEEP | Back button maps to cancel; used everywhere |
| `DatePicker` | KEEP, then localise | Sunday-first, English month names. Needs Monday-first and Danish (da-DK) |
| `DraggableList` | KEEP, re-evaluate | Heavily patched PanResponder implementation. A gesture-handler/reanimated library may eventually be more reliable (that would be a new dependency, so decide it explicitly) |
| `TagInput` | KEEP, fix æøå | |
| `GradeSelector` | Tied to University | Goes with the University decision |
| `BarChart` | KEEP | Dependency-free |
| `FadeSlideIn`, `TipBubble` | KEEP / REMOVE LATER | `TipBubble` is currently never shown |
| `HeaderBar`, `ProgressRing` | Unused | Dead files; `ProgressRing` is the only user of `react-native-svg`. May be useful for Timewheel or Today rings, so not deleted yet |

## 2. Existing reusable functionality (what must survive)

- `localDateKey()` and the discipline of storing local `'YYYY-MM-DD'` strings
  rather than ISO timestamps for calendar dates. This is important for Denmark
  (UTC+1/+2).
- The storage wrapper (`loadJSON`/`saveJSON`) as the single persistence entry
  point, and the idempotent one-shot migration pattern (`habitsMigrated`).
- Tasks plus habits as one list, with today and upcoming grouping and streak
  logic (now pure and tested in `src/data/tasks.js`).
- The bottom-sheet form pattern (`Modal` → `KeyboardAvoidingView` →
  `GlassSheet` → `ScrollView keyboardShouldPersistTaps="always"`). Every screen
  uses it and it encodes hard-won Android keyboard fixes.
- Safe-area handling (`SafeAreaProvider` at the root, insets applied per
  region).
- Theme tokens (`COLORS`) and the general calm dark visual language.
- The confirm-before-destroy pattern (`CustomAlert` with a cancel button).

## 3. Technical debt

Ordered roughly by how much it blocks LifeOS.

**Architecture**
1. **God component:** `App.js` owns every collection, load sequence,
   persistence wrapper, auth flow, navigation, drawer and timer. Every update
   re-renders the whole tree, and every new module means more props threaded
   through `App.js`. *Session 2:* tasks and habits moved to a Zustand store,
   migrations and parallel loading moved to `src/core/storage`. *Sessions
   3–4:* groceries, goals, notes and links moved too (every list module is
   now a feature store). Remaining in `App.js`: profile/onboarding, Home
   tips, exams, finances, study-timer data, navigation, Firebase.
2. **No real navigation:** the custom switcher cannot do nested stacks, deep
   links or per-tab history. Back handling is a hand-rolled history array, and
   the drawer is a `Modal`. React Navigation is installed but unused.
3. **Screens mix UI, form state and domain rules** in 200–600-line files.
   Only tasks logic has been extracted so far.
4. **Persistence model:** one JSON blob per collection, rewritten in full on
   every change from inside a `setState` updater (side effect in an updater).
   There is no schema version, no migration runner, no export/backup, and
   load is sequential (`await` × 14). Fine for hundreds of records, not for
   years of workout sets, meals and sleep logs. *Session 2:* schema version,
   migration runner, corrupt-value backups and parallel loading added; the
   one-blob-per-key format and lack of export remain.
5. **IDs are inconsistent:** `max(id)+1` in most screens, `Date.now()` in
   Exams and Links, fixed IDs in seed data. `max+1` can reuse the ID of a
   deleted item, which is risky once records reference each other.
6. ~~**No error boundary:** a render error blanks the app.~~ Root
   `ErrorBoundary` added in Session 2.
7. **Deferred from the Session 2 reviews** (do with the next module
   migration, not piecemeal):
   - ~~Extract the generic data-safety part of `journalStore.js` into a
     reusable helper.~~ Done in Session 3 (`createPersistedListStore`,
     ADR-003).
   - Make `KEY_SPECS` types the default in the engine (`type ?? spec.type`)
     so `App.js`-owned keys are shape-checked too. Small behaviour change for
     legacy keys (malformed values fall back instead of crashing a screen);
     do it as an explicit step.
   - Coalesce superseded writes (keep one in-flight save plus the latest
     pending value) instead of queueing every full-list save.
   - Persistence failures (`persistBlocked`) are only logged; the user is not
     told. Needs a UX decision (Danish message) in a UI session.
   - `parseGoalNumber` (comma decimals) lives in `features/goals/logic.js`.
     When Finances' `parseFloat` comma bug is fixed, build one shared Danish
     number parser in `src/data/helpers.js` (comma decimals AND "." thousands
     separators, which `parseGoalNumber` does not handle) and use it in both.
   - Each migrated store reads its own key with one `getItem` at boot (in
     parallel with `loadMany`). Fine for a few modules; if boot time matters
     later, let stores hydrate from a shared batched read.
   - 9 known lint warnings (unused variables/imports in `DatePicker`,
     `StatCard`, `JournalScreen`, `OnboardingScreen`, `StatsScreen`,
     `UniScreen`; `exhaustive-deps` in `TipBubble`). None affect behaviour.

**Correctness (not fixed this session unless noted)**
- ~~Overdue tasks vanished from the Tasks screen~~ — **fixed** this session.
- ~~App crashed at launch with an empty Firebase key~~ — **fixed** this
  session.
- Habit `streak` is a cached value that is only recomputed on toggle, so
  Stats and the habit card show stale streaks after a missed day.
- Dragging in the "Upcoming" section has no visible effect, because the
  section is re-sorted by date on every render. Done items there are also
  not sunk below open ones, unlike the other sections (kept as-is in
  Session 1 to preserve behaviour).
- `diffDays()` and the Goals expiry check parse `'YYYY-MM-DD'` with
  `new Date()`, which treats it as UTC, so "days left" and "expired" are off
  by hours in Denmark.
- Finance amounts use `parseFloat`, so Danish comma decimals are truncated.
  Sums are shown without rounding (floating-point artefacts possible).
  Only 15 transactions are visible.
- Tip bubbles can never show (see inventory).
- Found by the Session 4 code review in code moved verbatim into
  `src/features/*/logic.js` (pre-existing; deliberately not changed during
  the migration; fix each as its own explicit behaviour change with tests):
  - Goals: a goal counts as expired during its own deadline day
    (`isGoalExpired` parses `'YYYY-MM-DD'` as UTC). Fix with `localDateKey`
    comparison.
  - Goals: the inline progress field is controlled by `String(progress)`, so
    a comma decimal ("7,5") cannot be typed, clearing the field saves 0, and
    every keystroke saves the whole list.
  - Goals: `parseGoalNumber` ignores Danish thousands separators
    ("5.000" -> 5).
  - Links: `normalizeLinkUrl` checks a case-sensitive "http" prefix
    ("HTTPS://x" -> "https://HTTPS://x"; "httpbin.org" gets no scheme).
  - Goals/Notes/Links: entries without an `id` (only possible in damaged
    data) cannot be edited or deleted individually.
  - List operations return a new array even when nothing changed, so a
    no-op tap still saves the whole list (old behaviour too).
- Onboarding discards year and selected goals.
- Upstream README "Known Issues" (drag reliability, first tap on checkbox,
  composer vs keyboard, Grade Simulator commit, drawer overlapping the status
  bar) have not been re-verified on a device in this session.

**Localisation and accessibility**
- 100% English strings, hard-coded in every file, plus `'en-US'`/`'en-GB'`
  date formatting, `€`, a Sunday-first calendar and the Italian grade system.
- No `accessibilityLabel` or `accessibilityRole` anywhere. Many icon-only
  buttons (✕ ✎ ☰ ›) have 4–8 px padding, so tap targets are small. Font sizes
  of 9–11 are common.
- Contrast: `textSub` (#5a5a72) is about 2.9:1 on the background and 2.6:1 on
  cards, which fails WCAG AA for normal text. `textMuted` is fine at 6.3:1.
- Dark theme only. Whether a light or high-contrast theme is needed is
  unknown.

**Tooling and config**
- There were no tests, lint or type checking. Session 1 added unit tests and
  validation scripts; Session 2 added ESLint (`npm run lint`, part of
  `validate`). No type checking yet.
- `npm audit`: 51 advisories (1 critical in `tar`, 35 high), mostly in
  transitive build tooling. Review them in a dependency session. Do **not**
  run `npm audit fix --force`, because it breaks Expo SDK alignment.
- Expo Go cannot run the app (native nitro modules). A dev build is required.
- The Firebase key that was once committed remains in git history; restrict
  it in the Google Cloud console.
- `.gitignore` lists `images/`, but README screenshots in `images/` are
  tracked. `index.js` is an empty, unused file (`main` is
  `expo/AppEntry.js`).
- Unused dependencies: `@react-navigation/bottom-tabs` and
  `@react-navigation/native` (keep, they are planned), `react-native-svg`
  (used only by the unused `ProgressRing`), and `expo-linking` and
  `expo-status-bar` (not imported). `expo-system-ui` is also never imported,
  but Expo needs it to apply `userInterfaceStyle` on Android, so keep it.
  Check implicit and native usage before removing anything.

## 4. Recommended target architecture

The aim is evolution, not a new stack. Every element below can be introduced
next to the current code.

```
src/
  app/            App shell: providers, navigation container, root error boundary
  core/
    storage/      repository layer over AsyncStorage now, expo-sqlite later; schema version + migrations
    i18n/         da.js string table + t(); da-DK date/number/currency formatting
    time/         localDateKey & friends, Monday-first week helpers, time-of-day helpers
    activity/     append-only activity log ("task completed", "workout logged", …) feeding stats/XP
  shared/
    components/   today's src/components (moved gradually)
    theme/        colors (today's config/colors.js) + spacing/typography tokens
  features/
    today/  tasks/  habits/  routines/  calendar/  timewheel/  training/  exercises/
    nutrition/  sleep/  household/  shopping/  goals/  stats/  progression/  companion/
      each: screens/ components/ model.js (pure) store.js (state + persistence binding)
tests/            pure-logic tests (node:test now; jest-expo when component tests are needed)
```

Key decisions and the reasons behind them:

- **State:** move collections out of `App.js` into **per-domain stores**.
  Recommended: **Zustand**. It is one small dependency, hook-based, gives
  selective re-renders and works outside React for migrations and tests. The
  upstream author had already planned it. The acceptable no-dependency
  alternative is one React Context per domain, which needs more care to avoid
  re-renders. Decide this at the start of Session 2 and record the reason.
- **Persistence:** add a **repository interface** (`load`, `save`,
  `schemaVersion`, `migrate`) first, still backed by AsyncStorage, so screens
  stop knowing about keys. Move to **expo-sqlite** only when the first
  high-volume module arrives (training sets, meals, sleep logs). The
  repository boundary makes that a contained change. Keep data on the device;
  add a JSON export/backup before any cloud sync.
- **Navigation:** **React Navigation** (already installed). Bottom tabs for
  the four or five daily modules, a native stack per tab, and secondary
  modules reached from a "Mere" (More) screen instead of the custom drawer.
  This fixes the Android back button for free. It needs
  `@react-navigation/native-stack` (same family; `react-native-screens` is
  already present).
- **Domain model conventions for new data:** string IDs (time-plus-random,
  never `max+1`), `createdAt`/`updatedAt` timestamps, local `date` as
  `'YYYY-MM-DD'`, time of day as `'HH:mm'`, durations in minutes. Store no
  derived values (such as `streak`); compute them.
- **Activity log:** a single append-only log of completion events. Today,
  Statistics, XP and the companion all read from it, so modules do not need
  to know about each other.
- **i18n:** a plain `da.js` string table and a `t('key')` helper, with no
  library until pluralisation or multiple languages are needed. Format with
  `Intl` and `da-DK` (verify that Hermes' Intl output on the target devices
  is correct).
- **Accessibility as a foundation:** shared `Button`/`IconButton` components
  with labels, 44 pt targets and roles, minimum font sizes, contrast-checked
  tokens, and respect for OS font scaling and reduce-motion.
- **Testing:** pure logic is tested with `node:test` (no dependency).
  Introduce `jest-expo` plus React Native Testing Library when the first
  component-level tests are worth their cost.
- **Lint:** add ESLint via `npx expo lint` (eslint-config-expo).
- **TypeScript:** optional and incremental. `typescript` is already a
  devDependency; new `features/*` code could be `.ts`/`.tsx` with
  `allowJs`. Not urgent; decide in a dedicated session.

## 5. Migration strategy

Strangler-style: wrap, extract and move, one boundary per session, with the
app working after each step.

1. **Safety net first** (done this session): validation scripts and pure-logic
   tests. Add ESLint next.
2. **Data layer** (Session 2): repository plus versioned migrations; per-domain
   stores; `App.js` stops owning data. Screens keep their props API at first
   (adapters), so screen code barely changes.
3. **Navigation** (Session 3): React Navigation with the existing screens
   mounted unchanged; the drawer becomes "Mere".
4. **Danish and accessibility baseline** (Session 4): string table, da-DK
   formatting, shared accessible primitives, and translation of the screens
   being kept.
5. **Module by module:** new modules are built in `features/`. Existing
   screens move into `features/` when they are next substantially changed.
6. **Retire** what was classified REMOVE LATER (timer and heatmap, tip
   bubbles, unused components, University if confirmed), each with a storage
   migration that cleans up keys without losing data the user might still want
   (export first).

Rule: every step keeps the existing `lifeos_*` data readable. A user
upgrading must never lose data.

## 6. Proposed major modules

Each line gives the idea, what already exists, and the open questions. UX
details are deliberately **not** specified; they belong in each module's own
design session.

- **I dag (Today):** one calm screen answering "what matters now?": tasks due
  or overdue, routines and habits for today, the next calendar item, and short
  summaries from other modules. *Exists:* Home pending-tasks logic, overdue
  sorting. *Unknown:* how much to show at low energy; an "only the next thing"
  mode?
- **Calendar and tasks:** tasks exist (dates, priorities). Calendar needs an
  event model (start/end time) and probably time-of-day on tasks. *Unknown:*
  sync with the device calendar (`expo-calendar`, Google Calendar), which is
  a later, explicit decision.
- **Timewheel:** a visual circular plan of the day built from events, timed
  tasks and routines. *Exists:* nothing beyond `react-native-svg` and
  `ProgressRing`. *Unknown:* interaction model (view-only or drag to plan),
  24h or waking hours.
- **Routines and habits:** habits exist (daily, streaks). Routines are ordered
  step lists tied to a time of day (morning or evening). Needs a shared
  recurrence model (daily, weekdays, every N days). *Unknown:* reminders and
  notifications (`expo-notifications` would be new).
- **Training and workout tracking:** sessions, exercises, sets, reps, weight
  and RPE. High-volume data, so this is the trigger for SQLite. *Unknown:*
  program and plan support, rest timer, progression rules.
- **Exercise library:** seeded Danish exercise list plus user-created
  exercises, with muscle groups and equipment. *Unknown:* images or
  animations (licensing).
- **Nutrition and meal tracking:** meals and food items, possibly
  macros/protein. *Unknown (big):* food data source. A Danish food database
  such as DTU's Frida exists, but its licence and format are unverified.
  Manual entry and favourites may be enough for v1.
- **Sleep and recovery:** manual bedtime, wake time and quality first.
  *Unknown:* Health Connect or HealthKit import (native, permissions);
  definition of "recovery".
- **Household and shopping:** groceries exist and become Shopping (lists,
  quantities, maybe stores). Household chores reuse the recurrence model from
  routines. *Unknown:* sharing with other household members, which implies a
  backend.
- **Goals:** exist (numeric target and progress). Later goals may link to
  metrics from other modules (e.g. workouts per week).
- **Statistics:** exists in University-heavy form. Rebuild on the activity log
  and per-module summaries.
- **XP and progression:** XP derived from activity-log events with simple,
  transparent rules. *Unknown:* how to avoid pressure and guilt mechanics in a
  calm, low-energy app (no lost streak punishment?).
- **Companion:** a lightweight character reflecting progress and wellbeing.
  *Unknown:* almost everything (art, tone, whether it speaks, whether AI is
  involved). Build last.

## 7. Dependencies between modules

```
Foundation: storage/migrations ─ stores ─ navigation ─ i18n/da-DK ─ accessible primitives ─ time utils
   │
   ├─ Tasks ──────────────┐
   ├─ Recurrence model ───┼─ Routines/Habits ─┐
   │                      │   Household ──────┤
   ├─ Calendar (events) ──┴───────────────────┼─ Timewheel
   │                                          │
   ├─ Exercise library ─ Training             │
   ├─ Nutrition                               │
   ├─ Sleep/Recovery                          │
   ├─ Shopping (from Groceries)               │
   ├─ Goals                                   │
   │                                          ▼
   └─ Activity log ◄── all modules emit events ──► Today (reads summaries from all)
                     └─► Statistics ─► XP/Progression ─► Companion
```

- Today depends on Tasks and Routines/Habits at minimum; other modules add
  optional cards later.
- Timewheel depends on Calendar events plus time-of-day on tasks and routines.
- Household depends on the recurrence model (shared with Routines).
- Training depends on the Exercise library and on SQLite or the repository
  layer.
- Statistics, XP and the companion depend on the activity log and on there
  being enough modules worth summarising.

## 8. Recommended implementation order

1. Foundation: data layer → navigation → Danish and accessibility baseline.
   ESLint along the way.
2. Product decisions on UNCERTAIN items (University, Finances, Links, Google
   sign-in, demo data).
3. **I dag v1** from Home (tasks and habits only).
4. Tasks upgrade (time of day, recurrence model) → **Routines/Habits**.
5. **Shopping/Household** (cheap, reuses recurrence; early everyday value).
6. **Calendar** (events) → **Timewheel**.
7. **Exercise library → Training** (introduces SQLite through the repository).
8. **Sleep/Recovery** (manual).
9. **Nutrition** (after the data-source decision).
10. **Statistics** rebuilt on the activity log → **XP** → **Companion**.

## 9. Things that should NOT be built yet

- Backend, accounts, cloud sync or multi-device sharing. Keep it local-first;
  add export/backup first.
- Health Connect, HealthKit or wearables integration.
- Food database integration or barcode scanning.
- AI features (chat companion, auto-planning).
- Home-screen widgets, ads, payments (all on the upstream roadmap; out of
  scope).
- Push notifications and reminders, until the routines model exists.
- Light, high-contrast or tablet layouts, until the accessibility baseline
  shows they are needed.
- Gamification (XP, companion) before the core daily modules work well.
- A UI redesign, until the module structure is in place. Visual design gets
  its own sessions.

## 10. Risks and unknowns

- **Device-only bugs:** many past fixes target specific Android devices
  (keyboard, touch, safe area). Cloud sessions cannot run the app, so every
  UI-touching session needs a manual device check by the owner.
- **Data migration risk:** existing installs have data under `lifeos_*` keys,
  including the Italian demo data. Migrations must be idempotent and
  non-destructive. Decide whether to remove demo data automatically (no, unless
  the user confirms).
- **Product decisions pending:** University, Finances, Links, Google sign-in,
  and whether the app is single-user only.
- **Firebase:** keep it optional or remove it? It only pre-fills the name
  today. Removing it would also drop the nitro Google sign-in native modules
  and allow Expo Go again, which would simplify development.
- **Hermes Intl:** `da-DK` formatting completeness on the target devices needs
  verifying.
- **Data volume:** AsyncStorage blobs will not scale to multi-year training,
  nutrition and sleep logs. The SQLite move must happen before those modules
  ship, not after.
- **`DraggableList` reliability:** a custom gesture system; replacing it means
  new native dependencies (gesture-handler, reanimated).
- **Licence:** upstream is MIT, so keep the notice. Exercise images and food
  data have their own licences.
- **npm audit advisories** in build tooling; upgrade with SDK bumps, not
  forced fixes.

## 11. Recommended next 5 Cloud Sessions

Each one is reviewable on its own and leaves the app working. The numbers
below are planned roadmap steps, not the session counter used in the § 12
changelog (where Session 3 was the Groceries migration).

### Session 2: Data layer (state and persistence out of `App.js`) — DONE for tasks/habits

Done in Session 2 as a proof on one module (see § 12). Still to do with
the same recipe: the remaining collections, one per change (see Session 2b below).
- **Objective:** `App.js` no longer owns domain data. Introduce a repository
  with a schema version and a migration runner, and per-domain stores. No
  user-visible change.
- **Scope:** `src/core/storage/` (repository over AsyncStorage, `schemaVersion`
  key, ordered idempotent migrations; move `habitsMigrated` into it);
  per-domain stores for exams, finances, groceries, goals, notes, journal,
  links and profile, with Zustand or Context (record the decision); parallel
  load (`multiGet`); screens read and write via hooks; root error boundary;
  ESLint via `npx expo lint`.
- **Files:** `App.js`, `src/data/storage.js`, new `src/core/storage/*` and
  store files, `src/screens/*` (props → hooks, minimal), `tests/*`, `CLAUDE.md`.
- **Acceptance:** all existing keys load unchanged (test with a fixture of
  current-format data); migrations are tested to be idempotent; `App.js` is
  much smaller and holds only shell concerns; `npm run validate` and lint
  pass; no visual or behaviour change; device smoke test checklist included
  in the PR.

### Session 2b: second module on the store pattern + shared helper — DONE (Session 3)
- **Objective:** migrate **Groceries** (smallest collection, read only by
  `GroceriesScreen`, future Shopping module) to a store, and extract the
  generic data-safety logic out of `journalStore.js` into a reusable helper
  that both stores use (done as `src/core/state/persistedListStore.js`).
- **Acceptance:** existing `lifeos_groceries` data loads unchanged
  (fixture test); the journal store's behaviour and tests are unchanged
  (tests moved to the helper where generic); `App.js` no longer holds
  groceries; validate passes. Then repeat per collection (Goals, Notes,
  Links, Finances, Exams, profile) in small follow-ups. *Goals, Notes and
  Links: done in Session 4.*

### Session 3: Navigation (React Navigation)
- **Objective:** replace the `useState` switcher and custom drawer with React
  Navigation, keeping every screen.
- **Scope:** `NavigationContainer`, bottom tabs (I dag/Home, Tasks, Finances
  or a decided set, Stats), native stacks, a "Mere" screen listing secondary
  modules, Android back behaviour, preserved safe-area handling, onboarding
  as a gate before the navigator.
- **Files:** `App.js`, `src/config/nav.js`, new `src/app/navigation/*`,
  screens (only `onNavigate` call sites), `package.json`
  (`@react-navigation/native-stack`).
- **Acceptance:** every current screen is reachable; Android back goes back
  instead of exiting; no data-layer changes; validate passes; device check of
  back button and insets.

### Session 4: Danish and accessibility baseline
- **Objective:** Danish user-facing text and locale handling for the screens
  being kept, plus accessible shared primitives.
- **Scope:** `src/core/i18n/da.js` + `t()`; da-DK date and number formatting;
  Monday-first `DatePicker` in Danish; comma-decimal parsing helper (Finances,
  Goals); æøå in `TagInput`; `accessibilityLabel`/`Role` on icon buttons;
  larger hit areas; fix `textSub` contrast. Requires decisions on University,
  Finances and Links first (translate only what stays).
- **Acceptance:** no English strings remain in kept screens (grep-verified);
  helper tests for parsing and formatting; contrast of text tokens ≥ 4.5:1;
  validate passes.

### Session 5: I dag (Today) v1
- **Objective:** evolve Home into a calm Today screen.
- **Scope:** overdue and today's tasks, today's habits (check-off in place),
  next upcoming item; remove dead Home bits (tips, study days, timer state)
  with a storage cleanup migration; empty-state design for a fresh install.
  Visual design may use the design workflow at that point.
- **Acceptance:** works with an empty install and with existing data; pure
  "what's on today" selector is unit-tested; validate passes.

### Session 6: Recurrence model, routines and habits
- **Objective:** a shared recurrence model (daily, specific weekdays, every N
  days) and time of day on tasks; habits use it (streaks computed, not
  cached); first version of Routines as ordered step lists.
- **Acceptance:** migration of existing habits (`recurring: true` items in
  `journal`) without losing history; recurrence and streak logic fully
  unit-tested; Tasks screen behaviour unchanged for one-off tasks.

## 12. Changelog of foundation work

| Session | Change |
|---|---|
| 1 (2026-10-03) | Audit, `CLAUDE.md`, this plan. Fixed launch crash (Firebase key now from `EXPO_PUBLIC_FIREBASE_API_KEY`, `auth` null when unset). Fixed overdue tasks being invisible on the Tasks screen (new "Overdue" section; a task ticked off there stays visible, dimmed, for the rest of the visit so the tap can be undone). Onboarding hides "Continue with Google" when Firebase is not configured. `computeStreak` now counts from the passed date instead of the wall clock. Extracted task grouping and streak logic to `src/data/tasks.js` (deduplicated from `seedData.js`). Added `npm test` (node:test, 18 tests), `check:bundle`, `validate`, `doctor` scripts. Removed the ignored, conflicting `app.json` (effective config unchanged). Ignored `.env` and `.env.*` (except `.env.example`). |
| 2 (2026-10-03) | Versioned storage in `src/core/storage` (engine over injectable adapter, never throws, corrupt values backed up to `lifeos_corrupt_<key>`, read errors distinct from missing; documented key registry; `schemaVersion` + migration runner). Migration 1 absorbs the old inline `habitsMigrated` block (same result; atomic write, duplicate guard, aborts on unreadable data). Tasks + habits moved to a Zustand store (`src/features/tasks`, ADR-001); `App.js` no longer holds `journal`; Journal/Home/Stats read via hooks; on-disk format unchanged. Boot runs migrations then loads in parallel. Root `ErrorBoundary` (Danish fallback). ESLint via `expo lint` added to `validate`. New dependency: `zustand`. 54 tests. Behaviour change only for damaged data: a corrupt/unreadable journal shows empty instead of demo data. |
| 3 (2026-10-03) | Shared `createPersistedListStore` (`src/core/state/`, ADR-003) holds all list-store data safety; tasks/habits moved onto it (behaviour unchanged; `journalStore.js` removed). **Groceries migrated** (second module): `src/features/groceries/` (store + pure `logic.js`), `GroceriesScreen` reads via hooks, `App.js` no longer holds groceries, `lifeos_groceries` format unchanged. Safety suite runs per module. ADR-003 documents the migration template. Overlapping hydrations share one read; a failed boot shows the ErrorBoundary retry screen instead of an endless loading view. Behaviour change for damaged data only: corrupt/unreadable groceries show an empty list instead of the demo list, and unreadable grocery data is never overwritten (same rule as tasks). 79 tests. |
| 4 (2026-10-03) | **Goals, Notes and Links migrated** with the ADR-003 template, one commit each; `persistedListStore.js` unchanged. Each got `src/features/<module>/store.js` + a pure `logic.js` (clock and generated ids passed in). `HomeScreen` reads links via `useLinks` + `starredLinks`. `App.js` no longer holds any list module. Stored keys and formats unchanged and never rewritten on load; damaged data for these modules now follows the shared safety rules (corrupt -> backed up, empty list; unreadable -> never overwritten). `isGoalExpired` returns a real boolean (the old inline `''` was rendered as a bare string in a View). Safety suite runs for all five list modules. 143 tests. |
