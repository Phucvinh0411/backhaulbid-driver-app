import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Band, Button, Section, StateView, StatusBadge } from '@/components/ui';
import { useTrips } from '@/lib/useTrips';
import { formatDateTime, isClosed, shortId, statusOf } from '@/lib/trips';
import { colors, radius, space, type, fonts } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { isDriverSession, scopeKey } from '@/lib/sessionModel';
import OwnerDashboard from '@/components/OwnerDashboard';
import { getTrackingState, subscribeTracking } from '@/lib/driverTracking';

export default function TripsHome() {
  const { session } = useAuth();
  if (!session) return null;
  return isDriverSession(session) ? <DriverTripsHome key={scopeKey(session)} /> : <OwnerDashboard key={session.accountId} role={session.role} />;
}

const NEXT_BY_STATUS = {
  WAITING_PICKUP: 'Đến kho lấy hàng và xác nhận khi hàng đã lên xe.',
  PICKED_UP: 'Bấm “Bắt đầu chạy” khi rời kho.',
  IN_TRANSIT: 'Khi tới nơi, chụp bằng chứng để báo đã giao.',
  DELIVERED: 'Đã giao. Đang chờ chủ hàng xác nhận nhận hàng.',
};

function DriverTripsHome() {
  const router = useRouter();
  const [sharing, setSharing] = useState(getTrackingState);
  useEffect(() => subscribeTracking(setSharing), []);
  const { trips, state, error, refreshing, reload } = useTrips();
  const active = trips.filter((trip) => !isClosed(trip.status));
  const [current, ...others] = active;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload({ pull: true })} tintColor={colors.brand} />}
    >
      <View style={{ gap: space.sm }}><Text style={type.title}>Chuyến được giao</Text><Text style={type.secondary}>Cập nhật hành trình, chia sẻ vị trí và gửi ảnh giao hàng cho chuyến này.</Text></View>
      {state === 'loading' && <StateView kind="loading" title="Đang tải chuyến của bạn" />}
      {state === 'error' && <StateView kind="error" title="Không tải được chuyến" message={error} actionLabel="Thử lại" onAction={() => reload()} />}
      {state === 'ready' && error ? <Text style={styles.staleNote}>Chưa làm mới được: {error}</Text> : null}

      {/* One trip per code session: closed trips stay readable for 24 hours, then a new code is needed. */}
      {state === 'ready' && !current && trips[0] && (
        <StateView
          title="Chuyến đã kết thúc"
          message="Bạn vẫn xem được chuyến này trong 24 giờ. Khi được giao chuyến mới, đăng xuất rồi nhập mã nhận chuyến mới từ chủ xe."
          actionLabel="Xem chuyến"
          onAction={() => router.push(`/trips/${trips[0].id}`)}
        />
      )}
      {state === 'ready' && !trips.length && (
        <StateView
          title="Phiên này không còn chuyến"
          message="Chủ xe có thể đã cấp mã mới hoặc đổi tài xế. Đăng xuất ở tab Tài khoản rồi nhập mã nhận chuyến mới."
        />
      )}

      {current && (
        <Band eyebrow="Cần làm ngay" title={`${current.pickupLocation || '?'} → ${current.deliveryLocation || '?'}`}>
          <StatusBadge {...statusOf(current.status)} />
          <Text style={styles.bandNext}>{NEXT_BY_STATUS[current.status] || statusOf(current.status).label}</Text>
          <Text style={[styles.bandMeta, type.tabular]}>
            Chuyến #{shortId(current.id)}
            {current.expectedDeliveryAt ? ` · hạn giao ${formatDateTime(current.expectedDeliveryAt)}` : ''}
          </Text>
          <Text style={styles.bandMeta}>{sharing.active?.tripId === current.id ? `Đang chia sẻ GPS${sharing.mode === 'background' ? ' cả khi khóa màn hình' : ' khi app mở'}.` : 'Mở chuyến để bật chia sẻ vị trí.'}</Text>
          <Button label="Mở chuyến" variant="band" onPress={() => router.push(`/trips/${current.id}`)} />
        </Band>
      )}

      {others.length > 0 && (
        <Section title={`Chuyến khác được giao (${others.length})`}>
          {others.map((trip) => (
            <Pressable key={trip.id} accessibilityRole="link" onPress={() => router.push(`/trips/${trip.id}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSunken }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.rowRoute} numberOfLines={2}>
                    {`${trip.pickupLocation || '?'} → ${trip.deliveryLocation || '?'}`}
                  </Text>
                  <StatusBadge {...statusOf(trip.status)} />
                </View>
                <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  bandNext: { fontSize: 16, fontFamily: fonts.semibold, color: colors.surface, lineHeight: 22 },
  bandMeta: { fontSize: 13, fontFamily: fonts.regular, color: colors.onBandSoft },
  nextBox: { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: space.md, gap: 4 },
  nextLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.brand },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  rowRoute: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  chevron: { fontSize: 28, color: colors.inkSubtle },
  staleNote: { ...type.caption, color: colors.warning },
});
