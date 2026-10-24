import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '@/lib/auth';
import { biddingApi, loadAllPages, toPage } from '@/lib/services';
import { getAuctionPhase } from '@/lib/shared/statusMeta';
import AuctionCard from '@/components/auctions/AuctionCard';
import { Banner, Button, Screen, StateView, Tabs, TextField, useResource } from '@/components/ui';
import { colors, type } from '@/constants/theme';

const text = (value) => String(value || '').toLocaleLowerCase('vi');
const matches = (auction, needle) => !needle || [auction.title, auction.goodsType, auction.origin, auction.destination, auction.pickupLocation?.address, auction.deliveryLocation?.address, auction.id].map(text).join(' ').includes(needle);

export default function AuctionsTab() {
  const { session } = useAuth();
  if (!session) return null;
  return session.role === 'SHIPPER' ? <ShipperAuctions key={session.accountId} /> : <CarrierAuctions key={session.accountId} />;
}

const SHIPPER_TABS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'ACTION', label: 'Cần xử lý' },
  { value: 'PENDING', label: 'Chờ mở' },
  { value: 'OPEN', label: 'Đang đấu giá' },
  { value: 'COMPLETED', label: 'Đã kết thúc' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

function ShipperAuctions() {
  const router = useRouter();
  const [tab, setTab] = useState('ALL');
  const [query, setQuery] = useState('');
  // The server scopes a shipper's list to their own auctions.
  const { data, state, error, refreshing, reload } = useResource(() => loadAllPages((params) => biddingApi.list(params)), []);
  const items = useMemo(() => [...(data?.items || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [data]);
  const needsAction = (auction) => getAuctionPhase(auction) === 'AWAITING_WINNER' || auction.awardStatus === 'AWAITING_SHIPPER_SIGNATURE';
  const inTab = (auction, value) => (value === 'ALL' ? true : value === 'ACTION' ? needsAction(auction) : auction.status === value);
  const needle = text(query.trim());
  const visible = items.filter((auction) => inTab(auction, tab) && matches(auction, needle));

  return (
    <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })}>
      <Button label="Tạo phiên đấu giá mới" onPress={() => router.push('/auctions/new')} />
      <Tabs label="Trạng thái phiên" value={tab} onChange={setTab} options={SHIPPER_TABS.map((option) => ({ ...option, count: items.filter((auction) => inTab(auction, option.value)).length }))} />
      <TextField placeholder="Tìm theo tên lô hàng, địa điểm, mã phiên" value={query} onChangeText={setQuery} accessibilityLabel="Tìm phiên" returnKeyType="search" />
      {state === 'loading' && <StateView kind="loading" title="Đang tải phiên đấu giá" />}
      {state === 'error' && <StateView kind="error" title="Không tải được phiên" message={error} actionLabel="Thử lại" onAction={() => reload()} />}
      {state === 'ready' && error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}
      {state === 'ready' && data && !data.complete ? <Banner tone="warning">Danh sách quá dài nên chỉ hiển thị 1.000 phiên mới nhất.</Banner> : null}
      {state === 'ready' && visible.length === 0 && <StateView title={query ? 'Không có phiên phù hợp' : 'Chưa có phiên trong mục này'} message="Tạo phiên mới để nhà xe đăng ký và đặt giá." />}
      {visible.map((auction) => <AuctionCard key={auction.id} auction={auction} role="SHIPPER" onPress={() => router.push(`/auctions/${auction.id}`)} />)}
    </Screen>
  );
}

const CARRIER_SCOPES = [
  { value: 'REGISTRATION', label: 'Đang nhận đăng ký' },
  { value: 'OPEN', label: 'Đang đấu giá' },
  { value: 'ALL', label: 'Tất cả' },
];
const TYPE_FILTERS = [{ value: '', label: 'Mọi hình thức' }, { value: 'PUBLIC', label: 'Công khai' }, { value: 'SEALED', label: 'Đấu giá kín' }];
const SORTS = [{ value: 'deadline', label: 'Sắp hết hạn' }, { value: 'priceDesc', label: 'Giá trần cao' }, { value: 'newest', label: 'Mới nhất' }];
const deadlineOf = (auction) => new Date(auction.status === 'OPEN' ? auction.endTime : auction.registrationEndTime || auction.startTime).getTime() || 0;

function CarrierAuctions() {
  const router = useRouter();
  const [scope, setScope] = useState('REGISTRATION');
  const [auctionType, setAuctionType] = useState('');
  const [sort, setSort] = useState('deadline');
  const [query, setQuery] = useState('');
  const [access, setAccess] = useState({});
  const { data, state, error, refreshing, reload } = useResource(async () => {
    const pages = await Promise.all([
      biddingApi.list({ status: 'PENDING', page: 1, pageSize: 100 }),
      biddingApi.list({ status: 'OPEN', page: 1, pageSize: 100 }),
    ]).then((responses) => responses.map(toPage));
    const unique = Array.from(new Map(pages.flatMap((page) => page.items).map((auction) => [auction.id, auction])).values());
    // Registration state per auction arrives progressively; cards render first.
    unique.forEach((auction) => {
      biddingApi.access(auction.id).then((value) => setAccess((current) => ({ ...current, [auction.id]: value }))).catch(() => {});
    });
    return { items: unique, truncated: pages.some((page) => (page.pagination?.totalItems || 0) > 100) };
  }, []);

  const needle = text(query.trim());
  const visible = useMemo(() => {
    const filtered = (data?.items || []).filter((auction) => {
      if (scope === 'REGISTRATION' && !(auction.status === 'PENDING' && auction.registrationOpen)) return false;
      if (scope === 'OPEN' && auction.status !== 'OPEN') return false;
      if (auctionType && auction.auctionType !== auctionType) return false;
      return matches(auction, needle);
    });
    const comparators = {
      deadline: (a, b) => deadlineOf(a) - deadlineOf(b),
      priceDesc: (a, b) => Number(b.maxPrice) - Number(a.maxPrice),
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    };
    return filtered.sort(comparators[sort]);
  }, [auctionType, data, needle, scope, sort]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })}>
      <Text style={type.secondary}>Đấu giá ngược: đưa giá thấp hơn giá trần để nhận chuyến. Đăng ký và thanh toán trước hạn đóng đăng ký.</Text>
      <Button label="Phiên tôi đã đăng ký" variant="secondary" onPress={() => router.push('/registrations')} />
      <Tabs label="Phạm vi" value={scope} onChange={setScope} options={CARRIER_SCOPES} />
      <TextField placeholder="Tìm theo lô hàng, địa điểm, mã phiên" value={query} onChangeText={setQuery} accessibilityLabel="Tìm phiên" returnKeyType="search" />
      <Tabs label="Hình thức" value={auctionType} onChange={setAuctionType} options={TYPE_FILTERS} />
      <Tabs label="Sắp xếp" value={sort} onChange={setSort} options={SORTS} />
      {state === 'loading' && <StateView kind="loading" title="Đang tải phiên đấu giá" />}
      {state === 'error' && <StateView kind="error" title="Không tải được phiên" message={error} actionLabel="Thử lại" onAction={() => reload()} />}
      {state === 'ready' && error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}
      {state === 'ready' && data?.truncated ? <Banner tone="warning">Có hơn 100 phiên ở một trạng thái; chỉ hiển thị 100 phiên đầu.</Banner> : null}
      {state === 'ready' && visible.length === 0 && <StateView title="Không có phiên phù hợp" message="Thử đổi phạm vi hoặc bộ lọc, hoặc kéo xuống để làm mới." />}
      {visible.map((auction) => <AuctionCard key={auction.id} auction={auction} access={access[auction.id]} role="CARRIER" onPress={() => router.push(`/auctions/${auction.id}`)} />)}
    </Screen>
  );
}
