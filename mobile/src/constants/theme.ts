/**
 * ChemoCare AI - Theme Constants
 * iOS-style design system with blue/white theme
 */

export const colors = {
  // Primary Blues
  primary: {
    50: '#E6F0FF',
    100: '#CCE0FF',
    200: '#99C2FF',
    300: '#66A3FF',
    400: '#3385FF',
    500: '#0066CC',      // Main primary
    600: '#0052A3',
    700: '#003D7A',
    800: '#002952',
    900: '#001429',
  },
  
  // Neutrals
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  
  // Semantic Colors
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  
  // Status Colors for Chemo
  status: {
    pending: '#F59E0B',
    pendingBg: '#FEF3C7',
    approved: '#10B981',
    approvedBg: '#D1FAE5',
    inProgress: '#3B82F6',
    inProgressBg: '#DBEAFE',
    completed: '#6366F1',
    completedBg: '#E0E7FF',
    cancelled: '#EF4444',
    cancelledBg: '#FEE2E2',
    onHold: '#8B5CF6',
    onHoldBg: '#EDE9FE',
  },
  
  // Portal Accent Colors
  portal: {
    patient: '#0066CC',
    patientBg: '#E6F0FF',
    doctorOPD: '#059669',
    doctorOPDBg: '#D1FAE5',
    doctorDayCare: '#7C3AED',
    doctorDayCareBg: '#EDE9FE',
    nurse: '#DB2777',
    nurseBg: '#FCE7F3',
  },

  // Background colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
    tertiary: '#F1F5F9',
  },

  // Text colors
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#94A3B8',
    inverse: '#FFFFFF',
  },

  // Border colors
  border: {
    light: '#E2E8F0',
    medium: '#CBD5E1',
    dark: '#94A3B8',
  },
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 8,
  },
} as const;

export const borderRadius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const typography = {
  // Large Title - 34pt
  largeTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    letterSpacing: 0.37,
    lineHeight: 41,
  },
  // Title 1 - 28pt
  title1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: 0.36,
    lineHeight: 34,
  },
  // Title 2 - 22pt
  title2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: 0.35,
    lineHeight: 28,
  },
  // Title 3 - 20pt
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.38,
    lineHeight: 25,
  },
  // Headline - 17pt semibold
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  // Body - 17pt
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  // Body Bold
  bodyBold: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  // Callout - 16pt
  callout: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: -0.32,
    lineHeight: 21,
  },
  // Subhead - 15pt
  subhead: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: -0.24,
    lineHeight: 20,
  },
  // Subhead Bold
  subheadBold: {
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: -0.24,
    lineHeight: 20,
  },
  // Footnote - 13pt
  footnote: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: -0.08,
    lineHeight: 18,
  },
  // Caption 1 - 12pt
  caption1: {
    fontSize: 12,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 16,
  },
  // Caption 2 - 11pt
  caption2: {
    fontSize: 11,
    fontWeight: '400' as const,
    letterSpacing: 0.07,
    lineHeight: 13,
  },
} as const;

export const theme = {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
} as const;

// Legacy flat color exports for backwards compatibility
export const Colors = {
  ...colors,
  // Flat primary colors for legacy code
  primary: colors.primary[500],
  primaryLight: colors.primary[100],
  primaryDark: colors.primary[700],
  // White/Black shortcuts
  white: colors.neutral[0],
  black: colors.neutral[900],
  // Text color shortcuts
  textPrimary: colors.text.primary,
  textSecondary: colors.text.secondary,
  textTertiary: colors.text.tertiary,
  // Background shortcuts
  background: colors.background.primary,
  backgroundSecondary: colors.background.secondary,
  backgroundTertiary: colors.background.tertiary,
  // Border shortcut
  border: colors.border.light,
} as const;

// Legacy shadow exports
export const Shadows = {
  ...shadows,
  small: shadows.sm,
  medium: shadows.md,
  large: shadows.lg,
} as const;

// Legacy typography exports
export const Typography = {
  ...typography,
  fontFamily: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
  fontSize: {
    xxs: 10,
    xs: 11,
    sm: 13,
    md: 17,
    lg: 20,
    xl: 22,
    xxl: 28,
    xxxl: 34,
  },
} as const;

export const BorderRadius = borderRadius;
export const Spacing = {
  ...spacing,
  xxs: 2,
} as const;

// Type exports
export type ThemeType = typeof theme;
export type ColorsType = typeof colors;
export type ShadowsType = typeof shadows;
export type BorderRadiusType = typeof borderRadius;
export type SpacingType = typeof spacing;
export type TypographyType = typeof typography;
