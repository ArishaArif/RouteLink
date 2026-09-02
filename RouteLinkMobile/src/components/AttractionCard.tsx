import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { AttractionSpot } from '../types';

interface AttractionCardProps {
  spot: AttractionSpot;
  onMarkVisited: (spotId: string) => void;
  onMarkInterested: (spotId: string) => void;
}

// Fallback image when Google Places API / Backend hasn't provided an image URL yet
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';

export const AttractionCard: React.FC<AttractionCardProps> = ({ spot, onMarkVisited, onMarkInterested }) => {
  const currentForecast = spot.forecasts && spot.forecasts.length > 0 ? spot.forecasts[0] : null;

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: spot.imageUrl || PLACEHOLDER_IMAGE }}
        style={styles.image}
        resizeMode="cover"
      />

      <View style={styles.content}>
        <Text style={styles.title}>{spot.name}</Text>
        <Text style={styles.location}>📍 {spot.location}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {spot.description}
        </Text>

        {currentForecast && (
          <View style={styles.weatherBox}>
            <Text style={styles.weatherTitle}>
              🌡️ {currentForecast.time} - {currentForecast.temperatureC}°C ({currentForecast.condition})
            </Text>
            <Text style={styles.weatherSummary}>{currentForecast.recommendationSummary}</Text>
            {currentForecast.inDepthAnalysis ? (
              <Text style={styles.inDepthText} numberOfLines={2}>
                {currentForecast.inDepthAnalysis}
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.button, styles.visitedBtn]} onPress={() => onMarkVisited(spot.id)}>
            <Text style={styles.visitedBtnText}>✓ Already Visited</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.interestedBtn]} onPress={() => onMarkInterested(spot.id)}>
            <Text style={styles.interestedBtnText}>⭐ Interested</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: { width: '100%', height: 180 },
  content: { padding: 14 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  location: { fontSize: 12, color: '#666', marginVertical: 4 },
  description: { fontSize: 13, color: '#444', lineHeight: 18 },
  weatherBox: { backgroundColor: '#F0F7FF', padding: 10, borderRadius: 8, marginVertical: 10 },
  weatherTitle: { fontSize: 12, fontWeight: 'bold', color: '#0056B3' },
  weatherSummary: { fontSize: 12, color: '#333', marginTop: 2 },
  inDepthText: { fontSize: 11, color: '#666', marginTop: 4, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  button: { flex: 0.48, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  visitedBtn: { backgroundColor: '#EFEFEF', borderWidth: 1, borderColor: '#CCC' },
  visitedBtnText: { color: '#555', fontSize: 12, fontWeight: '600' },
  interestedBtn: { backgroundColor: '#007AFF' },
  interestedBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
});