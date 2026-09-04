import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AttractionSpot } from '../types';
import { colors, radius, spacing, shadow, typography } from '../theme';

interface AttractionCardProps {
  spot: AttractionSpot;
  onMarkVisited: (spotId: string) => void;
  // Optional: TripPlannerScreen doesn't wire this up yet (backend contract
  // mismatch, see comment there), so it can't be required here.
  onMarkInterested?: (spotId: string) => void;
}

// Fallback image when Google Places API / Backend hasn't provided an image URL yet
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';

export const AttractionCard: React.FC<AttractionCardProps> = ({ spot, onMarkVisited, onMarkInterested }) => {
  const currentForecast = spot.forecasts && spot.forecasts.length > 0 ? spot.forecasts[0] : null;

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: spot.imageUrl || PLACEHOLDER_IMAGE }}
          style={styles.image}
          resizeMode="cover"
        />
        {currentForecast && (
          <View style={styles.weatherBadge}>
            <Ionicons name="partly-sunny-outline" size={13} color={colors.forest} />
            <Text style={styles.weatherBadgeText}>{currentForecast.temperatureC}°C</Text>
          </View>
        )}
        <View style={styles.locationPill}>
          <Ionicons name="location" size={11} color={colors.card} />
          <Text style={styles.locationPillText} numberOfLines={1}>{spot.location}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{spot.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {spot.description}
        </Text>

        {currentForecast && (
          <View style={styles.weatherBox}>
            <Text style={styles.weatherTitle}>
              {currentForecast.time} · {currentForecast.condition}
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
            <Ionicons name="checkmark" size={14} color={colors.inkMuted} />
            <Text style={styles.visitedBtnText}>Already visited</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.interestedBtn]} onPress={() => onMarkInterested?.(spot.id)}>
            <Ionicons name="star" size={14} color={colors.card} />
            <Text style={styles.interestedBtnText}>Interested</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  imageWrap: { width: '100%', height: 190, position: 'relative' },
  image: { width: '100%', height: '100%' },
  weatherBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    gap: 4,
  },
  weatherBadgeText: { fontSize: 12, fontWeight: '700', color: colors.forest },
  locationPill: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,58,43,0.72)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    maxWidth: '80%',
    gap: 4,
  },
  locationPillText: { fontSize: 11, fontWeight: '600', color: colors.card },
  content: { padding: spacing.lg },
  title: { ...typography.cardTitle },
  description: { ...typography.bodyMuted, marginTop: 4 },
  weatherBox: { backgroundColor: colors.stone, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  weatherTitle: { fontSize: 12, fontWeight: '700', color: colors.forest },
  weatherSummary: { fontSize: 12, color: colors.ink, marginTop: 2 },
  inDepthText: { fontSize: 11, color: colors.inkMuted, marginTop: 4 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, gap: spacing.sm },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.pill,
  },
  visitedBtn: { backgroundColor: colors.stone, borderWidth: 1, borderColor: colors.border },
  visitedBtnText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  interestedBtn: { backgroundColor: colors.moss },
  interestedBtnText: { color: colors.card, fontSize: 12, fontWeight: '700' },
});
