import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionBar, Banner, Band, Button, Card, CheckRow, MoneyField, Row, Screen, Section, StateView, StatusBadge, useResource, useSingleFlight } from '@/components/ui';
import Sheet from '@/components/Sheet';
import ProofImage from '@/components/ProofImage';
import { useAuth } from '@/lib/auth';
import { biddingApi, fleetApi, newKey, toPage } from '@/lib/services';
import { AUCTION_TYPE_META, MY_BID_OUTCOME_META, getAccessStatusMeta, getAuctionPhase, getAuctionPhaseMeta, getMyBidOutcome } from '@/lib/shared/statusMeta';
import { getBidCeiling, getQuickBidAmounts, validateBidAmount } from '@/lib/shared/bidRules';
import { formatCountdown, formatDateTime, formatMoney, formatTimeWindow, formatWeight, secondsUntil, shortId, toAmount } from '@/lib/shared/format';
import { VEHICLE_TYPES } from '@/lib/shared/auctionForm';
import { auctionRoute } from './AuctionCard';
import { colors, radius, space, type, fonts } from '@/constants/theme';

// Without the realtime socket the room polls; the server stays authoritative for every bid.
const ROOM_POLL_MS = 4000;
const WAITING_POLL_MS = 30_000;
const TERMINAL = new Set(['AUCTION_COMPLETED', 'AUCTION_CANCELLED', 'REGISTRATION_CANCELLED', 'REGISTRATION_CLOSED', 'REPUTATION_TOO_LOW']);

export default function CarrierAuctionRoom({ auctionId }) {
  const router = useRouter();
  const { session } = useAuth();
  const { data, setData, state, error, refreshing, reload } = useResource(async () => {
    const [auction, access, bidResponse] = await Promise.all([
      biddingApi.get(auctionId),
      biddingApi.access(auctionId).catch(() => null),
      biddingApi.bids(auctionId, { page: 1, pageSize: 100, sortOrder: 'desc' }).catch(() => null),
    ]);
    const page = bidResponse ? toPage(bidResponse) : null;
    return { auction, access, bids: page?.items || [], remainingBids: page?.pagination?.remainingBids ?? null };
  }, [auctionId]);
  const [now, setNow] = useState(Date.now());
  const [amount, setAmount] = useState('');
  const [bidError, setBidError] = useState('');
  const [notice, setNotice] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [busy, run] = useSingleFlight();
  const pendingKey = useRef(null);
  const syncRequested = useRef(false);

  const auction = data?.auction;
  const access = data?.access;
  const phase = auction ? getAuctionPhase(auction) : null;
  const status = access?.accessStatus;
  const canEnter = access?.canEnter === true;

  useEffect(() => {
    if (!auction || phase === 'CANCELLED' || (status && TERMINAL.has(status) && phase !== 'OPEN')) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => void reload(), phase === 'OPEN' && canEnter ? ROOM_POLL_MS : WAITING_POLL_MS);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [auction, canEnter, phase, reload, status]);

  const endsIn = auction ? secondsUntil(phase === 'OPEN' ? auction.endTime : auction.startTime, now) : 0;
  // When the local clock reaches a boundary, ask the server instead of assuming the outcome.
  useEffect(() => {
    if (endsIn === 0 && (phase === 'OPEN' || status === 'WAITING_FOR_START') && !syncRequested.current) {
      syncRequested.current = true;
      void reload();
    }
    if (endsIn > 0) syncRequested.current = false;
  }, [endsIn, phase, reload, status]);

  if (state === 'loading') return <StateView kind="loading" title="Đang tải phiên" />;
  if (!auction) return <StateView kind="error" title="Không tải được phiên" message={error} actionLabel="Thử lại" onAction={() => reload()} />;

  const sealed = auction.auctionType === 'SEALED';
  const myId = session?.accountId;
  const history = data.bids.map((bid) => ({ id: bid.id, amount: toAmount(bid.bidAmount), time: bid.bidTime, isMe: sealed || bid.carrierId === myId }));
  const myBids = history.filter((bid) => bid.isMe);
  const lowestBid = !sealed && history.length ? Math.min(...history.map((bid) => bid.amount)) : null;
  const myLowest = myBids.length ? Math.min(...myBids.map((bid) => bid.amount)) : null;
  const outcome = getMyBidOutcome({ auction, myBidIds: myBids.map((bid) => bid.id) });
  const context = { auctionType: auction.auctionType, maxPrice: auction.maxPrice, priceStep: auction.priceStep, lowestBid, remainingBids: data.remainingBids };
  const ceiling = getBidCeiling(context);
  const quick = getQuickBidAmounts(context);
  const roomOpen = canEnter && phase === 'OPEN';
  const blocked = !roomOpen ? null : endsIn === 0 ? 'Đã hết giờ theo đồng hồ của bạn. Đang xác nhận với máy chủ.' : data.remainingBids === 0 ? 'Bạn đã dùng hết số lượt đặt giá.' : null;
  const vehicleLabel = VEHICLE_TYPES.find((item) => item.value === auction.vehicleTypeRequired)?.label || auction.vehicleTypeRequired;

  // The idempotency key is kept for the same amount after a network failure, so a retry
  // cannot place a second bid; any server answer clears it.
  const placeBid = () => run(async () => {
    const value = Number(amount);
    const message = validateBidAmount(value, context);
    if (message) return setBidError(message);
    if (!pendingKey.current || pendingKey.current.amount !== value) pendingKey.current = { amount: value, key: newKey() };
    setBidError('');
    setNotice('');
    try {
      await biddingApi.placeBid(auctionId, { bidAmount: String(value), idempotencyKey: pendingKey.current.key });
      pendingKey.current = null;
      setAmount('');
      setNotice(sealed ? 'Đã gửi giá kín.' : 'Đã đặt giá.');
    } catch (failure) {
      if (!failure.isNetwork) pendingKey.current = null;
      setBidError(failure.isNetwork ? `${failure.message} Bấm đặt lại cùng số tiền để thử lại an toàn.` : failure.message);
    }
    await reload();
    return undefined;
  });

  const retryPayment = () => run(async () => {
    setBidError('');
    try {
      await biddingApi.retryPayment(auctionId, access.registrationId, { idempotencyKey: newKey() });
      setNotice('Thanh toán đăng ký thành công.');
    } catch (failure) {
      setBidError(failure.message);
    }
    await reload();
  });

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })} bottomInset={roomOpen ? 260 : 0}>
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        {error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}
        <Card>
          <View style={styles.head}>
            <Text style={[type.caption, type.tabular]}>#{shortId(auction.id)} · {AUCTION_TYPE_META[auction.auctionType]?.label}</Text>
            <StatusBadge {...getAuctionPhaseMeta(auction)} />
          </View>
          <Text style={styles.title}>{auction.title}</Text>
          <Text style={styles.route}>{auctionRoute(auction)}</Text>
          <Text style={type.secondary}>{AUCTION_TYPE_META[auction.auctionType]?.description}</Text>
        </Card>
        {/* DESIGN.md: the bid room's key facts on the navy band while the room is open. */}
        {phase === 'OPEN' ? (
          <Band eyebrow={sealed ? 'Giá trần' : 'Giá thấp nhất hiện tại'} value={sealed ? formatMoney(auction.maxPrice) : lowestBid === null ? 'Chưa có giá' : formatMoney(lowestBid)}>
            <Text style={[styles.bandTimer, type.tabular]} accessibilityLiveRegion="polite">Còn {formatCountdown(endsIn)}{endsIn < 300 ? ' · sắp kết thúc' : ''}</Text>
            <Text style={styles.bandMeta}>{data.remainingBids !== null ? 'Còn ' + data.remainingBids + ' lượt đặt · ' : ''}Kết quả do máy chủ chốt</Text>
          </Band>
        ) : null}

        {/* Registration gate */}
        <Section title="Tham gia phiên" right={access ? <StatusBadge {...getAccessStatusMeta(status)} /> : null}>
          {!access ? <Text style={type.secondary}>Chưa kiểm tra được quyền tham gia. Kéo xuống để thử lại.</Text> : null}
          {access?.reputationScore !== undefined && access?.reputationScore !== null ? (
            <Row label="Điểm uy tín của bạn" value={`${access.reputationScore}/100 (tối thiểu ${access.minimumReputationScore ?? 70})`} />
          ) : null}
          {status === 'REGISTRATION_REQUIRED' && access.canRegister ? (
            <>
              <Text style={type.body}>Đăng ký trước {formatDateTime(auction.registrationEndTime)}. Phí tham gia {formatMoney(auction.participationFeeAmount)}{auction.isDepositRequired ? ` và tiền cọc ${formatMoney(auction.depositAmount)}` : ''} được trừ từ ví.</Text>
              <Button label="Đăng ký tham gia" onPress={() => setRegisterOpen(true)} />
            </>
          ) : null}
          {status === 'PAYMENT_INCOMPLETE' ? (
            <>
              <Banner tone="danger">Thanh toán đăng ký chưa hoàn tất. Kiểm tra số dư ví rồi thử lại.</Banner>
              <Button label="Thử lại thanh toán" onPress={retryPayment} loading={busy} />
              <Button label="Mở ví" variant="secondary" onPress={() => router.push('/wallet')} />
            </>
          ) : null}
          {status === 'WAITING_FOR_START' ? <Text style={[type.body, type.tabular]}>Đã đăng ký. Phòng mở sau {formatCountdown(endsIn)} ({formatDateTime(auction.startTime)}).</Text> : null}
          {status === 'REPUTATION_TOO_LOW' ? <Text style={type.body}>Điểm uy tín chưa đạt mức tối thiểu. Điểm giảm khi vi phạm chính sách giao hàng trễ.</Text> : null}
          {status === 'REGISTRATION_CLOSED' ? <Text style={type.body}>Phiên đã đóng đăng ký.</Text> : null}
          {bidError && !roomOpen ? <Banner tone="danger">{bidError}</Banner> : null}
        </Section>

        {/* Result */}
        {['AWAITING_WINNER', 'WINNER_DECIDED', 'ENDED_NO_WINNER', 'CLOSING'].includes(phase) && myBids.length ? (
          <Banner tone={outcome === 'WON' ? 'success' : 'info'} title={MY_BID_OUTCOME_META[outcome]?.label}>
            {outcome === 'WON' ? 'Ký hợp đồng trong mục Hợp đồng trước hạn để nhận chuyến.' : outcome === 'AWAITING_RESULT' ? 'Đang chờ chủ hàng hoặc hệ thống chốt kết quả.' : 'Cảm ơn bạn đã tham gia. Tiền cọc được hoàn theo chính sách.'}
          </Banner>
        ) : null}
        {outcome === 'WON' ? <Button label="Mở hợp đồng" onPress={() => router.push('/contracts')} /> : null}

        {roomOpen || myBids.length || (!sealed && history.length) ? (
          <Section title={sealed ? 'Giá bạn đã gửi' : 'Lịch sử giá'}>
            {!sealed ? <Row label="Giá thấp nhất hiện tại" value={lowestBid === null ? 'Chưa có giá' : formatMoney(lowestBid)} strong /> : null}
            <Row label="Giá thấp nhất của bạn" value={myLowest === null ? 'Chưa đặt giá' : formatMoney(myLowest)} />
            {data.remainingBids !== null ? <Row label="Lượt đặt còn lại" value={data.remainingBids} /> : null}
            {history.slice(0, 20).map((bid) => (
              <View key={bid.id} style={[styles.bid, bid.isMe && { borderColor: colors.brand }]}>
                <Text style={[styles.amount, type.tabular]}>{formatMoney(bid.amount)}</Text>
                <Text style={[type.caption, type.tabular]}>{bid.isMe ? 'Bạn' : 'Nhà xe khác'} · {formatDateTime(bid.time)}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="Lô hàng">
          <Row label="Giá trần / bước giá" value={`${formatMoney(auction.maxPrice)} / ${formatMoney(auction.priceStep)}`} strong />
          <Row label="Hàng hóa" value={`${auction.goodsType || '—'} · ${formatWeight(auction.weight)}`} />
          <Row label="Loại xe yêu cầu" value={vehicleLabel} />
          <Row label="Lấy hàng" value={[auction.pickupLocation?.locationName, auction.pickupLocation?.address, auction.pickupLocation?.province].filter(Boolean).join(', ')} />
          <Row label="Giao hàng" value={[auction.deliveryLocation?.locationName, auction.deliveryLocation?.address, auction.deliveryLocation?.province].filter(Boolean).join(', ')} />
          <Row label="Khung giờ lấy" value={formatTimeWindow(auction.earliestPickup, auction.latestPickup)} />
          <Row label="Khung giờ giao" value={formatTimeWindow(auction.earliestDelivery, auction.latestDelivery)} />
          <Row label="Đấu giá" value={formatTimeWindow(auction.startTime, auction.endTime)} />
          <Row label="Số lượt đặt tối đa" value={auction.maxBids} />
          {auction.notes ? <Row label="Ghi chú" value={auction.notes} /> : null}
          {auction.images?.length ? <View style={styles.images}>{auction.images.map((url) => <ProofImage key={url} url={url} style={styles.image} label="Ảnh hàng hóa" />)}</View> : null}
        </Section>
      </Screen>

      {roomOpen ? (
        <ActionBar>
          {blocked ? <Text style={[type.secondary, { color: colors.warning }]}>{blocked}</Text> : (
            <Text style={[type.caption, type.tabular]}>
              {sealed ? `Giá kín, tối đa ${formatMoney(auction.maxPrice)}.` : (ceiling.inclusive ? `Giá hợp lệ: từ ${formatMoney(ceiling.ceiling)} trở xuống.` : `Giá hợp lệ: thấp hơn ${formatMoney(ceiling.ceiling)}.`)}
            </Text>
          )}
          {quick.length ? (
            <View style={styles.quick}>
              {quick.map((value) => (
                <Pressable key={value} accessibilityRole="button" onPress={() => { setBidError(''); setAmount(String(value)); }} style={styles.quickChip}>
                  <Text style={[styles.quickText, type.tabular]}>{formatMoney(value)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <MoneyField label="Giá của bạn" value={amount} onChange={(value) => { setBidError(''); setAmount(value); }} error={bidError} editable={!blocked} />
          <Button label={sealed ? 'Gửi giá kín' : 'Đặt giá'} onPress={placeBid} loading={busy} disabled={Boolean(blocked) || !amount} />
        </ActionBar>
      ) : null}

      {registerOpen ? (
        <RegisterSheet auction={auction} onClose={() => setRegisterOpen(false)} onDone={async (message) => { setRegisterOpen(false); setNotice(message); await reload(); }}
          onAccess={(next) => setData((current) => ({ ...current, access: next }))} />
      ) : null}
    </View>
  );
}

function RegisterSheet({ auction, onClose, onDone, onAccess }) {
  const vehicles = useResource(() => fleetApi.vehicles(), []);
  const [vehicleId, setVehicleId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [retryId, setRetryId] = useState(null);
  const [busy, run] = useSingleFlight();
  const list = Array.isArray(vehicles.data) ? vehicles.data.filter((vehicle) => vehicle.status !== 'INACTIVE') : [];
  const fee = toAmount(auction.participationFeeAmount) || 0;
  const deposit = auction.isDepositRequired ? toAmount(auction.depositAmount) || 0 : 0;

  const submit = () => run(async () => {
    if (!vehicleId) return setError('Chọn một phương tiện đã được duyệt.');
    if (!agreed) return setError('Xác nhận cam kết để tiếp tục.');
    setError('');
    try {
      if (retryId) await biddingApi.retryPayment(auction.id, retryId, { idempotencyKey: newKey() });
      else await biddingApi.register(auction.id, { vehicleId, idempotencyKey: newKey() });
      await onDone('Đăng ký phiên và thanh toán thành công.');
    } catch (failure) {
      setError(failure.message);
      try {
        const access = await biddingApi.access(auction.id);
        onAccess(access);
        if (access?.accessStatus === 'PAYMENT_INCOMPLETE' && access.registrationId) setRetryId(access.registrationId);
      } catch {
        // Keep the payment error visible when the access refresh also fails.
      }
    }
    return undefined;
  });

  return (
    <Sheet visible title="Đăng ký tham gia phiên" busy={busy} onClose={onClose}
      footer={<><Button label={retryId ? `Thử lại thanh toán ${formatMoney(fee + deposit)}` : `Xác nhận và thanh toán ${formatMoney(fee + deposit)}`} onPress={submit} loading={busy} /><Button label="Đóng" variant="secondary" onPress={onClose} disabled={busy} /></>}>
      <Text style={styles.label}>Phương tiện tham gia</Text>
      {vehicles.state === 'loading' ? <StateView kind="loading" title="Đang tải phương tiện" /> : null}
      {vehicles.state === 'error' ? <Banner tone="danger">{vehicles.error}</Banner> : null}
      {vehicles.state === 'ready' && list.length === 0 ? <Text style={type.body}>Chưa có phương tiện. Thêm xe trong mục Đội xe và chờ duyệt.</Text> : null}
      {list.map((vehicle) => {
        const verified = vehicle.status === 'VERIFIED';
        const selected = vehicle.id === vehicleId;
        return (
          <Pressable key={vehicle.id} accessibilityRole="radio" accessibilityState={{ selected, disabled: !verified }} disabled={!verified || Boolean(retryId)} onPress={() => setVehicleId(vehicle.id)}
            style={[styles.vehicle, selected && { borderColor: colors.brand, backgroundColor: colors.brandSoft }, !verified && { opacity: 0.55 }]}>
            <Text style={styles.amount}>{vehicle.licensePlate}</Text>
            <Text style={type.caption}>{vehicle.bodyType || VEHICLE_TYPES.find((item) => item.value === vehicle.vehicleType)?.label} · {vehicle.payloadCapacity} tấn{verified ? '' : ' · chưa được duyệt'}</Text>
          </Pressable>
        );
      })}
      <Row label="Phí tham gia" value={formatMoney(fee)} />
      <Row label="Tiền đặt cọc" value={deposit ? `${formatMoney(deposit)} (hoàn lại nếu không thắng)` : 'Không yêu cầu'} />
      <Row label="Tổng trừ từ ví" value={formatMoney(fee + deposit)} strong />
      <CheckRow label="Tôi cam kết thực hiện chuyến nếu thắng và chấp nhận chính sách giao trễ." value={agreed} onChange={setAgreed} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  title: { fontSize: 18, fontFamily: fonts.bold, color: colors.ink },
  route: { fontSize: 15, fontFamily: fonts.semibold, color: colors.brand },
  bandTimer: { fontSize: 20, fontFamily: fonts.bold, color: colors.surface },
  bandMeta: { fontSize: 13, fontFamily: fonts.regular, color: colors.onBandSoft },
  bid: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, gap: 2 },
  amount: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quickChip: { minHeight: 40, paddingHorizontal: space.md, borderRadius: 20, backgroundColor: colors.brandSoft, justifyContent: 'center' },
  quickText: { color: colors.brand, fontFamily: fonts.bold },
  label: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  vehicle: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, gap: 2 },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  image: { width: 104, height: 78, borderRadius: radius.md },
});
