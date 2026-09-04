import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HazardAlert } from '../types';
import { api } from '../services/api';
import { colors, radius, spacing } from '../theme';

interface HazardBannerProps {
  region?: string;
}

export const HazardBanner: React.FC<HazardBannerProps> = ({ region }) => {
  const [hazards, setHazards] = useState<HazardAlert[]>([]);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    // Debounced: `region` here is the trip destination as it's being typed
    // (see App.tsx), so without this every keystroke fired a real network
    // request and flipped the banner to a loading spinner.
    const timer = setTimeout(() => {
      fetchHazards();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  const fetchHazards = async () => {
    try {
      setLoading(true);
      const data = await api.getHazards(region);
      setHazards(data);
    } catch (err) {
      // Mock hazard data removed. Banner will gracefully hide on failure.
      setHazards([]);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  };

  if (!visible) return null;
  // Only show the spinner on the very first load -- on later refetches
  // (destination changed) keep showing the last known banner instead of
  // blanking it out, so it doesn't visually "flicker" while typing settles.
  if (loading && !hasLoadedOnce) return <ActivityIndicator size="small" color={colors.clay} style={styles.loader} />;
  if (hazards.length === 0) return null;

  const topHazard = hazards[0];
  const isCritical = topHazard.severity === 'high' || topHazard.severity === 'critical';
  const accent = isCritical ? colors.critical : colors.warning;
  const bg = isCritical ? colors.criticalBg : colors.warningBg;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.rail, { backgroundColor: accent }]} />
      <Ionicons
        name={isCritical ? 'warning' : 'alert-circle-outline'}
        size={16}
        color={accent}
        style={styles.icon}
      />
      <View style={styles.content}>
        <Text style={[styles.title, { color: accent }]} numberOfLines={1}>
          {topHazard.severity.toUpperCase()} · {topHazard.region}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {topHazard.description}
        </Text>
      </View>
      <TouchableOpacity style={styles.dismissBtn} onPress={() => setVisible(false)} hitSlop={8}>
        <Ionicons name="close" size={16} color={colors.inkMuted} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    overflow: 'hidden',
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  rail: { width: 4, alignSelf: 'stretch', marginRight: spacing.sm },
  icon: { marginRight: spacing.xs },
  content: { flex: 1, marginRight: spacing.xs },
  title: { fontSize: 12, fontWeight: '700', marginBottom: 1, letterSpacing: 0.2 },
  description: { fontSize: 12, color: colors.inkMuted, lineHeight: 16 },
  dismissBtn: { padding: 4 },
  loader: { marginTop: spacing.sm, alignSelf: 'center' },
});
