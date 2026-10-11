import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Band, Button, Card, Screen, Section, StateView } from '@/components/ui';
import { useResource } from '@/components/ui/layout';
import { CountUp, LiveDot, Reveal } from '@/components/motion';
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

  const urgent = data.tasks[0]?.tone === 'danger' ? data.tasks[0] : null;
  const rest = urgent ? data.tasks.slice(1) : data.tasks;

  const stats = [
    { label: shipper ? 'Phiên đang chạy' : 'Phiên sắp/đang đấu', count: data.live, live: data.live > 0, href: shipper ? '/auctions' : '/registrations' },
    { label: 'Chuyến đang thực hiện', count: data.activeTrips, href: '/trips' },
    { label: 'Số dư khả dụng', text: data.wallet ? formatMoney(data.wallet.availableBalance) : '—', href: '/wallet' },
    { label: 'Thông báo chưa đọc', count: typeof data.unreadCount === 'number' ? data.unreadCount : undefined, text: data.unreadCount ?? '—', href: '/notifications' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })}>
      {error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}

      <Reveal>
        <View style={styles.stats}>
          {stats.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="link"
              accessibilityLabel={`${item.label}: ${item.count ?? item.text}`}
              onPress={() => router.push(item.href)}
              style={({ pressed }) => [styles.stat, pressed && styles.statPressed]}
            >
              <Text style={type.caption} numberOfLines={1}>{item.label}</Text>
              {typeof item.count === 'number' ? (
                <CountUp value={item.count} style={styles.statValue} />
              ) : (
                // Money is wider than a count: it gets a smaller size up front, because fit-to-width does not run on web.
                <Text style={[styles.statValue, styles.statMoney]} numberOfLines={1}>{item.text}</Text>
              )}
              {/* The foot row is always reserved, so a card that goes live does not change height (N1). */}
              <View style={styles.statFoot}>{item.live ? <LiveDot /> : null}</View>
            </Pressable>
          ))}
        </View>
      </Reveal>

      {/* DESIGN.md: the most urgent task sits on the navy band with a direct action. */}
      {urgent ? (
        <Reveal index={1}>
          <Band eyebrow="Việc gấp nhất" title={urgent.label} caption={`${urgent.title} · ${urgent.detail}`}>
            <Button label="Xử lý ngay" variant="band" onPress={() => router.push(urgent.href)} />
          </Band>
        </Reveal>
      ) : null}

      <Section title="Việc cần xử lý" right={<Text style={type.code}>{data.tasks.length ? `${data.tasks.length} việc` : ''}</Text>}>
        {data.tasks.length === 0 ? <Text style={type.secondary}>Không có việc nào đang chờ bạn.</Text> : null}
        {urgent && rest.length === 0 ? <Text style={type.secondary}>Không còn việc nào khác.</Text> : null}
        {rest.slice(0, 12).map((task, index) => (
          <Reveal key={task.key} index={index + 2}>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(task.href)}
              style={({ pressed }) => [styles.task, pressed && { backgroundColor: colors.surfaceSunken }]}
            >
              <View style={[styles.pill, { backgroundColor: tones[task.tone]?.bg, borderColor: tones[task.tone]?.border }]}>
                <Text style={[styles.pillText, { color: tones[task.tone]?.fg }]}>{task.label}</Text>
              </View>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={type.code}>{task.detail}</Text>
            </Pressable>
          </Reveal>
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
  // Two equal columns: each figure gets the same box whatever its length, so nothing shifts on load.
  stat: { width: '48%', flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.md, gap: space.xs, minHeight: 84, justifyContent: 'space-between' },
  statPressed: { backgroundColor: colors.surfaceSunken },
  statFoot: { minHeight: 16, justifyContent: 'center' },
  statValue: { fontSize: 22, fontFamily: fonts.monoBold, color: colors.ink, fontVariant: ['tabular-nums'] },
  statMoney: { fontSize: 18 },
  task: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: space.sm, gap: space.xs, borderRadius: radius.sm, paddingHorizontal: space.xs },
  pill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 12, fontFamily: fonts.bold },
  taskTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  taskDetail: { fontSize: 12 },
});
