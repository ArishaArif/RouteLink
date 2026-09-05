import React from 'react';
import { View, StyleSheet } from 'react-native';

interface BrandmarkProps {
  size?: number;
  color: string;
}

export const Brandmark: React.FC<BrandmarkProps> = ({ size = 24, color }) => {
  const mainWidth = size * 0.66;
  const mainHeight = size * 0.74;
  const minorWidth = size * 0.46;
  const minorHeight = size * 0.5;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="RouteLink"
    >
      <View
        style={[
          styles.peak,
          {
            right: 0,
            borderLeftWidth: minorWidth / 2,
            borderRightWidth: minorWidth / 2,
            borderBottomWidth: minorHeight,
            borderBottomColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.peak,
          {
            left: 0,
            borderLeftWidth: mainWidth / 2,
            borderRightWidth: mainWidth / 2,
            borderBottomWidth: mainHeight,
            borderBottomColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-end',
    position: 'relative',
  },
  peak: {
    position: 'absolute',
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderStyle: 'solid',
  },
});
