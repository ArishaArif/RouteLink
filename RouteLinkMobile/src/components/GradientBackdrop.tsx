import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../constants/theme';

interface GradientBackdropProps {
  variant?: 'primary' | 'danger';
  style?: ViewStyle;
}

export const GradientBackdrop: React.FC<GradientBackdropProps> = ({ variant = 'primary', style }) => {
  const { theme } = useTheme();
  const color = variant === 'danger' ? theme.colors.danger : theme.colors.primary;

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <View
        style={[
          styles.blob,
          styles.blobTop,
          { backgroundColor: color, opacity: theme.isDark ? 0.12 : 0.08 },
        ]}
      />
      <View
        style={[
          styles.blob,
          styles.blobMid,
          { backgroundColor: color, opacity: theme.isDark ? 0.08 : 0.05 },
        ]}
      />
      <View
        style={[
          styles.blob,
          styles.blobBottom,
          { backgroundColor: theme.colors.secondary, opacity: theme.isDark ? 0.06 : 0.04 },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: radius.full,
    width: 400,
    height: 400,
  },
  blobTop: {
    top: -120,
    right: -120,
  },
  blobMid: {
    top: '30%',
    left: -160,
  },
  blobBottom: {
    bottom: -140,
    right: -80,
  },
});
