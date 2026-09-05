import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography, touchTarget } from '../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  containerStyle?: ViewStyle;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, containerStyle, error, ...rest }) => {
  const { theme } = useTheme();
  return (
    <View style={containerStyle}>
      {label && <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surfaceSecondary,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            color: theme.colors.textPrimary,
          },
        ]}
        placeholderTextColor={theme.colors.textSecondary}
        {...rest}
      />
      {error && <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    ...typography.overline,
    marginBottom: spacing.space2,
  },
  input: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.space4,
    paddingVertical: spacing.space3,
    ...typography.body,
    minHeight: touchTarget,
  },
  error: {
    ...typography.micro,
    fontWeight: '400',
    marginTop: spacing.space1,
  },
});
