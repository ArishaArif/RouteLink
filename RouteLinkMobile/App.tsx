import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { TripProvider } from './src/context/TripContext';
import { HazardBanner } from './src/components/HazardBanner';
import { TripPlannerScreen } from './src/screens/TripPlannerScreen';
import { GuideMarketplaceScreen } from './src/screens/GuideMarketplaceScreen';
import { BookingChatScreen } from './src/screens/BookingChatScreen';
import { SOSScreen } from './src/screens/SOSScreen';

type TabType = 'planner' | 'guides' | 'chat' | 'sos';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('planner');

  return (
    <SafeAreaProvider>
      <TripProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          
          {/* Active Hazard Banner display at app top level */}
          <HazardBanner region="Hunza Valley" />

          {/* Tab Navigation Headers */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'planner' && styles.activeTab]}
              onPress={() => setActiveTab('planner')}
            >
              <Text style={[styles.tabText, activeTab === 'planner' && styles.activeTabText]}>🗺️ Planner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'guides' && styles.activeTab]}
              onPress={() => setActiveTab('guides')}
            >
              <Text style={[styles.tabText, activeTab === 'guides' && styles.activeTabText]}>👤 Guides</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'chat' && styles.activeTab]}
              onPress={() => setActiveTab('chat')}
            >
              <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>💬 Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'sos' && styles.sosTab]}
              onPress={() => setActiveTab('sos')}
            >
              <Text style={[styles.tabText, styles.sosTabText]}>🚨 SOS</Text>
            </TouchableOpacity>
          </View>

          {/* Active Screen View */}
          <View style={styles.screenContainer}>
            {activeTab === 'planner' && <TripPlannerScreen />}
            {activeTab === 'guides' && <GuideMarketplaceScreen />}
            {activeTab === 'chat' && <BookingChatScreen />}
            {activeTab === 'sos' && <SOSScreen />}
          </View>
        </SafeAreaView>
      </TripProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    marginHorizontal: 2,
  },
  activeTab: { backgroundColor: '#E0F2FE' },
  sosTab: { backgroundColor: '#FEE2E2' },
  tabText: { fontSize: 11, fontWeight: '600', color: '#4B5563' },
  activeTabText: { color: '#0284C7', fontWeight: 'bold' },
  sosTabText: { color: '#DC2626', fontWeight: 'bold' },
  screenContainer: { flex: 1 },
});