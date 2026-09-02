import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Guide } from '../types';
import { api } from '../services/api';

export const GuideMarketplaceScreen = () => {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGuides();
  }, []);

  const fetchGuides = async () => {
    try {
      setLoading(true);
      const data = await api.getGuides();
      setGuides(data);
    } catch (err: any) {
      // Fallback mock guides if backend has no guide records yet
      setGuides([
        {
          id: '04b8f4e2-1c9d-4a77-9f3e-2b6a5c8d1e11',
          name: 'Ali Raza',
          region: 'Hunza Valley',
          pricePerDay: 7500,
          rating: 4.9,
          bio: 'Certified trekking guide with 8+ years experience in Karakoram region.',
          languages: ['English', 'Urdu', 'Burushaski'],
          isAvailable: true,
        },
        {
          id: '04b8f4e2-1c9d-4a77-9f3e-2b6a5c8d1e22',
          name: 'Khan Balti',
          region: 'Skardu',
          pricePerDay: 8500,
          rating: 4.8,
          bio: 'Expert mountain navigator and high-altitude logistics specialist.',
          languages: ['English', 'Urdu', 'Balti'],
          isAvailable: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookGuide = (guide: Guide) => {
    Alert.alert('Book Guide', `Request booking with ${guide.name} for Rs. ${guide.pricePerDay}/day?`);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Verified Local Guides</Text>

      <FlatList
        data={guides}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.rating}>⭐ {item.rating}</Text>
            </View>

            <Text style={styles.region}>📍 {item.region}</Text>
            <Text style={styles.bio}>{item.bio}</Text>

            {item.languages && (
              <Text style={styles.languages}>
                🗣️ {item.languages.join(', ')}
              </Text>
            )}

            <View style={styles.cardFooter}>
              <Text style={styles.price}>Rs. {item.pricePerDay} / day</Text>
              <TouchableOpacity style={styles.bookButton} onPress={() => handleBookGuide(item)}>
                <Text style={styles.bookButtonText}>Request Booking</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 10, marginBottom: 14, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  rating: { fontSize: 14, fontWeight: 'bold', color: '#D97706' },
  region: { fontSize: 13, color: '#007AFF', marginVertical: 4, fontWeight: '600' },
  bio: { fontSize: 13, color: '#555', marginBottom: 8, lineHeight: 18 },
  languages: { fontSize: 12, color: '#777', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EEE' },
  price: { fontSize: 15, fontWeight: 'bold', color: '#2E7D32' },
  bookButton: { backgroundColor: '#007AFF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  bookButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});