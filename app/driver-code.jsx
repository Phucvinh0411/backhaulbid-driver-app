import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, TextField } from '@/components/ui';
import { Reveal } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import { normalizeDriverCode } from '@/lib/sessionModel';
import { colors, radius, space, type, fonts } from '@/constants/theme';

const STEPS = [
  'Lấy mã nhận chuyến từ chủ xe (chữ dài hoặc mã QR).',
  'Quét mã QR, hoặc dán nguyên mã vào ô bên dưới.',
  'Bấm Nhận chuyến. App mở chuyến được giao ngay sau đó.',
];
const FRAME_HEIGHT = 232;

/**
 * Driver sign-in with one "mã nhận chuyến" (paste or scan). No phone, password or registration.
 * The code is long, so it is pasted or scanned rather than typed; its case is kept exactly.
 */
export default function DriverCodeScreen() {
  const { signInWithCode, recovery } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState(recoveryMessage(recovery));
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const submit = async (value = code) => {
    if (busy) return;
    if (!normalizeDriverCode(value)) {
      setError('Mã nhận chuyến chưa đúng. Hãy dán nguyên mã hoặc quét mã QR chủ xe gửi.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signInWithCode(value); // On success the app opens the assigned trip.
    } catch (failure) {
      setError(failure.isNetwork
        ? 'Chưa kết nối được máy chủ. Mã vẫn được giữ trong 2 phút, bấm Nhận chuyến để thử lại.'
        : failure.message);
    } finally {
      setBusy(false);
    }
  };

  const startScan = async () => {
    setError('');
    const status = permission?.granted ? permission : await requestPermission();
    if (!status?.granted) { setError('Chưa có quyền camera. Bạn vẫn có thể dán mã nhận chuyến.'); return; }
    setScanning(true);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Reveal>
          <Text style={type.secondary}>Chủ xe gửi cho bạn một mã nhận chuyến. Mã dùng một lần và hết hạn sau 24 giờ.</Text>
        </Reveal>

        <Reveal index={1} style={styles.panel}>
          {STEPS.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={styles.stepIndex}>
                <Text style={styles.stepIndexText}>{index + 1}</Text>
              </View>
              <Text style={[type.body, styles.stepText]}>{step}</Text>
            </View>
          ))}
        </Reveal>

        {scanning ? (
          <View style={styles.scanner}>
            <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={busy ? undefined : ({ data }) => {
                const scanned = normalizeDriverCode(data);
                if (!scanned) { setError('Mã QR này không phải mã nhận chuyến.'); return; }
                setScanning(false);
                setCode(scanned);
                void submit(scanned);
              }} />
            {/* Corner marks and a scan line show where the code must sit; decoration only, so it is hidden from assistive tech. */}
            <View pointerEvents="none" importantForAccessibility="no" accessibilityElementsHidden style={styles.frame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <ScanLine />
            </View>
          </View>
        ) : null}
        <Button label={scanning ? 'Tắt camera' : 'Quét mã QR'} variant="secondary" onPress={scanning ? () => setScanning(false) : startScan} />

        <TextField
          label="Mã nhận chuyến"
          required
          multiline
          value={code}
          onChangeText={(value) => { setCode(value); setError(''); }}
          error={error}
          hint="Mã phân biệt chữ hoa, chữ thường. Dán nguyên mã, đừng gõ lại."
          placeholder="Dán mã chủ xe gửi vào đây"
          // The secret is case-sensitive: no auto-capitalisation, correction or suggestions.
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          importantForAutofill="no"
          textContentType="none"
          keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
          inputStyle={styles.code}
        />
        <Button label={busy ? 'Đang nhận chuyến...' : 'Nhận chuyến'} onPress={() => submit()} loading={busy} />
        <Text style={type.caption}>Mã sai, đã dùng hoặc hết hạn: nhờ chủ xe cấp mã mới trong ứng dụng hoặc trên web.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A thin line that travels down the scan frame. Stops under reduce motion. */
function ScanLine() {
  const reduce = useReducedMotion();
  const travel = useSharedValue(0);
  useEffect(() => {
    if (reduce) return undefined;
    travel.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(travel);
  }, [reduce, travel]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: travel.value * (FRAME_HEIGHT - 2) }] }));
  if (reduce) return null;
  return <Animated.View style={[styles.scanLine, line]} />;
}

function recoveryMessage(recovery) {
  if (recovery?.state === 'expired') return 'Lần nhận chuyến trước chưa hoàn tất và đã quá 2 phút. Hãy nhập lại mã; nếu báo đã dùng, nhờ chủ xe cấp mã mới.';
  if (recovery?.state === 'offline') return 'Lần nhận chuyến trước bị gián đoạn mạng. Nhập lại mã để thử tiếp.';
  if (recovery?.state === 'failed') return recovery.message || '';
  return '';
}

const CORNER = 26;
const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, maxWidth: 480, width: '100%', alignSelf: 'center' },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  stepIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stepIndexText: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.brand },
  stepText: { flex: 1, paddingTop: 3 },
  code: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20 },
  scanner: { height: 280, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.ink },
  frame: { position: 'absolute', top: 24, bottom: 24, left: 24, right: 24 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.surface },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  // Signal colour: the camera is live right now (DESIGN.md signal rule).
  scanLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: colors.signal },
});
