import type { Config } from 'tailwindcss';
import { colors } from '../../packages/ui/src/tokens';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        'primary-hover': colors.primaryHover,
        'primary-dark': colors.primaryDark,
        'primary-soft': colors.primarySoft,
        'primary-soft-border': colors.primarySoftBorder,
        'primary-tint': colors.primaryTint,
        ink: colors.text,
        'ink-2': colors.text2,
        muted: colors.muted,
        'muted-strong': colors.mutedStrong,
        bg: colors.bg,
        surface: colors.surface,
        'surface-2': colors.surface2,
        segment: colors.segment,
        line: colors.border,
        'line-input': colors.borderInput,
        'line-dashed': colors.borderDashed,
        alert: colors.alert,
        'success-bg': colors.successBg,
        success: colors.success,
        'info-bg': colors.infoBg,
        info: colors.info,
        'warning-bg': colors.warningBg,
        warning: colors.warning,
        'danger-bg': colors.dangerBg,
        danger: colors.danger,
        'neutral-bg': colors.neutralBg,
      },
      fontFamily: {
        // No React Native cada peso é uma família própria (fontWeight não troca o arquivo).
        inter: ['Inter_400Regular'],
        'inter-semibold': ['Inter_600SemiBold'],
        'inter-bold': ['Inter_700Bold'],
        heading: ['SpaceGrotesk_600SemiBold'],
        'heading-bold': ['SpaceGrotesk_700Bold'],
      },
    },
  },
} satisfies Config;
