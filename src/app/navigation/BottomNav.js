// src/app/navigation/BottomNav.js
//
// The bottom bar (the tab navigator's custom tabBar): the tabs in
// src/config/nav.js (I dag · Tidshjul · Plan · Træning · Mere, ADR-007/010). The current tab is
// highlighted (Mere while a screen listed on Mere is open) and its icon
// "pops" when the tab changes.
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../config/colors';
import { TAB_ITEMS, tabFor } from '../../config/nav';

export function BottomNav({ state, navigation }) {
  // insets.bottom = system nav bar height (Android 3-button/gesture) / home indicator (iOS)
  const insets = useSafeAreaInsets();
  const current = tabFor(state.routes[state.index].name);

  const navScalesRef = useRef({});
  const getNavScale = (id) => {
    if (!navScalesRef.current[id]) navScalesRef.current[id] = new Animated.Value(1);
    return navScalesRef.current[id];
  };
  // The old shell ran this effect while the loading view still hid the bar,
  // so the first "pop" was never seen. Skip it here too: only tab changes
  // pop the icon.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    const scale = getNavScale(current);
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }),
    ]).start();
  }, [current]);

  return (
    // paddingBottom = insets.bottom + 8 base padding. Without it, on Android
    // with 3-button nav (e.g. Galaxy A34) the bar renders behind the system
    // buttons.
    <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 8 }]} accessibilityRole="tablist">
      {TAB_ITEMS.map((n) => (
        <TouchableOpacity
          key={n.id}
          onPress={() => navigation.navigate(n.id)}
          style={styles.bottomNavItem}
          accessibilityRole="tab"
          accessibilityLabel={n.label}
          accessibilityState={{ selected: current === n.id }}
        >
          <View style={[styles.bottomNavIconWrap, current === n.id && styles.bottomNavIconWrapActive]}>
            <Animated.Text
              style={[
                styles.bottomNavIcon,
                current === n.id && styles.bottomNavIconActive,
                { transform: [{ scale: getNavScale(n.id) }] },
              ]}
            >
              {n.icon}
            </Animated.Text>
          </View>
          <Text style={[styles.bottomNavLabel, current === n.id && styles.bottomNavLabelActive]}>
            {n.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingTop: 8,
    // paddingBottom is applied inline as insets.bottom + 8.
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg2,
  },
  bottomNavItem: { alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 48 },
  bottomNavIconWrap: {
    width: 36, height: 28, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10,
  },
  bottomNavIconWrapActive: {
    backgroundColor: COLORS.accentGlow,
  },
  bottomNavIcon: { fontSize: 20, opacity: 0.35 },
  bottomNavIconActive: { opacity: 1 },
  // 12 pt and textMuted: readable and above 4.5:1 (textSub was not).
  bottomNavLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  // The accent is only 4.3:1 on bg2, so the selected label is white + bold.
  bottomNavLabelActive: { color: COLORS.text, fontWeight: '700' },
});
