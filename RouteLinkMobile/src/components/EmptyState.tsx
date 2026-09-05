import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Button } from './Button';
import { spacing, radius, typography, iconSize } from '../constants/theme';

interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'information-circle-outline',
  title,
  subtitle,
  actionTitle,
  onAction,
  style,
}) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, style]}>
      <Ionicons name={icon} size={iconSize.xl} color={theme.colors.textSecondary} />
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>}
      {actionTitle && onAction && (
        <Button title={actionTitle} variant="secondary" onPress={onAction} style={styles.action} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.space6,
    borderRadius: radius.lg,
  },
  title: {
    ...typography.bodySemibold,
    marginTop: spacing.space3,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.space1,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.space4,
  },
});
