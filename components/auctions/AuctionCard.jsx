import { StyleSheet, Text, View } from 'react-native';
import { Card, StatusBadge } from '@/components/ui';
import { AUCTION_TYPE_META, getAccessStatusMeta, getAuctionPhase, getAuctionPhaseMeta, getAwardStatusMeta, getShipperNextStep } from '@/lib/shared/statusMeta';
import { formatDateTime, formatMoney, formatWeight, shortId } from '@/lib/shared/format';
import { colors, space, type, fonts } from '@/constants/theme';

export const auctionRoute = (auction) => {
  const from = auction?.pickupLocation?.province || auction?.originProvince || auction?.origin;
  const to = auction?.deliveryLocation?.province || auction?.destinationProvince || auction?.destination;
  return `${from || '?'} → ${to || '?'}`;
};

/** The next deadline that matters for the current phase. */
export function auctionDeadline(auction) {
  const phase = getAuctionPhase(auction);
  if (phase === 'REGISTRATION') return { label: 'Đóng đăng ký', at: auction.registrationEndTime };
  if (phase === 'WAITING_START') return { label: 'Mở phòng', at: auction.startTime };
  if (phase === 'OPEN' || phase === 'CLOSING') return { label: 'Kết thúc', at: auction.endTime };
  return { label: 'Kết thúc lúc', at: auction.endTime };
}

export default function AuctionCard({ auction, access, role, onPress }) {
  const phaseMeta = getAuctionPhaseMeta(auction);
  const deadline = auctionDeadline(auction);
  const next = role === 'SHIPPER' ? getShipperNextStep(auction) : null;
  const award = role === 'SHIPPER' ? getAwardStatusMeta(auction.awardStatus) : null;
  return (
    <Card onPress={onPress} accessibilityLabel={`${auction.title}, ${phaseMeta.label}`}>
      <View style={styles.head}>
        <Text style={[type.caption, type.tabular]}>#{shortId(auction.id)} · {AUCTION_TYPE_META[auction.auctionType]?.label || auction.auctionType}</Text>
        <StatusBadge {...phaseMeta} />
      </View>
      <Text style={styles.title} numberOfLines={2}>{auction.title || 'Lô hàng'}</Text>
      <Text style={styles.route}>{auctionRoute(auction)}</Text>
      <Text style={[type.secondary, type.tabular]}>
        Giá trần {formatMoney(auction.maxPrice)} · {auction.goodsType || 'Hàng hóa'} · {formatWeight(auction.weight)}
      </Text>
      <Text style={[type.caption, type.tabular]}>{deadline.label}: {formatDateTime(deadline.at)}</Text>
      {access ? <StatusBadge {...getAccessStatusMeta(access.accessStatus)} /> : null}
      {next ? <Text style={styles.next}>Việc cần làm: {next.label}</Text> : award && auction.status === 'COMPLETED' ? <Text style={type.secondary}>{award.label}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  title: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
  route: { fontSize: 15, fontFamily: fonts.semibold, color: colors.brand },
  next: { fontSize: 14, fontFamily: fonts.bold, color: colors.danger },
});
