import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface AvatarProps {
  name: string;
  size?: number;
  style?: any;
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 48, style }) => {
  const { theme } = useTheme();
  const fontSize = size * 0.42;
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.surfaceSecondary,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: theme.colors.primary, fontSize }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
  },
});
