// src/config/nav.js
//
// The app's routes: the single source of truth for route names (`id`, used
// as the React Navigation route name), Danish labels, icons, which routes
// are bottom-bar tabs (`tab`) and which Mere group the others belong to
// (`section`), or which tab a screen belongs to (`parent`: reached from that
// tab, which stays highlighted; not listed on Mere). See ADR-005, ADR-007
// and ADR-010 in docs/ARCHITECTURE_DECISIONS.md.
//
// Bottom bar: I dag · Tidshjul · Plan · Træning · Mere. Mad becomes a tab
// between Træning and Mere once that module exists. Træning's own screens
// (a workout, exercises, a template, history) have parent 'training'.
// Everything else is listed on Mere (Kalender too, also linked from Plan;
// ADR-009).
//
// Note: the Plan route keeps the id 'journal' (the Tasks screen's old
// internal name). Route ids are not storage keys (those live in
// src/core/storage/keys.js), but renaming one changes every navigation
// call site, so ids are only renamed in a deliberate navigation change.
import { t } from '../core/i18n/index.js';

export const NAV = [
  { id: 'today',     label: t('nav.today'),     icon: '☀️', tab: true },
  { id: 'timewheel', label: t('nav.timewheel'), icon: '🕒', tab: true },
  { id: 'journal',   label: t('nav.plan'),      icon: '📋', tab: true },
  { id: 'training',  label: t('nav.training'),  icon: '🏋️', tab: true },
  { id: 'more',      label: t('nav.more'),      icon: '☰',  tab: true },
  { id: 'workout',         label: t('nav.workout'),         icon: '🏋️', parent: 'training' },
  { id: 'exercises',       label: t('nav.exercises'),       icon: '📖', parent: 'training' },
  { id: 'workoutTemplate', label: t('nav.workoutTemplate'), icon: '📝', parent: 'training' },
  { id: 'trainingHistory', label: t('nav.trainingHistory'), icon: '🗓', parent: 'training' },
  { id: 'routines',  label: t('nav.routines'),  icon: '🔁', section: 'life' },
  { id: 'calendar',  label: t('nav.calendar'),  icon: '📅', section: 'life' },
  { id: 'groceries', label: t('nav.groceries'), icon: '🛒', section: 'life' },
  { id: 'goals',     label: t('nav.goals'),     icon: '🗺', section: 'life' },
  { id: 'notes',     label: t('nav.notes'),     icon: '💡', section: 'life' },
  { id: 'stats',     label: t('nav.stats'),     icon: '📊', section: 'tools' },
  { id: 'links',     label: t('nav.links'),     icon: '🔗', section: 'tools' },
  { id: 'finances',  label: t('nav.finances'),  icon: '💶', section: 'tools' },
  { id: 'uni',       label: t('nav.uni'),       icon: '🎓', section: 'legacy' },
  { id: 'home',      label: t('nav.home'),      icon: '⌂',  section: 'legacy' },
];

/** The screen shown after start-up (and after onboarding). */
export const INITIAL_ROUTE = 'today';

/** The tab that lists every non-tab route. */
export const MORE_ROUTE = 'more';

/**
 * Android Back walks back through every screen switch, duplicates included,
 * and exits when none are left (ADR-004).
 */
export const BACK_BEHAVIOR = 'fullHistory';

/** The bottom-bar tabs, in order. */
export const TAB_ITEMS = NAV.filter(n => n.tab);

/** Mere's groups, in order, each with its routes. */
export const MORE_SECTIONS = [
  { id: 'life',   title: t('more.life') },
  { id: 'tools',  title: t('more.tools') },
  { id: 'legacy', title: t('more.legacy'), note: t('more.legacyNote') },
].map(s => ({ ...s, items: NAV.filter(n => n.section === s.id) }));

/** The tab to highlight for a route: itself if it is a tab, its parent tab, otherwise Mere. */
export function tabFor(routeId) {
  if (TAB_ITEMS.some(n => n.id === routeId)) return routeId;
  return NAV.find(n => n.id === routeId)?.parent ?? MORE_ROUTE;
}
