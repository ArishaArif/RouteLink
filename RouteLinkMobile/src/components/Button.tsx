import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography, iconSize, touchTarget } from '../constants/theme';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'disabled';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  const { theme } = useTheme();
  const isDisabled = variant === 'disabled' || loading || disabled;

  const backgroundColor =
    variant === 'primary' ? theme.colors.buttonPrimary :
    variant === 'destructive' ? theme.colors.buttonDanger :
    variant === 'disabled' ? theme.colors.surfaceSecondary :
    'transparent';

  const borderColor =
    variant === 'secondary' ? theme.colors.primary :
    variant === 'disabled' ? theme.colors.border :
    'transparent';

  const textColor =
    variant === 'primary' ? theme.colors.onButtonPrimary :
    variant === 'destructive' ? theme.colors.onButtonDanger :
    variant === 'disabled' ? theme.colors.textSecondary :
    variant === 'ghost' ? theme.colors.primary :
    theme.colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor,
          borderWidth: variant === 'secondary' || variant === 'disabled' ? 1 : 0,
          opacity: isDisabled ? 0.6 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={iconSize.sm} color={textColor} style={styles.icon} />}
          <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    paddingVertical: spacing.space3,
    paddingHorizontal: spacing.space5,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget,
  },
  icon: {
    marginRight: spacing.space2,
  },
  text: {
    ...typography.bodySemibold,
  },
});
