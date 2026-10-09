// Design tokens shared with the web portal; rules and measured contrast live in DESIGN.md.
// Navy is the only action colour; greys are cool-tinted to match it.
export const colors = {
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
};

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
};

export const type = {
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.ink },
  heading: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
  body: { fontSize: 15, fontFamily: fonts.regular, color: colors.ink, lineHeight: 22 },
  secondary: { fontSize: 14, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 20 },
  caption: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted },
  tabular: { fontVariant: ['tabular-nums'] },
};

export const elevation = {
  level2: { shadowColor: '#0F1E2E', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
};
