import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function SOSScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Emergency SOS</Text>

      <TouchableOpacity style={styles.sosButton} activeOpacity={0.8}>
        <Text style={styles.sosText}>TRIGGER SOS</Text>
      </TouchableOpacity>

      <Text style={styles.caption}>Sends instant location alert to rescue & emergency contacts</Text>

      {/* Map placeholder - will be replaced with live Google Maps view once API key is active */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderText}>Map loading...</Text>
      </View>

      {/* Route/nearest service info panel - fills in once map is live */}
      <View style={styles.infoPanel}>
        <Text style={styles.infoLabel}>Nearest Help:</Text>
        <Text style={styles.infoValue}>—</Text>
        <Text style={styles.infoLabel}>Distance:</Text>
        <Text style={styles.infoValue}>—</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5F5', padding: 24 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#C92A2A', marginBottom: 32 },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#E03131',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#C92A2A',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
  },
  sosText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  caption: { color: '#868E96', fontSize: 13, textAlign: 'center', marginTop: 32 },
  mapPlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#E9ECEF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  mapPlaceholderText: { color: '#868E96', fontSize: 14 },
  infoPanel: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  infoLabel: { color: '#868E96', fontSize: 12, marginTop: 8 },
  infoValue: { color: '#212529', fontSize: 16, fontWeight: '600' },
});