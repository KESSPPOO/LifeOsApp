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
  `tests/persistedListStore.test.mjs` runs against every migrated module's key
  and real stored format.
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
   `tests/persistedListStore.test.mjs` with a fixture in today's stored
   format, and test the module's operations (pure, and through the store).
8. **Remove it from `App.js`:** the `useState`, the `loadMany` entry, the
   `usePersist` setter, the props, and the now-unused seed import.
