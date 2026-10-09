import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, tones, TOUCH, type, fonts } from '@/constants/theme';

export function Button({ label, onPress, variant = 'primary', disabled = false, loading = false, accessibilityHint, style }) {
  const palette = {
    primary: { bg: colors.brand, pressed: colors.brandPressed, fg: '#fff', border: colors.brand },
    secondary: { bg: colors.surface, pressed: colors.surfaceSunken, fg: colors.ink, border: colors.line },
    // White pill on the navy band (DESIGN.md).
    band: { bg: colors.surface, pressed: colors.brandSoft, fg: colors.brand, border: colors.surface },
    danger: { bg: colors.surface, pressed: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
    warning: { bg: colors.surface, pressed: colors.warningSoft, fg: colors.warning, border: colors.warningSoft },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed && !inactive ? palette.pressed : palette.bg, borderColor: palette.border, opacity: inactive ? 0.55 : 1, transform: [{ scale: pressed && !inactive ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function StatusBadge({ label, tone = 'neutral' }) {
  const t = tones[tone] || tones.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={[styles.badgeDot, { backgroundColor: t.fg }]} />
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Section({ title, right, children, style }) {
  return (
    <View style={[styles.section, style]}>
      {(title || right) && (
        <View style={styles.sectionHeader}>
          {title ? (
            <Text accessibilityRole="header" style={type.heading}>
              {title}
            </Text>
          ) : (
            <View />
          )}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function RouteBlock({ from, to, fromDetail, toDetail }) {
  return (
    <View accessible accessibilityLabel={`Lấy hàng tại ${from || 'chưa rõ'}, giao tại ${to || 'chưa rõ'}`}>
      <View style={styles.stop}>
        <View style={styles.stopRail}>
          <View style={[styles.stopDot, { backgroundColor: colors.surface }]} />
          <View style={styles.stopLine} />
        </View>
        <View style={styles.stopBody}>
          <Text style={type.caption}>Lấy hàng</Text>
          <Text style={styles.stopName}>{from || 'Chưa cập nhật'}</Text>
          {fromDetail ? <Text style={type.secondary}>{fromDetail}</Text> : null}
        </View>
      </View>
      <View style={styles.stop}>
        <View style={styles.stopRail}>
          <View style={[styles.stopDot, { backgroundColor: colors.brand, borderRadius: 2 }]} />
        </View>
        <View style={styles.stopBody}>
          <Text style={type.caption}>Giao hàng</Text>
          <Text style={styles.stopName}>{to || 'Chưa cập nhật'}</Text>
          {toDetail ? <Text style={type.secondary}>{toDetail}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export function StateView({ kind = 'empty', title, message, actionLabel, onAction }) {
  return (
    <View style={[styles.state, kind === 'error' && { backgroundColor: colors.dangerSoft }]} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
      {kind === 'loading' ? <ActivityIndicator color={colors.brand} /> : null}
      {title ? <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text> : null}
      {message ? <Text style={[type.secondary, { textAlign: 'center' }]}>{message}</Text> : null}
      {actionLabel ? <Button label={actionLabel} variant="secondary" onPress={onAction} style={{ alignSelf: 'stretch', marginTop: space.sm }} /> : null}
    </View>
  );
}

export function FieldError({ message }) {
  if (!message) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontFamily: fonts.bold },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderWidth: 0, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 13, fontFamily: fonts.semibold },
  section: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stop: { flexDirection: 'row', gap: space.md },
  stopRail: { width: 14, alignItems: 'center', paddingTop: 5 },
  stopDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.brand },
  stopLine: { flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 4, minHeight: 18 },
  stopBody: { flex: 1, paddingBottom: space.md },
  stopName: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
  state: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken },
  fieldError: { color: colors.danger, fontSize: 14, fontFamily: fonts.semibold, marginTop: 4 },
});

export { TextField, MoneyField, ChoiceChips, SwitchRow, CheckRow, DateTimeField, FieldLabel } from './forms';
export { Screen, ActionBar, Banner, Band, Card, Row, Tabs, MenuItem, useResource, useSingleFlight } from './layout';
