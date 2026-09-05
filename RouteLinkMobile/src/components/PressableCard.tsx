import React, { useRef } from 'react';
import { TouchableOpacity, Animated, ViewStyle, StyleProp } from 'react-native';
import { Card } from './Card';

interface PressableCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  activeScale?: number;
}

export const PressableCard: React.FC<PressableCardProps> = ({
  children,
  onPress,
  style,
  elevated = true,
  activeScale = 0.98,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: activeScale,
      friction: 5,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={!onPress}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Card style={style} elevated={elevated}>
          {children}
        </Card>
      </Animated.View>
    </TouchableOpacity>
  );
};
