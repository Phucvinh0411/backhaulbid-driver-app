import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Banner, Button, TextField } from '@/components/ui';
import { Reveal } from '@/components/motion';
import { useAuth } from '@/lib/auth';
import { colors, radius, space, type, fonts } from '@/constants/theme';

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
          {/* The brand block is the one navy panel here: it names the product before the form asks for anything. */}
          <Reveal>
            <View style={styles.hero}>
              <View style={styles.mark}>
                <FontAwesome6 name="truck" size={18} color={colors.brand} />
              </View>
              <Text style={styles.heroName}>BackHaulBid</Text>
              <Text style={styles.heroTitle}>Đấu giá xe tải chiều về</Text>
              <Text style={styles.heroBody}>Chủ hàng đăng lô, chủ xe đặt giá, tài xế chạy chuyến.</Text>
            </View>
          </Reveal>

          <Reveal index={1}>
            <View style={styles.form}>
              <Text style={type.heading}>Chủ hàng, chủ xe đăng nhập</Text>
              {signOutNotice ? <Banner tone="neutral">{signOutNotice}</Banner> : null}
              {formError ? <Banner tone="danger">{formError}</Banner> : null}

              <TextField
                label="Số điện thoại"
                required
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  setErrors((current) => ({ ...current, phone: undefined }));
                }}
                error={errors.phone}
                placeholder="09xxxxxxxx"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="next"
              />
              <TextField
                label="Mật khẩu"
                required
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrors((current) => ({ ...current, password: undefined }));
                }}
                error={errors.password}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                onSubmitEditing={submit}
                returnKeyType="go"
              />
              <Button label={submitting ? 'Đang đăng nhập...' : 'Đăng nhập'} onPress={submit} loading={submitting} />
            </View>
          </Reveal>

          {/* Drivers have no account: they enter the one-time code their carrier sent. Secondary on purpose, one navy action per view. */}
          <Reveal index={2} style={styles.driverBlock}>
            <View style={styles.divider}>
              <View style={styles.rule} />
              <Text style={type.caption}>hoặc</Text>
              <View style={styles.rule} />
            </View>
            <View style={styles.driver}>
              <View style={styles.driverText}>
                <Text style={type.heading}>Tôi là tài xế</Text>
                <Text style={type.secondary}>Nhập mã nhận chuyến chủ xe gửi. Không cần số điện thoại hay mật khẩu.</Text>
              </View>
              <Button label="Nhập mã nhận chuyến" variant="secondary" onPress={() => router.push('/driver-code')} />
            </View>
          </Reveal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, gap: space.lg, maxWidth: 480, width: '100%', alignSelf: 'center' },
  hero: { backgroundColor: colors.band, borderRadius: radius.lg, padding: space.xl, gap: space.sm, borderWidth: 1, borderColor: colors.bandPressed },
  mark: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  heroName: { fontSize: 12, fontFamily: fonts.semibold, color: colors.onBandSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
  heroTitle: { fontSize: 24, fontFamily: fonts.bold, color: colors.surface, lineHeight: 30 },
  heroBody: { fontSize: 14, fontFamily: fonts.regular, color: colors.onBandSoft, lineHeight: 20 },
  form: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  driver: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  driverText: { gap: 4 },
  driverBlock: { gap: space.lg },
});
