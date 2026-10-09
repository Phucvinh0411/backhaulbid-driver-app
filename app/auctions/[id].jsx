import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/lib/auth';
import ShipperAuctionDetail from '@/components/auctions/ShipperAuctionDetail';
import CarrierAuctionRoom from '@/components/auctions/CarrierAuctionRoom';
import { colors } from '@/constants/theme';

export default function AuctionDetailRoute() {
  const { id } = useLocalSearchParams();
  const { session, ready } = useAuth();
  if (!ready || !session) return null;
  const auctionId = String(id);
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: session.role === 'SHIPPER' ? 'Chi tiết phiên' : 'Phòng đấu giá' }} />
      {session.role === 'SHIPPER'
        ? <ShipperAuctionDetail key={`${session.accountId}:${auctionId}`} auctionId={auctionId} />
        : <CarrierAuctionRoom key={`${session.accountId}:${auctionId}`} auctionId={auctionId} />}
    </View>
  );
}
