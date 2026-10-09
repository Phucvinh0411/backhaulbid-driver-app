import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteBlock, StateView, StatusBadge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useTrips } from '@/lib/useTrips';
import { formatDateTime, shortId, statusOf } from '@/lib/trips';
import { OWNER_GROUPS, getOwnerNextStep, groupOwnerTrips } from '@/lib/tracking';
import { colors, radius, space, TOUCH, type, fonts } from '@/constants/theme';

const EMPTY = {
  action: 'Không có chuyến nào cần bạn xử lý.',
  active: 'Chưa có chuyến đang thực hiện.',
  done: 'Chưa có chuyến hoàn thành hoặc đã hủy.',
};

/** Shipper/carrier order tracking: /trips/mine is scoped by the server role. */
export default function BusinessHome() {
  const router = useRouter();
  const { session } = useAuth();
  const role = session?.role;
  const { trips, state, error, refreshing, reload } = useTrips();
  const groups = groupOwnerTrips(trips, role);
  const [tab, setTab] = useState(null);
  const current = tab ?? (groups.action.length ? 'action' : 'active');
  const list = groups[current] || [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload({ pull: true })} tintColor={colors.brand} />}>
      <Text style={type.title}>Theo dõi chuyến hàng</Text>
      <Text style={type.secondary}>{role === 'SHIPPER' ? 'Từ lúc lấy hàng đến khi nhận đủ hàng.' : 'Phân công Tài xế và theo dõi hành trình giao nhận.'}</Text>

      <View style={styles.tabs} accessibilityRole="tablist">
        {OWNER_GROUPS.map((group) => {
          const selected = group.key === current;
          return (
            <Pressable key={group.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setTab(group.key)}
              style={[styles.tab, selected && styles.tabSelected]}>
              <Text style={[styles.tabText, selected && { color: colors.surface }]}>{group.label}</Text>
              <Text style={[styles.tabCount, selected && { color: colors.surface }]}>{groups[group.key].length}</Text>
            </Pressable>
          );
        })}
      </View>

      {state === 'loading' && <StateView kind="loading" title="Đang tải chuyến" />}
      {state === 'error' && <StateView kind="error" title="Không tải được chuyến" message={error} actionLabel="Thử lại" onAction={() => reload()} />}
      {state === 'ready' && error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}
      {state === 'ready' && list.length === 0 && <StateView title={EMPTY[current]} message="Chuyến được tạo sau khi trao thầu; kéo xuống để làm mới." />}

      {list.map((trip) => (
        <Pressable key={trip.id} accessibilityRole="button" accessibilityLabel={`Chuyến ${shortId(trip.id)}, ${statusOf(trip.status).label}`}
          onPress={() => router.push(`/business/trips/${trip.id}`)}
          style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceSunken }]}>
          <View style={styles.cardHead}>
            <StatusBadge {...statusOf(trip.status)} />
            <Text style={[type.caption, type.tabular]}>#{shortId(trip.id)}</Text>
          </View>
          <RouteBlock from={trip.pickupLocation} to={trip.deliveryLocation} />
          <Text style={styles.next}>{getOwnerNextStep(trip, role)}</Text>
          <Text style={[type.caption, type.tabular]}>Cập nhật {formatDateTime(trip.updatedAt || trip.createdAt)}{trip.expectedDeliveryAt ? ` · Hạn giao ${formatDateTime(trip.expectedDeliveryAt)}` : ''}</Text>
        </Pressable>
      ))}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  tabs: { flexDirection: 'row', gap: space.sm },
  tab: { flex: 1, minHeight: TOUCH, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink, textAlign: 'center' },
  tabCount: { fontSize: 12, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  next: { fontSize: 14, color: colors.brand, fontFamily: fonts.semibold },
});
