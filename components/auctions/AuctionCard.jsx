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

/**
 * One auction as a scannable card. Hierarchy: title, then route, then the ceiling price in
 * mono (the figure a carrier compares first), then deadline and next action.
 */
export default function AuctionCard({ auction, access, role, onPress }) {
  const phaseMeta = getAuctionPhaseMeta(auction);
  const deadline = auctionDeadline(auction);
  const next = role === 'SHIPPER' ? getShipperNextStep(auction) : null;
  const award = role === 'SHIPPER' ? getAwardStatusMeta(auction.awardStatus) : null;
  return (
    <Card onPress={onPress} accessibilityLabel={`${auction.title}, ${phaseMeta.label}`}>
      <View style={styles.head}>
        <Text style={[type.code, styles.code]} numberOfLines={1}>
          #{shortId(auction.id)} · {AUCTION_TYPE_META[auction.auctionType]?.label || auction.auctionType}
        </Text>
        <StatusBadge {...phaseMeta} />
      </View>

      <View style={styles.group}>
        <Text style={styles.title} numberOfLines={2}>{auction.title || 'Lô hàng'}</Text>
        <Text style={styles.route} numberOfLines={1}>{auctionRoute(auction)}</Text>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceBlock}>
          <Text style={type.caption}>Giá trần</Text>
          <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(auction.maxPrice)}</Text>
        </View>
        <Text style={[type.secondary, styles.meta]} numberOfLines={2}>
          {auction.goodsType || 'Hàng hóa'} · {formatWeight(auction.weight)}
        </Text>
      </View>

      <View style={styles.group}>
        <Text style={type.code}>{deadline.label}: {formatDateTime(deadline.at)}</Text>
        {access ? <StatusBadge {...getAccessStatusMeta(access.accessStatus)} /> : null}
        {next ? <Text style={styles.next}>Việc cần làm: {next.label}</Text> : award && auction.status === 'COMPLETED' ? <Text style={type.secondary}>{award.label}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  code: { flexShrink: 1, fontSize: 12 },
  group: { gap: space.xs },
  title: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink, lineHeight: 22 },
  route: { fontSize: 14, fontFamily: fonts.semibold, color: colors.brand },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md, paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: colors.line, marginTop: space.xs, paddingTop: space.md },
  priceBlock: { gap: 2, flexShrink: 1 },
  price: { fontSize: 18, fontFamily: fonts.monoBold, color: colors.ink, fontVariant: ['tabular-nums'] },
  meta: { flexShrink: 1, textAlign: 'right', maxWidth: '50%' },
  // Red is for errors and irreversible actions only (locked rule); a pending task is the brand colour.
  next: { fontSize: 14, fontFamily: fonts.bold, color: colors.brand },
});
