import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { HeatTier, SlotType, HazardSeverity } from '../types';
import { heatTierMeta, slotTypeMeta, hazardSeverityMeta, bookingStatusMeta, heatTierColor } from '../utils/display';
import { spacing, radius, typography, iconSize } from '../constants/theme';

type BadgeTone = 'default' | 'heatRamp';

type BadgeType =
  | { kind: 'heat'; value: HeatTier }
  | { kind: 'slot'; value: SlotType }
  | { kind: 'severity'; value: HazardSeverity }
  | { kind: 'booking'; value: 'requested' | 'confirmed' | 'cancelled' | 'completed' };

interface BadgeProps {
  badge: BadgeType;
  tone?: BadgeTone;
}

export const Badge: React.FC<BadgeProps> = ({ badge, tone = 'default' }) => {
  const { theme } = useTheme();

  if (badge.kind === 'heat') {
    const meta = heatTierMeta[badge.value];
    const color = tone === 'heatRamp' ? heatTierColor(badge.value) : theme.colors.primarySoftText;
    const bg = tone === 'heatRamp' ? `${heatTierColor(badge.value)}26` : 'rgba(29, 158, 117, 0.15)';
    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Ionicons name={meta.icon} size={iconSize.xs} color={color} />
        <Text style={[styles.text, { color }]}>{meta.label}</Text>
      </View>
    );
  }

  if (badge.kind === 'slot') {
    const meta = slotTypeMeta[badge.value];
    return (
      <View style={[styles.badge, { backgroundColor: theme.colors.surfaceSecondary }]}>
        <Ionicons name={meta.icon} size={iconSize.xs} color={theme.colors.textSecondary} />
        <Text style={[styles.text, { color: theme.colors.textSecondary }]}>{meta.label}</Text>
      </View>
    );
  }

  if (badge.kind === 'severity') {
    const meta = hazardSeverityMeta[badge.value];
    const softText =
      badge.value === 'low'
        ? theme.colors.primarySoftText
        : badge.value === 'medium'
        ? theme.colors.secondarySoftText
        : theme.colors.dangerSoftText;
    return (
      <View style={[styles.badge, { backgroundColor: meta.softColor }]}>
        <Ionicons name={meta.icon} size={iconSize.xs} color={softText} />
        <Text style={[styles.text, { color: softText }]}>{meta.label}</Text>
      </View>
    );
  }

  const meta = bookingStatusMeta[badge.value];
  const softText =
    badge.value === 'requested'
      ? theme.colors.infoSoftText
      : badge.value === 'confirmed'
      ? theme.colors.primarySoftText
      : badge.value === 'cancelled'
      ? theme.colors.dangerSoftText
      : theme.colors.secondarySoftText;
  return (
    <View style={[styles.badge, { backgroundColor: meta.softColor }]}>
      <Ionicons name={meta.icon} size={iconSize.xs} color={softText} />
      <Text style={[styles.text, { color: softText }]}>{meta.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.micro,
    marginLeft: spacing.space1,
  },
});
