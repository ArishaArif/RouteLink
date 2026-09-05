import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import { Card } from '../components/Card';
import { PressableCard } from '../components/PressableCard';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { HeatBarRow } from '../components/HeatBarRow';
import { StatTile } from '../components/StatTile';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { api } from '../services/api';
import { TripDay, HazardAlert, Trip, RootStackParamList } from '../types';
import { heatTierMeta, heatTierColor, formatDate } from '../utils/display';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const TripPlannerScreen = () => {
  const { theme } = useTheme();
  const { isLoading: authLoading } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    destination,
    duration,
    trip,
    trips,
    itinerary,
    isLoading: tripLoading,
    error: tripError,
    setDestination,
    setDuration,
    generateItinerary,
    selectTrip,
  } = useTrip();
  const [hazards, setHazards] = useState<HazardAlert[]>([]);
  const [hazardLoading, setHazardLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const loadHazards = useCallback(async () => {
    setHazardLoading(true);
    try {
      const data = await api.getHazards(trip?.destination || destination);
      setHazards(data);
    } catch {
      setHazards([]);
    } finally {
      setHazardLoading(false);
    }
  }, [trip?.destination, destination]);

  useEffect(() => {
    if (authLoading) return;
    loadHazards();
  }, [authLoading, loadHazards]);

  const toggleDay = (dayNumber: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => ({ ...prev, [dayNumber]: !prev[dayNumber] }));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadHazards()]);
    setRefreshing(false);
  };

  const days = itinerary?.itinerary || [];
  const currentTier = days[0]?.heatTier || 'mild';
  const loading = tripLoading || hazardLoading;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Routes</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {trip ? `${trip.destination} • ${days.length} days` : `${destination} • ${duration} days`}
        </Text>
      </View>

      <View style={styles.section}>
        <Card elevated={false}>
          <Input
            label="Destination"
            value={destination}
            onChangeText={setDestination}
            placeholder="e.g. Hunza, Skardu, Naran"
            autoCapitalize="words"
          />
          <Input
            label="Duration (days)"
            value={duration}
            onChangeText={(text) => setDuration(text.replace(/[^0-9]/g, ''))}
            placeholder="3"
            keyboardType="number-pad"
            containerStyle={{ marginTop: 12 }}
          />
          <Button
            title="Plan trip"
            onPress={generateItinerary}
            loading={tripLoading}
            style={{ marginTop: 16 }}
          />
          {!trip && !tripLoading && (
            <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
              No trip exists yet. Set a destination and tap Plan trip to create one.
            </Text>
          )}
        </Card>
      </View>

      {trips.length > 1 && (
        <View style={styles.section}>
          <Text style={[styles.overline, { color: theme.colors.textSecondary }]}>Select trip</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {trips.map((t) => (
              <TripPill key={t.id} trip={t} active={t.id === trip?.id} onPress={() => selectTrip(t)} />
            ))}
          </ScrollView>
        </View>
      )}

      {trip && days.length > 0 && (
        <View style={styles.section}>
          <View style={styles.stats}>
            <StatTile label="Days" value={String(days.length)} />
            <StatTile label="Day 1 heat" value={heatTierMeta[currentTier].label} accent={heatTierColor(currentTier)} />
            <StatTile label="Alerts" value={String(hazards.length)} accent={hazards.length > 0 ? theme.colors.danger : undefined} />
          </View>
        </View>
      )}

      {days.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.overline, { color: theme.colors.textSecondary }]}>Heat across days</Text>
          <HeatBarRow tiers={days.map((d) => d.heatTier)} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Itinerary</Text>
        {tripError ? (
          <Card elevated={false}>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              {tripError}. Showing a static plan.
            </Text>
          </Card>
        ) : tripLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : !trip ? (
          <EmptyState icon="map-outline" title="No trip yet" subtitle="Plan a trip to generate an itinerary." />
        ) : days.length === 0 ? (
          <Card elevated={false}>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>No itinerary days available.</Text>
          </Card>
        ) : (
          days.map((day) => (
            <DayCard key={day.dayNumber} day={day} expanded={!!expanded[day.dayNumber]} onToggle={() => toggleDay(day.dayNumber)} />
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Regional hazard alerts</Text>
        {hazardLoading ? (
          <Skeleton width="100%" height={80} />
        ) : hazards.length === 0 ? (
          <Card elevated={false}>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              No active alerts for {trip?.destination || destination}.
            </Text>
          </Card>
        ) : (
          hazards.map((h) => (
            <PressableCard key={h.id} style={styles.hazardCard} onPress={() => navigation.navigate('MainTabs', { screen: 'Alerts' })}>
              <View style={styles.hazardRow}>
                <Badge badge={{ kind: 'severity', value: h.severity }} />
                <Text style={[styles.hazardType, { color: theme.colors.textSecondary }]}>
                  {h.hazardType.replace(/_/g, ' ')}
                </Text>
              </View>
              <Text style={[styles.hazardText, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                {h.description || h.rawText}
              </Text>
            </PressableCard>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const TripPill = ({ trip, active, onPress }: { trip: Trip; active: boolean; onPress: () => void }) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        {
          backgroundColor: active ? theme.colors.buttonPrimary : theme.colors.surface,
          borderColor: active ? theme.colors.buttonPrimary : theme.colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={{ color: active ? theme.colors.onButtonPrimary : theme.colors.textPrimary, fontWeight: '600' }}>
        {trip.destination}
      </Text>
    </TouchableOpacity>
  );
};

const DayCard = ({ day, expanded, onToggle }: { day: TripDay; expanded: boolean; onToggle: () => void }) => {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const guides = day.needsMarketplaceData ? day.marketplace?.guides || [] : [];

  return (
    <Card style={styles.dayCard}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
        <View style={styles.dayHeader}>
          <View>
            <Text style={[styles.dayTitle, { color: theme.colors.textPrimary }]}>
              Day {day.dayNumber}
            </Text>
            <Text style={[styles.dayDate, { color: theme.colors.textSecondary }]}>
              {formatDate(day.date)}
            </Text>
          </View>
          <View style={styles.dayBadges}>
            {day.heatTier && <Badge badge={{ kind: 'heat', value: day.heatTier }} tone="heatRamp" />}
            {day.slotType && <Badge badge={{ kind: 'slot', value: day.slotType }} />}
          </View>
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.dayBody}>
          {day.fallbackMessage && (
            <View style={[styles.fallback, { backgroundColor: theme.colors.surfaceSecondary }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.fallbackText, { color: theme.colors.textSecondary }]}>
                {day.fallbackMessage}
              </Text>
            </View>
          )}
          {day.activities.length === 0 ? (
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>No activities planned yet.</Text>
          ) : (
            day.activities.map((a, idx) => (
              <View key={idx} style={styles.activity}>
                <View style={styles.timeline}>
                  <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
                  {idx < day.activities.length - 1 && (
                    <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
                  )}
                </View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>{a.time}</Text>
                  <Text style={[styles.activityTitle, { color: theme.colors.textPrimary }]}>{a.title}</Text>
                  {a.location && <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{a.location}</Text>}
                </View>
              </View>
            ))
          )}
          {guides.length > 0 && (
            <View style={styles.guidesSection}>
              <Text style={[styles.guidesTitle, { color: theme.colors.textSecondary }]}>
                Guides in this region
              </Text>
              {guides.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.guideRow}
                  onPress={() => navigation.navigate('GuideDetail', { guideId: g.id })}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.guideName, { color: theme.colors.textPrimary }]}>{g.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    marginBottom: 12,
  },
  overline: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  pill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
  },
  dayCard: {
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dayDate: {
    fontSize: 13,
    marginTop: 2,
  },
  dayBadges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  dayBody: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  fallback: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  fallbackText: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 8,
    flex: 1,
  },
  activity: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timeline: {
    width: 20,
    alignItems: 'center',
    marginRight: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  activityContent: {
    flex: 1,
  },
  activityTime: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  guidesSection: {
    marginTop: 16,
    paddingTop: 16,
  },
  guidesTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  guideName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  hazardCard: {
    marginBottom: 10,
  },
  hazardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hazardType: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  hazardText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
