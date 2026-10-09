import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { colors, radius, space, TOUCH, type, fonts } from '@/constants/theme';

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');
const groupDigits = (digits) => (digits ? new Intl.NumberFormat('vi-VN').format(Number(digits)) : '');

export function FieldLabel({ label, required }) {
  return (
    <Text style={styles.label}>
      {label}
      {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
    </Text>
  );
}

export function TextField({ label, required, value, onChangeText, error, hint, multiline, style, inputStyle, onFocus, onBlur, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      {label ? <FieldLabel label={label} required={required} /> : null}
      <TextInput
        accessibilityLabel={label}
        value={value == null ? '' : String(value)}
        onChangeText={onChangeText}
        placeholderTextColor={colors.inkSubtle}
        multiline={multiline}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[styles.input, multiline && styles.multiline, focused && styles.inputFocused, error && styles.inputError, rest.editable === false && { backgroundColor: colors.canvas }, inputStyle]}
        {...rest}
      />
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** VND input that shows grouped digits and reports a plain digit string. */
export function MoneyField({ value, onChange, ...rest }) {
  return (
    <TextField
      {...rest}
      value={groupDigits(digitsOnly(value))}
      onChangeText={(text) => onChange(digitsOnly(text))}
      keyboardType="number-pad"
      inputStyle={type.tabular}
    />
  );
}

/** Single choice from a short list, shown as wrapping chips (radio semantics). */
export function ChoiceChips({ label, required, options, value, onChange, error, disabled }) {
  return (
    <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? <FieldLabel label={label} required={required} /> : null}
      <View style={styles.chips}>
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          const selected = item.value === value;
          return (
            <Pressable
              key={String(item.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(selected && !required ? '' : item.value)}
              style={[styles.chip, selected && styles.chipSelected, disabled && { opacity: 0.5 }]}
            >
              <Text style={[styles.chipText, selected && { color: colors.surface }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange, disabled }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} value={Boolean(value)} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.brand }} />
    </View>
  );
}

export function CheckRow({ label, value, onChange }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(value) }} onPress={() => onChange(!value)} style={styles.checkRow}>
      <View style={[styles.box, value && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
        {value ? <Text style={{ color: colors.surface, fontFamily: fonts.bold }}>✓</Text> : null}
      </View>
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

const pad = (value) => String(value).padStart(2, '0');
const DAY_MS = 86_400_000;

/**
 * Date + time picker without native modules: pick one of the next 30 days, then step the
 * hour and minute. Value is an ISO string (or '') in the device time zone.
 */
export function DateTimeField({ label, required, value, onChange, error, hint, minuteStep = 15 }) {
  const date = value ? new Date(value) : null;
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 30 }, (_, index) => new Date(start.getTime() + index * DAY_MS));
  }, []);
  const set = (next) => onChange(next ? next.toISOString() : '');
  const base = () => {
    if (date) return new Date(date);
    const next = new Date();
    next.setMinutes(Math.ceil(next.getMinutes() / minuteStep) * minuteStep, 0, 0);
    next.setHours(next.getHours() + 1);
    return next;
  };
  const pickDay = (day) => {
    const next = base();
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    set(next);
  };
  const shift = (minutes) => set(new Date(base().getTime() + minutes * 60_000));
  const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();

  return (
    <View style={styles.field}>
      {label ? <FieldLabel label={label} required={required} /> : null}
      <View style={[styles.dateBox, error && styles.inputError]}>
        <Text style={[styles.dateValue, type.tabular]} accessibilityLiveRegion="polite">
          {date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}` : 'Chưa chọn'}
        </Text>
        <View style={styles.dayRow}>
          {days.slice(0, 8).map((day, index) => (
            <Pressable key={day.toISOString()} accessibilityRole="button" accessibilityState={{ selected: sameDay(day, date) }}
              accessibilityLabel={`Ngày ${day.getDate()} tháng ${day.getMonth() + 1}`}
              onPress={() => pickDay(day)} style={[styles.day, sameDay(day, date) && styles.chipSelected]}>
              <Text style={[styles.dayText, sameDay(day, date) && { color: colors.surface }]}>{index === 0 ? 'Hôm nay' : index === 1 ? 'Mai' : `${pad(day.getDate())}/${pad(day.getMonth() + 1)}`}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.stepRow}>
          {[[-60, '−1 giờ'], [-minuteStep, `−${minuteStep}′`], [minuteStep, `+${minuteStep}′`], [60, '+1 giờ'], [DAY_MS / 60_000 * 7, '+7 ngày']].map(([minutes, text]) => (
            <Pressable key={text} accessibilityRole="button" accessibilityLabel={`${label}: ${text}`} onPress={() => shift(minutes)} style={styles.step}>
              <Text style={styles.stepText}>{text}</Text>
            </Pressable>
          ))}
          {date && !required ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Xóa ${label}`} onPress={() => set(null)} style={styles.step}>
              <Text style={[styles.stepText, { color: colors.danger }]}>Xóa</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  // DESIGN.md soft-filled input: grey fill, no visible border; navy ring when focused.
  input: { minHeight: TOUCH, borderWidth: 2, borderColor: 'transparent', borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16, fontFamily: fonts.regular, color: colors.ink, backgroundColor: colors.surfaceSunken },
  inputFocused: { backgroundColor: colors.surface, borderColor: colors.brand },
  multiline: { minHeight: TOUCH * 2, paddingTop: space.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger, borderWidth: 2 },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.semibold },
  hint: { fontSize: 13, color: colors.inkMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.surfaceSunken, backgroundColor: colors.surfaceSunken, justifyContent: 'center' },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  switchLabel: { fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  box: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  dateBox: { borderWidth: 2, borderColor: 'transparent', borderRadius: radius.md, padding: space.md, gap: space.sm, backgroundColor: colors.surfaceSunken },
  dateValue: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { minHeight: 36, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center' },
  dayText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
  stepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  step: { minHeight: 36, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: 'center' },
  stepText: { fontSize: 13, fontFamily: fonts.bold, color: colors.brand },
});
