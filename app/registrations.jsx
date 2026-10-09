import { useEffect, useMemo, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Banner, Button, Card, Screen, StateView, StatusBadge, Tabs, useResource, useSingleFlight } from '@/components/ui';
import Sheet from '@/components/Sheet';
import { auctionRoute } from '@/components/auctions/AuctionCard';
import { useAuth } from '@/lib/auth';
import { biddingApi, fleetApi, toPage } from '@/lib/services';
import { MY_BID_OUTCOME_META, getAccessStatusMeta, getMyBidOutcome } from '@/lib/shared/statusMeta';
import { formatDateTime, formatMoney, shortId } from '@/lib/shared/format';
import { colors, space, type, fonts } from '@/constants/theme';

const GROUPS = [
  { value: 'ACTION', label: 'Cần xử lý', statuses: ['PAYMENT_INCOMPLETE', 'AUCTION_OPEN'] },
  { value: 'UPCOMING', label: 'Sắp diễn ra', statuses: ['WAITING_FOR_START'] },
  { value: 'DONE', label: 'Đã kết thúc', statuses: ['AUCTION_COMPLETED', 'AUCTION_CANCELLED', 'REGISTRATION_CANCELLED', 'REGISTRATION_CLOSED'] },
  { value: 'ALL', label: 'Tất cả', statuses: null },
];
const URGENCY = { AUCTION_OPEN: 0, PAYMENT_INCOMPLETE: 1, WAITING_FOR_START: 2 };
const CANCELLABLE = new Set(['WAITING_FOR_START', 'PAYMENT_INCOMPLETE']);

export default function MyRegistrationsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [group, setGroup] = useState('ALL');
  const [outcomes, setOutcomes] = useState({});
  const [toCancel, setToCancel] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, run] = useSingleFlight();
  const requested = useRef(new Set());
  const { data, state, error, refreshing, reload } = useResource(async () => {
    const [response, vehicles] = await Promise.all([biddingApi.myRegistrations({ page: 1, pageSize: 100 }), fleetApi.vehicles().catch(() => [])]);
    return { rows: toPage(response).items, vehicles: Array.isArray(vehicles) ? vehicles : [] };
  }, []);
  const rows = useMemo(() => data?.rows || [], [data]);

  // Finished auctions: the carrier's own bids decide won/lost.
  useEffect(() => {
    rows.filter(({ auction }) => auction?.status === 'COMPLETED' && !requested.current.has(auction.id)).forEach(({ auction }) => {
      requested.current.add(auction.id);
      biddingApi.bids(auction.id, { page: 1, pageSize: 100 })
        .then((response) => {
          const mine = toPage(response).items.filter((bid) => auction.auctionType === 'SEALED' || bid.carrierId === session?.accountId);
          setOutcomes((current) => ({ ...current, [auction.id]: getMyBidOutcome({ auction, myBidIds: mine.map((bid) => bid.id) }) }));
        })
        .catch(() => {});
    });
  }, [rows, session?.accountId]);

  const inGroup = (row, value) => {
    const statuses = GROUPS.find((item) => item.value === value)?.statuses;
    return !statuses || statuses.includes(row.access?.accessStatus);
  };
  const visible = rows.filter((row) => inGroup(row, group))
    .sort((a, b) => (URGENCY[a.access?.accessStatus] ?? 9) - (URGENCY[b.access?.accessStatus] ?? 9) || new Date(b.registration?.registeredAt) - new Date(a.registration?.registeredAt));
  const plate = (vehicleId) => data?.vehicles.find((vehicle) => vehicle.id === vehicleId)?.licensePlate || 'Phương tiện đã chọn';

  const cancel = () => run(async () => {
    setCancelError('');
    try {
      await biddingApi.cancelRegistration(toCancel.auction.id, toCancel.registration.id);
      setToCancel(null);
      setNotice('Đã hủy đăng ký. Khoản đã thanh toán được hoàn theo chính sách.');
    } catch (failure) {
      setCancelError(failure.message);
    }
    await reload();
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Phiên tôi đã đăng ký' }} />
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })}>
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        <Tabs label="Nhóm" value={group} onChange={setGroup} options={GROUPS.map((item) => ({ ...item, count: rows.filter((row) => inGroup(row, item.value)).length }))} />
        {state === 'loading' && <StateView kind="loading" title="Đang tải" />}
        {state === 'error' && <StateView kind="error" title="Không tải được phiên đã đăng ký" message={error} actionLabel="Thử lại" onAction={() => reload()} />}
        {state === 'ready' && visible.length === 0 && <StateView title="Không có phiên trong mục này" message="Tìm phiên và đăng ký trong tab Đấu giá." />}
        {visible.map((row) => {
          const status = row.access?.accessStatus;
          const outcome = outcomes[row.auction?.id];
          return (
            <Card key={row.registration.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <Text style={[type.caption, type.tabular]}>#{shortId(row.auction?.id)}</Text>
                {status ? <StatusBadge {...getAccessStatusMeta(status)} /> : null}
              </View>
              <Text style={{ fontSize: 16, fontFamily: fonts.bold, color: colors.ink }}>{row.auction?.title}</Text>
              <Text style={{ fontSize: 15, fontFamily: fonts.semibold, color: colors.brand }}>{auctionRoute(row.auction)}</Text>
              <Text style={[type.secondary, type.tabular]}>Xe {plate(row.registration.vehicleId)} · phí {formatMoney(row.registration.participationFeeAmount)}{row.registration.depositAmount ? ` · cọc ${formatMoney(row.registration.depositAmount)}` : ''}</Text>
              <Text style={[type.caption, type.tabular]}>Đăng ký {formatDateTime(row.registration.registeredAt)} · bắt đầu {formatDateTime(row.auction?.startTime)}</Text>
              {outcome ? <StatusBadge {...MY_BID_OUTCOME_META[outcome]} /> : null}
              <Button label={status === 'AUCTION_OPEN' ? 'Vào phòng đấu giá' : status === 'PAYMENT_INCOMPLETE' ? 'Hoàn tất thanh toán' : 'Xem phiên'} variant={URGENCY[status] !== undefined && status !== 'WAITING_FOR_START' ? 'primary' : 'secondary'} onPress={() => router.push(`/auctions/${row.auction.id}`)} />
              {CANCELLABLE.has(status) ? <Button label="Hủy đăng ký" variant="danger" onPress={() => { setCancelError(''); setToCancel(row); }} /> : null}
            </Card>
          );
        })}
      </Screen>
      <Sheet visible={Boolean(toCancel)} title="Hủy đăng ký phiên?" busy={busy} onClose={() => setToCancel(null)}
        footer={<><Button label="Hủy đăng ký" variant="danger" onPress={cancel} loading={busy} /><Button label="Giữ đăng ký" variant="secondary" onPress={() => setToCancel(null)} disabled={busy} /></>}>
        <Text style={type.body}>Bạn sẽ không vào được phòng đấu giá “{toCancel?.auction?.title}”. Phí và cọc được hoàn theo chính sách của hệ thống.</Text>
        {cancelError ? <Banner tone="danger">{cancelError}</Banner> : null}
      </Sheet>
    </View>
  );
}
