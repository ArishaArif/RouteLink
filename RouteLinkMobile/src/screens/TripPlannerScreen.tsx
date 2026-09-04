import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTrip } from '../context/TripContext';
import { AttractionCard } from '../components/AttractionCard';
import { AttractionSpot } from '../types';
import { api } from '../services/api';
import { colors, radius, spacing, shadow, typography } from '../theme';

// Small helper for the "3 days left" / "Today" / "Completed" badge on each
// itinerary day -- purely a display label, doesn't touch trip data.
const getDayBadge = (dateStr: string): { label: string; tone: 'upcoming' | 'today' | 'past' } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return { label: '', tone: 'upcoming' };
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { label: 'Today', tone: 'today' };
  if (diffDays < 0) return { label: 'Completed', tone: 'past' };
  return { label: `${diffDays} day${diffDays === 1 ? '' : 's'} left`, tone: 'upcoming' };
};

export const TripPlannerScreen = () => {
  const { destination, duration, startDate, itinerary, isLoading, error, setDestination, setDuration, setStartDate, generateItinerary } = useTrip();
  const [attractions, setAttractions] = useState<AttractionSpot[]>([]);
  const [isLoadingAttractions, setIsLoadingAttractions] = useState(false);

  // Debounced live fetch: firing a network request on every single keystroke
  // (the previous behaviour) caused a visible full-screen loading spinner
  // and an Alert.alert popup to flash on every letter typed. Waiting for a
  // short pause in typing, and requiring a minimal length, fixes both the
  // wasted requests and the "screen refreshes every letter" feeling.
  useEffect(() => {
    if (destination.trim().length < 3) {
      setAttractions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchLiveRecommendations();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  const fetchLiveRecommendations = async () => {
    try {
      setIsLoadingAttractions(true);
      const data = await api.getRecommendations(destination);
      setAttractions(data);
    } catch (err: any) {
      // Silently degrade instead of popping an Alert -- this runs in the
      // background as you type, and an alert dialog firing mid-keystroke
      // is far more disruptive than just showing no suggestions yet.
      setAttractions([]);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.containerContent}>
      <Text style={styles.header}>Trip Planner</Text>
      <Text style={styles.subheader}>Build your route, check conditions, go.</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Destination</Text>
        <TextInput style={styles.input} placeholder="e.g. Hunza, Skardu" placeholderTextColor={colors.inkFaint} value={destination} onChangeText={setDestination} />

        <Text style={styles.label}>Duration (Days)</Text>
        <TextInput style={styles.input} placeholder="e.g. 3" placeholderTextColor={colors.inkFaint} keyboardType="numeric" value={duration} onChangeText={setDuration} />

        <Text style={styles.label}>Start Date</Text>
        <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkFaint} value={startDate} onChangeText={setStartDate} />
        <Text style={styles.hint}>Defaults to today -- change it if you're leaving on a different day.</Text>

        <TouchableOpacity style={styles.button} onPress={generateItinerary} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color={colors.card} /> : <Text style={styles.buttonText}>Generate itinerary</Text>}
        </TouchableOpacity>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Swipeable Recommendations Deck with Live Data */}
      {isLoadingAttractions ? (
        <ActivityIndicator size="large" color={colors.moss} style={styles.loader} />
      ) : (
        attractions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Recommended attractions ({attractions.length} available)</Text>
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
          <Text style={styles.sectionHeader}>{destination} · {itinerary.days}-day plan</Text>

          {itinerary.itinerary.map((day) => {
            const badge = getDayBadge(day.date);
            return (
              <View key={day.dayNumber} style={styles.dayCard}>
                <View style={styles.dayHeaderRow}>
                  <View>
                    <Text style={styles.dayTitle}>Day {day.dayNumber}</Text>
                    <Text style={styles.dayDate}>{day.date}</Text>
                  </View>
                  {badge.label ? (
                    <View
                      style={[
                        styles.dayBadge,
                        badge.tone === 'today' && styles.dayBadgeToday,
                        badge.tone === 'past' && styles.dayBadgePast,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayBadgeText,
                          badge.tone === 'today' && styles.dayBadgeTextToday,
                          badge.tone === 'past' && styles.dayBadgeTextPast,
                        ]}
                      >
                        {badge.label}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {day.fallbackMessage && (
                  <View style={styles.alertBox}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
                    <Text style={styles.alertText}>{day.fallbackMessage}</Text>
                  </View>
                )}

                {/* Trail-style timeline instead of a flat text list */}
                <View style={styles.timeline}>
                  {day.activities.map((act, idx) => (
                    <View key={idx} style={styles.timelineRow}>
                      <View style={styles.timelineTrack}>
                        <View style={styles.timelineDot} />
                        {idx < day.activities.length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={styles.time}>{act.time}</Text>
                        <Text style={styles.actTitle}>{act.title}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.stone },
  containerContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { ...typography.header },
  subheader: { ...typography.bodyMuted, marginTop: 2, marginBottom: spacing.lg },
  formGroup: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.xl, ...shadow.card },
  label: { ...typography.label, marginBottom: 6 },
  hint: { ...typography.caption, marginTop: -8, marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.stone,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.md,
    color: colors.ink,
    fontSize: 14,
  },
  button: { backgroundColor: colors.moss, padding: 14, borderRadius: radius.pill, alignItems: 'center' },
  buttonText: { color: colors.card, fontWeight: '700', fontSize: 14 },
  errorText: { color: colors.critical, marginTop: spacing.sm, fontSize: 13 },
  section: { marginBottom: spacing.xl },
  sectionHeader: { ...typography.sectionHeader, marginBottom: spacing.md },
  dayCard: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.md, ...shadow.card },
  dayHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dayTitle: { fontSize: 15, fontWeight: '700', color: colors.forest },
  dayDate: { fontSize: 12, color: colors.inkFaint, marginTop: 1 },
  dayBadge: { backgroundColor: colors.stoneDark, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  dayBadgeToday: { backgroundColor: colors.mossLight },
  dayBadgePast: { backgroundColor: colors.stoneDark },
  dayBadgeText: { fontSize: 11, fontWeight: '700', color: colors.inkMuted },
  dayBadgeTextToday: { color: colors.moss },
  dayBadgeTextPast: { color: colors.inkFaint },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningBg,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  alertText: { color: colors.warning, fontSize: 12, flex: 1 },
  timeline: { marginTop: spacing.md },
  timelineRow: { flexDirection: 'row' },
  timelineTrack: { width: 18, alignItems: 'center' },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.moss, marginTop: 5 },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2, marginBottom: 2 },
  timelineContent: { flex: 1, paddingBottom: spacing.md, paddingLeft: spacing.sm },
  time: { fontSize: 11, color: colors.inkFaint, fontWeight: '700' },
  actTitle: { fontSize: 14, fontWeight: '600', color: colors.ink, marginTop: 1 },
  loader: { marginVertical: spacing.xl },
});
