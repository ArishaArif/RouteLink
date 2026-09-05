import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { RootTabParamList, RootStackParamList } from '../types';

import { HomeScreen } from '../screens/HomeScreen';
import { TripPlannerScreen } from '../screens/TripPlannerScreen';
import { SOSScreen } from '../screens/SOSScreen';
import { MarketplaceScreen } from '../screens/MarketplaceScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AlertsScreen } from '../screens/AlertsScreen';
import { GuideDetailScreen } from '../screens/GuideDetailScreen';
import { BookingsScreen } from '../screens/BookingsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { TripsScreen } from '../screens/TripsScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          borderBottomWidth: 1,
        },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: {
          fontSize: theme.typography.title.fontSize,
          fontWeight: theme.typography.title.fontWeight,
          color: theme.colors.textPrimary,
        },
        tabBarActiveTintColor: route.name === 'SOS' ? theme.colors.buttonDanger : theme.colors.tabActive,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: theme.isDark ? 0.3 : 0.06,
          shadowRadius: 8,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'ellipse-outline';

          if (route.name === 'Explore') iconName = 'compass-outline';
          else if (route.name === 'Routes') iconName = 'calendar-outline';
          else if (route.name === 'Guides') iconName = 'people-outline';
          else if (route.name === 'Alerts') iconName = 'warning-outline';
          else if (route.name === 'SOS') iconName = 'alert-circle';
          else if (route.name === 'Profile') iconName = 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Explore" component={HomeScreen} options={{ title: 'Explore' }} />
      <Tab.Screen name="Routes" component={TripPlannerScreen} options={{ title: 'Routes' }} />
      <Tab.Screen name="Guides" component={MarketplaceScreen} options={{ title: 'Guides' }} />
      <Tab.Screen name="Alerts" component={AlertsScreen} options={{ title: 'Alerts' }} />
      <Tab.Screen
        name="SOS"
        component={SOSScreen}
        options={{ title: 'SOS', headerTintColor: theme.colors.buttonDanger }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="GuideDetail"
        component={GuideDetailScreen}
        options={{
          headerShown: true,
          presentation: 'card',
          title: 'Guide',
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: { color: theme.colors.textPrimary },
        }}
      />
      <Stack.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{
          headerShown: true,
          title: 'My Bookings',
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: { color: theme.colors.textPrimary },
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: true,
          title: 'Conversation',
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: { color: theme.colors.textPrimary },
        }}
      />
      <Stack.Screen
        name="Trips"
        component={TripsScreen}
        options={{
          headerShown: true,
          title: 'My Trips',
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: { color: theme.colors.textPrimary },
        }}
      />
    </Stack.Navigator>
  );
}
