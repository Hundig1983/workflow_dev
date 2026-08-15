export const colors = {
  background: '#f7f8fa',
  surface: '#ffffff',
  border: '#dfe3e8',
  text: '#1b1f24',
  textMuted: '#6b7280',
  primary: '#2f6f4f',
  primaryText: '#ffffff',
  /** Empty state — calm and neutral: nothing is wrong. */
  empty: '#6b7280',
  emptySurface: '#eef1f4',
  /** Error state — deliberately a different hue from empty, so the two never read alike. */
  danger: '#b3261e',
  dangerSurface: '#fdeceb',
  fieldError: '#b3261e',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 6, md: 10 } as const;
