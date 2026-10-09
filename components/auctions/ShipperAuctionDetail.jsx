import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionBar, Banner, Button, Card, ChoiceChips, Row, Screen, Section, StateView, StatusBadge, TextField, useResource, useSingleFlight } from '@/components/ui';
import Sheet from '@/components/Sheet';
import ProofImage from '@/components/ProofImage';
import { biddingApi, toPage } from '@/lib/services';
import { AUCTION_TYPE_META, getAuctionPhase, getAuctionPhaseMeta, getAwardStatusMeta } from '@/lib/shared/statusMeta';
import { formatCountdown, formatDateTime, formatMoney, formatTimeWindow, formatWeight, secondsUntil, shortId, toAmount } from '@/lib/shared/format';
import { VEHICLE_TYPES } from '@/lib/shared/auctionForm';
import { auctionDeadline, auctionRoute } from './AuctionCard';
import { colors, radius, space, type, fonts } from '@/constants/theme';

// The shipper is not in the realtime room, so an open auction is refreshed gently.
const OPEN_REFRESH_MS = 30_000;
const CANCEL_REASONS = ['Thay đổi kế hoạch vận chuyển', 'Hàng chưa sẵn sàng', 'Đã tìm được đơn vị vận chuyển khác', 'Khác'];

const AWARD_TEXT = {
  PENDING: 'Đang chuẩn bị hợp đồng cho nhà xe thắng.',
  CREATING_CONTRACT: 'Đang tạo hợp đồng cho nhà xe được xét.',
  AWAITING_CARRIER_SIGNATURE: 'Đang chờ nhà xe được xét ký hợp đồng. Quá hạn, hệ thống mời nhà xe dự phòng kế tiếp theo thứ tự giá.',
  AWAITING_SHIPPER_SIGNATURE: 'Nhà xe đã ký. Đến lượt bạn ký hợp đồng trước hạn.',
  SIGNED: 'Hợp đồng đã có đủ chữ ký. Chuyến vận chuyển đã được tạo.',
  NO_CARRIER_SIGNED: 'Đã xét người thắng và tối đa 3 nhà xe dự phòng nhưng không ai ký hợp đồng.',
  SHIPPER_SIGNATURE_EXPIRED: 'Bạn đã quá hạn ký; hệ thống dừng xét nhà xe dự phòng.',
  CREATION_FAILED: 'Tạo hợp đồng gặp lỗi; hệ thống sẽ thử lại.',
  NO_WINNER: 'Phiên kết thúc mà không có giá nào.',
};

export default function ShipperAuctionDetail({ auctionId }) {
  const router = useRouter();
  const { data, state, error, refreshing, reload } = useResource(async () => {
    const [auction, bidResponse] = await Promise.all([
      biddingApi.get(auctionId),
      biddingApi.bids(auctionId, { page: 1, pageSize: 100, sortOrder: 'asc' }).catch(() => null),
    ]);
    return { auction, bids: bidResponse ? toPage(bidResponse).items : null };
  }, [auctionId]);
  const [now, setNow] = useState(Date.now());
  const [confirmBid, setConfirmBid] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [sheetError, setSheetError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, run] = useSingleFlight();

  const auction = data?.auction;
  const phase = auction ? getAuctionPhase(auction) : null;
  const live = phase === 'OPEN' || phase === 'REGISTRATION' || phase === 'WAITING_START' || phase === 'CLOSING';
  useEffect(() => {
    if (!live) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => void reload(), OPEN_REFRESH_MS);
    return () => { clearInterval(tick); clearInterval(refresh); };
  }, [live, reload]);

  if (state === 'loading') return <StateView kind="loading" title="Đang tải phiên" />;
  if (state === 'forbidden') return <StateView kind="error" title="Không có quyền xem phiên" message="Phiên này không thuộc tài khoản của bạn." />;
  if (!auction) return <StateView kind="error" title="Không tải được phiên" message={error} actionLabel="Thử lại" onAction={() => reload()} />;

  const sealed = auction.auctionType === 'SEALED';
  const bids = [...(data.bids || [])].map((bid) => ({ ...bid, amount: toAmount(bid.bidAmount) })).sort((a, b) => a.amount - b.amount || new Date(a.bidTime) - new Date(b.bidTime));
  const canSelectWinner = phase === 'AWAITING_WINNER';
  const cancellable = auction.status === 'PENDING' || auction.status === 'OPEN';
  const award = getAwardStatusMeta(auction.awardStatus);
  const deadline = auctionDeadline(auction);
  const vehicleLabel = VEHICLE_TYPES.find((item) => item.value === auction.vehicleTypeRequired)?.label || auction.vehicleTypeRequired;

  const selectWinner = () => run(async () => {
    setSheetError('');
    try {
      await biddingApi.selectWinner(auctionId, confirmBid.id);
      setConfirmBid(null);
      setNotice('Đã chọn người thắng. Hệ thống đang tạo hợp đồng và mời nhà xe ký.');
    } catch (failure) {
      setSheetError(failure.message);
    }
    await reload();
  });

  const cancel = () => run(async () => {
    if (!reason) return setSheetError('Chọn lý do hủy phiên.');
    if (reason === 'Khác' && !reasonDetail.trim()) return setSheetError('Mô tả lý do hủy.');
    setSheetError('');
    try {
      const full = [reason, reasonDetail.trim()].filter(Boolean).join(': ');
      await biddingApi.cancel(auctionId, full.slice(0, 500));
      setCancelOpen(false);
      setNotice('Đã hủy phiên đấu giá.');
    } catch (failure) {
      setSheetError(failure.message);
    }
    await reload();
    return undefined;
  });

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })} bottomInset={cancellable || canSelectWinner ? 120 : 0}>
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        {error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}

        <Card>
          <View style={styles.head}>
            <Text style={[type.caption, type.tabular]}>#{shortId(auction.id)} · {AUCTION_TYPE_META[auction.auctionType]?.label}</Text>
            <StatusBadge {...getAuctionPhaseMeta(auction)} />
          </View>
          <Text style={styles.title}>{auction.title}</Text>
          <Text style={styles.route}>{auctionRoute(auction)}</Text>
          {live ? (
            <Text style={[styles.countdown, type.tabular]} accessibilityLiveRegion="polite">
              {deadline.label} sau {formatCountdown(secondsUntil(deadline.at, now))}
            </Text>
          ) : null}
          {auction.status === 'CANCELLED' ? <Banner tone="danger">Phiên đã hủy{auction.cancellationReason ? `: ${auction.cancellationReason}` : '.'}</Banner> : null}
        </Card>

        {canSelectWinner ? <Banner tone="warning" title="Chọn người thắng">Phiên kín đã kết thúc. Xem các giá bên dưới và chọn nhà xe thắng.</Banner> : null}

        {award ? (
          <Section title="Trao thầu và hợp đồng" right={<StatusBadge {...award} />}>
            <Text style={type.body}>{AWARD_TEXT[auction.awardStatus] || award.label}</Text>
            {auction.awardProgress?.currentAttempt > 0 ? (
              <Text style={[type.secondary, type.tabular]}>
                Lượt xét {auction.awardProgress.currentAttempt}/{auction.awardProgress.maximumAttempts}
                {auction.awardProgress.signingDeadlineAt ? ` · Hạn ký ${formatDateTime(auction.awardProgress.signingDeadlineAt)}` : ''}
              </Text>
            ) : null}
            {auction.awardStatus === 'NO_CARRIER_SIGNED' && auction.creationFeeStatus === 'REFUNDED' ? <Text style={{ color: colors.success, fontFamily: fonts.semibold }}>Phí tạo phiên đã được hoàn vào ví.</Text> : null}
            {auction.awardStatus === 'AWAITING_SHIPPER_SIGNATURE' ? <Button label="Ký hợp đồng" onPress={() => router.push('/contracts')} /> : null}
            {auction.awardTripId && ['SIGNED', 'AWAITING_SHIPPER_SIGNATURE', 'AWAITING_CARRIER_SIGNATURE'].includes(auction.awardStatus) ? <Button label="Theo dõi chuyến" variant="secondary" onPress={() => router.push(`/business/trips/${auction.awardTripId}`)} /> : null}
          </Section>
        ) : null}

        <Section title={`Giá đã đặt (${bids.length})`}>
          {data.bids === null ? <Text style={type.secondary}>Chưa tải được danh sách giá.</Text> : null}
          {data.bids && bids.length === 0 ? <Text style={type.secondary}>{phase === 'OPEN' ? 'Chưa có nhà xe nào đặt giá.' : 'Phiên chưa có giá nào.'}</Text> : null}
          {bids.map((bid, index) => {
            const winner = auction.winningBidId === bid.id;
            return (
              <View key={bid.id} style={[styles.bid, winner && { borderColor: colors.success, backgroundColor: colors.successSoft }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.amount, type.tabular]}>{index + 1}. {formatMoney(bid.amount)}</Text>
                  <Text style={[type.caption, type.tabular]}>Nhà xe #{shortId(bid.carrierId)} · {formatDateTime(bid.bidTime)}</Text>
                  {winner ? <Text style={{ color: colors.success, fontFamily: fonts.bold }}>Người thắng</Text> : null}
                </View>
                <View style={{ gap: 6 }}>
                  <Pressable accessibilityRole="link" onPress={() => router.push(`/carriers/${bid.carrierId}`)} style={styles.link}><Text style={styles.linkText}>Hồ sơ</Text></Pressable>
                  {canSelectWinner ? <Pressable accessibilityRole="button" onPress={() => { setSheetError(''); setConfirmBid(bid); }} style={[styles.link, { backgroundColor: colors.brand }]}><Text style={[styles.linkText, { color: colors.surface }]}>Chọn</Text></Pressable> : null}
                </View>
              </View>
            );
          })}
          {sealed && phase === 'OPEN' ? <Text style={type.caption}>Phiên kín: nhà xe không thấy giá của nhau.</Text> : null}
        </Section>

        <Section title="Thông tin phiên">
          <Row label="Giá trần / bước giá" value={`${formatMoney(auction.maxPrice)} / ${formatMoney(auction.priceStep)}`} strong />
          <Row label="Số lượt đặt tối đa mỗi nhà xe" value={auction.maxBids} />
          <Row label="Tiền đặt cọc" value={auction.isDepositRequired ? formatMoney(auction.depositAmount) : 'Không yêu cầu'} />
          <Row label="Phí tạo phiên" value={`${formatMoney(auction.creationFeeAmount)}${auction.creationFeeStatus ? ` · ${auction.creationFeeStatus === 'SETTLED' ? 'đã thu' : auction.creationFeeStatus === 'REFUNDED' ? 'đã hoàn' : 'đang giữ'}` : ''}`} />
          <Row label="Đăng ký" value={formatTimeWindow(auction.registrationStartTime, auction.registrationEndTime)} />
          <Row label="Đấu giá" value={formatTimeWindow(auction.startTime, auction.endTime)} />
        </Section>

        <Section title="Hàng hóa và lộ trình">
          <Row label="Hàng hóa" value={`${auction.goodsType || '—'} · ${formatWeight(auction.weight)}${auction.volume ? ` · ${auction.volume} m³` : ''}`} />
          <Row label="Loại xe yêu cầu" value={vehicleLabel} />
          {auction.requiredTemp ? <Row label="Nhiệt độ" value={auction.requiredTemp} /> : null}
          <Row label="Lấy hàng" value={[auction.pickupLocation?.locationName, auction.pickupLocation?.address, auction.pickupLocation?.province].filter(Boolean).join(', ')} />
          <Row label="Khung giờ lấy" value={formatTimeWindow(auction.earliestPickup || auction.pickupLocation?.earliestTime, auction.latestPickup || auction.pickupLocation?.latestTime)} />
          <Row label="Giao hàng" value={[auction.deliveryLocation?.locationName, auction.deliveryLocation?.address, auction.deliveryLocation?.province].filter(Boolean).join(', ')} />
          <Row label="Khung giờ giao" value={formatTimeWindow(auction.earliestDelivery || auction.deliveryLocation?.earliestTime, auction.latestDelivery || auction.deliveryLocation?.latestTime)} />
          {auction.notes ? <Row label="Ghi chú" value={auction.notes} /> : null}
          {auction.images?.length ? (
            <View style={styles.images}>
              {auction.images.map((url) => <ProofImage key={url} url={url} style={styles.image} label="Ảnh hàng hóa" />)}
            </View>
          ) : null}
        </Section>
      </Screen>

      {cancellable || canSelectWinner ? (
        <ActionBar>
          {canSelectWinner ? <Text style={type.secondary}>Chọn một giá trong danh sách để trao thầu.</Text> : null}
          {cancellable ? <Button label="Hủy phiên" variant="danger" onPress={() => { setSheetError(''); setReason(''); setReasonDetail(''); setCancelOpen(true); }} /> : null}
        </ActionBar>
      ) : null}

      <Sheet visible={Boolean(confirmBid)} title="Chọn người thắng?" busy={busy} onClose={() => setConfirmBid(null)}
        footer={<><Button label="Xác nhận chọn" onPress={selectWinner} loading={busy} /><Button label="Quay lại" variant="secondary" onPress={() => setConfirmBid(null)} disabled={busy} /></>}>
        <Text style={type.body}>Trao thầu cho nhà xe #{shortId(confirmBid?.carrierId)} với giá {formatMoney(confirmBid?.amount)}. Hệ thống tạo hợp đồng và mời nhà xe ký; không đổi lại được.</Text>
        {sheetError ? <Banner tone="danger">{sheetError}</Banner> : null}
      </Sheet>

      <Sheet visible={cancelOpen} title="Hủy phiên đấu giá?" busy={busy} onClose={() => setCancelOpen(false)}
        footer={<><Button label="Hủy phiên" variant="danger" onPress={cancel} loading={busy} /><Button label="Giữ phiên" variant="secondary" onPress={() => setCancelOpen(false)} disabled={busy} /></>}>
        <Text style={type.secondary}>Nhà xe đã đăng ký được hoàn phí theo chính sách. Thao tác không hoàn tác được.</Text>
        <ChoiceChips label="Lý do" required options={CANCEL_REASONS} value={reason} onChange={setReason} />
        <TextField label="Chi tiết" value={reasonDetail} onChangeText={setReasonDetail} multiline maxLength={400} />
        {sheetError ? <Banner tone="danger">{sheetError}</Banner> : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  title: { fontSize: 18, fontFamily: fonts.bold, color: colors.ink },
  route: { fontSize: 15, fontFamily: fonts.semibold, color: colors.brand },
  countdown: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  bid: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md },
  amount: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
  link: { minHeight: 36, minWidth: 64, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: colors.brand, fontFamily: fonts.bold },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  image: { width: 104, height: 78, borderRadius: radius.md },
});
