// src/app/navigation/AppNavigator.js
//
// The app's navigation: one bottom-tab navigator holding every route in
// src/config/nav.js as siblings (ADR-004). ShellLayout (top bar) wraps the
// navigator, BottomNav is its tab bar (I dag · Tidshjul · Plan · Mere,
// ADR-005/007), and
// Android Back walks the full switch history (BACK_BEHAVIOR). Screens that
// are not tabs are opened from Mere.
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
import TodayScreen      from '../../features/today/screens/TodayScreen';
import PlanScreen       from '../../features/plan/screens/PlanScreen';
import TimewheelScreen  from '../../features/timewheel/screens/TimewheelScreen';
import RoutinesScreen   from '../../features/routines/screens/RoutinesScreen';
import MoreScreen       from './MoreScreen';

const Tab = createBottomTabNavigator();

// Dark theme with the app's own background, so no white flashes between
// screens. (Headers are hidden and the tab bar is custom, so nothing else in
// the theme is used.)
const THEME = { ...DarkTheme, colors: { ...DarkTheme.colors, background: COLORS.bg } };

// As before the migration, only the current screen is mounted: every visit
// starts fresh and plays the FadeSlideIn entrance. (React Navigation 7 has no
// unmountOnBlur, so the screen layout renders nothing while unfocused.)
function FocusedScreen({ children }) {
  const focused = useIsFocused();
  return focused ? <FadeSlideIn style={{ flex: 1 }}>{children}</FadeSlideIn> : null;
}

/**
 * legacyProps: TEMPORARY wiring for data App.js still owns (profile, exams,
 * finances, tips, timer). Keyed by route name; passed to the screens that need it
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
        <Tab.Screen name="today">{() => <TodayScreen {...legacyProps.today} />}</Tab.Screen>
        <Tab.Screen name="timewheel" component={TimewheelScreen} />
        <Tab.Screen name="routines" component={RoutinesScreen} />
        <Tab.Screen name="more" component={MoreScreen} />
        <Tab.Screen name="home">{() => <HomeScreen {...legacyProps.home} />}</Tab.Screen>
        <Tab.Screen name="uni">{() => <UniScreen {...legacyProps.uni} />}</Tab.Screen>
        <Tab.Screen name="journal" component={PlanScreen} />
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
