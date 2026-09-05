import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import { Card } from '../components/Card';
import { PressableCard } from '../components/PressableCard';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Brandmark } from '../components/Brandmark';
import { StatusGlyph } from '../components/StatusGlyph';
import { api, ApiError } from '../services/api';
import { AttractionSpot, HazardAlert, Trip } from '../types';
import { formatDateRange, hazardSeverityMeta } from '../utils/display';
import { spacing, radius, typography, iconSize } from '../constants/theme';

const { width } = Dimensions.get('window');

const DESTINATIONS = [
  { name: 'Hunza', image: 'https://images.unsplash.com/photo-1542259659-4e0c4038b04b?auto=format&w=800&q=80' },
  { name: 'Hunza Valley', image: 'https://images.unsplash.com/photo-1542259659-4e0c4038b04b?auto=format&w=800&q=80' },
  { name: 'Skardu', image: 'https://images.unsplash.com/photo-1565035010268-a3816f98589a?auto=format&w=800&q=80' },
  { name: 'Deosai', image: 'https://images.unsplash.com/photo-1534068590799-09895a701e3e?auto=format&w=800&q=80' },
  { name: 'Attabad Lake', image: 'https://images.unsplash.com/photo-1562696271-0580045c26b3?auto=format&w=800&q=80' },
  { name: 'Gilgit', image: 'https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?auto=format&w=800&q=80' },
  { name: 'Naran', image: 'https://images.unsplash.com/photo-1626010448982-5d629e925539?auto=format&w=800&q=80' },
];

const HERO_IMAGE = 'https://images.unsplash.com/photo-1518182170546-0766bc6f9213?auto=format&w=800&q=80';
const HERO_HEIGHT = 240;
const EXPLORE_CARD_WIDTH = width * 0.62;

function imageForSpot(spot: AttractionSpot): string | null {
  const match = DESTINATIONS.find((d) => d.name.toLowerCase() === spot.name.toLowerCase());
  return match?.image ?? spot.imageUrl ?? null;
}

function findWeatherNumber(ctx: Record<string, any> | null | undefined): number | null {
  if (!ctx) return null;
  for (const key of ['highC', 'tempC', 'temperatureC', 'lowC']) {
    const val = ctx[key];
    if (typeof val === 'number' && Number.isFinite(val)) return val;
  }
  for (const key of Object.keys(ctx)) {
    const val = ctx[key];
    if (typeof val === 'number' && Number.isFinite(val)) return val;
  }
  return null;
}

function weatherCondition(ctx: Record<string, any> | null | undefined): string | null {
  if (!ctx) return null;
  const raw = ctx.condition ?? ctx.summary ?? ctx.description;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const text = raw.replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function dayOfTrip(trip: Trip): { current: number; total: number } | null {
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const now = new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const total = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  const diff = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const current = Math.max(1, Math.min(total, diff + 1));
  return { current, total };
}

const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);

export const HomeScreen = () => {
  const { theme } = useTheme();
  const { isLoading: authLoading } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { destination, trips, itinerary } = useTrip();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [spots, setSpots] = useState<AttractionSpot[]>([]);
  const [alerts, setAlerts] = useState<HazardAlert[]>([]);
  const [alertTotal, setAlertTotal] = useState(0);
  const [excludeList, setExcludeList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  const activeDestination = trips[trips.length - 1]?.destination || destination;
  const activeTrip = trips[trips.length - 1] || null;
  const today = itinerary?.itinerary[0];
  const weatherNumber = findWeatherNumber(today?.weatherContext);
  const condition = weatherCondition(today?.weatherContext);
  const progress = activeTrip ? dayOfTrip(activeTrip) : null;

  const load = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const [recData, hazardData, stateData] = await Promise.all([
          api.getRecommendations(activeDestination),
          api.getHazards(activeDestination),
          api.getDestinationState(),
        ]);
        setSpots(recData);
        setAlertTotal(hazardData.length);
        setAlerts(hazardData.slice(0, 2));
        setExcludeList(stateData.excludeList || []);
      } catch (e: any) {
        setError(e instanceof ApiError ? e.message : 'Unable to load home data.');
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [activeDestination]
  );

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const markState = async (spotName: string, status: 'visited' | 'dismissed') => {
    setExcludeList((prev) => Array.from(new Set([...prev, spotName])));
    try {
      await api.markDestinationState(spotName, status);
    } catch (e) {
      setExcludeList((prev) => prev.filter((n) => n !== spotName));
    }
  };

  const visibleSpots = spots.filter(
    (s) => !excludeList.some((n) => n.toLowerCase() === s.name.toLowerCase())
  );

  const heroTranslate = scrollY.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: [-110, 0, 110],
    extrapolate: 'clamp',
  });

  const heroScale = scrollY.interpolate({
    inputRange: [-220, 0],
    outputRange: [1.3, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + spacing.space2 }]}>
        <View style={styles.brandRow}>
          <Brandmark size={iconSize.lg} color={theme.colors.primary} />
          <Text style={[styles.brandName, { color: theme.colors.textPrimary }]}>RouteLink</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Alerts' as never)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={alertTotal > 0 ? `Alerts, ${alertTotal} active` : 'Alerts'}
          style={[styles.bell, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <Ionicons name="notifications-outline" size={iconSize.md} color={theme.colors.textPrimary} />
          {alertTotal > 0 && <View style={[styles.bellDot, { backgroundColor: theme.colors.danger }]} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        <View style={styles.heroSection}>
          <View style={styles.heroWrap}>
            <AnimatedImageBackground
              source={{ uri: HERO_IMAGE }}
              style={[styles.hero, { transform: [{ translateY: heroTranslate }, { scale: heroScale }] }]}
              imageStyle={styles.heroImage}
            >
              <View style={[styles.heroOverlay, { backgroundColor: theme.colors.overlayStrong }]} />
              <View style={styles.heroText}>
                <Text style={[styles.overline, { color: theme.colors.primary }]}>Current location</Text>
                <View style={styles.heroTitleRow}>
                  <Text style={styles.heroTitle} numberOfLines={1}>
                    {activeDestination}
                  </Text>
                  {weatherNumber !== null && (
                    <Text style={styles.heroTemp}>{Math.round(weatherNumber)}°C</Text>
                  )}
                </View>
                {condition && <Text style={styles.heroSubtitle}>{condition}</Text>}
              </View>
            </AnimatedImageBackground>
          </View>
        </View>

        {activeTrip && (
          <View style={styles.section}>
            <PressableCard
              style={[styles.expeditionCard, { borderColor: theme.colors.primary }]}
              onPress={() => navigation.navigate('Routes' as never)}
            >
              <View style={styles.expeditionHeader}>
                <View style={styles.expeditionHeaderLeft}>
                  <Ionicons name="compass-outline" size={iconSize.sm} color={theme.colors.primary} />
                  <Text style={[styles.overline, styles.expeditionOverline, { color: theme.colors.textSecondary }]}>
                    Active expedition
                  </Text>
                </View>
                {progress && (
                  <View style={[styles.dayPill, { backgroundColor: theme.colors.primary }]}>
                    <Text style={[styles.dayPillText, { color: theme.colors.onButtonPrimary }]}>
                      Day {progress.current} of {progress.total}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.expeditionTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                {activeTrip.title}
              </Text>
              <View style={styles.expeditionFooter}>
                <Text style={[styles.expeditionMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {activeTrip.destination} • {formatDateRange(activeTrip.startDate, activeTrip.endDate)}
                </Text>
                <Text style={[styles.link, { color: theme.colors.primary }]}>View Route</Text>
              </View>
            </PressableCard>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.actionRow}>
            <ActionButton
              icon="map-outline"
              label="Plan Route"
              theme={theme}
              onPress={() => navigation.navigate('Routes' as never)}
            />
            <ActionButton
              icon="people-outline"
              label="Find Guide"
              theme={theme}
              onPress={() => navigation.navigate('Guides' as never)}
            />
            <ActionButton
              icon="warning-outline"
              label="SOS Screen"
              theme={theme}
              danger
              onPress={() => navigation.navigate('SOS' as never)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.overline, { color: theme.colors.textSecondary }]}>Active path alerts</Text>
            {alertTotal > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('Alerts' as never)} activeOpacity={0.8}>
                <Text style={[styles.link, { color: theme.colors.secondary }]}>See All ({alertTotal})</Text>
              </TouchableOpacity>
            )}
          </View>
          {loading ? (
            <Skeleton width="100%" height={72} borderRadius={radius.lg} />
          ) : alerts.length === 0 ? (
            <Card elevated={false}>
              <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
                No active alerts for {activeDestination}.
              </Text>
            </Card>
          ) : (
            alerts.map((alert) => (
              <PressableCard
                key={alert.id}
                style={styles.alertCard}
                onPress={() => navigation.navigate('Alerts' as never)}
              >
                <View style={styles.alertRow}>
                  <StatusGlyph severity={alert.severity} size={iconSize.xl} />
                  <View style={styles.alertBody}>
                    <Text style={[styles.alertTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                      {hazardSeverityMeta[alert.severity].label} • {alert.hazardType.replace(/_/g, ' ')}
                    </Text>
                    <Text style={[styles.alertText, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                      {alert.description || alert.rawText}
                    </Text>
                  </View>
                </View>
              </PressableCard>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.overline, styles.exploreHeading, { color: theme.colors.textSecondary }]}>
            Explore {activeDestination}
          </Text>
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : error ? (
            <EmptyState
              icon="refresh-outline"
              title="Could not load"
              subtitle={error}
              actionTitle="Retry"
              onAction={onRefresh}
            />
          ) : visibleSpots.length === 0 ? (
            <EmptyState
              icon="compass-outline"
              title="No recommendations"
              subtitle="Explore a different destination or check dismissed items in Profile."
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={EXPLORE_CARD_WIDTH + spacing.space3}
              decelerationRate="fast"
              contentContainerStyle={styles.exploreRow}
            >
              {visibleSpots.map((spot) => (
                <ExploreCard
                  key={spot.id}
                  spot={spot}
                  theme={theme}
                  onDismiss={() => markState(spot.name, 'dismissed')}
                  onVisited={() => markState(spot.name, 'visited')}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const ActionButton = ({
  icon,
  label,
  theme,
  danger,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  theme: any;
  danger?: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[
      styles.actionButton,
      {
        backgroundColor: danger ? theme.colors.buttonDanger : theme.colors.surface,
        borderColor: danger ? theme.colors.buttonDanger : theme.colors.border,
      },
    ]}
    onPress={onPress}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Ionicons
      name={icon}
      size={iconSize.lg}
      color={danger ? theme.colors.onButtonDanger : theme.colors.primary}
    />
    <Text
      style={[
        styles.actionLabel,
        { color: danger ? theme.colors.onButtonDanger : theme.colors.textPrimary },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const ExploreCard = ({
  spot,
  theme,
  onDismiss,
  onVisited,
}: {
  spot: AttractionSpot;
  theme: any;
  onDismiss: () => void;
  onVisited: () => void;
}) => {
  const imageUri = imageForSpot(spot);
  return (
    <View style={[styles.exploreCard, { backgroundColor: theme.colors.surfaceSecondary }]}>
      <ImageBackground
        source={imageUri ? { uri: imageUri } : undefined}
        style={styles.exploreImage}
        imageStyle={styles.exploreImageStyle}
      >
        <View style={[styles.exploreOverlay, { backgroundColor: theme.colors.overlayWeak }]} />
        <View style={styles.exploreActions}>
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.exploreAction}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${spot.name}`}
          >
            <Ionicons name="close" size={iconSize.sm} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onVisited}
            style={styles.exploreAction}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${spot.name} visited`}
          >
            <Ionicons name="checkmark" size={iconSize.sm} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.exploreText}>
          <Text style={styles.exploreName} numberOfLines={1}>
            {spot.name}
          </Text>
          <Text style={styles.exploreLocation} numberOfLines={1}>
            {spot.location}
          </Text>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.space8,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.space4,
    paddingBottom: spacing.space3,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandName: {
    ...typography.title,
    fontWeight: '700',
    marginLeft: spacing.space2,
  },
  bell: {
    width: spacing.space8 + spacing.space1,
    height: spacing.space8 + spacing.space1,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: spacing.space2,
    right: spacing.space2,
    width: spacing.space2,
    height: spacing.space2,
    borderRadius: radius.full,
  },
  heroSection: {
    paddingHorizontal: spacing.space4,
  },
  heroWrap: {
    height: HERO_HEIGHT,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    height: HERO_HEIGHT,
    justifyContent: 'flex-end',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
  },
  heroText: {
    padding: spacing.space5,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    ...typography.displaySmall,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  heroTemp: {
    ...typography.displaySmall,
    color: '#FFFFFF',
    marginLeft: spacing.space3,
  },
  heroSubtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.space1,
  },
  overline: {
    ...typography.overline,
  },
  section: {
    marginTop: spacing.space6,
    paddingHorizontal: spacing.space4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.space3,
  },
  link: {
    ...typography.captionSemibold,
  },
  body: {
    ...typography.body,
  },
  expeditionCard: {
    borderWidth: 1,
  },
  expeditionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expeditionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  expeditionOverline: {
    marginLeft: spacing.space2,
  },
  dayPill: {
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
    borderRadius: radius.md,
  },
  dayPillText: {
    ...typography.micro,
  },
  expeditionTitle: {
    ...typography.heading,
    marginTop: spacing.space3,
  },
  expeditionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.space2,
  },
  expeditionMeta: {
    ...typography.caption,
    flexShrink: 1,
    marginRight: spacing.space2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.space2,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.space4,
  },
  actionLabel: {
    ...typography.captionSemibold,
    marginTop: spacing.space2,
    textAlign: 'center',
  },
  alertCard: {
    marginBottom: spacing.space2,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertBody: {
    flex: 1,
    marginLeft: spacing.space3,
  },
  alertTitle: {
    ...typography.bodySemibold,
    textTransform: 'capitalize',
  },
  alertText: {
    ...typography.caption,
    marginTop: 2,
  },
  exploreHeading: {
    marginBottom: spacing.space3,
  },
  exploreRow: {
    paddingRight: spacing.space4,
  },
  exploreCard: {
    width: EXPLORE_CARD_WIDTH,
    height: 190,
    marginRight: spacing.space3,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  exploreImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    padding: spacing.space3,
  },
  exploreImageStyle: {
    borderRadius: radius.xl,
    resizeMode: 'cover',
  },
  exploreOverlay: {
    ...StyleSheet.absoluteFill,
  },
  exploreActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.space2,
  },
  exploreAction: {
    width: spacing.space8,
    height: spacing.space8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,11,15,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exploreText: {
    marginTop: 'auto',
  },
  exploreName: {
    ...typography.subtitle,
    color: '#FFFFFF',
  },
  exploreLocation: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
});
