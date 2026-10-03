
// src/config/nav.js
//
// The app's routes: the single source of truth for route names (`id`, used
// as the React Navigation route name), drawer/bottom-bar labels and icons,
// and which routes appear in the bottom bar. The drawer lists all of them.
// See ADR-004 in docs/ARCHITECTURE_DECISIONS.md.
//
// Note: the Tasks route keeps the id 'journal' (its old internal name). Route
// ids are not storage keys any more (those live in src/core/storage/keys.js),
// but renaming one would still change every navigation call site, so
// ids are only renamed in a deliberate navigation change.
export const NAV = [
  { id: 'home',      label: 'Home',       icon: '⌂',  bottomNav: true  },
  { id: 'uni',       label: 'University', icon: '🎓', bottomNav: true  },
  { id: 'journal',   label: 'Tasks',      icon: '✅', bottomNav: true  },
  { id: 'finances',  label: 'Finances',   icon: '💶', bottomNav: true  },
  { id: 'stats',     label: 'Stats',      icon: '📊', bottomNav: true  },
  { id: 'groceries', label: 'Groceries',  icon: '🛒', bottomNav: false },
  { id: 'goals',     label: 'Goals',      icon: '🗺', bottomNav: false },
  { id: 'notes',     label: 'Notes',      icon: '💡', bottomNav: false },
  { id: 'links',     label: 'Links',      icon: '🔗', bottomNav: false },
];

/** The screen shown after start-up (and after onboarding). */
export const INITIAL_ROUTE = 'home';

/**
 * Android Back walks back through every screen switch, duplicates included,
 * and exits when none are left: the behaviour of the old hand-built history.
 */
export const BACK_BEHAVIOR = 'fullHistory';

/** The routes shown in the bottom bar, in order. */
export const BOTTOM_NAV_ITEMS = NAV.filter(n => n.bottomNav);

/** The NAV entry for a route name (top-bar label and icon). */
export function navItem(routeName) {
  return NAV.find(n => n.id === routeName);
}
