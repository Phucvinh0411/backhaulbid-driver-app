import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInUp, ReduceMotion, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, fonts, motion, space } from '@/constants/theme';

// Motion primitives for the whole app. Animations run on the UI thread through reanimated and only
// touch transform and opacity. Every primitive honours the system "reduce motion" setting.

/** Fades a block in from below, staggered by its index in a list. Renders static under reduce motion. */
export function Reveal({ index = 0, children, style }) {
  const reduce = useReducedMotion();
  if (reduce) return <View style={style}>{children}</View>;
  return (
    <Animated.View
      entering={FadeInUp.duration(motion.base).delay(Math.min(index, 8) * motion.stagger).reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Counts a number to its new value, so a changed bid or balance reads as a live update.
 * `format` turns the number into text. Non-numeric values are not animated and show `fallback`.
 */
export function CountUp({ value, format = (number) => String(Math.round(number)), fallback = '—', duration = motion.slow, style }) {
  const reduce = useReducedMotion();
  const target = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const [shown, setShown] = useState(() => (reduce || target === null ? target : 0));
  const from = useRef(shown ?? 0);

  useEffect(() => {
    if (target === null) return undefined;
    if (reduce) {
      from.current = target;
      setShown(target);
      return undefined;
    }
    const start = from.current;
    const began = Date.now();
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - began) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = start + (target - start) * eased;
      from.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduce]);

  const text = target === null || shown === null ? fallback : format(shown);
  return <Text style={[style, { fontVariant: ['tabular-nums'] }]}>{text}</Text>;
}

/** Pulsing dot that marks a live state. Always paired with a text label (N4). */
export function LiveDot({ onDark = false, label = 'Trực tiếp' }) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduce) return undefined;
    pulse.value = withRepeat(withTiming(0.3, { duration: motion.pulse, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reduce]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={styles.live}>
      <Animated.View style={[styles.dot, { backgroundColor: onDark ? colors.signal : colors.signalText }, dot]} />
      <Text style={[styles.liveText, { color: onDark ? colors.onBandSoft : colors.inkMuted }]}>{label}</Text>
    </View>
  );
}

const clamp = (share) => Math.min(1, Math.max(0, Number(share) || 0));

/** A bar for a 0–1 share that glides to its new length. Pair it with a text label at the call site (N4). */
export function Gauge({ value = 0, onDark = false, label }) {
  const reduce = useReducedMotion();
  const share = useSharedValue(clamp(value));
  useEffect(() => {
    share.value = reduce ? clamp(value) : withTiming(clamp(value), { duration: motion.slow, easing: Easing.out(Easing.cubic) });
  }, [value, reduce, share]);
  const fill = useAnimatedStyle(() => ({ width: `${share.value * 100}%` }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(value) * 100) }}
      style={[styles.gaugeTrack, { backgroundColor: onDark ? colors.bandPressed : colors.surfaceSunken }]}
    >
      <Animated.View style={[styles.gaugeFill, { backgroundColor: onDark ? colors.signal : colors.brand }, fill]} />
    </View>
  );
}

/** A chart column that rises to its height. The value label stays outside, so the figure is readable before the bar settles. */
export function GrowBar({ height, style }) {
  const reduce = useReducedMotion();
  const grown = useSharedValue(reduce ? height : 0);
  useEffect(() => {
    grown.value = reduce ? height : withTiming(height, { duration: motion.slow, easing: Easing.out(Easing.cubic) });
  }, [height, reduce, grown]);
  const rise = useAnimatedStyle(() => ({ height: grown.value }));
  return <Animated.View style={[style, rise]} />;
}

/** Grey placeholder shaped like the content it stands for. A gentle pulse, no shimmer gradient. */
export function Skeleton({ width = '100%', height = 14, radius = 6, style }) {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduce) return undefined;
    opacity.value = withRepeat(withTiming(0.5, { duration: motion.pulse / 2, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduce]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View importantForAccessibility="no" accessibilityElementsHidden style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfaceSunken }, pulse, style]} />;
}

/** A card-shaped loading state: a title line and two body lines, so the layout does not jump on load. */
export function SkeletonCard({ lines = 2 }) {
  return (
    <View style={styles.skeletonCard}>
      <Skeleton width="40%" height={12} />
      <Skeleton width="78%" height={18} />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '55%' : '92%'} height={12} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  live: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 12, fontFamily: fonts.bold, letterSpacing: 0.4, textTransform: 'uppercase' },
  skeletonCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: space.lg, gap: space.sm },
  gaugeTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 4 },
});
