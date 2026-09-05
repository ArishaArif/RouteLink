export const palette = {
  teal: {
    950: '#042E25',
    900: '#085041',
    800: '#0A6B56',
    700: '#0E8068',
    600: '#1D9E75',
    500: '#4DB892',
    400: '#7DD1B0',
    300: '#B0E5D0',
    200: '#D4F0E4',
    100: '#E1F5EE',
    50: '#F0FAF5',
  },
  amber: {
    950: '#5C360A',
    900: '#854F0B',
    800: '#A66710',
    700: '#C98015',
    600: '#EF9F27',
    500: '#F4B85C',
    400: '#F8D08E',
    300: '#FBDFB3',
    200: '#FAEEDA',
    100: '#FCF5EB',
    50: '#FEFAF5',
  },
  dusk: {
    950: '#080B0F',
    900: '#0D1117',
    800: '#161B22',
    700: '#21262D',
    600: '#30363D',
    500: '#484F58',
    400: '#6E7681',
    300: '#8B949E',
    200: '#B1BAC4',
    100: '#C9D1D9',
    50: '#F0F6FC',
  },
  cloud: {
    950: '#1B1F24',
    900: '#32383F',
    800: '#57606A',
    700: '#6E7781',
    600: '#8C959F',
    500: '#AEB8C1',
    400: '#D0D7DE',
    300: '#E6EBF0',
    200: '#F0F2F5',
    100: '#F6F8FA',
    50: '#FAFAF8',
  },
  danger: {
    700: '#A82222',
    600: '#CF2E2E',
    500: '#E24B4A',
    400: '#F07070',
    300: '#F5A3A3',
    200: '#FCDCDC',
    100: '#FEF2F2',
  },
  success: {
    dark: '#2DA44E',
    light: '#1A7F37',
  },
};

export type StatusShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'octagon';

export const statusCoding: Record<'success' | 'warning' | 'danger' | 'info', { shape: StatusShape; icon: string }> = {
  success: { shape: 'circle', icon: 'checkmark' },
  warning: { shape: 'triangle', icon: 'alert' },
  danger: { shape: 'octagon', icon: 'close' },
  info: { shape: 'square', icon: 'information' },
};

export const heatTiers = {
  cool: { tier: 1, label: 'Low', color: palette.teal[600], shape: 'circle' as StatusShape },
  mild: { tier: 2, label: 'Moderate', color: palette.success.dark, shape: 'square' as StatusShape },
  warm: { tier: 3, label: 'Elevated', color: palette.amber[600], shape: 'diamond' as StatusShape },
  hot: { tier: 4, label: 'High', color: '#E87B35', shape: 'triangle' as StatusShape },
  extreme: { tier: 5, label: 'Extreme', color: palette.danger[500], shape: 'octagon' as StatusShape },
};

export const severityCoding = {
  low: { color: palette.teal[600], shape: 'circle' as StatusShape, icon: 'checkmark-circle' },
  medium: { color: palette.amber[600], shape: 'triangle' as StatusShape, icon: 'alert-circle' },
  high: { color: palette.danger[500], shape: 'octagon' as StatusShape, icon: 'close-circle' },
};

export const severity = {
  low: severityCoding.low.color,
  medium: severityCoding.medium.color,
  high: severityCoding.high.color,
};

export const heatRamp = {
  cool: heatTiers.cool.color,
  mild: heatTiers.mild.color,
  warm: heatTiers.warm.color,
  hot: heatTiers.hot.color,
  extreme: heatTiers.extreme.color,
};

export const overlays = {
  strong: 'rgba(8,11,15,0.55)',
  weak: 'rgba(8,11,15,0.35)',
  strongLight: 'rgba(250,250,248,0.72)',
  weakLight: 'rgba(250,250,248,0.40)',
};

export const spacing = {
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space5: 20,
  space6: 24,
  space8: 32,
  space12: 48,
  space16: 64,
  space24: 96,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
};

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};

export const iconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  hero: 64,
};

export const touchTarget = 48;

export const typography = {
  display: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
  },
  displaySmall: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600' as const,
  },
  heading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodySemibold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  captionSemibold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  micro: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.88,
    textTransform: 'uppercase' as const,
  },
};

export type Theme = {
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceSecondary: string;
    surfaceTertiary: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    borderStrong: string;
    primary: string;
    primaryDark: string;
    primaryLight: string;
    onPrimary: string;
    buttonPrimary: string;
    onButtonPrimary: string;
    secondary: string;
    secondaryDark: string;
    secondaryLight: string;
    onSecondary: string;
    danger: string;
    dangerDark: string;
    dangerLight: string;
    onDanger: string;
    buttonDanger: string;
    onButtonDanger: string;
    info: string;
    success: string;
    warning: string;
    severityLow: string;
    severityMedium: string;
    severityHigh: string;
    primarySoftText: string;
    secondarySoftText: string;
    dangerSoftText: string;
    infoSoftText: string;
    tabActive: string;
    heatCool: string;
    heatMild: string;
    heatWarm: string;
    heatHot: string;
    heatExtreme: string;
    overlayStrong: string;
    overlayWeak: string;
  };
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadows: {
    flat: null;
    raised: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    floating: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };
};

export const createTheme = (isDark: boolean): Theme => {
  const colors = isDark
    ? {
        background: palette.dusk[900],
        surface: palette.dusk[800],
        surfaceSecondary: palette.dusk[700],
        surfaceTertiary: palette.dusk[600],
        textPrimary: palette.dusk[50],
        textSecondary: palette.dusk[300],
        border: palette.dusk[600],
        borderStrong: palette.dusk[400],
        primary: palette.teal[600],
        primaryDark: palette.teal[900],
        primaryLight: palette.teal[100],
        onPrimary: palette.teal[50],
        buttonPrimary: palette.teal[600],
        onButtonPrimary: palette.dusk[950],
        secondary: palette.amber[600],
        secondaryDark: palette.amber[900],
        secondaryLight: palette.amber[100],
        onSecondary: palette.dusk[950],
        danger: palette.danger[500],
        dangerDark: palette.danger[600],
        dangerLight: palette.danger[100],
        onDanger: palette.danger[100],
        buttonDanger: palette.danger[500],
        onButtonDanger: palette.dusk[50],
        info: palette.teal[600],
        success: palette.success.dark,
        warning: palette.amber[600],
        severityLow: severity.low,
        severityMedium: severity.medium,
        severityHigh: severity.high,
        primarySoftText: palette.teal[300],
        secondarySoftText: palette.amber[300],
        dangerSoftText: palette.danger[300],
        infoSoftText: palette.teal[300],
        tabActive: palette.teal[600],
        heatCool: heatRamp.cool,
        heatMild: heatRamp.mild,
        heatWarm: heatRamp.warm,
        heatHot: heatRamp.hot,
        heatExtreme: heatRamp.extreme,
        overlayStrong: overlays.strong,
        overlayWeak: overlays.weak,
      }
    : {
        background: palette.cloud[50],
        surface: palette.cloud[100],
        surfaceSecondary: '#FFFFFF',
        surfaceTertiary: palette.cloud[300],
        textPrimary: palette.cloud[950],
        textSecondary: palette.cloud[800],
        border: palette.cloud[400],
        borderStrong: palette.cloud[700],
        primary: palette.teal[700],
        primaryDark: palette.teal[900],
        primaryLight: palette.teal[100],
        onPrimary: palette.teal[50],
        buttonPrimary: palette.teal[700],
        onButtonPrimary: palette.cloud[50],
        secondary: palette.amber[700],
        secondaryDark: palette.amber[900],
        secondaryLight: palette.amber[100],
        onSecondary: palette.cloud[950],
        danger: palette.danger[600],
        dangerDark: palette.danger[700],
        dangerLight: palette.danger[100],
        onDanger: palette.danger[700],
        buttonDanger: palette.danger[600],
        onButtonDanger: palette.cloud[50],
        info: palette.teal[700],
        success: palette.success.light,
        warning: palette.amber[700],
        severityLow: palette.teal[700],
        severityMedium: palette.amber[800],
        severityHigh: palette.danger[600],
        primarySoftText: palette.teal[900],
        secondarySoftText: palette.amber[900],
        dangerSoftText: palette.danger[700],
        infoSoftText: palette.teal[900],
        tabActive: palette.teal[700],
        heatCool: palette.teal[700],
        heatMild: palette.success.light,
        heatWarm: palette.amber[800],
        heatHot: '#C25E1C',
        heatExtreme: palette.danger[600],
        overlayStrong: overlays.strongLight,
        overlayWeak: overlays.weakLight,
      };

  return {
    isDark,
    colors,
    spacing,
    radius,
    typography,
    shadows: {
      flat: null,
      raised: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
      floating: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.45 : 0.15,
        shadowRadius: 20,
        elevation: 8,
      },
    },
  };
};
