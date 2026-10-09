import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, FieldError } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { normalizeDriverCode } from '@/lib/sessionModel';
import { colors, radius, space, TOUCH, type, fonts } from '@/constants/theme';

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
        <Text style={type.title}>Nhận chuyến bằng mã</Text>
        <Text style={type.secondary}>Chủ xe gửi cho bạn một mã nhận chuyến (dạng chữ dài hoặc mã QR). Mã dùng một lần và hết hạn sau 24 giờ.</Text>

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
          </View>
        ) : null}
        <Button label={scanning ? 'Tắt camera' : 'Quét mã QR'} variant="secondary" onPress={scanning ? () => setScanning(false) : startScan} />

        <View>
          <Text style={styles.label} nativeID="code-label">Mã nhận chuyến</Text>
          <TextInput
            accessibilityLabelledBy="code-label"
            value={code}
            onChangeText={(value) => { setCode(value); setError(''); }}
            // The secret is case-sensitive: no auto-capitalisation, correction or suggestions.
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            importantForAutofill="no"
            textContentType="none"
            keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
            multiline
            style={[styles.input, type.tabular, error && styles.inputError]}
            placeholder="Dán mã chủ xe gửi vào đây"
            placeholderTextColor={colors.inkSubtle}
          />
          <FieldError message={error} />
        </View>
        <Button label={busy ? 'Đang nhận chuyến...' : 'Nhận chuyến'} onPress={() => submit()} loading={busy} />
        <Text style={type.caption}>Mã sai, đã dùng hoặc hết hạn: nhờ chủ xe cấp mã mới trong ứng dụng hoặc trên web.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function recoveryMessage(recovery) {
  if (recovery?.state === 'expired') return 'Lần nhận chuyến trước chưa hoàn tất và đã quá 2 phút. Hãy nhập lại mã; nếu báo đã dùng, nhờ chủ xe cấp mã mới.';
  if (recovery?.state === 'offline') return 'Lần nhận chuyến trước bị gián đoạn mạng. Nhập lại mã để thử tiếp.';
  if (recovery?.state === 'failed') return recovery.message || '';
  return '';
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, maxWidth: 480, width: '100%', alignSelf: 'center' },
  label: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink, marginBottom: 6 },
  input: { minHeight: TOUCH * 2, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, padding: space.md, fontSize: 15, color: colors.ink, backgroundColor: colors.surface, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger, borderWidth: 2 },
  scanner: { height: 280, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.ink },
});
