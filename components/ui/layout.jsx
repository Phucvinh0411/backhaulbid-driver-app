import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, TOUCH, type, fonts } from '@/constants/theme';

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
 */
export function Band({ eyebrow, title, value, caption, children, style }) {
  return (
    <View style={[styles.band, style]}>
      {eyebrow ? <Text style={styles.bandEyebrow}>{eyebrow}</Text> : null}
      {title ? <Text accessibilityRole="header" style={styles.bandTitle}>{title}</Text> : null}
      {value !== undefined && value !== null ? <Text style={[styles.bandValue, type.tabular]}>{value}</Text> : null}
      {caption ? <Text style={styles.bandCaption}>{caption}</Text> : null}
      {children}
    </View>
  );
}

export function Card({ children, onPress, accessibilityLabel, style }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceSunken }, style]}>
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

/** Horizontal segmented tabs; counts are optional. */
export function Tabs({ options, value, onChange, label }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable key={String(option.value)} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(option.value)}
            style={[styles.tab, selected && styles.tabSelected]}>
            <Text style={[styles.tabText, selected && { color: colors.surface }]}>
              {option.label}{option.count !== undefined ? ` · ${option.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function MenuItem({ icon, label, hint, onPress, badge, danger }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={onPress}
      style={({ pressed }) => [styles.menu, pressed && { backgroundColor: colors.surfaceSunken }]}>
      {icon}
      <View style={{ flex: 1 }}>
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
  band: { backgroundColor: colors.band, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  bandEyebrow: { fontSize: 12, fontFamily: fonts.semibold, color: colors.onBandSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
  bandTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.surface },
  bandValue: { fontSize: 28, fontFamily: fonts.bold, color: colors.surface },
  bandCaption: { fontSize: 14, fontFamily: fonts.regular, color: colors.onBandSoft, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  row: { gap: 2 },
  rowValue: { fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
  tabs: { gap: space.sm, paddingVertical: 2 },
  tab: { minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, justifyContent: 'center' },
  tabSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  menu: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 8, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.surface },
  menuLabel: { fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
  chevron: { fontSize: 24, color: colors.inkSubtle },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: colors.surface, fontSize: 12, fontFamily: fonts.bold },
});
