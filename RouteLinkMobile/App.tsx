import React, { useRef, useState, useCallback } from 'react';
import { StatusBar, View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { TripProvider } from './src/context/TripContext';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthScreen } from './src/screens/AuthScreen';

function getActiveRouteName(state: any): string {
  if (!state?.routes) return '';
  const route = state.routes[state.index ?? 0];
  if (route.state) return getActiveRouteName(route.state);
  return route.name;
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />;
}

function AppRoot() {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const [currentRoute, setCurrentRoute] = useState('Explore');

  const onStateChange = useCallback(() => {
    const state = navigationRef.current?.getRootState?.();
    if (state) setCurrentRoute(getActiveRouteName(state));
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loader, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onStateChange={onStateChange}>
      <ThemedStatusBar />
      {user ? <RootNavigator currentRoute={currentRoute} /> : <AuthScreen />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <TripProvider>
            <AppRoot />
          </TripProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
