// Navigation (ADR-004, ADR-005). No UI framework: the route definitions are
// pure data, route-name usage is checked in the source, and Android Back is
// checked against React Navigation's real TabRouter configured exactly as
// the app configures it (BACK_BEHAVIOR, INITIAL_ROUTE, NAV).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// TabRouter is the router @react-navigation/bottom-tabs uses (devDependency).
import { TabRouter } from '@react-navigation/routers';
import {
  NAV, INITIAL_ROUTE, BACK_BEHAVIOR, TAB_ITEMS, MORE_SECTIONS, tabFor,
} from '../src/config/nav.js';
import { repoPath, sourceFiles } from './fixtures.mjs';

const ROUTES = NAV.map(n => n.id);

// ── Route definitions ───────────────────────────────────────────────────────

const LEGACY_ROUTES = ['home', 'uni', 'journal', 'finances', 'stats', 'groceries', 'goals', 'notes', 'links'];

test('every pre-ADR-005 route id still exists (no renames); the LifeOS routes are new', () => {
  for (const id of LEGACY_ROUTES) assert.ok(ROUTES.includes(id), id);
  assert.deepEqual(ROUTES.filter(id => !LEGACY_ROUTES.includes(id)), ['today', 'timewheel', 'training', 'more', 'workout', 'exercises', 'workoutTemplate', 'trainingHistory', 'routines', 'calendar']);
  assert.equal(new Set(ROUTES).size, ROUTES.length, 'unique');
});

test('the app starts on I dag', () => {
  assert.equal(INITIAL_ROUTE, 'today');
});

test('bottom bar is I dag · Tidshjul · Plan · Træning · Mere (ADR-005, ADR-007, ADR-010)', () => {
  assert.deepEqual(TAB_ITEMS.map(n => n.id), ['today', 'timewheel', 'journal', 'training', 'more']);
  assert.deepEqual(TAB_ITEMS.map(n => n.label), ['I dag', 'Tidshjul', 'Plan', 'Træning', 'Mere']);
});

test('University, Finances, Links and the old Home are not primary', () => {
  for (const id of ['uni', 'finances', 'links', 'home']) {
    assert.ok(!TAB_ITEMS.some(n => n.id === id), id);
    assert.equal(tabFor(id), 'more', id);
  }
});

test('every non-tab route is listed on Mere exactly once or belongs to a tab (nothing unreachable)', () => {
  const listed = MORE_SECTIONS.flatMap(s => s.items.map(n => n.id));
  assert.equal(new Set(listed).size, listed.length, 'no duplicates');
  assert.deepEqual([...listed].sort(), NAV.filter(n => !n.tab && !n.parent).map(n => n.id).sort());
  for (const n of NAV.filter(x => x.parent)) {
    assert.ok(TAB_ITEMS.some(tab => tab.id === n.parent), `${n.id}: parent ${n.parent} is a tab`);
    assert.ok(!n.section && !n.tab, `${n.id}: a parent route is neither on Mere nor a tab`);
  }
  for (const s of MORE_SECTIONS) assert.ok(s.items.length > 0, `${s.id} is not empty`);
  assert.deepEqual(MORE_SECTIONS.map(s => s.id), ['life', 'tools', 'legacy']);
  assert.deepEqual(MORE_SECTIONS.find(s => s.id === 'legacy').items.map(n => n.id), ['uni', 'home']);
});

test('every route has a Danish label and an icon; tabs highlight themselves', () => {
  for (const n of NAV) {
    assert.ok(n.label && !n.label.startsWith('nav.'), `${n.id} label resolved`);
    assert.ok(n.icon, `${n.id} icon`);
    assert.ok(n.tab || n.section || n.parent, `${n.id} is a tab, in a Mere section or under a tab`);
  }
  for (const n of TAB_ITEMS) assert.equal(tabFor(n.id), n.id);
});

// ── Route names used in the source ──────────────────────────────────────────

test('every route has exactly one Tab.Screen in AppNavigator, and nothing else does', () => {
  const src = readFileSync(repoPath('../src/app/navigation/AppNavigator.js'), 'utf8');
  const screens = [...src.matchAll(/<Tab\.Screen name="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual([...screens].sort(), [...ROUTES].sort());
});

test('every navigate("…") with a literal route name in src names an existing route', () => {
  const files = [...sourceFiles(repoPath('../src')), repoPath('../App.js')];
  const used = files.flatMap(f =>
    [...readFileSync(f, 'utf8').matchAll(/\bnavigate\(\s*['"`]([^'"`]+)['"`]/g)].map(m => [m[1], f]));
  assert.ok(used.length > 0, 'the scan found the I dag and Home links');
  for (const [name, file] of used) assert.ok(ROUTES.includes(name), `${name} in ${file}`);
});

test('App.js no longer contains the old hand-built switcher', () => {
  const app = readFileSync(repoPath('../App.js'), 'utf8');
  for (const old of ['goToScreen', 'screenHistoryRef', 'SCREENS', 'onNavigate', 'BackHandler']) {
    assert.ok(!new RegExp(`\\b${old}\\b`).test(app), old);
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

test('starts on I dag; Back with no history exits the app', () => {
  const nav = createNav();
  assert.equal(nav.current(), 'today');
  assert.equal(nav.back(), 'EXIT');
});

test('Back returns to the previous screen instead of exiting', () => {
  const nav = createNav();
  nav.navigate('more');
  nav.navigate('groceries'); // opened from Mere
  assert.equal(nav.current(), 'groceries');
  assert.equal(nav.back(), 'more');
  assert.equal(nav.back(), 'today');
  assert.equal(nav.back(), 'EXIT');
});

test('Back walks every switch, duplicates included (same as the old manual history)', () => {
  const nav = createNav();
  ['journal', 'today', 'journal', 'notes'].forEach(r => nav.navigate(r));
  assert.deepEqual([nav.back(), nav.back(), nav.back(), nav.back(), nav.back()],
    ['journal', 'today', 'journal', 'today', 'EXIT']);
});

test('Rutiner is secondary: on Mere under Livet (not a tab, not legacy), and Back returns from it', () => {
  assert.equal(tabFor('routines'), 'more');
  assert.deepEqual(MORE_SECTIONS.find(s => s.id === 'life').items[0].id, 'routines');
  assert.ok(!TAB_ITEMS.some(n => n.id === 'routines'), 'not a tab');
  const nav = createNav();
  nav.navigate('journal');
  nav.navigate('routines');
  assert.deepEqual([nav.back(), nav.back(), nav.back()], ['journal', 'today', 'EXIT']);
});

test('Kalender is secondary: on Mere under Livet and linked from Plan, no new tab; Back returns from it (ADR-009)', () => {
  assert.equal(tabFor('calendar'), 'more');
  assert.deepEqual(MORE_SECTIONS.find(s => s.id === 'life').items.map(n => n.id).slice(0, 2), ['routines', 'calendar']);
  assert.ok(!TAB_ITEMS.some(n => n.id === 'calendar'), 'not a tab');
  assert.equal(NAV.find(n => n.id === 'calendar').label, 'Kalender');
  const plan = readFileSync(repoPath('../src/features/plan/screens/PlanScreen.js'), 'utf8');
  assert.match(plan, /navigate\('calendar'\)/);
  const nav = createNav();
  nav.navigate('journal');
  nav.navigate('calendar');
  assert.deepEqual([nav.back(), nav.back(), nav.back()], ['journal', 'today', 'EXIT']);
});

test('Træning is a tab; its screens highlight it, are not on Mere, and Back walks back through them (ADR-010)', () => {
  assert.equal(tabFor('training'), 'training');
  for (const id of ['workout', 'exercises', 'workoutTemplate', 'trainingHistory']) assert.equal(tabFor(id), 'training', id);
  const onMere = MORE_SECTIONS.flatMap(s => s.items.map(n => n.id));
  assert.ok(!onMere.some(id => ['training', 'workout', 'exercises', 'workoutTemplate', 'trainingHistory'].includes(id)));
  const nav = createNav();
  nav.navigate('training');
  nav.navigate('workout');
  nav.navigate('today'); // the workout keeps going elsewhere
  nav.navigate('training');
  assert.deepEqual([nav.back(), nav.back(), nav.back(), nav.back()], ['today', 'workout', 'training', 'today']);
});

test('Back with no history from a Træning screen goes to Træning, not Mere', () => {
  const shell = readFileSync(repoPath('../src/app/navigation/ShellLayout.js'), 'utf8');
  assert.match(shell, /navigation\.navigate\(tabFor\(current\)\)/);
});

test('Tidshjul is a tab: reachable directly, and Back returns from it', () => {
  const nav = createNav();
  nav.navigate('timewheel');
  nav.navigate('journal');
  assert.deepEqual([nav.back(), nav.back(), nav.back()], ['timewheel', 'today', 'EXIT']);
  assert.equal(tabFor('timewheel'), 'timewheel');
});

test('choosing the current screen again records nothing', () => {
  const nav = createNav();
  nav.navigate('journal');
  nav.navigate('journal');
  assert.equal(nav.back(), 'today');
  assert.equal(nav.back(), 'EXIT');
});

test('every route is reachable by navigate', () => {
  for (const r of ROUTES) {
    const nav = createNav();
    nav.navigate(r);
    assert.equal(nav.current(), r);
  }
});
