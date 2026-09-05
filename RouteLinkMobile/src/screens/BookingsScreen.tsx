import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { api } from '../services/api';
import { Booking } from '../types';
import { formatPrice, formatDateRange } from '../utils/display';


export const BookingsScreen = () => {
  const { theme } = useTheme();
  const { isLoading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.listBookings();
      setBookings(data);
    } catch (e) {
      setBookings([]);
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

  const grouped = bookings.reduce<Record<string, Booking[]>>((acc, b) => {
    acc[b.status] = acc[b.status] || [];
    acc[b.status].push(b);
    return acc;
  }, {});

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>My Bookings</Text>
      </View>

      <View style={styles.section}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : bookings.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No bookings yet" subtitle="Book a guide from the Guides tab." />
        ) : (
          Object.keys(grouped).map((status) => (
            <View key={status} style={styles.group}>
              <Text style={[styles.groupTitle, { color: theme.colors.textSecondary }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
              {grouped[status].map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const BookingCard = ({ booking }: { booking: Booking }) => {
  const { theme } = useTheme();
  const guideName = booking.guide?.name ?? 'Guide';
  const trip = booking.trip;
  return (
    <Card style={styles.card}>
        <View style={styles.row}>
          <Avatar name={guideName} size={44} />
          <View style={styles.body}>
            <Text style={[styles.name, { color: theme.colors.textPrimary }]}>{guideName}</Text>
            {trip && (
              <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
                {formatDateRange(trip.startDate, trip.endDate)} • {trip.destination}
              </Text>
            )}
          </View>
          <Text style={[styles.price, { color: theme.colors.buttonPrimary }]}>{formatPrice(booking.totalPrice)}</Text>
        </View>
        <View style={styles.footer}>
          <Badge badge={{ kind: 'booking', value: booking.status }} />
          {booking.viewerRole && (
            <Text style={[styles.role, { color: theme.colors.textSecondary }]}>
              {booking.viewerRole}
            </Text>
          )}
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
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  group: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  card: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  role: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
});
