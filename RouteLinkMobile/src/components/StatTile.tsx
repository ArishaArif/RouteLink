import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography } from '../constants/theme';

interface StatTileProps {
  label: string;
  value: string;
  accent?: string;
  valueFirst?: boolean;
}

export const StatTile: React.FC<StatTileProps> = ({ label, value, accent, valueFirst = false }) => {
  const { theme } = useTheme();
  const labelNode = (
    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
  );
  const valueNode = (
    <Text style={[styles.value, valueFirst ? null : styles.valueSpaced, { color: accent ?? theme.colors.textPrimary }]}>
      {value}
    </Text>
  );

  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      {valueFirst ? valueNode : labelNode}
      {valueFirst ? <View style={styles.gap} /> : null}
      {valueFirst ? labelNode : valueNode}
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.space3,
    alignItems: 'center',
  },
  label: {
    ...typography.overline,
  },
  value: {
    ...typography.heading,
    fontWeight: '700',
  },
  valueSpaced: {
    marginTop: spacing.space1,
  },
  gap: {
    height: spacing.space1,
  },
});
