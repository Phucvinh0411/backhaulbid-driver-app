import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, TOUCH, type, fonts } from '@/constants/theme';
import { LiveDot } from '@/components/motion';

/** Scrollable page with pull-to-refresh and room for a sticky action bar. */
export function Screen({ children, refreshing = false, onRefresh, bottomInset = 0, contentStyle }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: space.xxl + bottomInset }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

/** Actions pinned above the home indicator; pair with Screen bottomInset. */
export function ActionBar({ children }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>{children}</View>;
}

export function Banner({ tone = 'info', title, children }) {
  const palette = { success: [colors.successSoft, colors.success], warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger], info: [colors.infoSoft, colors.info], neutral: [colors.surfaceSunken, colors.inkMuted] }[tone] || [colors.infoSoft, colors.info];
  return (
    <View style={[styles.banner, { backgroundColor: palette[0] }]} accessibilityLiveRegion="polite" accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      {title ? <Text style={[styles.bannerTitle, { color: palette[1] }]}>{title}</Text> : null}
      {children ? (typeof children === 'string' || Array.isArray(children) ? <Text style={{ color: palette[1], fontSize: 14, lineHeight: 20 }}>{children}</Text> : children) : null}
    </View>
  );
}

/**
 * DESIGN.md navy band: the one inverted panel per screen for its key fact (current trip,
 * wallet balance, bid room). Put Button variant="band" inside for the main action.
 * `value` may be text or a node (for example a CountUp); `live` adds a pulsing LIVE marker.
 */
export function Band({ eyebrow, title, value, caption, live = false, children, style }) {
  const hasValue = value !== undefined && value !== null && value !== '';
  return (
    <View style={[styles.band, style]}>
      {eyebrow || live ? (
        <View style={styles.bandTop}>
          {eyebrow ? <Text style={styles.bandEyebrow}>{eyebrow}</Text> : <View />}
          {live ? <LiveDot onDark /> : null}
        </View>
      ) : null}
      {title ? <Text accessibilityRole="header" style={styles.bandTitle}>{title}</Text> : null}
      {hasValue ? (typeof value === 'string' || typeof value === 'number' ? <Text style={styles.bandValue}>{value}</Text> : value) : null}
      {caption ? <Text style={styles.bandCaption}>{caption}</Text> : null}
      {children}
    </View>
  );
}

export function Card({ children, onPress, accessibilityLabel, style }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}>
      {children}
    </Pressable>
  );
}

export function Row({ label, value, strong, selectable }) {
  return (
    <View style={styles.row}>
      <Text style={type.caption}>{label}</Text>
      <Text selectable={selectable} style={[styles.rowValue, strong && { fontFamily: fonts.bold }, type.tabular]}>{value === null || value === undefined || value === '' ? '—' : value}</Text>
    </View>
  );
}

/**
 * Filter chips; counts are optional. Chips wrap onto new lines instead of scrolling sideways,
 * so no option is ever hidden past the screen edge (N8). Long sets start collapsed to the first
 * few options plus the selected one, with a chip that reveals the rest.
 */
const TABS_COLLAPSED = 4;
export function Tabs({ options, value, onChange, label }) {
  const [expanded, setExpanded] = useState(false);
  const long = options.length > TABS_COLLAPSED + 2;
  const shown = !long || expanded ? options : options.filter((option, index) => index < TABS_COLLAPSED || option.value === value);
  const hidden = options.length - shown.length;
  return (
    <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel={label}>
      {shown.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable key={String(option.value)} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(option.value)}
            style={[styles.tab, selected && styles.tabSelected]}>
            <Text style={[styles.tabText, selected && { color: colors.surface }]}>{option.label}</Text>
            {option.count !== undefined ? (
              <Text style={[styles.tabCount, selected && { color: colors.surface }]}>{option.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
      {long ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={expanded ? `Thu gọn ${label || "bộ lọc"}` : `Hiện thêm ${hidden} lựa chọn`}
          onPress={() => setExpanded((current) => !current)} style={[styles.tab, styles.tabMore]}>
          <Text style={[styles.tabText, { color: colors.brand }]}>{expanded ? "Thu gọn" : `+${hidden} khác`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MenuItem({ icon, label, hint, onPress, badge, danger }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={onPress}
      style={({ pressed }) => [styles.menu, pressed && { backgroundColor: colors.surfaceSunken }]}>
      {icon ? <View style={styles.menuIcon}>{icon}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
        {hint ? <Text style={type.caption}>{hint}</Text> : null}
      </View>
      {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

/**
 * Loads data on focus and on demand. Results from an older request never overwrite a newer
 * one; a failed refresh keeps the previous data and reports the error separately.
 */
export function useResource(loader, deps = []) {
  const [data, setData] = useState(undefined);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const load = useCallback(async ({ pull = false } = {}) => {
    const token = ++generation.current;
    if (pull) setRefreshing(true);
    try {
      const result = await loader();
      if (!mounted.current || token !== generation.current) return;
      setData(result);
      setError('');
      setState('ready');
    } catch (failure) {
      if (!mounted.current || token !== generation.current) return;
      setError(failure.message);
      setState((current) => (current === 'ready' ? 'ready' : failure.status === 403 ? 'forbidden' : 'error'));
    } finally {
      if (mounted.current && token === generation.current) setRefreshing(false);
    }
  }, deps);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return { data, setData, state, error, refreshing, reload: load };
}

/** Prevents double submission: the second tap while a request runs is ignored. */
export function useSingleFlight() {
  const [busy, setBusy] = useState(false);
  const ref = useRef(false);
  const run = useCallback(async (work) => {
    if (ref.current) return undefined;
    ref.current = true;
    setBusy(true);
    try {
      return await work();
    } finally {
      ref.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, run];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  banner: { borderRadius: 12, padding: space.md, gap: 4 },
  bannerTitle: { fontSize: 15, fontFamily: fonts.bold },
  band: { backgroundColor: colors.band, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.bandPressed },
  bandTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  bandEyebrow: { flexShrink: 1, fontSize: 12, fontFamily: fonts.semibold, color: colors.onBandSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
  bandTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.surface, lineHeight: 24 },
  bandValue: { fontSize: 30, fontFamily: fonts.monoBold, color: colors.surface, fontVariant: ['tabular-nums'] },
  bandCaption: { fontSize: 14, fontFamily: fonts.regular, color: colors.onBandSoft, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  cardPressed: { backgroundColor: colors.surfaceSunken, transform: [{ scale: 0.99 }] },
  row: { gap: 2 },
  rowValue: { fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tab: { minHeight: 40, maxWidth: '100%', paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surfaceSunken, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabMore: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  tabText: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink, flexShrink: 1 },
  tabCount: { fontSize: 12, fontFamily: fonts.mono, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  menuIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  menu: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 8, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.surface },
  menuLabel: { fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
  chevron: { fontSize: 24, color: colors.inkSubtle },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: colors.surface, fontSize: 12, fontFamily: fonts.bold },
});
