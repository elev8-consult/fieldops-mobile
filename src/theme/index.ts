/**
 * Design tokens for the I Prom mobile app.
 * Tuned for field use by non-technical staff: large text, big touch targets,
 * high contrast, generous spacing.
 */
export const colors = {
  primary: '#208AEF',
  primaryDark: '#1565C0',
  primarySoft: '#E6F1FB',
  bg: '#F4F6F8',
  surface: '#FFFFFF',
  border: '#D7DEE5',
  text: '#16202A',
  textMuted: '#5C6B7A',
  success: '#1E9E57',
  successSoft: '#E3F5EC',
  danger: '#D64545',
  dangerSoft: '#FBE9E9',
  warning: '#C8860D',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const font = {
  /** Minimum comfortable tap target height. */
  tapTarget: 56,
  h1: 28,
  h2: 22,
  body: 18,
  label: 16,
  small: 14,
} as const;
