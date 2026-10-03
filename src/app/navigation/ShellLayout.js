// src/app/navigation/ShellLayout.js
//
// The persistent app chrome above the screens: the top bar (HeaderBar: ☰,
// logo, current screen) and the slide-in drawer listing every route. Moved
// unchanged from App.js; used as the tab navigator's `layout`, so it reads
// the current route from navigator state and switches screens with
// navigation.navigate.
// The bottom bar is BottomNav (the navigator's tabBar).
import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StatusBar, Modal, StyleSheet,
  Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../config/colors';
import { NAV } from '../../config/nav';
import { HeaderBar } from '../../components/HeaderBar';

const DRAWER_WIDTH = 240;

export function ShellLayout({ state, navigation, children }) {
  // insets.top  = status bar height (Android) / notch (iOS)
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index].name;
  const currentNav = NAV.find(n => n.id === current);

  const [drawerMounted, setDrawerMounted] = useState(false);
  const drawerX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const openDrawer = () => {
    setDrawerMounted(true);
    drawerX.setValue(-DRAWER_WIDTH);
    requestAnimationFrame(() => {
      Animated.timing(drawerX, {
        toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    });
  };
  // The drawer is a Modal, so Android Back while it is open goes to
  // onRequestClose (closes it) and never reaches the navigator.
  const closeDrawer = () => {
    Animated.timing(drawerX, {
      toValue: -DRAWER_WIDTH, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => setDrawerMounted(false));
  };

  return (
    // Plain View instead of SafeAreaView: insets are applied per region (top
    // bar, drawer header, bottom bar) rather than padding the whole root.
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <HeaderBar title={`${currentNav?.icon} ${currentNav?.label}`} onMenuPress={openDrawer} />

      {/* ── Drawer ── */}
      <Modal visible={drawerMounted} animationType="none" transparent onRequestClose={closeDrawer}>
        <View style={styles.drawerOverlay}>
          <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerX }] }]}>
            {/* paddingTop uses insets.top so the header clears the status bar
                on all devices/platforms. */}
            <View style={[styles.drawerHeader, { paddingTop: 16 + insets.top }]}>
              <Text style={styles.logo}>
                <Text style={{ color: COLORS.accent }}>Life</Text>OS
              </Text>
              <Text style={styles.drawerSubtitle}>Personal Life OS</Text>
            </View>
            <ScrollView>
              {NAV.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  onPress={() => { navigation.navigate(n.id); closeDrawer(); }}
                  style={[styles.drawerItem, current === n.id && styles.drawerItemActive]}
                >
                  <Text style={{ fontSize: 18 }}>{n.icon}</Text>
                  <Text style={[styles.drawerLabel, current === n.id && styles.drawerLabelActive]}>
                    {n.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
          <TouchableOpacity style={{ flex: 1 }} onPress={closeDrawer} />
        </View>
      </Modal>

      {/* ── Screens + bottom bar (rendered by the navigator) ── */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  logo: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },

  drawerOverlay: {
    flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: COLORS.bg2,
    borderRightWidth: 1, borderRightColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
  },
  drawerHeader: {
    padding: 16,
    // paddingTop is applied inline as 16 + insets.top.
    borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 8,
  },
  drawerSubtitle: { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
  drawerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderLeftWidth: 2, borderLeftColor: 'transparent',
  },
  drawerItemActive: { backgroundColor: COLORS.accentGlow, borderLeftColor: COLORS.accent },
  drawerLabel:      { fontSize: 14, color: COLORS.textMuted, marginLeft: 14 },
  drawerLabelActive:{ color: COLORS.accent, fontWeight: '600' },

  content: { flex: 1 },
});
