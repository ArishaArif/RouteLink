import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Animated,
  Vibration,
  RefreshControl,
  Clipboard,
  Share,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useTrip } from '../context/TripContext';
import { Card } from '../components/Card';
import { PressableCard } from '../components/PressableCard';
import { ExpandableSection } from '../components/ExpandableSection';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Avatar } from '../components/Avatar';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { api, ApiError } from '../services/api';
import { Booking, Guide, RootStackParamList } from '../types';
import { formatPrice, formatDateRange } from '../utils/display';

type Props = NativeStackScreenProps<RootStackParamList, 'GuideDetail'>;

export const GuideDetailScreen = ({ route }: Props) => {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { guideId } = route.params;
  const { trip, trips } = useTrip();
  const activeTrip = trip || trips[trips.length - 1] || null;

  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const [startDate, setStartDate] = useState(activeTrip?.startDate || '');
  const [endDate, setEndDate] = useState(activeTrip?.endDate || '');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<Booking | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.getGuide(guideId);
      setGuide(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Unable to load guide details.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [guideId]);

  useEffect(() => {
    if (activeTrip) {
      setStartDate(activeTrip.startDate);
      setEndDate(activeTrip.endDate);
    }
  }, [activeTrip]);

  useEffect(() => {
    if (loading || error || !guide) return;
    fadeAnim.setValue(0);
    translateY.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [loading, error, guide]);

  const clampDate = (value: string, min: string, max: string) => {
    if (!value) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  };

  const handleBooking = async () => {
    if (!activeTrip || !guide) return;
    const s = clampDate(startDate, activeTrip.startDate, activeTrip.endDate);
    const e = clampDate(endDate, activeTrip.startDate, activeTrip.endDate);
    setStartDate(s);
    setEndDate(e);
    setBookingLoading(true);
    setBookingError(null);
    setBookingResult(null);
    Vibration.vibrate(20);
    try {
      const booking = await api.createBooking({
        tripId: activeTrip.id,
        guideId: guide.id,
        startDate: s,
        endDate: e,
      });
      setBookingResult(booking);
    } catch (err: any) {
      let message = err instanceof ApiError ? err.message : 'Booking failed.';
      if (err instanceof ApiError && err.details.length > 0) {
        message = err.details.map((d: any) => (typeof d === 'string' ? d : d.message || JSON.stringify(d))).join('\n');
      }
      if (err instanceof ApiError && err.status === 409 && err.data?.conflict) {
        const c = err.data.conflict;
        message = `Overlap: ${formatDateRange(c.startDate, c.endDate)}`;
      }
      setBookingError(message);
    } finally {
      setBookingLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const toggleFavorite = () => {
    Vibration.vibrate(30);
    setIsFavorite((prev) => !prev);
  };

  const handleShare = async () => {
    Vibration.vibrate(30);
    if (!guide) return;
    try {
      await Share.share({
        message: `Check out ${guide.name}, a local guide in ${guide.region}. Rate: ${formatPrice(guide.pricePerDay)}/day.`,
      });
    } catch {}
  };

  const handleCopy = (text: string) => {
    Vibration.vibrate(20);
    Clipboard.setString(text);
  };

  const avatarScale = scrollY.interpolate({
    inputRange: [-120, 0, 120],
    outputRange: [1.2, 1, 0.8],
    extrapolate: 'clamp',
  });

  const avatarOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [1, 0.6],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }

  if (error || !guide) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState icon="refresh-outline" title="Could not load guide" subtitle={error || 'Guide not found.'} actionTitle="Retry" onAction={() => load()} />
      </View>
    );
  }

  const languages = guide.languages || [];
  const tripRange = activeTrip ? formatDateRange(activeTrip.startDate, activeTrip.endDate) : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
        <View style={styles.header}>
          <Animated.View
            style={[
              styles.avatar,
              {
                transform: [{ scale: avatarScale }],
                opacity: avatarOpacity,
              },
            ]}
          >
            <Avatar name={guide.name} size={96} />
          </Animated.View>
          <Text style={[styles.name, { color: theme.colors.textPrimary }]}>{guide.name}</Text>
          <Text style={[styles.region, { color: theme.colors.textSecondary }]}>
            <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} /> {guide.region}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity onPress={toggleFavorite} style={styles.iconButton} activeOpacity={0.8}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorite ? theme.colors.danger : theme.colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.iconButton} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleCopy(`${guide.name} — ${guide.region} — ${formatPrice(guide.pricePerDay)}/day`)}
              style={styles.iconButton}
              activeOpacity={0.8}
            >
              <Ionicons name="copy-outline" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <PressableCard>
            <Text style={[styles.priceLabel, { color: theme.colors.textSecondary }]}>Rate per day</Text>
            <Text style={[styles.price, { color: theme.colors.buttonPrimary }]}>
              {formatPrice(guide.pricePerDay)}
            </Text>

            <View style={styles.divider} />

            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Languages</Text>
            <View style={styles.chips}>
              {languages.length === 0 ? (
                <Text style={[styles.body, { color: theme.colors.textSecondary }]}>Not specified</Text>
              ) : (
                languages.map((lang) => (
                  <View key={lang} style={[styles.chip, { backgroundColor: theme.colors.surfaceSecondary }]}>
                    <Text style={[styles.chipText, { color: theme.colors.textSecondary }]}>{lang}</Text>
                  </View>
                ))
              )}
            </View>
          </PressableCard>
        </View>

        <View style={styles.section}>
          <ExpandableSection title="About" initialExpanded>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              {guide.bio || 'Local guide with regional knowledge.'}
            </Text>
          </ExpandableSection>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Booking</Text>
          {!activeTrip ? (
            <Card elevated={false}>
              <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
                Create a trip first to book this guide.
              </Text>
              <Button
                title="Plan a trip"
                variant="secondary"
                style={{ marginTop: 12 }}
                onPress={() => navigation.navigate('MainTabs', { screen: 'Routes' })}
              />
            </Card>
          ) : bookingResult ? (
            <Card elevated={false}>
              <View style={styles.resultRow}>
                <Ionicons name="checkmark-circle" size={28} color={theme.colors.success} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[styles.body, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                    Booking confirmed
                  </Text>
                  <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
                    {formatPrice(bookingResult.totalPrice)} • {formatDateRange(bookingResult.startDate, bookingResult.endDate)}
                  </Text>
                </View>
              </View>
            </Card>
          ) : (
            <Card elevated={false}>
              <Text style={[styles.body, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
                Trip dates: {tripRange}
              </Text>
              <Input
                label="Start date"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
              />
              <Input
                label="End date"
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                containerStyle={{ marginTop: 12 }}
              />
              {bookingError && (
                <Text style={[styles.bookingError, { color: theme.colors.danger }]}>{bookingError}</Text>
              )}
              <Button
                title="Request booking"
                loading={bookingLoading}
                style={{ marginTop: 16 }}
                onPress={handleBooking}
              />
            </Card>
          )}
        </View>

        {guide.phone && (
          <View style={[styles.section, { marginBottom: 32 }]}>
            <Button
              title={`Call ${guide.phone}`}
              variant="secondary"
              icon="call"
              onPress={() => {
                Vibration.vibrate(30);
                Linking.openURL(`tel:${guide.phone}`);
              }}
            />
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 8,
  },
  avatar: {
    marginBottom: 16,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  region: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(150,150,150,0.12)',
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
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.2)',
    marginVertical: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  chip: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingError: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
