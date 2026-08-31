import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MarketplaceScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Guide Marketplace</Text>
      <Text style={styles.subtitle}>Verified Local Guides & Logistics</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#6C757D', marginTop: 8 },
});