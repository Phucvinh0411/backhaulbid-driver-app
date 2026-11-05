import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Button, FieldError } from '@/components/ui';
import { useAutoTripTracking } from '@/lib/useAutoTripTracking';
import { GPS_STATUSES } from '@/lib/trackingData';
import { colors, fonts, radius, space, type } from '@/constants/theme';

export default function DriverLocationControl({ trip }) {
  const { active, starting, mode, queued, error, retry } = useAutoTripTracking(trip);
  if (!trip || !GPS_STATUSES.includes(trip.status)) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.dot, { backgroundColor: active ? colors.success : colors.warning }]} />
        <Text style={styles.title}>
          {active
            ? 'Đang phát vị trí trực tiếp'
            : starting
              ? 'Đang kết nối định vị GPS...'
              : 'Định vị trực tiếp đang tạm ngưng'}
        </Text>
      </View>
      <Text style={type.secondary}>
        {active
          ? `${mode === 'background' ? 'Vị trí xe cập nhật liên tục cả khi khóa màn hình.' : 'Vị trí xe cập nhật tự động khi mở ứng dụng.'}${queued ? ` (${queued} điểm chờ gửi)` : ''}`
          : 'Hệ thống tự động chia sẻ vị trí và quãng đường xe di chuyển cho Chủ hàng & Chủ xe suốt hành trình.'}
      </Text>
      {error ? <FieldError message={error} /> : null}
      {!active && !starting ? (
        <View style={styles.actions}>
          <Button label="Bật lại định vị GPS" onPress={retry} style={{ flex: 1 }} />
          {Platform.OS !== 'web' ? (
            <Button label="Cài đặt quyền" variant="secondary" onPress={() => Linking.openSettings()} style={{ flex: 1 }} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.xs,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    ...type.body,
    fontFamily: fonts.bold,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
  },
});
