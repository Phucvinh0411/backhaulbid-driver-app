import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, FieldError } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, radius, space, TOUCH, type, fonts } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, expired, signOutNotice } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(expired ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : '');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const next = {};
    if (!/^\d{9,11}$/.test(phone.trim())) next.phone = 'Nhập số điện thoại 9–11 chữ số.';
    if (!password) next.password = 'Nhập mật khẩu.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    setFormError('');
    try {
      await signIn(phone.trim(), password);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>B</Text>
            </View>
            <Text style={styles.brandName}>BackHaulBid</Text>
          </View>
          {/* Drivers have no account: they enter the one-time code their carrier sent. */}
          <View style={styles.driverCard}>
            <Text style={type.heading}>Tài xế</Text>
            <Text style={type.secondary}>Nhập hoặc quét mã nhận chuyến do chủ xe gửi. Không cần số điện thoại hay mật khẩu.</Text>
            <Button label="Nhập mã nhận chuyến" onPress={() => router.push('/driver-code')} />
          </View>
          {signOutNotice ? <View style={styles.alert} accessibilityRole="alert"><Text style={styles.alertText}>{signOutNotice}</Text></View> : null}
          <Text style={type.title}>Chủ hàng, Chủ xe đăng nhập</Text>

          {formError ? (
            <View style={styles.alert} accessibilityRole="alert">
              <Text style={styles.alertText}>{formError}</Text>
            </View>
          ) : null}

          <View>
            <Text style={styles.label} nativeID="phone-label">Số điện thoại</Text>
            <TextInput
              accessibilityLabelledBy="phone-label"
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                setErrors((current) => ({ ...current, phone: undefined }));
              }}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="09xxxxxxxx"
              placeholderTextColor={colors.inkSubtle}
              returnKeyType="next"
            />
            <FieldError message={errors.phone} />
          </View>
          <View>
            <Text style={styles.label} nativeID="password-label">Mật khẩu</Text>
            <TextInput
              accessibilityLabelledBy="password-label"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: undefined }));
              }}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              style={[styles.input, errors.password && styles.inputError]}
              onSubmitEditing={submit}
              returnKeyType="go"
            />
            <FieldError message={errors.password} />
          </View>
          <Button label={submitting ? 'Đang đăng nhập...' : 'Đăng nhập'} onPress={submit} loading={submitting} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.xl, gap: space.lg, maxWidth: 480, width: '100%', alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  brandMark: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#fff', fontFamily: fonts.bold, fontSize: 18 },
  brandName: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },
  label: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink, marginBottom: 6 },
  input: { minHeight: TOUCH, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16, color: colors.ink, backgroundColor: colors.surface },
  inputError: { borderColor: colors.danger, borderWidth: 2 },
  alert: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space.md },
  driverCard: { padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.brandSoft, gap: space.sm },
  alertText: { color: colors.danger, fontSize: 14, fontFamily: fonts.semibold },
});
