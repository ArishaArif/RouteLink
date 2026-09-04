import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Guide } from '../types';
import { api } from '../services/api';
import { useTrip } from '../context/TripContext';
import { colors, radius, spacing, shadow, typography } from '../theme';

interface GuideMarketplaceScreenProps {
  onBooked?: (bookingId: string, guideName: string) => void;
}

// Deterministic avatar color per guide -- stands in for a real profile photo
// (Guide has no imageUrl field yet) while still reading as a photo-forward card.
const AVATAR_PALETTE = [colors.moss, colors.clay, colors.forest, colors.sage];
const avatarColorFor = (id: string) => {
  const sum = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
};
const initialsFor = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

export const GuideMarketplaceScreen: React.FC<GuideMarketplaceScreenProps> = ({ onBooked }) => {
  const { trip } = useTrip();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingGuideId, setBookingGuideId] = useState<string | null>(null);
  const [confirmingGuide, setConfirmingGuide] = useState<Guide | null>(null);
  const [noTripNotice, setNoTripNotice] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchGuides();
  }, []);

  const fetchGuides = async () => {
    try {
      setLoading(true);
      const data = await api.getGuides();
      setGuides(data);
    } catch (err: any) {
      // Fallback mock guides if backend has no guide records yet
      setGuides([
        {
          id: '04b8f4e2-1c9d-4a77-9f3e-2b6a5c8d1e11',
          name: 'Ali Raza',
          region: 'Hunza Valley',
          pricePerDay: 7500,
          rating: 4.9,
          bio: 'Certified trekking guide with 8+ years experience in Karakoram region.',
          languages: ['English', 'Urdu', 'Burushaski'],
          isAvailable: true,
        },
        {
          id: '04b8f4e2-1c9d-4a77-9f3e-2b6a5c8d1e22',
          name: 'Khan Balti',
          region: 'Skardu',
          pricePerDay: 8500,
          rating: 4.8,
          bio: 'Expert mountain navigator and high-altitude logistics specialist.',
          languages: ['English', 'Urdu', 'Balti'],
          isAvailable: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookGuide = (guide: Guide) => {
    if (!trip) {
      setNoTripNotice(true);
      return;
    }
    setFeedback(null);
    setConfirmingGuide(guide);
  };

  const confirmBooking = async () => {
    const guide = confirmingGuide;
    if (!guide || !trip) return;
    setConfirmingGuide(null);
    setBookingGuideId(guide.id);
    try {
      const booking = await api.createBooking({
        tripId: trip.id,
        guideId: guide.id,
        startDate: trip.startDate,
        endDate: trip.endDate,
      });
      if (onBooked) {
        onBooked(booking.id, guide.name);
      } else {
        setFeedback({ type: 'success', text: `Your request with ${guide.name} was sent.` });
      }
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase().includes('fetch')
        ? "Can't reach the server right now. Please try again."
        : err?.message || 'Could not create the booking.';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setBookingGuideId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.moss} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Verified local guides</Text>
      <Text style={styles.subheader}>Book a trekking guide for your route.</Text>

      {feedback && feedback.type === 'error' && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.critical} />
          <Text style={styles.bannerText}>{feedback.text}</Text>
          <TouchableOpacity onPress={() => setFeedback(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.critical} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={guides}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <View style={[styles.avatar, { backgroundColor: avatarColorFor(item.id) }]}>
                <Text style={styles.avatarText}>{initialsFor(item.name)}</Text>
              </View>

              <View style={styles.cardTopInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.isAvailable && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.moss} />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
                <View style={styles.trustRow}>
                  <Ionicons name="star" size={12} color={colors.clay} />
                  <Text style={styles.rating}>{item.rating}</Text>
                  <Text style={styles.trustDot}>·</Text>
                  <Ionicons name="location-outline" size={12} color={colors.inkMuted} />
                  <Text style={styles.region}>{item.region}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.bio}>{item.bio}</Text>

            {item.languages && (
              <View style={styles.languagesRow}>
                <Ionicons name="chatbubble-outline" size={12} color={colors.inkFaint} />
                <Text style={styles.languages}>{item.languages.join(', ')}</Text>
              </View>
            )}

            <View style={styles.cardFooter}>
              <Text style={styles.price}>Rs. {item.pricePerDay}<Text style={styles.priceUnit}> / day</Text></Text>
              <TouchableOpacity
                style={styles.bookButton}
                onPress={() => handleBookGuide(item)}
                disabled={bookingGuideId === item.id}
              >
                {bookingGuideId === item.id
                  ? <ActivityIndicator color={colors.card} size="small" />
                  : <Text style={styles.bookButtonText}>Request booking</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* "No trip yet" notice -- bottom sheet, not a centered modal */}
      <Modal visible={noTripNotice} transparent animationType="slide" onRequestClose={() => setNoTripNotice(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, styles.sheetBackdrop]} activeOpacity={1} onPress={() => setNoTripNotice(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={[styles.sheetIconCircle, { backgroundColor: colors.stoneDark }]}>
              <Ionicons name="map-outline" size={26} color={colors.forest} />
            </View>
            <Text style={styles.sheetTitle}>Plan a trip first</Text>
            <Text style={styles.sheetBody}>
              Generate an itinerary on the Planner tab before booking a guide -- bookings need a trip with dates.
            </Text>
            <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={() => setNoTripNotice(false)}>
              <Text style={styles.sheetPrimaryBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Booking confirmation -- bottom sheet */}
      <Modal visible={!!confirmingGuide} transparent animationType="slide" onRequestClose={() => setConfirmingGuide(null)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, styles.sheetBackdrop]} activeOpacity={1} onPress={() => setConfirmingGuide(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Confirm booking</Text>
            {confirmingGuide && trip && (
              <>
                <View style={styles.sheetGuideRow}>
                  <View style={[styles.avatar, styles.avatarSmall, { backgroundColor: avatarColorFor(confirmingGuide.id) }]}>
                    <Text style={styles.avatarTextSmall}>{initialsFor(confirmingGuide.name)}</Text>
                  </View>
                  <View>
                    <Text style={styles.sheetGuideName}>{confirmingGuide.name}</Text>
                    <Text style={styles.sheetGuideMeta}>Rs. {confirmingGuide.pricePerDay} / day</Text>
                  </View>
                </View>
                <Text style={styles.sheetBody}>
                  {trip.startDate} to {trip.endDate}
                </Text>
              </>
            )}
            <View style={styles.sheetButtonRow}>
              <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={() => setConfirmingGuide(null)}>
                <Text style={styles.sheetSecondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetPrimaryBtn, styles.sheetPrimaryBtnFlex]} onPress={confirmBooking}>
                <Text style={styles.sheetPrimaryBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success confirmation -- full friendly bottom sheet with icon, not just a banner */}
      <Modal visible={!!(feedback && feedback.type === 'success')} transparent animationType="slide" onRequestClose={() => setFeedback(null)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={[StyleSheet.absoluteFill, styles.sheetBackdrop]} activeOpacity={1} onPress={() => setFeedback(null)} />
          <View style={[styles.sheet, styles.sheetCentered]}>
            <View style={styles.sheetHandle} />
            <View style={[styles.sheetIconCircle, styles.sheetIconCircleSuccess]}>
              <Ionicons name="paper-plane" size={24} color={colors.moss} />
            </View>
            <Text style={styles.sheetTitle}>Request sent</Text>
            <Text style={[styles.sheetBody, styles.sheetBodyCentered]}>{feedback?.text}</Text>
            <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={() => setFeedback(null)}>
              <Text style={styles.sheetPrimaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.stone, paddingTop: spacing.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.stone },
  header: { ...typography.header, paddingHorizontal: spacing.lg },
  subheader: { ...typography.bodyMuted, paddingHorizontal: spacing.lg, marginTop: 2, marginBottom: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  card: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.md, ...shadow.card },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText: { color: colors.card, fontSize: 18, fontWeight: '700' },
  avatarSmall: { width: 40, height: 40, borderRadius: radius.sm, marginRight: spacing.sm },
  avatarTextSmall: { color: colors.card, fontSize: 14, fontWeight: '700' },
  cardTopInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.mossLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  verifiedText: { fontSize: 10, fontWeight: '700', color: colors.moss },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  rating: { fontSize: 12, fontWeight: '700', color: colors.ink },
  trustDot: { color: colors.inkFaint, fontSize: 12, marginHorizontal: 1 },
  region: { fontSize: 12, color: colors.inkMuted },
  bio: { ...typography.bodyMuted, marginBottom: spacing.sm },
  languagesRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.md },
  languages: { fontSize: 12, color: colors.inkFaint },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  price: { fontSize: 15, fontWeight: '700', color: colors.forest },
  priceUnit: { fontSize: 12, fontWeight: '400', color: colors.inkMuted },
  bookButton: { backgroundColor: colors.moss, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill },
  bookButtonText: { color: colors.card, fontWeight: '700', fontSize: 13 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.criticalBg,
    padding: spacing.md,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  bannerText: { flex: 1, fontSize: 13, color: colors.critical },

  // Bottom sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { backgroundColor: 'rgba(30,26,20,0.4)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingTop: spacing.md },
  sheetCentered: { alignItems: 'center' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetIconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  sheetIconCircleSuccess: { backgroundColor: colors.mossLight },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.forest, marginBottom: spacing.sm },
  sheetBody: { fontSize: 14, color: colors.inkMuted, lineHeight: 20, marginBottom: spacing.lg },
  sheetBodyCentered: { textAlign: 'center' },
  sheetGuideRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sheetGuideName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  sheetGuideMeta: { fontSize: 12, color: colors.inkMuted, marginTop: 1 },
  sheetButtonRow: { flexDirection: 'row', gap: spacing.sm },
  sheetSecondaryBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.pill, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  sheetSecondaryBtnText: { color: colors.inkMuted, fontWeight: '700' },
  sheetPrimaryBtn: { backgroundColor: colors.moss, paddingVertical: 13, paddingHorizontal: spacing.xl, borderRadius: radius.pill, alignItems: 'center', width: '100%' },
  sheetPrimaryBtnFlex: { flex: 1, width: undefined },
  sheetPrimaryBtnText: { color: colors.card, fontWeight: '700' },
});
