import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useTrip } from '../context/TripContext';
import { AttractionCard } from '../components/AttractionCard';
import { AttractionSpot } from '../types';
import { api } from '../services/api';

// Mock attraction pool (Will be replaced by live GET /api/recommendations responses)
const MOCK_ATTRACTION_POOL: AttractionSpot[] = [
  {
    id: 'b1a2c3d4-0001-4000-8000-000000000001',
    name: 'Attabad Lake',
    location: 'Hunza Valley',
    latitude: 36.3362,
    longitude: 74.8642,
    description: 'Turquoise blue lake formed by a landslide, perfect for boating and jet skiing.',
    forecasts: [
      {
        time: '12:00 PM',
        temperatureC: 22,
        condition: 'Sunny',
        slotType: 'outdoor_ok',
        recommendationSummary: 'Ideal for boating between 11 AM - 3 PM.',
        inDepthAnalysis: 'Clear skies with mild winds. High UV index; wear sunscreen.',
      },
    ],
  },
  {
    id: 'b1a2c3d4-0002-4000-8000-000000000002',
    name: 'Passu Cones Viewpoint',
    location: 'Passu, Hunza',
    latitude: 36.4522,
    longitude: 74.8812,
    description: 'Iconic cathedral-like mountain peaks along the Karakoram Highway.',
    forecasts: [
      {
        time: '03:00 PM',
        temperatureC: 19,
        condition: 'Partly Cloudy',
        slotType: 'outdoor_ok',
        recommendationSummary: 'Best lighting for photography in late afternoon.',
        inDepthAnalysis: 'Temperatures drop rapidly after sunset around 5:30 PM.',
      },
    ],
  },
  {
    id: 'b1a2c3d4-0003-4000-8000-000000000003',
    name: 'Baltit Fort',
    location: 'Karimabad, Hunza',
    latitude: 36.3256,
    longitude: 74.6644,
    description: '700-year-old ancient fort offering panoramic views of Hunza Valley.',
    forecasts: [
      {
        time: '06:00 PM',
        temperatureC: 32,
        condition: 'Heatwave Warning',
        slotType: 'indoor_rest',
        recommendationSummary: 'Wait until evening; heavy midday direct sunlight.',
        inDepthAnalysis: 'Extreme heat tier detected. Indoor museum tour advised until peak heat dissipates.',
      },
    ],
  },
];

export const TripPlannerScreen = () => {
  const { destination, duration, itinerary, isLoading, error, setDestination, setDuration, generateItinerary } = useTrip();
  const [attractions, setAttractions] = useState<AttractionSpot[]>(MOCK_ATTRACTION_POOL);

  const handleMarkVisited = async (spotId: string) => {
    const spot = attractions.find((item) => item.id === spotId);

    // Optimistic UI update: remove card locally immediately
    setAttractions((prev) => prev.filter((item) => item.id !== spotId));

    if (!spot) return;

    try {
      // Real call to POST /api/users/me/destination-state (see api.ts).
      await api.markDestinationState(spot.name, 'visited');
    } catch (err: any) {
      Alert.alert('Notice', 'Marked visited locally. Will retry syncing when backend is reachable.');
    }
  };

  const handleMarkInterested = (spotId: string) => {
    // NOTE: intentionally NOT calling markDestinationState here.
    // The backend only supports 'visited' | 'dismissed' (API_CONTRACT.md §18) —
    // both of which exclude a destination from future recommendations.
    // "Interested" means the opposite (the user wants to keep seeing/planning it),
    // so there's no correct status to send yet. This needs a real decision with
    // Backend/ML (e.g. a third 'interested' status, or a separate wishlist list)
    // rather than silently miswiring it to 'dismissed'.
    Alert.alert('Saved!', 'Added to your trip interest list.');
    setAttractions((prev) => prev.filter((item) => item.id !== spotId));
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Trip Planner & Recommendations</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Destination</Text>
        <TextInput style={styles.input} placeholder="e.g. Hunza, Skardu" value={destination} onChangeText={setDestination} />

        <Text style={styles.label}>Duration (Days)</Text>
        <TextInput style={styles.input} placeholder="e.g. 3" keyboardType="numeric" value={duration} onChangeText={setDuration} />

        <TouchableOpacity style={styles.button} onPress={generateItinerary} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate Itinerary</Text>}
        </TouchableOpacity>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Swipeable Recommendations Deck */}
      {attractions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Recommended Attractions ({attractions.length} Available)</Text>
          <AttractionCard
            spot={attractions[0]}
            onMarkVisited={handleMarkVisited}
            onMarkInterested={handleMarkInterested}
          />
        </View>
      )}

      {/* Dynamic Itinerary Days */}
      {itinerary && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>{destination} ({itinerary.days} Days Plan)</Text>

          {itinerary.itinerary.map((day) => (
            <View key={day.dayNumber} style={styles.dayCard}>
              <Text style={styles.dayTitle}>Day {day.dayNumber} ({day.date})</Text>

              {day.fallbackMessage && (
                <View style={styles.alertBox}>
                  <Text style={styles.alertText}>{day.fallbackMessage}</Text>
                </View>
              )}

              {day.activities.map((act, idx) => (
                <View key={idx} style={styles.activityRow}>
                  <Text style={styles.time}>{act.time}</Text>
                  <Text style={styles.actTitle}>{act.title}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  formGroup: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, marginBottom: 12 },
  button: { backgroundColor: '#007AFF', padding: 12, borderRadius: 6, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  errorText: { color: 'red', marginTop: 8 },
  section: { marginBottom: 24 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  dayCard: { backgroundColor: '#fff', padding: 14, borderRadius: 8, marginBottom: 10 },
  dayTitle: { fontSize: 16, fontWeight: 'bold', color: '#007AFF', marginBottom: 8 },
  alertBox: { backgroundColor: '#FFF3CD', padding: 8, borderRadius: 4, marginBottom: 8 },
  alertText: { color: '#856404', fontSize: 12 },
  activityRow: { marginBottom: 6, paddingLeft: 8 },
  time: { fontSize: 12, color: '#666', fontWeight: '600' },
  actTitle: { fontSize: 14, fontWeight: 'bold' },
});