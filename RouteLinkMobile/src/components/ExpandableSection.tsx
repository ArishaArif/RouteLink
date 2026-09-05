import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography, iconSize } from '../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ExpandableSectionProps {
  title: string;
  children: React.ReactNode;
  initialExpanded?: boolean;
  maxCollapsedHeight?: number;
}

export const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  title,
  children,
  initialExpanded = false,
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(initialExpanded);
  const rotate = useRef(new Animated.Value(initialExpanded ? 1 : 0)).current;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !expanded;
    setExpanded(next);
    Animated.spring(rotate, {
      toValue: next ? 1 : 0,
      friction: 6,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons name="chevron-down" size={iconSize.md} color={theme.colors.textSecondary} />
        </Animated.View>
      </TouchableOpacity>
      {expanded && <View style={styles.body}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.space4,
  },
  title: {
    ...typography.bodySemibold,
  },
  body: {
    paddingHorizontal: spacing.space4,
    paddingBottom: spacing.space4,
  },
});
