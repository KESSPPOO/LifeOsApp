// src/app/navigation/BottomNav.js
//
// The bottom bar (the tab navigator's custom tabBar): the five routes marked
// bottomNav in src/config/nav.js, current one highlighted, icon "pop" when
// the screen changes. Moved unchanged from App.js; only the source of the
// current route (navigator state) and the action (navigation.navigate)
// changed.
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../config/colors';
import { BOTTOM_NAV_ITEMS } from '../../config/nav';

export function BottomNav({ state, navigation }) {
  // insets.bottom = system nav bar height (Android 3-button/gesture) / home indicator (iOS)
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index].name;

  const navScalesRef = useRef({});
  const getNavScale = (id) => {
    if (!navScalesRef.current[id]) navScalesRef.current[id] = new Animated.Value(1);
    return navScalesRef.current[id];
  };
  // The old shell ran this effect while the loading view still hid the bar,
  // so the first "pop" was never seen. Skip it here too: only screen changes
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
    <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 8 }]}>
      {BOTTOM_NAV_ITEMS.map((n) => (
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
  bottomNavItem: { alignItems: 'center', flex: 1 },
  bottomNavIconWrap: {
    width: 36, height: 28, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10,
  },
  bottomNavIconWrapActive: {
    backgroundColor: COLORS.accentGlow,
  },
  bottomNavIcon: { fontSize: 20, opacity: 0.35 },
  bottomNavIconActive: { opacity: 1 },
  bottomNavLabel: { fontSize: 10, color: COLORS.textSub, marginTop: 4 },
  bottomNavLabelActive: { color: COLORS.accent, fontWeight: '600' },
});
