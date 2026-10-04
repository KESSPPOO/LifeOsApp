# Architecture decisions

Short ADR-style records. Add new entries at the bottom; never rewrite an
accepted entry. If a decision changes, add a new entry that supersedes it.

---

## ADR-001: Zustand for per-module state (instead of React Context)

- **Status:** accepted (Session 2, 2026-10-03)
- **Scope:** domain state that `App.js` used to own. Tasks and habits
  (`journal`) are the first and only module migrated so far.

### Context
`App.js` holds every collection in `useState` and passes it down as props.
Any change re-renders the whole tree, and every new LifeOS module would mean
more state and props in `App.js`. Data has to move into per-module state
containers that screens read directly. The two options evaluated were React
Context, which needs no dependency, and Zustand, which adds one.

### Evaluation

| Criterion | React Context | Zustand 5 |
|---|---|---|
| RN / Expo suitability | Built in | Pure JS, no native code, no runtime dependencies (all peers optional). Metro resolves `zustand` and `zustand/vanilla` from root files even though our `metro.config.js` disables package `exports` (verified by bundling) |
| Simplicity | Provider + context + memoised value + custom hook per module; providers nest in `App.js` | `createStore` + `useStore(store, selector)`; no providers |
| Persistence integration | Saving happens inside React (effects or updaters), so persistence is tied to render timing | The store is a plain object usable outside React, so load, migrate and save live in plain functions that run before the first render |
| Re-render behaviour | Every consumer re-renders when the value changes; avoiding that means splitting contexts or adding selector libraries | Selector subscriptions: a component re-renders only when its selected slice changes |
| Module isolation | Each module needs a provider mounted somewhere in the tree, so the shell keeps knowing about every module | Each module owns a store file; the shell only triggers hydration |
| Testing | Needs a React renderer; we have none, and adding `jest-expo` or Testing Library is heavy | `zustand/vanilla` stores run directly in `node:test` with an in-memory storage adapter; no new test framework |
| Migration effort | Similar per module | Similar per module. Screens swap props for one hook call |
| Long-term maintainability | No dependency to track | One small, widely used, stable dependency (~1 kB of runtime code used); an API that has been stable across major versions |

A third option was considered: a hand-rolled store on React's
`useSyncExternalStore`, with no dependency. It would mean re-implementing what
Zustand already provides (subscription bookkeeping, selector and snapshot
caching, equality helpers) and testing it ourselves, to save one tiny,
well-tested package. Rejected for now. Our stores are created through
`createStore`, so swapping in such an implementation later would stay local
to each store file.

### Decision
Use **Zustand 5** (`zustand/vanilla` stores plus the `useStore` hook).

Rules that go with it:
1. One store per module, in `src/features/<module>/`. Write a pure,
   injectable factory (`create…Store({ storage, … })`) that tests use, and a
   small app-binding file that creates the singleton with the real storage
   and exports hooks.
2. **Do not use Zustand's `persist` middleware.** It would rewrite stored
   values into its own `{ state, version }` envelope and break compatibility
   with existing `lifeos_*` data. Persistence goes through
   `src/core/storage` and keeps the existing on-disk format.
3. Hydrate from storage explicitly at boot, after migrations have run. Do not
   save during hydration. Only user actions write.
4. Components subscribe with narrow selectors. A selector must return stored
   references, not new objects or arrays (otherwise React 19 loops). Use
   `useShallow` if a derived object is unavoidable.

### Consequences
- One new runtime dependency: `zustand`.
- `App.js` no longer owns tasks and habits. The other collections keep the
  old pattern until they are migrated one by one using the same recipe.
- Two state patterns coexist during the migration. This is intentional and
  temporary.

---

## ADR-002: Versioned storage with in-place, format-preserving migrations

- **Status:** accepted (Session 2, 2026-10-03)

### Context
Data lives in AsyncStorage as one JSON value per key (`lifeos_<key>`). Before
this session the only schema change was an ad-hoc one-shot flag
(`habitsMigrated`) inside `App.js`. LifeOS needs to evolve data shapes
safely across many modules.

### Decision
- `src/core/storage/` owns persistence: a storage engine over an injectable
  adapter (AsyncStorage in the app, an in-memory map in tests), a documented
  key registry, and an ordered migration list keyed by a single global
  `schemaVersion` (stored as `lifeos_schemaVersion`).
- Migrations run once at boot, before any state is hydrated, in ascending
  order. Each must be **idempotent** (it checks its own preconditions) and
  **non-destructive** (it never deletes legacy keys and writes related keys
  together with `multiSet`). The version is bumped only after a migration
  succeeds. A failing migration stops the run, and the app continues on the
  old version so it can retry on the next launch.
- If the stored version is newer than the app knows (a downgrade), no
  migration runs and the version is not lowered.
- Reads are defensive: unparsable JSON, or a value of the wrong type, falls
  back to the default, and the raw value is first copied to
  `lifeos_corrupt_<key>` so it is never silently lost. If that backup cannot
  be written, the read is reported as `'error'` instead of `'corrupt'`.
- A read `'error'` means "unknown", never "missing": migrations abort on it
  (retry next launch), and stores block saving until a later read succeeds,
  so data that was never read cannot be overwritten.
- Demo/seed data is used only when a key is genuinely missing (fresh
  install). A corrupt or unreadable collection shows as empty rather than
  as demo data that would then be saved as the user's own.
- On-disk formats stay as they are (e.g. `journal` remains a plain array).
  A migration changes a format only when there is a reason, never as a side
  effect of a refactor.

### Consequences
- The legacy `habitsMigrated` logic became migration 1. It still writes the
  `habitsMigrated` flag, so an older build of the app (after a downgrade)
  does not migrate the habits a second time.
- SQLite can later be introduced behind the same engine interface for
  high-volume modules, without touching screens.

---

## ADR-003: One shared factory for persisted list stores

- **Status:** accepted (Session 3, 2026-10-03)
- **Refines:** ADR-001 rule 1 (per-module store factory) and ADR-002.

### Context
Tasks/habits got a hand-written store in Session 2. Its data-safety logic had
nothing task-specific in it: hydrate once with one retry, seed only on a
missing key, empty list on corrupt or unreadable data, block saving after a
failed read and allow recovery by re-hydrating, ordered saves, no save before
hydration, drop non-object entries. Groceries, the second module, needs
exactly the same thing. Copying it per module would let the copies drift, and
one forgotten guard overwrites user data.

### Decision
- `src/core/state/persistedListStore.js` exports one function,
  `createPersistedListStore({ storage, key, seed, logger })`. It returns a
  Zustand vanilla store with `{ items, hydrated, persistBlocked, hydrate,
  setItems, flush }` for **one key holding an array of objects**, in its
  existing on-disk format.
- A migrated module has no store factory of its own. It has a binding file
  `src/features/<module>/store.js` (singleton plus named hooks, e.g.
  `useGroceries` / `useSetGroceries` / `hydrateGroceries`) and, where it has
  domain rules, a pure `logic.js` (e.g. `features/groceries/logic.js`, or
  `src/data/tasks.js` for tasks).
- The data-safety guarantees are tested once per module: the suite in
  `tests/persistedListStore.test.mjs` runs with each migrated module's
  registered key (`KEYS`) and a fixture of its stored format. The app's
  `store.js` bindings import AsyncStorage, so they are covered by
  `check:bundle` and device testing, not by unit tests.
- Scope is deliberately narrow: lists only. Non-list data (the profile
  scalars, the `heatmap` object) does not get bent into this factory. Write a
  sibling only when a second module of that shape needs it.

### Consequences
- Tasks/habits now use the factory (the old `features/tasks/journalStore.js`
  is gone). The hook names and behaviour are unchanged, and so are all
  task/habit tests.
- Adding a list module costs about 20 lines of binding code plus its domain
  logic and tests.

### Migration template (one module per change)
1. **Storage key:** keep the existing key and format. Set its owner in
   `src/core/storage/keys.js`.
2. **Migration compatibility:** no migration unless the format must change.
   If it must, add one in `migrations.js` (idempotent, non-destructive) with
   tests from the old format.
3. **Feature store:** `src/features/<module>/store.js` calls
   `createPersistedListStore({ storage: appStorage, key: KEYS.x, seed })`.
   The seed is the module's existing demo data, used only when the key is
   missing.
4. **Hydration:** add `hydrate<Module>()` to the `Promise.all` in `App.js`'s
   boot, after `runMigrations`.
5. **Persistence:** screens write only through the persisted setter
   (`setItems`, exported as `useSet<Module>`). Never call AsyncStorage
   directly.
6. **Feature hooks:** screens read with `use<Module>()`, a narrow selector,
   instead of props.
7. **Tests:** add the module to `MODULES` in
   `tests/persistedListStore.test.mjs` (its `KEYS` entry, a fixture of today's
   stored format in `tests/fixtures.mjs`, a test seed), and test the module's
   operations (pure, and through the store).
8. **Remove it from `App.js`:** the `useState`, the `loadMany` entry, the
   `usePersist` setter, the props, and the now-unused seed import.

---

## ADR-004: React Navigation reproduces the existing shell (no redesign)

- **Status:** accepted (Session 5, 2026-10-03)

### Context: navigation before this change
`App.js` switched screens by hand: `screen` state, a `SCREENS` map of
JSX, a manual history array and a `BackHandler`. Inventory of the existing
behaviour, which the migration must keep:

| Route id | Screen | Reached via | Props from `App.js` | Notes |
|---|---|---|---|---|
| `home` | HomeScreen | start screen; bottom bar; drawer | exams, finances, heatmap, userName, course, isFirstUse, tipsShown, onDismissTip, timer props (unused), `onNavigate` | links to `uni` (Next Target header and card), `journal` (Tasks header, "+N more"), `links` (Quick Links header) |
| `uni` | UniScreen | bottom bar; drawer; Home | exams, setExams, totalCredits | |
| `journal` | JournalScreen ("Tasks") | bottom bar; drawer; Home | none (tasks store) | |
| `finances` | FinancesScreen | bottom bar; drawer | finances, setFinances | |
| `stats` | StatsScreen | bottom bar; drawer | exams, heatmap, finances, loggedSeconds | |
| `groceries` | GroceriesScreen | drawer | none | |
| `goals` | GoalsScreen | drawer | none | |
| `notes` | NotesScreen | drawer | none | |
| `links` | LinksScreen | drawer; Home | none | |

Shell behaviour:
- **Persistent chrome:** a top bar (☰, logo, the current screen's icon and
  label), a bottom bar with the five `bottomNav` items (current one
  highlighted, icon "pop" when the screen changes), and a custom animated
  drawer (a `Modal`) listing every route with the current one highlighted.
  Safe-area insets go on the root top padding, the drawer header and the
  bottom bar.
- **Switching:** only the current screen is mounted. Every visit mounts it
  fresh (local state such as filters or open forms resets) and plays the
  `FadeSlideIn` entrance. Choosing the current screen again does nothing.
- **Android Back:** if the drawer is open, it closes. Otherwise Back returns
  to the previously shown screen, walking back through every switch
  (including duplicates). With no history left, the app exits. Modals inside
  screens close themselves first (`onRequestClose`).
- **Onboarding:** a gate. Until it completes, only `OnboardingScreen` renders,
  with no chrome.

### Decision
- **One bottom-tab navigator** (`@react-navigation/bottom-tabs`, already
  installed) holds all nine routes as siblings. This is the structure the app
  already has: a flat set of screens with a bottom bar. It is not a decision
  about the future LifeOS information architecture.
  - `backBehavior: 'fullHistory'` reproduces the old manual history
    exactly: every switch is recorded, duplicates included, and Back pops
    it. Re-selecting the current route records nothing.
  - A custom `tabBar` renders the existing bottom bar for the routes marked
    `bottomNav` in `src/config/nav.js`. The other four routes are reachable
    from the drawer only, as before.
  - The navigator `layout` renders the existing top bar and drawer around the
    navigator, with access to its state. They are not per-screen headers
    (`headerShown: false`).
  - `screenLayout` mounts a screen only while it is focused and wraps it in
    `FadeSlideIn`, so each visit still starts fresh with the same entrance.
    React Navigation 7 has no `unmountOnBlur`.
- **No drawer navigator.** `@react-navigation/drawer` would add two native
  modules (`react-native-gesture-handler`, `react-native-reanimated`), need a
  rebuilt dev client, and change the drawer's look and gestures. The existing
  `Modal` drawer is kept and just calls `navigation.navigate`.
- **No new runtime dependencies.** `@react-navigation/native` and
  `bottom-tabs` (v7) were already in `package.json`; `react-native-screens`
  and `react-native-safe-area-context` were already installed. The only
  `package.json` change is declaring `@react-navigation/routers` (already
  installed by `bottom-tabs`) as a devDependency, because the navigation
  tests drive its `TabRouter`.
- **Route names** are the existing ids in `src/config/nav.js`, the single
  source for name, label, icon and bottom-bar membership. They are not
  renamed (`journal` stays).
- **Onboarding** stays a gate outside the `NavigationContainer`.
- **Data still owned by `App.js`** (profile, exams, finances, tips, timer) is
  passed to the four screens that need it through `Tab.Screen` render
  callbacks. This is temporary wiring, removed when those domains migrate.
  No new global state is introduced for it.

### Consequences
- `App.js` no longer has screen state, history or a `BackHandler`. Screens
  navigate with `useNavigation()` instead of an `onNavigate` prop.
- Nested stacks inside a route, and deep linking (`linking` on
  `NavigationContainer`), can be added later without another shell rewrite.
- Unchanged: drawer gestures (none before), visuals, which screens are in the
  bottom bar, and storage and stores.

---

## ADR-005: Transitional LifeOS navigation: I dag · Plan · Mere

- **Status:** accepted (Session 6, 2026-10-03). Builds on ADR-004 (same
  navigator); changes only the information architecture.

### Context
ADR-004 reproduced the inherited shell: a bottom bar with Home, University,
Tasks, Finances and Stats, plus a drawer listing everything. That bar is the
old student app. The product direction (`docs/LIFEOS_PLAN.md` § 6) is:

- CORE: I dag, Timewheel, Calendar, Tasks, Routines/Habits
- HEALTH: Training, Exercise library, Nutrition, Sleep, Recovery
- LIFE: Shopping/Household, Goals, Notes
- PROGRESSION: Pip, XP, stats

The preferred long-term bar is **I dag / Plan / Træning / Mad / Mere**.
Træning and Mad do not exist. Tabs for them would be fake features.

Product decisions for the existing modules (Session 6):

| Module | Decision |
|---|---|
| University | Legacy. Off the primary navigation; code and data kept; not migrated or redesigned |
| Finances | Kept as is; off the primary navigation; secondary tool |
| Links | Kept; secondary |
| Tasks/Habits | Core |
| Groceries | Future Shopping/Household |
| Goals | Core supporting |
| Notes | Supporting |
| Old Home dashboard | Replaced as start screen by the new I dag; kept reachable for now |

### Decision
- **Bottom bar: I dag · Plan · Mere** (three tabs, in that order).
  - **I dag** (`today`, new): the start screen (`INITIAL_ROUTE`).
  - **Plan** (`journal`): today's Tasks screen (tasks + habits). Plan is where
    Calendar, Timewheel and Routines will live; for now it is the tasks list.
    The route id stays `journal` (ADR-004: ids are only renamed
    deliberately; nothing gains from renaming it now).
  - **Mere** (`more`, new): a plain Danish list of every secondary screen,
    grouped as *Livet* (Indkøb, Mål, Noter), *Værktøjer* (Statistik,
    Links, Økonomi) and *Ældre skærme* (Universitet, the old Home dashboard).
- **Growth without another rewrite:** Træning and Mad become tabs between
  Plan and Mere when those modules exist (one `NAV` entry with
  `tab: true` each). A module that graduates from Mere to the bar changes
  one field. Nothing else in the shell knows the list.
- **The drawer is removed.** Mere replaces it (the plan's original target in
  § 4). Two parallel menus would list the same screens twice. The ☰ button
  goes with it. Secondary screens show a "Tilbage" button in the top bar,
  which does the same as Android Back (`goBack`, falling back to Mere when
  there is no history), so iOS users are not stranded.
- **Same navigator.** Still one flat bottom-tab navigator with
  `backBehavior: 'fullHistory'` (ADR-004). Every route, old and new, is a
  sibling. No nested stacks yet: the secondary screens are single screens,
  and Back already walks the full history. A native stack per tab can be
  added when a tab needs pushed detail screens.
- **`src/config/nav.js` stays the single source:** route id, Danish label,
  icon, `tab` (in the bottom bar) and `section` (its Mere group). The bottom
  bar, the top bar title, the Mere screen and the tests read it. The bar
  highlights *Mere* while a secondary screen is shown, so the user can see
  where they are.
- **Danish shell, English legacy screens.** Labels in the shell, I dag and
  Mere are Danish (`src/core/i18n`). The legacy screens keep their English
  content until the planned translation session. Mere says so for the
  *Ældre skærme* group.
- **No storage changes.** No keys are removed or renamed. University,
  Finances and old-Home data stay where they are and still load at boot.

### Consequences
- A fresh start opens on I dag; Back from I dag with no history exits.
- University and Finances are two taps away (Mere → item), not one.
- The old Home dashboard and its `home_section_order` key keep working
  under Mere → Ældre skærme. Retiring it (and its `legacyProps`) is a later
  cleanup once nobody needs it.
- The navigation tests pin the new primary order and check that every route
  is either a tab or listed in a Mere section.

---

## ADR-006: Optional local schedule fields on tasks (no migration)

- **Status:** accepted (Session 7, 2026-10-04)

### Context
Plan, I dag, and later the Timewheel and Calendar need to know when a task
happens. A task (an entry in `journal` with `recurring: false`) already has
an optional local `date` ('YYYY-MM-DD'). Existing installs have many tasks
without any time, and they must keep working unchanged.

### Decision
- Two **optional** fields on one-off tasks:
  - `startTime`: local wall-clock time, canonical `'HH:mm'` (24-hour,
    zero-padded), on the task's `date`.
  - `durationMinutes`: whole minutes, 1–1440.
- **Absent (or null, or invalid) means "no time" / "duration unknown".**
  Nothing is inferred: a task with a start time and no duration is a point
  in time, never a guessed 30- or 60-minute block.
- The **end time is derived** (start + duration, possibly past midnight)
  and never stored.
- Only **dated** tasks can be timed; habits are never timed. A form save
  without a time removes both keys (`withSchedule`), so a task saved
  without a time never gains `startTime: null`.
- No timestamps, UTC conversion, time-zone ids, recurrence or event
  model. A local date + local time is enough until a real second consumer
  (Timewheel, Calendar) shows otherwise.
- Pure helpers: `src/core/time/timeOfDay.js` (HH:mm parsing and
  arithmetic) and `src/features/tasks/schedule.js` (a task's schedule,
  status at a given "now", ordering, labels). Callers pass "now" in.

### Why no migration
The fields are additive and optional. Every existing task already means
"no time", which is exactly what an absent field means, so no stored value
has to change. A migration would rewrite every user's `journal` for no
gain and add a failure mode. `lifeos_journal` keeps its key and format;
older app versions ignore the extra keys.

### Consequences
- A timed task's status at "now" is `upcoming`, `active` (only with a
  known duration: start ≤ now < end), or `past`. A past, unfinished task
  stays open and visible; nothing is completed automatically.
- Overlaps are possible and are not detected or resolved yet; that belongs
  to the Timewheel.

---

## ADR-007: Tidshjul (Timewheel) as a primary tab, built as a view

- **Status:** accepted (Session 8, 2026-10-04). Extends ADR-005.

### Context
Tasks can now carry a local start time and duration (ADR-006). The first
real consumer of that schedule is the Timewheel: a glanceable picture of
now, next and the shape of the day. It belongs with the daily core (I dag,
Plan), not under Mere.

### Decision
- **Bottom bar: I dag · Tidshjul · Plan · Mere.** Route id `timewheel`,
  Danish label "Tidshjul". Træning and Mad still slot in between Plan and
  Mere later; the bar stays data-driven from `src/config/nav.js`.
- **A view, not a store.** Timewheel reads the tasks store and persists
  nothing. `src/features/timewheel/logic.js` turns the tasks of one
  selected date into items (start/end minutes, point vs interval, status,
  overview lane, overlaps), timeline rows and ring geometry.
- **One NU/NÆSTE rule.** The selection moved from I dag's logic into
  `src/features/tasks/focus.js` (`selectFocus`); I dag and Timewheel both
  call it, and a test asserts they agree for the same date and time.
  Another date has no live "now": a future day shows its first planned
  task, a past day a short summary.
- **Overlap detection is a scheduling rule** (`findOverlaps` in
  `src/features/tasks/schedule.js`): half-open intervals, so touching
  items do not overlap; points (no duration) and finished tasks are not
  intervals for this purpose. Conflicts are shown, never resolved.
- **One task editor.** Plan's sheet wiring became `useEntryEditor`
  (`src/features/plan/useEntryEditor.js`); Timewheel opens the same sheet
  ("Flyt" starts in the time field). The I dag NU/NÆSTE cards became a
  shared component (`src/features/tasks/components/ItemRow.js`).
- **No new dependency.** The 24-hour ring uses `react-native-svg`, already
  installed (previously only used by the unused `ProgressRing`).

### Consequences
- Four tabs at 12 pt labels still fit a 360 dp phone; a fifth (Træning)
  will need a check.
- The ring is supplemental: every item, with time, length, state and
  overlap in words, is in the timeline below it. Open tasks that have no
  place on the timeline (untimed, or carried over from earlier days) are
  listed under it, so whatever NU shows is also on the screen.

---

## ADR-008: Routines as templates with derived occurrences and a per-date log

- **Status:** accepted (Session 9, 2026-10-04)

### Context
Routines (a morning or evening sequence of steps) are the second scheduled
domain after tasks. They repeat on weekdays and their steps are ticked per
day. Copying them into the task list every day would duplicate data,
pollute Plan and need a background job.

### Decision
- **Two stored lists, nothing else** (`src/features/routines/store.js`,
  both on `createPersistedListStore`, both empty by default):
  - `routines`: templates `{ id, name, enabled, activeFrom, daysOfWeek
    (ISO 1 = mandag … 7 = søndag), startTime?, durationMinutes?, steps:
    [{ id, text }] }`. String ids (time + random). No step times.
  - `routineLog`: `{ routineId, date, completedStepIds }`, one entry per
    routine and local date, created on the first tick. Ticking never
    changes the template.
- **Occurrences are derived** for the date being shown
  (`occurrencesOn` in `src/features/routines/model.js`): a routine occurs
  when it is enabled, `date >= activeFrom` and the date's ISO weekday is in
  `daysOfWeek`. Weekly recurrence only: no RRULE, intervals, exceptions or
  libraries. Nothing is pre-generated; there is no scheduler.
- **Shared schedule contract, not a universal event model.** An occurrence
  carries the same `date` / `startTime` / `durationMinutes` fields as a
  task, so `src/features/tasks/schedule.js` (status, ordering, overlaps)
  works on both unchanged. `routineItem` adds the same presentation
  fields as `taskItem` (endTime, timeLabel, status) plus `kind:
  'routine'`, a kindLabel and progress text. NU/NÆSTE (`selectFocus`),
  I dag and Tidshjul take routine items next to tasks; there is no
  preference by kind (equal keys keep tasks first, as input order). An
  active routine (also yesterday's, still running after midnight) can be
  NU, the earliest later one NÆSTE, an untimed one a flexible item; a
  finished routine, or one whose time has passed, never takes part: it is
  not carried over like a task, it comes back on its next day (so a
  routine created after its time today does not jump to NU). With no
  routines every output is exactly what it was (tests assert this).
- **Interaction:** tapping a routine anywhere opens that day's checklist
  (`useRoutineChecklist`); the template is edited only on the Rutiner
  screen (route `routines`, secondary: Mere → Livet, plus links from Plan
  and the checklist). No new tab.
- **Deleting a routine keeps its log** (history is never removed
  automatically); orphaned entries are simply not shown.

### Known v1 limitations
- Occurrences are projected from the CURRENT template. Editing a
  routine's days, time or steps also changes how past dates are shown;
  their log entries are kept, but only steps that still exist count, and a
  paused routine disappears from every date. No template versioning yet.
- A routine with no steps cannot be created; damaged data with no steps
  shows as "Ikke startet" and never completes.

## ADR-009: Kalender as a view over one shared per-date schedule

- **Status:** accepted (Session 10, 2026-10-04)

### Context
The user needs to see what a day, and a week, looks like: tasks with
times, routines, what is untimed, where things collide. Tidshjul already
combines tasks and routine occurrences for one date, inside its own model.
A calendar that copied tasks into "events", or kept its own store, would
drift from Plan and Tidshjul and need syncing.

### Decision
- **One shared query, no event model.** `getScheduleForDate({ journal,
  routines, routineLog, date, today, nowMinutes })` in
  `src/features/schedule/day.js` returns `{ items, conflicts, untimed }`
  for one date: timed tasks and routine occurrences (with the part after
  midnight of those from the day before), lanes and overlaps through the
  existing `findOverlaps`, and the date's untimed tasks and routines. It is
  Tidshjul's former `dayItems` / `placeItems`, moved, not rewritten; Tidshjul
  (`buildDay`) now calls it, and a randomized differential check against
  the old code plus regression tests show identical output for Tidshjul
  and I dag. The per-item words (`timeRange`, `itemDetails`,
  `overlapText`, `describeScheduledItem`), `clockFor` and the
  `ConflictPanel` moved with it, and the date heading (`DateHeader`) and
  what tapping an item does (`useScheduleItemActions`) are shared too, so
  the two views say, show and open the same.
  Tasks and routines do not import it; it imports them. No Event class,
  no providers, no adapters.
- **Kalender persists nothing.** Route `calendar` ("Kalender"), on Mere →
  Livet and linked from Plan; no new tab (I dag · Tidshjul · Plan · Mere
  stay). No store, no storage key, no generated or cached days: a day is
  derived when shown, a week is its seven dates (`weekDates`, Monday
  first; ISO week numbers).
- **Two modes, one selected date.** Uge (default: Tidshjul already
  answers "my day", the week is what no other screen shows, and Uge still
  lists the selected day, today, below it) and Dag. The date lives in a
  reducer (`calendarReducer`) only while the screen is open; `null` means
  "follow today". ‹ › step a day in Dag and a week in Uge. No month view.
- **Dag** draws the timed items on a vertical axis at their true times
  (72 pt per hour) within a window: the waking day (08–20), widened to the
  items and now with an hour's margin, never past 00–24. A block is as tall
  as its duration but at least 44 pt; blocks that would then cover each
  other sit side by side (that is layout, not a conflict). A point in time
  stays a line, never gets a length. Untimed tasks and routines are listed
  apart ("Uden tidspunkt"). The NU line only on today, from `useNow`.
- **Uge** shows seven rows with a thin track per day: bars at real minutes
  on one window for the whole week, points as ticks, overlapping items on
  separate lines, and the day's count and conflicts in words. No titles;
  tapping a day lists its items below ("Vis dagen" opens Dag). The week
  model takes no "now", so it never rebuilds on the clock.
- **Opening is delegated.** A task opens the Plan task sheet
  (`useEntryEditor`; "Flyt" at its time field), a routine its day's
  checklist; "Flyt" on a routine opens its template on Rutiner, whose
  editor now says that a change applies on every day. "Ny opgave" opens the
  same task sheet with the selected date. No drag-and-drop, no
  auto-reschedule, no per-occurrence routine times or exceptions.
- Finished items stay, subdued. Conflicts are Tidshjul's exactly (tests
  compare the two).

### Known limitations
- **Routines on past dates are projections** of the routine as it is now
  (ADR-008): a changed time, days or steps also changes how earlier days
  look. Kalender does not pretend otherwise: a past day or week with
  routines carries the quiet note "Rutiner på tidligere dage vises, som
  rutinen er sat op nu." Versioned templates are future work.
- A task is shown on its own date only; open tasks carried over from
  earlier days are on I dag and Plan, not on today's calendar page.
- Blocks are at least 44 pt, so a very short item looks longer than it is;
  its start is still exact and its words say the real times.
