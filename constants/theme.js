import { Appearance } from 'react-native';

// Design tokens shared with the web portal; rules and measured contrast live in DESIGN.md.
// Navy is the only action colour; greys are cool-tinted to match it.
const light = {
  ink: '#0F1E2E',
  inkMuted: '#4A5B6C',
  inkSubtle: '#5E6A77',
  canvas: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceSunken: '#EDF0F4',
  line: '#DFE4EA',
  lineStrong: '#C3CCD6',
  brand: '#1B4965',
  brandPressed: '#143A51',
  brandSoft: '#E6EEF4',
  band: '#102F44',
  bandPressed: '#1A3D55',
  onBandSoft: '#B7C6D3',
  focus: '#2B7BB9',
  success: '#0E7C3A',
  successSoft: '#E3F3E8',
  warning: '#8A5300',
  warningSoft: '#FBEFD9',
  danger: '#C0262D',
  dangerSoft: '#FBE7E7',
  info: '#1F5FBF',
  infoSoft: '#E6EEFA',
  // Live signal: one bright accent for "happening now" (LIVE dot, urgent countdown). Never a button colour.
  signal: '#2DD4BF',
  signalText: '#0F766E',
};

// Dark palette. The band inverts to a light panel, so every "text on brand/band" that uses
// colors.surface stays readable without touching the screens. Pairs are chosen for >= 4.5:1 body text.
const dark = {
  ink: '#E8EEF4',
  inkMuted: '#A9B8C6',
  inkSubtle: '#8D9CAB',
  canvas: '#0A141D',
  surface: '#111E2A',
  surfaceSunken: '#1A2B3A',
  line: '#24384A',
  lineStrong: '#3A5166',
  brand: '#7DB3D8',
  brandPressed: '#9CC6E3',
  brandSoft: '#17324A',
  band: '#DCE8F1',
  bandPressed: '#C3D3DF',
  onBandSoft: '#3A4C5C',
  focus: '#7DB3D8',
  success: '#5FD38D',
  successSoft: '#12301F',
  warning: '#F2B75C',
  warningSoft: '#3A2A0C',
  danger: '#FF8A8A',
  dangerSoft: '#3D1517',
  info: '#8AB4F8',
  infoSoft: '#152A4A',
  signal: '#0F766E',
  signalText: '#2DD4BF',
};

/**
 * The palette is resolved once, at launch, from the system setting. Screens build their StyleSheets
 * at import time, so a theme change takes effect the next time the app starts.
 */
export const scheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
export const colors = scheme === 'dark' ? dark : light;
/** For surfaces that never go dark, such as the map document drawn over light map tiles. */
export const lightColors = light;

// Soft fill + status-coloured text, each pair >= 4.6:1. `border` equals the fill (no outline).
export const tones = {
  neutral: { bg: colors.surfaceSunken, fg: colors.inkMuted, border: colors.surfaceSunken },
  info: { bg: colors.infoSoft, fg: colors.info, border: colors.infoSoft },
  success: { bg: colors.successSoft, fg: colors.success, border: colors.successSoft },
  warning: { bg: colors.warningSoft, fg: colors.warning, border: colors.warningSoft },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  brand: { bg: colors.brandSoft, fg: colors.brand, border: colors.brandSoft },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
// lg is the card radius (16 px in DESIGN.md); pill for every button, chip and badge.
export const radius = { sm: 6, md: 8, lg: 16, xl: 16, pill: 999 };

/** Minimum touch target in dp; drivers often operate the app with gloves or one hand. */
export const TOUCH = 48;

// Be Vietnam Pro, loaded in app/_layout.jsx. Android ignores fontWeight for custom fonts,
// so each weight is its own family: use `fonts.bold` instead of fontWeight: '700'.
export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  // JetBrains Mono: money, countdowns, trip and plate codes only. Vietnamese copy stays in Be Vietnam Pro.
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
};

export const type = {
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.ink },
  heading: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
  body: { fontSize: 15, fontFamily: fonts.regular, color: colors.ink, lineHeight: 22 },
  secondary: { fontSize: 14, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 20 },
  caption: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted },
  tabular: { fontVariant: ['tabular-nums'] },
  // Numbers that must line up and stay still while they change (N1): mono is fixed-width by design.
  figure: { fontFamily: fonts.mono, color: colors.ink, fontVariant: ['tabular-nums'] },
  // Reference codes and timestamps: mono so characters are unambiguous, muted so they stay secondary.
  code: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
};

/** Motion budget. Only transform and opacity are animated; durations stay short so the UI never feels slow. */
export const motion = {
  fast: 160,
  base: 260,
  slow: 480,
  stagger: 55,
  pulse: 1300,
};

export const elevation = {
  level2: { shadowColor: '#0F1E2E', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
};
