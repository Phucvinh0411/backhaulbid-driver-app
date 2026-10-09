import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { colors, fonts } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { roleLabel, tabVisible } from '@/lib/roles';
import { isDriverSession } from '@/lib/sessionModel';
import OwnerAvatarMenu from '@/components/OwnerAvatarMenu';

function TabIcon({ name, color }) {
  return <FontAwesome size={22} name={name} color={color} />;
}

// Shipper: Trang chủ / Phiên / Chuyến / Ví / Thêm
// Carrier: Trang chủ / Đấu giá / Chuyến / Đội xe / Thêm
// Driver (code session, one trip): Chuyến / Tài khoản
export default function TabLayout() {
  const { session } = useAuth();
  const role = session?.role;
  const driver = isDriverSession(session);
  const shown = (name) => (tabVisible(session, name) ? undefined : null);
  // Owners reach wallet (carrier), notifications and account from "Thêm".
  const ownerHidden = (name) => (driver ? shown(name) : null);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontSize: 12, fontFamily: fonts.semibold },
        tabBarStyle: { minHeight: 60, borderTopColor: colors.line },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.ink },
        headerRight: () => (driver ? null : <OwnerAvatarMenu />),
      }}
    >
      <Tabs.Screen name="index" options={{ title: driver ? 'Chuyến' : 'Trang chủ', headerTitle: driver ? 'Chuyến của tôi' : `BackHaulBid · ${roleLabel(role)}`, tabBarIcon: ({ color }) => <TabIcon name={driver ? 'truck' : 'home'} color={color} /> }} />
      <Tabs.Screen name="auctions" options={{ href: shown('auctions'), title: role === 'SHIPPER' ? 'Phiên' : 'Đấu giá', headerTitle: role === 'SHIPPER' ? 'Phiên đấu giá của tôi' : 'Tìm phiên đấu giá', tabBarIcon: ({ color }) => <TabIcon name="gavel" color={color} /> }} />
      <Tabs.Screen name="trips" options={{ href: shown('trips'), title: 'Chuyến', headerTitle: 'Theo dõi đơn hàng', tabBarIcon: ({ color }) => <TabIcon name="truck" color={color} /> }} />
      <Tabs.Screen name="wallet" options={{ href: role === 'SHIPPER' ? undefined : null, title: 'Ví', headerTitle: 'Ví và thanh toán', tabBarIcon: ({ color }) => <TabIcon name="credit-card" color={color} /> }} />
      <Tabs.Screen name="fleet" options={{ href: shown('fleet'), title: 'Đội xe', headerTitle: 'Đội xe', tabBarIcon: ({ color }) => <TabIcon name="users" color={color} /> }} />
      <Tabs.Screen name="history" options={{ href: shown('history'), title: 'Lịch sử', headerTitle: 'Lịch sử chuyến', tabBarIcon: ({ color }) => <TabIcon name="history" color={color} /> }} />
      <Tabs.Screen name="notifications" options={{ href: ownerHidden('notifications'), title: 'Thông báo', headerTitle: 'Thông báo', tabBarIcon: ({ color }) => <TabIcon name="bell" color={color} /> }} />
      <Tabs.Screen name="more" options={{ href: shown('more'), title: 'Thêm', headerTitle: 'Thêm', tabBarIcon: ({ color }) => <TabIcon name="bars" color={color} /> }} />
      <Tabs.Screen name="account" options={{ href: ownerHidden('account'), title: 'Tài khoản', headerTitle: 'Tài khoản', tabBarIcon: ({ color }) => <TabIcon name="user" color={color} /> }} />
    </Tabs>
  );
}
