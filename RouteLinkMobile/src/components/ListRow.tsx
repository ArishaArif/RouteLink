import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography, iconSize } from '../constants/theme';

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  accessory?: 'chevron' | 'none';
  trailing?: React.ReactNode;
  iconColor?: string;
}

export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  icon,
  onPress,
  accessory = 'chevron',
  trailing,
  iconColor,
}) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      disabled={!onPress}
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceSecondary }]}>
          <Ionicons name={icon} size={iconSize.md} color={iconColor ?? theme.colors.primary} />
        </View>
      )}
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      {trailing}
      {!trailing && accessory === 'chevron' && (
        <Ionicons name="chevron-forward" size={iconSize.md} color={theme.colors.textSecondary} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.space3,
    paddingHorizontal: spacing.space4,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.space2,
  },
  iconWrap: {
    width: spacing.space8,
    height: spacing.space8,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.space3,
  },
  text: {
    flex: 1,
  },
  title: {
    ...typography.bodySemibold,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
});
