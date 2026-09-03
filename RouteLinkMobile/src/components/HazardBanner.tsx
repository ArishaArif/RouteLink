import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { HazardAlert } from '../types';
import { api } from '../services/api';

interface HazardBannerProps {
  region?: string;
}

export const HazardBanner: React.FC<HazardBannerProps> = ({ region }) => {
  const [hazards, setHazards] = useState<HazardAlert[]>([]);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHazards();
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
    }
  };

  if (!visible) return null;
  if (loading) return <ActivityIndicator size="small" color="#F59E0B" style={styles.loader} />;
  if (hazards.length === 0) return null;

  const topHazard = hazards[0];
  const isCritical = topHazard.severity === 'high' || topHazard.severity === 'critical';

  return (
    <View style={[styles.container, isCritical ? styles.criticalBg : styles.warningBg]}>
      <View style={styles.content}>
        <Text style={styles.title}>
          ⚠️ {topHazard.severity.toUpperCase()} HAZARD ALERT: {topHazard.region}
        </Text>
        <Text style={styles.description}>{topHazard.description}</Text>
      </View>
      <TouchableOpacity style={styles.dismissBtn} onPress={() => setVisible(false)}>
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  criticalBg: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#EF4444' },
  warningBg: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' },
  content: { flex: 1, marginRight: 8 },
  title: { fontSize: 13, fontWeight: 'bold', color: '#991B1B', marginBottom: 2 },
  description: { fontSize: 12, color: '#7F1D1D', lineHeight: 16 },
  dismissBtn: { padding: 4 },
  dismissText: { fontSize: 16, color: '#991B1B', fontWeight: 'bold' },
  loader: { marginTop: 10, alignSelf: 'center' },
});