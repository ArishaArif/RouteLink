import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { HeatTier } from '../types';
import { heatTierColor } from '../utils/display';
import { spacing, radius, typography } from '../constants/theme';

interface HeatBarRowProps {
  tiers: (HeatTier | null | undefined)[];
  labels?: string[];
  maxHeight?: number;
}

export const HeatBarRow: React.FC<HeatBarRowProps> = ({ tiers, labels, maxHeight = 88 }) => {
  const { theme } = useTheme();
  const animatedValues = useRef(tiers.map(() => new Animated.Value(0))).current;

  function heightForTier(tier: HeatTier | null | undefined): number {
    if (!tier) return maxHeight * 0.3;
    const ratios: Record<HeatTier, number> = { cool: 0.3, mild: 0.45, warm: 0.65, hot: 0.85, extreme: 1 };
    return maxHeight * ratios[tier];
  }

  useEffect(() => {
    const animations = animatedValues.map((val, i) =>
      Animated.timing(val, {
        toValue: heightForTier(tiers[i]),
        duration: 500,
        delay: i * 80,
        useNativeDriver: false,
      })
    );
    Animated.parallel(animations).start();
  }, [tiers]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      {tiers.map((tier, i) => (
        <View key={i} style={styles.barWrap}>
          <Animated.View
            style={[
              styles.bar,
              {
                height: animatedValues[i],
                backgroundColor: heatTierColor(tier),
                opacity: tier ? 1 : 0.35,
              },
            ]}
          />
          {labels?.[i] ? (
            <Text numberOfLines={1} style={[styles.label, { color: theme.colors.textSecondary }]}>
              {labels[i]}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.space4,
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: spacing.space1,
  },
  bar: {
    width: '62%',
    borderRadius: radius.sm,
    minHeight: spacing.space1,
  },
  label: {
    ...typography.overline,
    fontSize: 9,
    letterSpacing: 0.2,
    marginTop: spacing.space2,
  },
});
