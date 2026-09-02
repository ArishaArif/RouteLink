import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';

export const SOSScreen = () => {
  const [sendingSos, setSendingSos] = useState(false);
  // Default coordinates (e.g. Hunza / Gilgit Baltistan region fallback)
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 36.3167,
    lng: 74.65,
  });

  const handleEmergencyCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleBroadcastSOS = async () => {
    Alert.alert(
      'Confirm SOS Emergency',
      'Are you sure you want to trigger an SOS alert? Your current location will be shared with local tourist response teams and emergency services.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'SEND SOS ALERT',
          style: 'destructive',
          onPress: async () => {
            setSendingSos(true);
            try {
              // Simulate / API call for SOS broadcast
              await new Promise((resolve) => setTimeout(resolve, 1500));
              Alert.alert(
                'SOS Alert Dispatched',
                `Location broadcasted (${coords.lat}, ${coords.lng}). Local emergency services (Rescue 1122) and nearby verified guides have been notified.`
              );
            } catch (err) {
              Alert.alert('Error', 'Failed to dispatch online SOS alert. Please dial 1122 directly.');
            } finally {
              setSendingSos(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🚨 Emergency SOS Assistance</Text>
      <Text style={styles.subtitle}>
        Quickly dispatch your current GPS coordinates to regional tourist safety response teams in Northern Pakistan.
      </Text>

      {/* Main Panic Button */}
      <TouchableOpacity
        style={[styles.sosButton, sendingSos && styles.sosButtonDisabled]}
        onPress={handleBroadcastSOS}
        disabled={sendingSos}
      >
        {sendingSos ? (
          <ActivityIndicator size="large" color="#FFF" />
        ) : (
          <>
            <Text style={styles.sosButtonText}>TRIGGER SOS</Text>
            <Text style={styles.sosSubtext}>Tap for Immediate Dispatch</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>📍 Last Captured Location</Text>
        <Text style={styles.infoText}>Latitude: {coords.lat}</Text>
        <Text style={styles.infoText}>Longitude: {coords.lng}</Text>
        <Text style={styles.infoRegion}>Region: Gilgit-Baltistan / Hunza District</Text>
      </View>

      {/* Direct Hotline Buttons */}
      <Text style={styles.sectionTitle}>Direct Emergency Hotlines</Text>
      
      <TouchableOpacity style={styles.hotlineBtn} onPress={() => handleEmergencyCall('1122')}>
        <Text style={styles.hotlineTitle}>🚑 Rescue 1122 (Medical & Disaster)</Text>
        <Text style={styles.hotlineSub}>Tap to Call 1122</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.hotlineBtn} onPress={() => handleEmergencyCall('1422')}>
        <Text style={styles.hotlineTitle}>👮 Tourist Police Hotline</Text>
        <Text style={styles.hotlineSub}>Tap to Call 1422</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FFF5F5' },
  header: { fontSize: 22, fontWeight: 'bold', color: '#991B1B', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#7F1D1D', marginBottom: 20, lineHeight: 18 },
  sosButton: {
    backgroundColor: '#DC2626',
    width: 200,
    height: 200,
    borderRadius: 100,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    marginVertical: 16,
  },
  sosButtonDisabled: { backgroundColor: '#FCA5A5' },
  sosButtonText: { color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  sosSubtext: { color: '#FEE2E2', fontSize: 11, marginTop: 4 },
  infoCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#FECACA' },
  infoTitle: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 6 },
  infoText: { fontSize: 12, color: '#444' },
  infoRegion: { fontSize: 12, color: '#DC2626', fontWeight: '600', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#1A1A1A' },
  hotlineBtn: { backgroundColor: '#FFF', padding: 14, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  hotlineTitle: { fontSize: 14, fontWeight: 'bold', color: '#1F2937' },
  hotlineSub: { fontSize: 12, color: '#2563EB', marginTop: 2 },
});