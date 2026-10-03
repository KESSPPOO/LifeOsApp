// Navigation (ADR-004). No UI framework: the route definitions are pure
// data, route-name usage is checked in the source, and Android Back is
// checked against React Navigation's real TabRouter configured exactly as
// the app configures it (BACK_BEHAVIOR, INITIAL_ROUTE, NAV).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// TabRouter is the router @react-navigation/bottom-tabs uses (devDependency).
import { TabRouter } from '@react-navigation/routers';
import { NAV, INITIAL_ROUTE, BACK_BEHAVIOR, BOTTOM_NAV_ITEMS } from '../src/config/nav.js';

const ROUTES = NAV.map(n => n.id);

// ── Route definitions ───────────────────────────────────────────────────────

test('route names are the existing screen ids (no renames)', () => {
  assert.deepEqual(ROUTES, ['home', 'uni', 'journal', 'finances', 'stats', 'groceries', 'goals', 'notes', 'links']);
  assert.equal(new Set(ROUTES).size, ROUTES.length, 'unique');
  assert.equal(INITIAL_ROUTE, 'home');
});

test('bottom bar keeps the same five routes in the same order', () => {
  assert.deepEqual(BOTTOM_NAV_ITEMS.map(n => n.id), ['home', 'uni', 'journal', 'finances', 'stats']);
});

// ── Route names used in the source ──────────────────────────────────────────

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith('.js') ? [p] : [];
  });
}

test('every route has exactly one Tab.Screen in AppNavigator, and nothing else does', () => {
  const src = readFileSync(new URL('../src/app/navigation/AppNavigator.js', import.meta.url), 'utf8');
  const screens = [...src.matchAll(/<Tab\.Screen name="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual([...screens].sort(), [...ROUTES].sort());
});

test('every navigate("…") with a literal route name in src names an existing route', () => {
  const files = [...sourceFiles(new URL('../src', import.meta.url).pathname), new URL('../App.js', import.meta.url).pathname];
  const used = files.flatMap(f =>
    [...readFileSync(f, 'utf8').matchAll(/\bnavigate\(\s*['"`]([^'"`]+)['"`]/g)].map(m => [m[1], f]));
  assert.ok(used.length > 0, 'the scan found the Home links');
  for (const [name, file] of used) assert.ok(ROUTES.includes(name), `${name} in ${file}`);
});

test('the old hand-built switcher is gone (its exact identifiers)', () => {
  const files = [...sourceFiles(new URL('../src', import.meta.url).pathname), new URL('../App.js', import.meta.url).pathname];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const old of ['goToScreen', 'screenHistoryRef', 'SCREENS', 'onNavigate']) {
      assert.ok(!new RegExp(`\\b${old}\\b`).test(src), `${old} in ${f}`);
    }
  }
});

// ── Android Back (React Navigation's TabRouter, configured like the app) ───

function createNav() {
  const router = TabRouter({ backBehavior: BACK_BEHAVIOR, initialRouteName: INITIAL_ROUTE });
  const opts = { routeNames: ROUTES, routeParamList: {}, routeGetIdList: {} };
  let state = router.getInitialState(opts);
  return {
    current: () => state.routes[state.index].name,
    navigate(name) { state = router.getStateForAction(state, { type: 'NAVIGATE', payload: { name } }, opts) ?? state; },
    /** Returns the screen after Back, or 'EXIT' when the app would close. */
    back() {
      const next = router.getStateForAction(state, { type: 'GO_BACK' }, opts);
      if (!next) return 'EXIT';
      state = next;
      return state.routes[state.index].name;
    },
  };
}

test('starts on Home; Back with no history exits the app', () => {
  const nav = createNav();
  assert.equal(nav.current(), 'home');
  assert.equal(nav.back(), 'EXIT');
});

test('Back returns to the previous screen instead of exiting', () => {
  const nav = createNav();
  nav.navigate('groceries'); // drawer-only route
  assert.equal(nav.current(), 'groceries');
  assert.equal(nav.back(), 'home');
  assert.equal(nav.back(), 'EXIT');
});

test('Back walks every switch, duplicates included (same as the old manual history)', () => {
  const nav = createNav();
  ['uni', 'home', 'uni', 'notes'].forEach(r => nav.navigate(r));
  assert.deepEqual([nav.back(), nav.back(), nav.back(), nav.back(), nav.back()],
    ['uni', 'home', 'uni', 'home', 'EXIT']);
});

test('choosing the current screen again records nothing', () => {
  const nav = createNav();
  nav.navigate('journal');
  nav.navigate('journal');
  assert.equal(nav.back(), 'home');
  assert.equal(nav.back(), 'EXIT');
});

test('every route is reachable by navigate', () => {
  for (const r of ROUTES) {
    const nav = createNav();
    nav.navigate(r);
    assert.equal(nav.current(), r);
  }
});
