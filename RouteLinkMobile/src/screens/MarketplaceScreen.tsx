import React, { useEffect, useState, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import { PressableCard } from '../components/PressableCard';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Avatar } from '../components/Avatar';
import { SegmentedControl } from '../components/SegmentedControl';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { api } from '../services/api';
import { Guide, RootStackParamList } from '../types';
import { formatPrice } from '../utils/display';

type GuideNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GuideDetail'>;

const LANGUAGE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'English', label: 'English' },
  { value: 'Urdu', label: 'Urdu' },
  { value: 'Chinese', label: 'Chinese' },
];

export const MarketplaceScreen = () => {
  const { theme } = useTheme();
  const { isLoading: authLoading } = useAuth();
  const { trips } = useTrip();
  const navigation = useNavigation<GuideNavigationProp>();
  const activeRegion = trips[trips.length - 1]?.destination;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'priceAsc' | 'priceDesc'>('priceAsc');
  const [language, setLanguage] = useState<string>('all');

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.getGuides(
        activeRegion,
        language === 'all' ? undefined : language
      );
      setGuides(data);
      setError(null);
    } catch (e) {
      setError('Unable to load guides. Pull down to retry.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, activeRegion, language]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const copy = guides.filter((g) => {
      if (!query) return true;
      return (
        g.name.toLowerCase().includes(query) ||
        g.region.toLowerCase().includes(query) ||
        (g.bio || '').toLowerCase().includes(query)
      );
    });
    copy.sort((a, b) => (sort === 'priceAsc' ? a.pricePerDay - b.pricePerDay : b.pricePerDay - a.pricePerDay));
    return copy;
  }, [guides, search, sort]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Guides</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {activeRegion ? `Guides in and around ${activeRegion}` : 'Local guides across regions'}
        </Text>
      </View>

      <View style={styles.section}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, region, or bio"
          autoCapitalize="none"
        />
        <View style={styles.filters}>
          <SegmentedControl
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={(v) => setLanguage(v)}
          />
        </View>
        <View style={styles.sortRow}>
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
            {filtered.length} {filtered.length === 1 ? 'guide' : 'guides'}
          </Text>
          <TouchableOpacity
            style={[styles.sortButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
            onPress={() => setSort((s) => (s === 'priceAsc' ? 'priceDesc' : 'priceAsc'))}
            activeOpacity={0.7}
          >
            <Text style={[styles.body, { color: theme.colors.primary }]}>
              Price {sort === 'priceAsc' ? 'low–high' : 'high–low'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <EmptyState icon="refresh-outline" title="Could not load guides" subtitle={error} actionTitle="Retry" onAction={onRefresh} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="people-outline" title="No guides found" subtitle="Try a different search or language filter." />
        ) : (
          filtered.map((guide) => (
            <GuideCard
              key={guide.id}
              guide={guide}
              onPress={() => navigation.navigate('GuideDetail', { guideId: guide.id })}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
};

const GuideCard = ({ guide, onPress }: { guide: Guide; onPress: () => void }) => {
  const { theme } = useTheme();
  const languages = (guide.languages || []).slice(0, 3);

  return (
    <PressableCard style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        <Avatar name={guide.name} size={48} />
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: theme.colors.textPrimary }]}>{guide.name}</Text>
          <Text style={[styles.region, { color: theme.colors.textSecondary }]}>
            <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} /> {guide.region}
          </Text>
        </View>
        <Text style={[styles.price, { color: theme.colors.buttonPrimary }]}>{formatPrice(guide.pricePerDay)}</Text>
      </View>

      <Text style={[styles.bio, { color: theme.colors.textSecondary }]} numberOfLines={3}>
        {guide.bio || 'Local guide with regional knowledge.'}
      </Text>

      <View style={styles.chips}>
        {languages.map((lang) => (
          <View key={lang} style={[styles.chip, { backgroundColor: theme.colors.surfaceSecondary }]}>
            <Text style={[styles.chipText, { color: theme.colors.textSecondary }]}>{lang}</Text>
          </View>
        ))}
      </View>

      <Button title="View profile" variant="secondary" style={{ marginTop: 12 }} onPress={onPress} />
    </PressableCard>
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
  filters: {
    marginTop: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  sortButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  card: {
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  region: {
    fontSize: 13,
    marginTop: 2,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
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
});
