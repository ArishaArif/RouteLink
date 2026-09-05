import React, { useRef, useCallback, useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography } from '../constants/theme';

interface SOSTriggerProps {
  onActivate: () => void;
  loading?: boolean;
  holdDurationMs?: number;
  size?: number;
}

export const SOSTrigger: React.FC<SOSTriggerProps> = ({
  onActivate,
  loading = false,
  holdDurationMs = 1200,
  size = 176,
}) => {
  const { theme } = useTheme();
  const holding = useRef(false);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const start = useCallback(() => {
    if (loading) return;
    holding.current = true;
    Animated.timing(progress, {
      toValue: 1,
      duration: holdDurationMs,
      useNativeDriver: false,
    }).start();
    timer.current = setTimeout(() => {
      holding.current = false;
      progress.setValue(0);
      onActivate();
    }, holdDurationMs);
  }, [holdDurationMs, loading, onActivate, progress]);

  const cancel = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    clearTimer();
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress, clearTimer]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const outerSize = size * 1.62;
  const midSize = size * 1.3;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.ring,
          { width: outerSize, height: outerSize, borderRadius: outerSize / 2, backgroundColor: `${theme.colors.danger}1F` },
        ]}
      />
      <View
        style={[
          styles.ring,
          { width: midSize, height: midSize, borderRadius: midSize / 2, backgroundColor: `${theme.colors.danger}33` },
        ]}
      />
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: theme.colors.buttonDanger,
            shadowColor: theme.colors.buttonDanger,
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          theme.shadows.floating,
        ]}
        onPressIn={start}
        onPressOut={cancel}
        activeOpacity={1}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Hold to broadcast emergency beacon"
      >
        <Animated.View style={[styles.fill, { width }]} />
        {loading ? (
          <ActivityIndicator size="large" color="#FFFFFF" />
        ) : (
          <Text style={styles.label}>SOS</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: spacing.space4,
  },
  ring: {
    position: 'absolute',
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  label: {
    ...typography.display,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: 1,
    color: '#FFFFFF',
  },
});
