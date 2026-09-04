// Shared design tokens for RouteLink.
// Palette direction: AllTrails' earthy trail-green for the planning/hazard
// surfaces, Airbnb's warm neutral + photo-forward layout for marketplace/booking.
// Keep every screen importing from here so a future palette tweak is one file.

export const colors = {
  // Core brand
  forest: '#1E3A2B', // deep pine — headers, high-emphasis text
  moss: '#3F7D52', // primary green — primary buttons, active states
  mossDark: '#2F6140', // pressed/hover state for moss
  mossLight: '#E6F0E8', // soft green surface (success, verified, active day)
  sage: '#7C9C84', // muted secondary green — secondary text on green surfaces

  // Accent (trail-blaze clay, not the generic AI terracotta — more brick, less peach)
  clay: '#B5502E',
  clayLight: '#FBEAE1',

  // Neutrals — stone/sand instead of a flat cream, keeps it feeling outdoorsy
  stone: '#F5F4EF',
  stoneDark: '#EDEBE2',
  card: '#FFFFFF',
  border: '#E4E1D6',
  ink: '#26261F', // primary text
  inkMuted: '#6B6A5F', // secondary text
  inkFaint: '#9B998C', // tertiary / placeholder text

  // Status
  warning: '#B8860B',
  warningBg: '#FBF3D9',
  critical: '#B3261E',
  criticalBg: '#FCE8E6',
  success: '#2E7D46',
  successBg: '#E6F0E8',
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const typography = {
  header: { fontSize: 24, fontWeight: '700' as const, color: colors.forest, letterSpacing: -0.3 },
  sectionHeader: { fontSize: 17, fontWeight: '700' as const, color: colors.forest },
  cardTitle: { fontSize: 17, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  bodyMuted: { fontSize: 13, color: colors.inkMuted, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.ink },
  caption: { fontSize: 11, color: colors.inkFaint },
};

export const shadow = {
  card: {
    shadowColor: '#1E3A2B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};
