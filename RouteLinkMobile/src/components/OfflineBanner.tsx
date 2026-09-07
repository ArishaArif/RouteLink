import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../context/NetworkContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Shows a slim red banner at the top of the screen when offline.
 * Automatically animates in/out based on network state.
 */
export function OfflineBanner() {
  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();

  if (isConnected) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 4 }]}>
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.text}>You're offline. Changes may not sync.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D32F2F',
    paddingBottom: 6,
    paddingHorizontal: 12,
    gap: 6,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
