import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, space, TOUCH } from '@/constants/theme';

/** Owner account actions live in the header; driver sessions keep their own trip-scoped account screen. */
export default function OwnerAvatarMenu() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  if (session?.role !== 'SHIPPER' && session?.role !== 'CARRIER') return null;

  const close = () => { if (!busy) setVisible(false); };
  const logout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      setVisible(false);
    } catch {
      Alert.alert('Không thể đăng xuất', 'Hãy thử lại sau.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở menu tài khoản"
        accessibilityHint="Mở hồ sơ hoặc đăng xuất"
        accessibilityState={{ expanded: visible }}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
      >
        <Text style={styles.avatarText}>{String(session.phone || 'T').slice(-1)}</Text>
      </Pressable>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Đóng menu tài khoản" />
          <View accessibilityRole="menu" style={[styles.menu, { top: insets.top + 52 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Hồ sơ" onPress={() => { setVisible(false); router.push('/account'); }} style={styles.item}>
              <Text style={styles.itemText}>Hồ sơ</Text>
            </Pressable>
            <View style={styles.divider} />
            <Pressable accessibilityRole="button" accessibilityLabel="Đăng xuất" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={logout} style={styles.item}>
              {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={[styles.itemText, styles.danger]}>Đăng xuất</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: { width: TOUCH, height: TOUCH, marginRight: space.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  avatarPressed: { opacity: 0.78 },
  avatarText: { color: colors.surface, fontFamily: fonts.bold, fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(16, 47, 68, 0.12)' },
  menu: { position: 'absolute', right: space.md, width: 220, paddingVertical: space.xs, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, elevation: 8 },
  item: { minHeight: 48, justifyContent: 'center', paddingHorizontal: space.lg },
  itemText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  danger: { color: colors.danger },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
});
