/**
 * Design tokens do GestaCondomínio — fonte única para web (Tailwind) e mobile (React Native).
 * Extraídos das telas de referência em docs/design/.
 */
export const colors = {
  primary: '#0F766E',
  primaryHover: '#115E59',
  primaryDark: '#0F3B37',
  primarySoft: '#E6F2F0',
  primarySoftBorder: '#CFE6E1',
  primaryTint: '#F3FAF8',
  accentRing: '#5EEAD4',
  text: '#14181F',
  text2: '#3A4049',
  muted: '#5B626C',
  mutedStrong: '#6B727C',
  bg: '#F4F5F2',
  surface: '#FFFFFF',
  surface2: '#EEF0EC',
  segment: '#E7E9E4',
  border: '#E2E4DF',
  borderInput: '#D5D8D2',
  borderDashed: '#C9CEC6',
  camera: '#1B2420',
  success: '#14603A',
  successBg: '#E2F3EA',
  info: '#1D4A85',
  infoBg: '#E4EDFA',
  warning: '#8A3B07',
  warningBg: '#FCEFD9',
  danger: '#9A1B1B',
  dangerBg: '#FBE6E4',
  alert: '#C2410C',
  neutral: '#3A4049',
  neutralBg: '#EDEFEA',
} as const;

export const radius = { sm: 10, md: 12, lg: 14, xl: 16, xxl: 18, camera: 20, pill: 999 } as const;

export const fonts = {
  body: 'Inter',
  heading: 'Space Grotesk',
} as const;

export const touchTarget = 44;

export type BadgeTone = 'ok' | 'warn' | 'info' | 'bad' | 'neu';

export const badgeTones: Record<BadgeTone, { bg: string; fg: string }> = {
  ok: { bg: colors.successBg, fg: colors.success },
  warn: { bg: colors.warningBg, fg: colors.warning },
  info: { bg: colors.infoBg, fg: colors.info },
  bad: { bg: colors.dangerBg, fg: colors.danger },
  neu: { bg: colors.neutralBg, fg: colors.neutral },
};
