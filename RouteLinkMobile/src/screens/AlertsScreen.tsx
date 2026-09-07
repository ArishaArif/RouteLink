import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import { Card } from '../components/Card';
import { SegmentedControl } from '../components/SegmentedControl';
import { EmptyState } from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { StatusGlyph } from '../components/StatusGlyph';
import { api, ApiError } from '../services/api';
import { HazardAlert, HazardVerdict } from '../types';
import { formatRelativeTime, hazardSeverityMeta } from '../utils/display';
import { spacing, radius, typography, iconSize } from '../constants/theme';

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export const AlertsScreen = () => {
  const { theme } = useTheme();
  const { isLoading: authLoading } = useAuth();
  const { trips } = useTrip();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const regions = useMemo(() => Array.from(new Set(['All', ...trips.map((t) => t.destination)])), [trips]);
  const [region, setRegion] = useState<string>('All');
  const [alerts, setAlerts] = useState<HazardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hazardInput, setHazardInput] = useState('');
  const [hazardChecking, setHazardChecking] = useState(false);
  const [verdict, setVerdict] = useState<HazardVerdict | null>(null);

  useEffect(() => {
    if (!regions.includes(region)) {
      setRegion('All');
    }
  }, [regions, region]);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await api.getHazards(region === 'All' ? undefined : region);
      const sorted = [...data].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      setAlerts(sorted);
    } catch (e: any) {
      const message = e instanceof ApiError ? e.message : 'Unable to load alerts.';
      setError(message);
      setAlerts([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const onCheckHazard = async () => {
    const text = hazardInput.trim();
    if (!text) return;
    setHazardChecking(true);
    setVerdict(null);
    try {
      const result = await api.classifyHazardText(text);
      setVerdict(result);
    } catch (e: any) {
      setVerdict({ text, hazardConfidence: 0, isHazard: false });
    } finally {
      setHazardChecking(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('SOS' as never)}
        style={[styles.sosBanner, { backgroundColor: theme.colors.buttonDanger, paddingTop: insets.top + spacing.space3 }]}
        accessibilityRole="button"
        accessibilityLabel="Emergency, tap to open SOS"
      >
        <Ionicons name="shield-outline" size={iconSize.lg} color={theme.colors.onButtonDanger} />
        <View style={styles.sosBannerBody}>
          <Text style={[styles.sosBannerTitle, { color: theme.colors.onButtonDanger }]}>
            Emergency? Tap for SOS
          </Text>
          <Text style={[styles.sosBannerText, { color: theme.colors.onButtonDanger }]}>
            Broadcast your coordinates to nearby rescue services
          </Text>
        </View>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Active Alerts</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {region === 'All' ? 'Regional safety feed' : `${region} safety feed`}
          </Text>
        </View>

        {regions.length > 1 && (
          <View style={styles.section}>
            <SegmentedControl
              options={regions.map((r) => ({ value: r, label: r }))}
              value={region}
              onChange={setRegion}
            />
          </View>
        )}

        {error && (
          <View style={styles.section}>
            <Card elevated={false} style={{ backgroundColor: theme.colors.dangerLight }}>
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={iconSize.md} color={theme.colors.danger} />
                <Text style={[styles.errorText, { color: theme.colors.dangerSoftText }]}>{error}</Text>
                <TouchableOpacity onPress={() => load(false)} activeOpacity={0.8}>
                  <Text style={[styles.errorAction, { color: theme.colors.danger }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </View>
        )}

        <View style={styles.section}>
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : alerts.length === 0 ? (
            <EmptyState
              icon="shield-checkmark-outline"
              title={error ? 'Could not load alerts' : 'No active alerts'}
              subtitle={error ? 'Pull down or tap Retry to try again.' : `No hazards reported for ${region}.`}
            />
          ) : (
            alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.overline, { color: theme.colors.textSecondary }]}>Check a hazard report</Text>
          <Card elevated={false}>
            <Text style={[styles.checkLabel, { color: theme.colors.textPrimary }]}>
              Paste or type a safety report to classify it.
            </Text>
            <TextInput
              style={[
                styles.hazardInput,
                {
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              placeholder="e.g. Landslide reported near Attabad Lake..."
              placeholderTextColor={theme.colors.textSecondary}
              value={hazardInput}
              onChangeText={setHazardInput}
              multiline
              numberOfLines={3}
              maxLength={10000}
              textAlignVertical="top"
            />
            <TouchableOpacity
              onPress={onCheckHazard}
              disabled={hazardChecking || !hazardInput.trim()}
              activeOpacity={0.8}
              style={[
                styles.checkBtn,
                {
                  backgroundColor: theme.colors.buttonPrimary,
                  opacity: hazardChecking || !hazardInput.trim() ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.checkBtnText, { color: theme.colors.onButtonPrimary }]}>
                {hazardChecking ? 'Analyzing...' : 'Classify report'}
              </Text>
            </TouchableOpacity>
            {verdict && (
              <View
                style={[
                  styles.verdictBox,
                  {
                    backgroundColor: verdict.isHazard
                      ? theme.colors.dangerLight || 'rgba(255,59,48,0.1)'
                      : 'rgba(52,199,89,0.1)',
                  },
                ]}
              >
                <Ionicons
                  name={verdict.isHazard ? 'warning' : 'checkmark-circle'}
                  size={iconSize.md}
                  color={verdict.isHazard ? theme.colors.danger : '#34C759'}
                />
                <View style={styles.verdictBody}>
                  <Text
                    style={[
                      styles.verdictLabel,
                      { color: verdict.isHazard ? theme.colors.danger : '#34C759' },
                    ]}
                  >
                    {verdict.isHazard ? 'Hazard detected' : 'No hazard'}
                  </Text>
                  <Text style={[styles.verdictConf, { color: theme.colors.textSecondary }]}>
                    Confidence: {Math.round(verdict.hazardConfidence * 100)}%
                  </Text>
                  {verdict.source && (
                    <Text style={[styles.verdictMeta, { color: theme.colors.textSecondary }]}>
                      Source: {verdict.source}{verdict.degraded ? ' (degraded — keyword fallback)' : ''}{verdict.mocked ? ' (mock)' : ''}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
};

const AlertRow = ({ alert }: { alert: HazardAlert }) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const meta = hazardSeverityMeta[alert.severity];
  const hasRaw = Boolean(alert.rawText && alert.rawText !== alert.description);
  const hasCoords = alert.latitude !== null && alert.longitude !== null;

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <StatusGlyph severity={alert.severity} size={iconSize.xl} />
        <View style={styles.cardHeaderBody}>
          <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {meta.label} • {alert.hazardType.replace(/_/g, ' ')}
          </Text>
          <Text style={[styles.cardRegion, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {alert.region}
          </Text>
        </View>
      </View>

      <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
        {alert.description || alert.rawText}
      </Text>

      {expanded && (
        <>
          {hasRaw && <Text style={[styles.raw, { color: theme.colors.textSecondary }]}>{alert.rawText}</Text>}
          {hasCoords && (
            <Text style={[styles.coords, { color: theme.colors.textSecondary }]}>
              {alert.latitude!.toFixed(4)}, {alert.longitude!.toFixed(4)}
            </Text>
          )}
        </>
      )}

      <View style={styles.footer}>
        <Text style={[styles.time, { color: theme.colors.textSecondary }]}>
          {formatRelativeTime(alert.createdAt)}
        </Text>
        {hasRaw || hasCoords ? (
          <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
            <Text style={[styles.toggle, { color: theme.colors.primary }]}>{expanded ? 'Less' : 'More'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.space8,
  },
  sosBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.space4,
    paddingBottom: spacing.space3,
  },
  sosBannerBody: {
    flex: 1,
    marginLeft: spacing.space3,
  },
  sosBannerTitle: {
    ...typography.bodySemibold,
  },
  sosBannerText: {
    ...typography.caption,
    opacity: 0.9,
  },
  header: {
    paddingHorizontal: spacing.space4,
    paddingTop: spacing.space5,
  },
  title: {
    ...typography.displaySmall,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.space1,
  },
  section: {
    marginTop: spacing.space5,
    paddingHorizontal: spacing.space4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    ...typography.caption,
    flex: 1,
    marginLeft: spacing.space2,
  },
  errorAction: {
    ...typography.captionSemibold,
    marginLeft: spacing.space2,
  },
  card: {
    marginBottom: spacing.space3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderBody: {
    flex: 1,
    marginLeft: spacing.space3,
  },
  cardTitle: {
    ...typography.bodySemibold,
    textTransform: 'capitalize',
  },
  cardRegion: {
    ...typography.caption,
    marginTop: 2,
  },
  description: {
    ...typography.caption,
    marginTop: spacing.space3,
  },
  raw: {
    ...typography.caption,
    marginTop: spacing.space2,
  },
  coords: {
    ...typography.micro,
    fontWeight: '400',
    marginTop: spacing.space2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.space3,
  },
  time: {
    ...typography.micro,
    fontWeight: '400',
  },
  toggle: {
    ...typography.captionSemibold,
  },
  overline: {
    ...typography.overline,
    marginBottom: spacing.space3,
  },
  checkLabel: {
    ...typography.body,
    marginBottom: spacing.space3,
  },
  hazardInput: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.space3,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 80,
    marginBottom: spacing.space3,
  },
  checkBtn: {
    borderRadius: radius.lg,
    paddingVertical: spacing.space3,
    alignItems: 'center',
  },
  checkBtnText: {
    ...typography.bodySemibold,
  },
  verdictBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.space3,
    marginTop: spacing.space3,
  },
  verdictBody: {
    marginLeft: spacing.space3,
    flex: 1,
  },
  verdictLabel: {
    ...typography.bodySemibold,
  },
  verdictConf: {
    ...typography.caption,
    marginTop: 2,
  },
  verdictMeta: {
    ...typography.micro,
    marginTop: 2,
    fontStyle: 'italic',
  },
});
