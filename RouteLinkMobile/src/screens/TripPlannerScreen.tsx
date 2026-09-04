import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useTrip } from '../context/TripContext';
import { AttractionCard } from '../components/AttractionCard';
import { AttractionSpot } from '../types';
import { api } from '../services/api';

export const TripPlannerScreen = () => {
  const { destination, duration, itinerary, isLoading, error, setDestination, setDuration, generateItinerary } = useTrip();
  const [attractions, setAttractions] = useState<AttractionSpot[]>([]);
  const [isLoadingAttractions, setIsLoadingAttractions] = useState(false);

  // Trigger live fetch when destination is updated
  useEffect(() => {
    if (destination) {
      fetchLiveRecommendations();
    }
  }, [destination]);

  const fetchLiveRecommendations = async () => {
    try {
      setIsLoadingAttractions(true);
      const data = await api.getRecommendations(destination); 
      setAttractions(data);
    } catch (err: any) {
      Alert.alert('Error', 'Could not load live recommendations.');
    } finally {
      setIsLoadingAttractions(false);
    }
  };

  const handleMarkVisited = async (spotId: string) => {
    const spot = attractions.find((item) => item.id === spotId);
    setAttractions((prev) => prev.filter((item) => item.id !== spotId));

    if (!spot) return;

    try {
      await api.markDestinationState(spot.name, 'visited');
    } catch (err: any) {
      Alert.alert('Notice', 'Marked visited locally. Will retry syncing when backend is reachable.');
    }
  };

  /*
  // Temporarily disabled due to API contract mismatch (Backend only supports 'visited' | 'dismissed')
  const handleMarkInterested = (spotId: string) => {
    Alert.alert('Saved!', 'Added to your trip interest list.');
    setAttractions((prev) => prev.filter((item) => item.id !== spotId));
  };
  */

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

      {/* Swipeable Recommendations Deck with Live Data */}
      {isLoadingAttractions ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        attractions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Recommended Attractions ({attractions.length} Available)</Text>
            <AttractionCard
              spot={attractions[0]}
              onMarkVisited={handleMarkVisited}
              // onMarkInterested={handleMarkInterested} <-- HIDDEN UNTIL BACKEND FIX
            />
          </View>
        )
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
  loader: { marginVertical: 20 },
});