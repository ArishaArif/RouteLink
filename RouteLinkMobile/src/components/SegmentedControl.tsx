import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, LayoutChangeEvent } from 'react-native';
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
  const [segmentWidth, setSegmentWidth] = useState(0);

  const activeIndex = options.findIndex((o) => o.value === value);
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;

  useEffect(() => {
    Animated.spring(indicator, {
      toValue: safeIndex * segmentWidth,
      friction: 8,
      tension: 300,
      useNativeDriver: true,
    }).start();
  }, [safeIndex, segmentWidth]);

  const onLayout = (e: LayoutChangeEvent) => {
    const totalWidth = e.nativeEvent.layout.width;
    const padding = spacing.space1 * 2;
    const innerWidth = totalWidth - padding;
    setSegmentWidth(innerWidth / options.length);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.surfaceSecondary }]}
      onLayout={onLayout}
    >
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              backgroundColor: theme.colors.primary,
              transform: [{ translateX: indicator }],
            },
          ]}
        />
      )}
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
    left: spacing.space1,
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
