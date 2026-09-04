import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootTabParamList } from '../types';

import HomeScreen from '../screens/HomeScreen';
import { TripPlannerScreen } from '../screens/TripPlannerScreen';
import { SOSScreen } from '../screens/SOSScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor: route.name === 'SOS' ? '#E03131' : '#0B7285',
        tabBarInactiveTintColor: '#868E96',
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'ellipse-outline';

          if (route.name === 'Home') iconName = 'compass-outline';
          else if (route.name === 'TripPlanner') iconName = 'calendar-outline';
          else if (route.name === 'SOS') iconName = 'alert-circle';
          else if (route.name === 'Marketplace') iconName = 'people-outline';
          else if (route.name === 'Profile') iconName = 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Explore' }} />
      <Tab.Screen name="TripPlanner" component={TripPlannerScreen} options={{ title: 'Planner' }} />
      <Tab.Screen name="SOS" component={SOSScreen} options={{ title: 'SOS', headerTintColor: '#C92A2A' }} />
      <Tab.Screen name="Marketplace" component={MarketplaceScreen} options={{ title: 'Guides' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}