import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { api, setAuthToken } from '../services/api';
import { User } from '../types';

interface LoginScreenProps {
  onAuthenticated: (user: User, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const friendlyError = (err: any) => {
    // Raw fetch/network failures ("Failed to fetch", "Network request failed")
    // aren't useful to a traveler -- translate them into something actionable.
    const msg = err?.message || '';
    if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) {
      return "Can't reach the server. Check your connection and try again.";
    }
    return msg || 'Something went wrong. Please try again.';
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim() || (mode === 'signup' && !name.trim())) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = mode === 'signup'
        ? await api.signup(name.trim(), email.trim(), password)
        : await api.login(email.trim(), password);

      setAuthToken(response.token);
      onAuthenticated(response.user, response.token);
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>RouteLink</Text>
      <Text style={styles.subtitle}>Safe Travel Planner for Northern Pakistan</Text>

      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]}
            onPress={() => { setMode('login'); setError(null); }}
          >
            <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'signup' && styles.toggleBtnActive]}
            onPress={() => { setMode('signup'); setError(null); }}
          >
            <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {mode === 'signup' && (
          <>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} placeholder="Areeba Khan" value={name} onChangeText={setName} autoCapitalize="words" />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.buttonText}>{mode === 'signup' ? 'Create Account' : 'Log In'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#F8F9FA' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6C757D', textAlign: 'center', marginTop: 6, marginBottom: 24 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, elevation: 2 },
  toggleRow: { flexDirection: 'row', backgroundColor: '#F1F3F5', borderRadius: 8, marginBottom: 20, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#007AFF' },
  toggleText: { fontWeight: '600', color: '#495057' },
  toggleTextActive: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#343A40' },
  input: { borderWidth: 1, borderColor: '#CED4DA', borderRadius: 6, padding: 10, marginBottom: 14 },
  button: { backgroundColor: '#007AFF', padding: 12, borderRadius: 6, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  errorText: { color: '#DC2626', marginBottom: 10, fontSize: 13 },
});
