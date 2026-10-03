// src/app/navigation/AppNavigator.js
//
// The app's navigation (ADR-004): one bottom-tab navigator holding every
// route in src/config/nav.js as siblings, reproducing the old hand-built
// shell. ShellLayout (top bar + drawer) wraps the navigator, BottomNav is its
// tab bar, and Android Back walks the full switch history (BACK_BEHAVIOR).
//
// This reproduces the CURRENT app. It is not the future LifeOS navigation;
// that is a separate design decision.
import React from 'react';
import { NavigationContainer, DarkTheme, useIsFocused } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { COLORS } from '../../config/colors';
import { INITIAL_ROUTE, BACK_BEHAVIOR } from '../../config/nav';
import { FadeSlideIn } from '../../components/FadeSlideIn';
import { ShellLayout } from './ShellLayout';
import { BottomNav } from './BottomNav';

import HomeScreen       from '../../screens/HomeScreen';
import UniScreen        from '../../screens/UniScreen';
import FinancesScreen   from '../../screens/FinancesScreen';
import StatsScreen      from '../../screens/StatsScreen';
import GroceriesScreen  from '../../screens/GroceriesScreen';
import GoalsScreen      from '../../screens/GoalsScreen';
import NotesScreen      from '../../screens/NotesScreen';
import LinksScreen      from '../../screens/LinksScreen';
import JournalScreen    from '../../screens/JournalScreen';

const Tab = createBottomTabNavigator();

// Dark theme with the app's own background, so no white flashes between
// screens.
const THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: COLORS.accent,
    background: COLORS.bg,
    card: COLORS.bg2,
    text: COLORS.text,
    border: COLORS.border,
  },
};

// As before the migration, only the current screen is mounted: every visit
// starts fresh and plays the FadeSlideIn entrance. (React Navigation 7 has no
// unmountOnBlur, so the screen layout renders nothing while unfocused.)
function FocusedScreen({ children }) {
  const focused = useIsFocused();
  return focused ? <FadeSlideIn style={{ flex: 1 }}>{children}</FadeSlideIn> : null;
}

/**
 * legacyProps: TEMPORARY wiring for data App.js still owns (profile, exams,
 * finances, tips, timer). Keyed by route name; passed to those four screens
 * through render callbacks until their domains migrate to feature stores
 * (docs/LIFEOS_PLAN.md). Every other screen reads its own store.
 */
export function AppNavigator({ legacyProps }) {
  return (
    <NavigationContainer theme={THEME}>
      <Tab.Navigator
        initialRouteName={INITIAL_ROUTE}
        backBehavior={BACK_BEHAVIOR}
        layout={(props) => <ShellLayout {...props} />}
        tabBar={(props) => <BottomNav {...props} />}
        screenLayout={({ children }) => <FocusedScreen>{children}</FocusedScreen>}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="home">{() => <HomeScreen {...legacyProps.home} />}</Tab.Screen>
        <Tab.Screen name="uni">{() => <UniScreen {...legacyProps.uni} />}</Tab.Screen>
        <Tab.Screen name="journal" component={JournalScreen} />
        <Tab.Screen name="finances">{() => <FinancesScreen {...legacyProps.finances} />}</Tab.Screen>
        <Tab.Screen name="stats">{() => <StatsScreen {...legacyProps.stats} />}</Tab.Screen>
        <Tab.Screen name="groceries" component={GroceriesScreen} />
        <Tab.Screen name="goals" component={GoalsScreen} />
        <Tab.Screen name="notes" component={NotesScreen} />
        <Tab.Screen name="links" component={LinksScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
