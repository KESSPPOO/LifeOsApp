// src/app/ErrorBoundary.js
//
// Root error boundary. Without it, any render error unmounts the whole tree
// and the user sees a blank screen. It shows a minimal fallback with a retry
// instead. It renders nothing extra while the app works, and does no
// reporting beyond console.error (no analytics or cloud logging, by design).
//
// Stored data is unaffected: changes are persisted as they happen, and retrying
// remounts the app, which re-runs the (idempotent) boot sequence.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../config/colors';

export class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error', error, info?.componentStack);
  }

  retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title} accessibilityRole="header">Noget gik galt</Text>
        <Text style={styles.body}>
          Der opstod en uventet fejl. Dine gemte data er ikke påvirket.
        </Text>
        <TouchableOpacity
          onPress={this.retry}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Prøv igen"
        >
          <Text style={styles.buttonText}>Prøv igen</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  button: { backgroundColor: COLORS.accent, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
