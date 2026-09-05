import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GradientBackdrop } from '../components/GradientBackdrop';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { ApiError } from '../services/api';

export const AuthScreen = () => {
  const { theme } = useTheme();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(nameAnim, {
      toValue: mode === 'signup' ? 1 : 0,
      friction: 9,
      tension: 260,
      useNativeDriver: true,
    }).start();
  }, [mode]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
    } catch (e: any) {
      let message = e instanceof ApiError ? e.message : 'Authentication failed. Please try again.';
      if (e instanceof ApiError && e.details.length > 0) {
        message = e.details.map((d: any) => (typeof d === 'string' ? d : d.message || JSON.stringify(d))).join('\n');
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isValid =
    email.includes('@') && password.length >= 8 && (mode === 'login' || name.trim().length > 0);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <GradientBackdrop />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: theme.colors.buttonPrimary }]}>
            <Ionicons name="navigate" size={32} color={theme.colors.onButtonPrimary} />
          </View>
          <Text style={[styles.brandTitle, { color: theme.colors.textPrimary }]}>RouteLink</Text>
          <Text style={[styles.brandSubtitle, { color: theme.colors.textSecondary }]}>
            Plan safer trips across Northern Pakistan.
          </Text>
        </View>

        <Card>
          <View style={styles.tabRow}>
            <Button
              title="Sign in"
              variant={mode === 'login' ? 'primary' : 'ghost'}
              onPress={() => setMode('login')}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title="Create account"
              variant={mode === 'signup' ? 'primary' : 'ghost'}
              onPress={() => setMode('signup')}
              style={{ flex: 1 }}
            />
          </View>

          <Animated.View
            style={{
              transform: [
                {
                  translateX: nameAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
              opacity: nameAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
            }}
          >
            {mode === 'signup' && (
              <Input
                label="Name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                containerStyle={{ marginTop: 16 }}
              />
            )}
          </Animated.View>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            containerStyle={{ marginTop: 16 }}
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            containerStyle={{ marginTop: 16 }}
          />
          <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
            Password must be at least 8 characters.
          </Text>

          {error && (
            <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
          )}

          <Button
            title={mode === 'login' ? 'Sign in' : 'Create account'}
            loading={loading}
            onPress={handleSubmit}
            disabled={!isValid}
            style={{ marginTop: 20 }}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
});
