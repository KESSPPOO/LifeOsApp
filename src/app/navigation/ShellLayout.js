// src/app/navigation/ShellLayout.js
//
// The persistent app chrome above the screens: the top bar (HeaderBar) with
// the current screen's title, and "Tilbage" on screens that are not tabs.
// Used as the tab navigator's `layout`, so it reads the current route from
// navigator state. Secondary screens are reached from Mere (ADR-005); there
// is no drawer any more. The bottom bar is BottomNav (the navigator's
// tabBar).
import React from 'react';
import { View, StatusBar, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../config/colors';
import { NAV, tabFor } from '../../config/nav';
import { HeaderBar } from '../../components/HeaderBar';

export function ShellLayout({ state, navigation, children }) {
  // insets.top  = status bar height (Android) / notch (iOS)
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index].name;
  const currentNav = NAV.find(n => n.id === current);

  // Same as Android Back; with no history (cannot normally happen on a
  // secondary screen) go to the tab the screen belongs to (tabFor: its
  // parent, or Mere, where the others are listed).
  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate(tabFor(current));
  };

  return (
    // Plain View instead of SafeAreaView: insets are applied per region (top
    // bar here, bottom bar in BottomNav) rather than padding the whole root.
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <HeaderBar title={currentNav?.label} onBack={currentNav?.tab ? undefined : goBack} />
      {/* ── Screens + bottom bar (rendered by the navigator) ── */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1 },
});
