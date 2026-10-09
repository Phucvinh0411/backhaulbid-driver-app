import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Band, Button, Card, Screen, Section, StateView } from '@/components/ui';
import { useResource } from '@/components/ui/layout';
import { api } from '@/lib/api';
import { biddingApi, contractApi, notificationApi, toPage, walletApi } from '@/lib/services';
import { carrierTasks, shipperTasks } from '@/lib/ownerTasks';
import { formatMoney } from '@/lib/shared/format';
import { colors, radius, space, tones, type, fonts } from '@/constants/theme';

const asList = (value) => (Array.isArray(value) ? value : value?.data || []);

/** Owner home: live counts and the tasks waiting for this account. */
export default function OwnerDashboard({ role }) {
  const router = useRouter();
  const shipper = role === 'SHIPPER';
  const { data, state, error, refreshing, reload } = useResource(async () => {
    const [primary, contracts, trips, wallet, unread] = await Promise.all([
      shipper ? biddingApi.list({ page: 1, pageSize: 100 }) : biddingApi.myRegistrations({ page: 1, pageSize: 100 }),
      contractApi.mine(),
      api.get('/api/v1/trips/mine'),
      walletApi.me().catch(() => null),
      notificationApi.unreadCount().catch(() => null),
    ]);
    const items = toPage(primary).items;
    const input = { contracts: asList(contracts), trips: asList(trips) };
    const tasks = shipper ? shipperTasks({ ...input, auctions: items }) : carrierTasks({ ...input, registrations: items });
    const activeTrips = input.trips.filter((trip) => !['COMPLETED', 'CANCELLED'].includes(trip.status)).length;
    const live = shipper ? items.filter((auction) => auction.status === 'OPEN' || auction.status === 'PENDING').length
      : items.filter((row) => ['AUCTION_OPEN', 'WAITING_FOR_START'].includes(row.access?.accessStatus)).length;
    const unreadCount = typeof unread === 'number' ? unread : unread?.count ?? unread?.unreadCount ?? null;
    return { tasks, activeTrips, live, wallet, unreadCount };
  }, [role]);

  if (state === 'loading') return <StateView kind="loading" title="Đang tải trang chủ" />;
  if (state === 'error') return <StateView kind="error" title="Không tải được trang chủ" message={error} actionLabel="Thử lại" onAction={() => reload()} />;

  const urgent = data.tasks[0]?.tone === "danger" ? data.tasks[0] : null;
  const rest = urgent ? data.tasks.slice(1) : data.tasks;

  const stats = [
    { label: shipper ? 'Phiên đang chạy' : 'Phiên sắp/đang đấu', value: data.live, href: shipper ? '/auctions' : '/registrations' },
    { label: 'Chuyến đang thực hiện', value: data.activeTrips, href: '/trips' },
    { label: 'Số dư khả dụng', value: data.wallet ? formatMoney(data.wallet.availableBalance) : '—', href: '/wallet' },
    { label: 'Thông báo chưa đọc', value: data.unreadCount ?? '—', href: '/notifications' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })}>
      {error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}
      <View style={styles.stats}>
        {stats.map((item) => (
          <Pressable key={item.label} accessibilityRole="link" accessibilityLabel={`${item.label}: ${item.value}`} onPress={() => router.push(item.href)} style={({ pressed }) => [styles.stat, pressed && { backgroundColor: colors.surfaceSunken }]}>
            <Text style={[styles.statValue, type.tabular]} numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
            <Text style={type.caption}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* DESIGN.md: the most urgent task sits on the navy band with a direct action. */}
      {urgent ? (
        <Band eyebrow="Việc gấp nhất" title={urgent.label} caption={`${urgent.title} · ${urgent.detail}`}>
          <Button label="Xử lý ngay" variant="band" onPress={() => router.push(urgent.href)} />
        </Band>
      ) : null}

      <Section title="Việc cần xử lý" right={<Text style={type.caption}>{data.tasks.length ? `${data.tasks.length} việc` : ''}</Text>}>
        {data.tasks.length === 0 ? <Text style={type.secondary}>Không có việc nào đang chờ bạn.</Text> : null}
        {urgent && rest.length === 0 ? <Text style={type.secondary}>Không còn việc nào khác.</Text> : null}
        {rest.slice(0, 12).map((task) => (
          <Pressable key={task.key} accessibilityRole="link" onPress={() => router.push(task.href)} style={({ pressed }) => [styles.task, pressed && { backgroundColor: colors.surfaceSunken }]}>
            <View style={[styles.pill, { backgroundColor: tones[task.tone]?.bg, borderColor: tones[task.tone]?.border }]}>
              <Text style={[styles.pillText, { color: tones[task.tone]?.fg }]}>{task.label}</Text>
            </View>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={[type.caption, type.tabular]}>{task.detail}</Text>
          </Pressable>
        ))}
      </Section>

      <Card>
        {shipper ? (
          <>
            <Button label="Tạo phiên đấu giá" onPress={() => router.push('/auctions/new')} />
            <Button label="Sổ địa chỉ kho" variant="secondary" onPress={() => router.push('/addresses')} />
          </>
        ) : (
          <>
            <Button label="Tìm phiên đấu giá" onPress={() => router.push('/auctions')} />
            <Button label="Phiên tôi đã đăng ký" variant="secondary" onPress={() => router.push('/registrations')} />
          </>
        )}
        <Button label="Xem thống kê" variant="secondary" onPress={() => router.push('/statistics')} />
        <Button label="Hợp đồng" variant="secondary" onPress={() => router.push('/contracts')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { width: '48%', flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.md, gap: 4, minHeight: 76 },
  statValue: { fontSize: 20, fontFamily: fonts.bold, color: colors.ink },
  task: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: space.sm, gap: 4 },
  pill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 12, fontFamily: fonts.bold },
  taskTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
});
