import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity, Clipboard, Share, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useTrip } from '../context/TripContext';
import { GradientBackdrop } from '../components/GradientBackdrop';
import { Card } from '../components/Card';
import { SOSTrigger } from '../components/SOSTrigger';
import { Skeleton } from '../components/Skeleton';
import { api } from '../services/api';
import { formatDistance } from '../utils/display';
import { spacing, radius, typography, iconSize } from '../constants/theme';

const STATIC_EMERGENCY = [
  { label: 'Police', number: '15' },
  { label: 'Ambulance', number: '1122' },
  { label: 'NDMA Helpline', number: '1700' },
];

export const SOSScreen = () => {
  const { theme } = useTheme();
  const { coords } = useTrip();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [nearest, setNearest] = useState<{
    mocked: boolean;
    services: { name: string; category: string; phone: string; distanceKm: number; latitude: number; longitude: number }[];
    emergencyNumbers: { label: string; number: string }[];
  } | null>(null);
  const [sosResult, setSosResult] = useState<{ triggeredAt: string; persisted: boolean } | null>(null);
  const [passiveLoading, setPassiveLoading] = useState(true);

  useEffect(() => {
    if (!coords) {
      setPassiveLoading(false);
      return;
    }
    let cancelled = false;
    setPassiveLoading(true);
    api.getNearestServices(coords.lat, coords.lng, 50000)
      .then((data) => {
        if (cancelled) return;
        setNearest(data);
      })
      .catch(() => {
        if (cancelled) return;
        setNearest(null);
      })
      .finally(() => {
        if (!cancelled) setPassiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coords]);

  const handleActivate = async () => {
    if (!coords) return;
    setLoading(true);
    try {
      const response = await api.triggerSOS(coords.lat, coords.lng, 50000);
      setSosResult(response.sos);
      setNearest(response.nearest);
    } catch (e) {
      setSosResult(null);
    } finally {
      setLoading(false);
    }
  };

  const copyPhone = (phone: string) => {
    Vibration.vibrate(20);
    Clipboard.setString(phone);
  };

  const shareService = async (service: { name: string; category: string; phone: string; distanceKm: number }) => {
    Vibration.vibrate(30);
    try {
      await Share.share({
        message: `${service.name} (${service.category}) — ${service.phone} — ${formatDistance(service.distanceKm)} away`,
      });
    } catch (e) {
      return;
    }
  };

  const callPhone = (phone: string) => {
    Vibration.vibrate(30);
    Linking.openURL(`tel:${phone}`);
  };

  const hotlines = nearest?.emergencyNumbers?.length ? nearest.emergencyNumbers : STATIC_EMERGENCY;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4 }]}
    >
      <GradientBackdrop variant="danger" />

      <View style={styles.header}>
        <View style={[styles.modePill, { borderColor: theme.colors.danger }]}>
          <Text style={[styles.modePillText, { color: theme.colors.danger }]}>Emergency SOS mode</Text>
        </View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Broadcast Emergency</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Sends your coordinates to the nearest rescue and police posts.
        </Text>
      </View>

      <SOSTrigger onActivate={handleActivate} loading={loading} size={176} holdDurationMs={1500} />

      <Text style={[styles.holdHint, { color: theme.colors.textPrimary }]}>Hold button to trigger beacon</Text>

      {coords && (
        <View style={styles.section}>
          <Card elevated={false}>
            <View style={styles.gpsHeader}>
              <Text style={[styles.overline, { color: theme.colors.textSecondary }]}>Your GPS location</Text>
              {nearest && (
                <Text style={[styles.gpsSource, { color: nearest.mocked ? theme.colors.secondary : theme.colors.primary }]}>
                  {nearest.mocked ? 'Simulated' : 'Live'}
                </Text>
              )}
            </View>
            <Text style={[styles.gpsValue, { color: theme.colors.textPrimary }]}>
              {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
            </Text>
            <Text style={[styles.gpsNote, { color: theme.colors.textSecondary }]}>
              Derived from your trip destination
            </Text>
          </Card>
        </View>
      )}

      {sosResult && (
        <View style={styles.section}>
          <Card elevated={false} style={{ backgroundColor: theme.colors.dangerLight }}>
            <View style={styles.truthRow}>
              <Ionicons name="information-circle" size={iconSize.md} color={theme.colors.danger} />
              <Text style={[styles.truthText, { color: theme.colors.dangerSoftText }]}>
                {nearest?.mocked ? 'Results are simulated. ' : 'Nearest services loaded. '}
                {sosResult.persisted === false && 'This SOS is not recorded — call directly.'}
              </Text>
            </View>
          </Card>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.overline, styles.sectionHeading, { color: theme.colors.textSecondary }]}>
          Help near you
        </Text>
        {passiveLoading ? (
          <Skeleton width="100%" height={80} borderRadius={radius.lg} />
        ) : !nearest || nearest.services.length === 0 ? (
          <Card elevated={false}>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              {coords
                ? 'No services found nearby. Use the emergency numbers below.'
                : 'Create a trip to resolve your position, or use the emergency numbers below.'}
            </Text>
          </Card>
        ) : (
          nearest.services.slice(0, 3).map((service, idx) => (
            <Card key={`${service.name}-${idx}`} style={styles.resultCard}>
              <View style={styles.resultRow}>
                <View style={[styles.resultIcon, { backgroundColor: theme.colors.dangerLight }]}>
                  <Ionicons name="medical" size={iconSize.md} color={theme.colors.danger} />
                </View>
                <View style={styles.resultBody}>
                  <Text style={[styles.resultName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                    {service.name}
                  </Text>
                  <Text style={[styles.resultMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {service.category} • {formatDistance(service.distanceKm)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.phone, { color: theme.colors.danger }]}>{service.phone}</Text>
              <View style={styles.actionRow}>
                <ActionButton icon="call" label="Call" color={theme.colors.danger} onPress={() => callPhone(service.phone)} />
                <ActionButton icon="copy-outline" label="Copy" color={theme.colors.primary} onPress={() => copyPhone(service.phone)} />
                <ActionButton icon="share-outline" label="Share" color={theme.colors.primary} onPress={() => shareService(service)} />
              </View>
            </Card>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.overline, styles.sectionHeading, { color: theme.colors.textSecondary }]}>
          Emergency hotlines
        </Text>
        {hotlines.map((item) => (
          <Card key={item.number} style={styles.hotlineCard} elevated={false}>
            <View style={styles.hotlineRow}>
              <Ionicons name="call" size={iconSize.md} color={theme.colors.danger} />
              <View style={styles.hotlineBody}>
                <Text style={[styles.hotlineLabel, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={[styles.hotlineNumber, { color: theme.colors.textSecondary }]}>{item.number}</Text>
              </View>
              <TouchableOpacity
                onPress={() => copyPhone(item.number)}
                activeOpacity={0.8}
                style={styles.hotlineCopy}
                accessibilityRole="button"
                accessibilityLabel={`Copy ${item.label} number`}
              >
                <Ionicons name="copy-outline" size={iconSize.sm} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => callPhone(item.number)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Call ${item.label}`}
              >
                <Text style={[styles.callText, { color: theme.colors.danger }]}>CALL</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
};

const ActionButton = ({
  icon,
  label,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={styles.actionButton}
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Ionicons name={icon} size={iconSize.sm} color={color} />
    <Text style={[styles.actionLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.space8,
  },
  header: {
    paddingHorizontal: spacing.space4,
    alignItems: 'center',
  },
  modePill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.space3,
    paddingVertical: spacing.space1,
  },
  modePillText: {
    ...typography.overline,
  },
  title: {
    ...typography.displaySmall,
    marginTop: spacing.space3,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.space1,
    textAlign: 'center',
  },
  holdHint: {
    ...typography.captionSemibold,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.space2,
  },
  section: {
    marginTop: spacing.space6,
    paddingHorizontal: spacing.space4,
  },
  overline: {
    ...typography.overline,
  },
  sectionHeading: {
    marginBottom: spacing.space3,
  },
  gpsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gpsSource: {
    ...typography.captionSemibold,
  },
  gpsValue: {
    ...typography.title,
    marginTop: spacing.space2,
  },
  gpsNote: {
    ...typography.micro,
    fontWeight: '400',
    marginTop: spacing.space1,
  },
  body: {
    ...typography.body,
  },
  truthRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  truthText: {
    ...typography.caption,
    flex: 1,
    marginLeft: spacing.space2,
  },
  resultCard: {
    marginBottom: spacing.space3,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIcon: {
    width: spacing.space8 + spacing.space2,
    height: spacing.space8 + spacing.space2,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultBody: {
    flex: 1,
    marginLeft: spacing.space3,
  },
  resultName: {
    ...typography.bodySemibold,
  },
  resultMeta: {
    ...typography.caption,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  phone: {
    ...typography.bodySemibold,
    marginTop: spacing.space2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.space3,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.space5,
    paddingVertical: spacing.space1,
  },
  actionLabel: {
    ...typography.captionSemibold,
    marginLeft: spacing.space1,
  },
  hotlineCard: {
    marginBottom: spacing.space2,
  },
  hotlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hotlineBody: {
    flex: 1,
    marginLeft: spacing.space3,
  },
  hotlineLabel: {
    ...typography.bodySemibold,
  },
  hotlineNumber: {
    ...typography.caption,
    marginTop: 2,
  },
  hotlineCopy: {
    marginRight: spacing.space4,
  },
  callText: {
    ...typography.captionSemibold,
    letterSpacing: 0.6,
  },
});
