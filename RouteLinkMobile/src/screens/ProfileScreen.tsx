import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ListRow } from '../components/ListRow';
import { Skeleton } from '../components/Skeleton';
import { api } from '../services/api';
import { DestinationState } from '../types';

export const ProfileScreen = () => {
  const { theme, toggle, isDark } = useTheme();
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const [state, setState] = useState<DestinationState | null>(null);
  const [stateLoading, setStateLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getDestinationState()
      .then((data) => {
        if (cancelled) return;
        setState(data);
      })
      .catch(() => {
        if (cancelled) return;
        setState({ excludeList: [], destinationState: [] });
      })
      .finally(() => setStateLoading(false));
    return () => { cancelled = true; };
  }, []);

  const rows = state?.destinationState || [];
  const visited = rows.filter((row) => row.status === 'visited').map((row) => row.destinationName);
  const dismissed = rows.filter((row) => row.status === 'dismissed').map((row) => row.destinationName);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceSecondary }]}>
          <Ionicons name="person" size={32} color={theme.colors.primary} />
        </View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {user ? user.name : 'Traveler'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {user ? user.email : 'Not signed in'}
        </Text>
      </View>

      <View style={styles.section}>
        <ListRow
          title="My Trips"
          subtitle="Manage your expeditions"
          icon="map-outline"
          onPress={() => navigation.navigate('Trips' as never)}
        />
        <ListRow
          title="My Bookings"
          subtitle="Guides you've booked"
          icon="calendar-outline"
          onPress={() => navigation.navigate('Bookings' as never)}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Visited & Dismissed</Text>
        {stateLoading ? (
          <Skeleton width="100%" height={80} />
        ) : (
          <Card elevated={false}>
            <StateList label="Visited" items={visited} theme={theme} icon="checkmark-circle" />
            <StateList label="Dismissed" items={dismissed} theme={theme} icon="close-circle" />
            <StateList label="Excluded" items={state?.excludeList || []} theme={theme} icon="eye-off" />
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <Card elevated={false}>
          <View style={styles.settingRow}>
            <Text style={[styles.body, { color: theme.colors.textPrimary }]}>Dark mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggle}
              trackColor={{ false: theme.colors.surfaceSecondary, true: theme.colors.primary }}
              thumbColor={theme.colors.onPrimary}
            />
          </View>
        </Card>
      </View>

      <View style={[styles.section, { marginBottom: 32 }]}>
        <Button title="Sign out" variant="destructive" icon="log-out-outline" onPress={logout} />
      </View>
    </ScrollView>
  );
};

const StateList = ({
  label,
  items,
  theme,
  icon,
}: {
  label: string;
  items: string[];
  theme: any;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) => (
  <View style={styles.stateGroup}>
    <Text style={[styles.stateLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
    {items.length === 0 ? (
      <Text style={[styles.stateEmpty, { color: theme.colors.textSecondary }]}>None yet</Text>
    ) : (
      <View style={styles.chips}>
        {items.map((item) => (
          <View key={item} style={[styles.chip, { backgroundColor: theme.colors.surfaceSecondary }]}>
            <Ionicons name={icon} size={12} color={theme.colors.primary} />
            <Text style={[styles.chipText, { color: theme.colors.textPrimary }]}>{item}</Text>
          </View>
        ))}
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stateGroup: {
    marginBottom: 16,
  },
  stateLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stateEmpty: {
    fontSize: 13,
    marginTop: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
