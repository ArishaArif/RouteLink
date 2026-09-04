import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { TripProvider, useTrip } from './src/context/TripContext';
import { HazardBanner } from './src/components/HazardBanner';
import { TripPlannerScreen } from './src/screens/TripPlannerScreen';
import { GuideMarketplaceScreen } from './src/screens/GuideMarketplaceScreen';
import { BookingChatScreen } from './src/screens/BookingChatScreen';
import { SOSScreen } from './src/screens/SOSScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { setAuthToken } from './src/services/api';
import { User } from './src/types';

type TabType = 'planner' | 'guides' | 'chat' | 'sos';

interface ActiveBooking {
  bookingId: string;
  guideName: string;
}

// Rendered inside TripProvider so it can read the current trip's destination
// (needed for the hazard banner) and pass real auth/booking state down to
// the tabs that need it.
function AppContent({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { destination } = useTrip();
  const [activeTab, setActiveTab] = useState<TabType>('planner');
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);

  const handleBooked = (bookingId: string, guideName: string) => {
    setActiveBooking({ bookingId, guideName });
    setActiveTab('chat');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Hazard banner now follows the traveler's actual planned destination
          instead of being hardcoded to Hunza Valley -- falls back to a
          sensible default region only if no trip has been planned yet. */}
      <HazardBanner region={destination || 'Hunza Valley'} />

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

      <View style={styles.screenContainer}>
        {activeTab === 'planner' && <TripPlannerScreen />}
        {activeTab === 'guides' && <GuideMarketplaceScreen onBooked={handleBooked} />}
        {activeTab === 'chat' && (
          <BookingChatScreen
            bookingId={activeBooking?.bookingId ?? null}
            guideName={activeBooking?.guideName ?? null}
            myUserId={user.id}
          />
        )}
        {activeTab === 'sos' && <SOSScreen />}
      </View>

      <TouchableOpacity style={styles.logoutBar} onPress={onLogout}>
        <Text style={styles.logoutText}>Log out ({user.name})</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  const handleAuthenticated = (authedUser: User) => {
    setUser(authedUser);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <SafeAreaProvider>
      <TripProvider>
        {user ? (
          <AppContent user={user} onLogout={handleLogout} />
        ) : (
          <LoginScreen onAuthenticated={handleAuthenticated} />
        )}
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
  logoutBar: { padding: 10, alignItems: 'center', backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  logoutText: { fontSize: 12, color: '#6B7280' },
});
