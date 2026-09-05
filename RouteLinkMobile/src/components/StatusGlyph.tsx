import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HazardSeverity } from '../types';
import { hazardSeverityMeta } from '../utils/display';
import { radius } from '../constants/theme';

interface StatusGlyphProps {
  severity: HazardSeverity;
  size?: number;
}

export const StatusGlyph: React.FC<StatusGlyphProps> = ({ severity, size = 32 }) => {
  const meta = hazardSeverityMeta[severity];
  const glyphSize = size * 0.55;

  if (meta.shape === 'triangle') {
    return (
      <View
        style={[styles.wrap, { width: size, height: size }]}
        accessibilityRole="image"
        accessibilityLabel={meta.label}
      >
        <View
          style={[
            styles.triangle,
            {
              borderLeftWidth: size / 2,
              borderRightWidth: size / 2,
              borderBottomWidth: size * 0.86,
              borderBottomColor: meta.color,
            },
          ]}
        />
        <Ionicons name="alert" size={glyphSize * 0.72} color="#1B1F24" style={styles.triangleIcon} />
      </View>
    );
  }

  const isOctagon = meta.shape === 'octagon';

  return (
    <View
      style={[
        styles.wrap,
        styles.solid,
        {
          width: size,
          height: size,
          borderRadius: isOctagon ? size * 0.3 : radius.full,
          backgroundColor: meta.color,
          transform: isOctagon ? [{ rotate: '22.5deg' }] : undefined,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={meta.label}
    >
      <Ionicons
        name={isOctagon ? 'close' : 'checkmark'}
        size={glyphSize}
        color="#FFFFFF"
        style={isOctagon ? styles.octagonIcon : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  solid: {
    overflow: 'hidden',
  },
  triangle: {
    position: 'absolute',
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderStyle: 'solid',
  },
  triangleIcon: {
    position: 'absolute',
    bottom: '14%',
  },
  octagonIcon: {
    transform: [{ rotate: '-22.5deg' }],
  },
});
