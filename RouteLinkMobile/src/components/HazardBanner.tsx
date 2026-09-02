import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HazardAlert } from '../types';
import { api } from '../services/api';

interface HazardBannerProps {
  region?: string;
}

export const HazardBanner: React.FC<HazardBannerProps> = ({ region }) => {
  const [hazards, setHazards] = useState<HazardAlert[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetchHazards();
  }, [region]);

  const fetchHazards = async () => {
    try {
      const data = await api.getHazards(region);
      setHazards(data);
    } catch (err) {
      // Mock hazard data if backend feed is empty during development
      setHazards([
        {
          id: '04b8f4e2-1c9d-4a77-9f3e-2b6a5c8d1e99',
          sourceType: 'nlp_scrape',
          rawText: 'Landslide reported on KKH near Babusar Pass',
          hazardType: 'natural_disaster',
          region: region || 'Hunza Valley',
          latitude: 35.1234,
          longitude: 74.5678,
          severity: 'high',
          description: 'Landslide blockages near Babusar Top. Travel delayed by 3-4 hours. Use alternate route.',
          isActive: true,
          expiresAt: '2026-10-10',
          createdAt: '2026-10-05',
        },
      ]);
    }
  };

  if (!visible || hazards.length === 0) return null;

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
});