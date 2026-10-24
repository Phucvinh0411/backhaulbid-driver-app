import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, radius, space, TOUCH, type } from '@/constants/theme';

/**
 * Bottom sheet used for confirmations and short forms; stays above the keyboard.
 * Closes three ways (backdrop, the close button, Android back); all are blocked while `busy`.
 */
export default function Sheet({ visible, title, onClose, busy = false, children, footer }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityLabel="Đóng" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[type.title, styles.title]}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.close, pressed && { backgroundColor: colors.line }, busy && { opacity: 0.4 }]}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={{ gap: space.md }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <View style={styles.footer}>{footer}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 30, 46, 0.45)' },
  // DESIGN.md: sheets are the one surface that carries a shadow (level 2) instead of a border.
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center', ...elevation.level2 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { flex: 1, fontSize: 18, lineHeight: 24 },
  close: { width: TOUCH - 8, height: TOUCH - 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken },
  closeText: { fontSize: 16, color: colors.inkMuted },
  body: { maxHeight: 420 },
  footer: { gap: space.sm },
});
