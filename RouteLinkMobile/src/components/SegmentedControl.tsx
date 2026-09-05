import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography } from '../constants/theme';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const { theme } = useTheme();
  const indicator = useRef(new Animated.Value(0)).current;

  const activeIndex = options.findIndex((o) => o.value === value);
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;

  useEffect(() => {
    Animated.spring(indicator, {
      toValue: safeIndex,
      friction: 8,
      tension: 300,
      useNativeDriver: false,
    }).start();
  }, [safeIndex]);

  const translateX = indicator.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => i * (100 / options.length) + '%'),
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceSecondary }]}>
      <Animated.View
        style={[
          styles.indicator,
          {
            width: `${100 / options.length}%`,
            backgroundColor: theme.colors.primary,
            transform: [{ translateX }],
          },
        ]}
      />
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={styles.button}
          onPress={() => onChange(option.value)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.label,
              { color: value === option.value ? theme.colors.onButtonPrimary : theme.colors.textSecondary },
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: radius.full,
    padding: spacing.space1,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: spacing.space1,
    bottom: spacing.space1,
    borderRadius: radius.full,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.space2,
    alignItems: 'center',
    zIndex: 1,
  },
  label: {
    ...typography.captionSemibold,
  },
});
