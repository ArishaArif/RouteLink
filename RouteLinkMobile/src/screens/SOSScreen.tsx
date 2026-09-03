import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';
import MapViewComponent from '../components/MapView';
import { useTrip } from '../context/TripContext';
import { api } from '../services/api';
import { HazardAlert } from '../types';

type SosService = {
  name: string;
  category: string;
  phone: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
};

export const SOSScreen = () => {
  const { coords } = useTrip();
  const [sendingSos, setSendingSos] = useState(false);
  const [lastResult, setLastResult] = useState<{
    services: SosService[];
    emergencyNumbers: { label: string; number: string }[];
  } | null>(null);
  const [hazards, setHazards] = useState<HazardAlert[]>([]);

  // Falls back to Hunza Valley if no trip/destination has been set yet
  const activeCoords = coords ?? { lat: 36.3167, lng: 74.6500 };

  useEffect(() => {
    // Active hazards near the user, so the SOS route can avoid them.
    // Failure here shouldn't block SOS itself — just means no rerouting hint.
    api.getHazards().then(setHazards).catch(() => setHazards([]));
  }, []);

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
              // Real call to the backend, not a simulated delay
              const response = await api.triggerSOS(activeCoords.lat, activeCoords.lng);
              setLastResult(response.nearest);
              Alert.alert(
                'SOS Alert Dispatched',
                `Location broadcasted (${activeCoords.lat}, ${activeCoords.lng}). ` +
                `${response.nearest.services.length} nearby services found. ` +
                (response.nearest.mocked ? '(Demo data — nearest-service lookup is not live yet.)' : '') +
                ` Also call Rescue 1122 directly if this is a real emergency.`
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

  const nearestService = lastResult?.services?.[0] ?? null;

  // Only exclude hazards that have real coordinates and sit reasonably close
  // to the current area — a hazard on the other side of the country isn't
  // relevant to this route and would just waste one of the limited exclude slots.
  const NEARBY_THRESHOLD_KM = 50;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const nearbyHazardPoints = hazards
    .filter((h) => h.latitude != null && h.longitude != null)
    .filter((h) => haversineKm(activeCoords.lat, activeCoords.lng, h.latitude as number, h.longitude as number) <= NEARBY_THRESHOLD_KM)
    .map((h) => ({ latitude: h.latitude as number, longitude: h.longitude as number, label: `${h.hazardType}: ${h.region}` }));

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🚨 Emergency SOS Assistance</Text>
      <Text style={styles.subtitle}>
        Quickly dispatch your current GPS coordinates to regional tourist safety response teams in Northern Pakistan.
      </Text>

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
        <Text style={styles.infoTitle}>📍 Current Trip Location</Text>
        <Text style={styles.infoText}>Latitude: {activeCoords.lat}</Text>
        <Text style={styles.infoText}>Longitude: {activeCoords.lng}</Text>
      </View>

      {/*
        Before an SOS is sent: just show current location.
        After: show the real route to the nearest service, routed around
        any active hazards nearby (hazard-aware rerouting, see MapView.tsx).
      */}
      <MapViewComponent
        originLat={activeCoords.lat}
        originLng={activeCoords.lng}
        destLat={nearestService?.latitude ?? activeCoords.lat}
        destLng={nearestService?.longitude ?? activeCoords.lng}
        hazardPoints={nearbyHazardPoints}
      />

      {lastResult && (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Nearest Services Found</Text>
          {lastResult.services.map((s, i) => (
            <Text key={i} style={styles.infoText}>
              {s.name} ({s.category}) — {s.distanceKm} km — {s.phone}
            </Text>
          ))}
          {nearbyHazardPoints.length > 0 && (
            <Text style={styles.infoRegion}>
              Route above avoids {nearbyHazardPoints.length} active hazard{nearbyHazardPoints.length > 1 ? 's' : ''} near you.
            </Text>
          )}
        </View>
      )}

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
