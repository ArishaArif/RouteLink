import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl, TouchableOpacity, Alert, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { api } from '../services/api';
import { Trip } from '../types';
import { formatDateRange } from '../utils/display';

export const TripsScreen = () => {
  const { theme } = useTheme();
  const { isLoading: authLoading } = useAuth();
  const { selectTrip, loadTrips } = useTrip();
  const navigation = useNavigation();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.listTrips();
      setTrips(data);
    } catch (e) {
      setTrips([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const handleDelete = (trip: Trip) => {
    Vibration.vibrate(30);
    Alert.alert('Delete trip', `Remove "${trip.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(trip.id);
          try {
            await api.deleteTrip(trip.id);
            setTrips((prev) => prev.filter((t) => t.id !== trip.id));
            await loadTrips();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete trip.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const handleOpen = async (trip: Trip) => {
    await selectTrip(trip);
    navigation.navigate('Routes' as never);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>My Trips</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Manage your active expeditions.
        </Text>
      </View>

      <View style={styles.section}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : trips.length === 0 ? (
          <EmptyState
            icon="map-outline"
            title="No trips yet"
            subtitle="Plan your first route from the Routes tab."
            actionTitle="Plan a trip"
            onAction={() => navigation.navigate('Routes' as never)}
          />
        ) : (
          trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onOpen={() => handleOpen(trip)}
              onDelete={() => handleDelete(trip)}
              deleting={deletingId === trip.id}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
};

const TripCard = ({
  trip,
  onOpen,
  onDelete,
  deleting,
}: {
  trip: Trip;
  onOpen: () => void;
  onDelete: () => void;
  deleting: boolean;
}) => {
  const { theme } = useTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.colors.surfaceSecondary }]}>
          <Ionicons name="navigate" size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.name, { color: theme.colors.textPrimary }]}>{trip.title}</Text>
          <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
            {trip.destination} • {formatDateRange(trip.startDate, trip.endDate)}
          </Text>
          {trip.status && (
            <Text style={[styles.status, { color: theme.colors.textSecondary }]}>
              Status: {trip.status}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          title="Open"
          variant="secondary"
          icon="calendar-outline"
          onPress={onOpen}
          style={{ flex: 1 }}
        />
        <Button
          title={deleting ? 'Deleting...' : 'Delete'}
          variant="ghost"
          icon="trash-outline"
          onPress={onDelete}
          disabled={deleting}
          style={{ flex: 1 }}
        />
      </View>
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
    marginTop: 16,
    paddingHorizontal: 16,
  },
  card: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  status: {
    fontSize: 12,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
});
