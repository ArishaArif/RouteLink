import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius } from '../constants/theme';

type DimensionValueString = `${number}%` | 'auto';

interface SkeletonProps {
  width?: number | DimensionValueString;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = spacing.space4,
  borderRadius = radius.md,
  style,
}) => {
  const { theme } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surfaceSecondary,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            transform: [
              { skewX: '-20deg' },
              {
                translateX: shimmer.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-300, 300],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
};

export const SkeletonCard: React.FC = () => {
  return (
    <View style={styles.card}>
      <Skeleton width="100%" height={140} borderRadius={radius.lg} />
      <Skeleton width="60%" height={spacing.space5} style={styles.line1} />
      <Skeleton width="40%" height={spacing.space4} style={styles.line2} />
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  shimmer: {
    width: 100,
    height: '200%',
  },
  card: {
    marginBottom: spacing.space4,
  },
  line1: {
    marginTop: spacing.space3,
  },
  line2: {
    marginTop: spacing.space2,
  },
});
