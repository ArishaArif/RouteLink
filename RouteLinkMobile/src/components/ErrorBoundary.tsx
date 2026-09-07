import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  /** Optional fallback UI. Defaults to the built-in error card. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors in child components and shows a retry card
 * instead of crashing the entire app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeScreen />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production you'd send this to Sentry / Bugsnag / etc.
    if (__DEV__) {
      console.error('[ErrorBoundary]', error.message, info.componentStack);
    }
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorCard error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function ErrorCard({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message} numberOfLines={4}>
        {error?.message || 'An unexpected error occurred.'}
      </Text>
      <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.8}>
        <Ionicons name="refresh-outline" size={18} color="#fff" />
        <Text style={styles.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
  },
  message: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
