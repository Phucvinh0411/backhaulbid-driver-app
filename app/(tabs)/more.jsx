import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { MenuItem, Screen, useResource } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { roleLabel } from '@/lib/roles';
import { notificationApi } from '@/lib/services';
import { colors, radius, space, type, fonts } from '@/constants/theme';

const icon = (name) => <FontAwesome name={name} size={20} color={colors.brand} style={{ width: 24, textAlign: 'center' }} />;

export default function MoreTab() {
  const router = useRouter();
  const { session } = useAuth();
  const unread = useResource(() => notificationApi.unreadCount().catch(() => null), []);
  const count = typeof unread.data === 'number' ? unread.data : unread.data?.count;
  if (!session || session.role === 'DRIVER') return null;
  const shipper = session.role === 'SHIPPER';

  const groups = [
    {
      title: 'Giao dịch',
      items: [
        { icon: 'bar-chart', label: 'Thống kê', hint: 'Xu hướng đấu giá, chuyến và đội xe', href: '/statistics' },
        ...(shipper ? [] : [{ icon: 'credit-card', label: 'Ví và thanh toán', hint: 'Số dư, nạp, rút, lịch sử', href: '/wallet' }]),
        { icon: 'file-text-o', label: 'Hợp đồng', hint: 'Xem và ký hợp đồng vận chuyển', href: '/contracts' },
        ...(shipper ? [] : [{ icon: 'list-alt', label: 'Phiên tôi đã đăng ký', hint: 'Thanh toán, vào phòng, kết quả', href: '/registrations' }]),
        { icon: 'exclamation-triangle', label: 'Khiếu nại', hint: 'Gửi và theo dõi khiếu nại', href: '/complaints' },
        { icon: 'bell', label: 'Thông báo', hint: 'Phiên, hợp đồng và chuyến', href: '/notifications', badge: count ? String(count) : null },
      ],
    },
    {
      title: 'Hồ sơ',
      items: [
        ...(shipper ? [{ icon: 'book', label: 'Sổ địa chỉ kho', hint: 'Kho thường dùng khi tạo phiên', href: '/addresses' }] : []),
        { icon: 'building-o', label: 'Hồ sơ doanh nghiệp', hint: 'Xác thực người đại diện và doanh nghiệp', href: '/company' },
        { icon: 'id-card-o', label: 'Quét QR xác thực người đại diện', hint: 'Đọc căn cước gắn chip bằng NFC', href: '/verification' },
      ],
    },
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={type.title}>{roleLabel(session.role)}</Text>
        <Text style={[type.secondary, type.tabular]}>{session.phone}</Text>
      </View>
      {groups.map((group) => (
        <View key={group.title} style={{ gap: space.xs }}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.group}>
            {group.items.map((item) => <MenuItem key={item.href} icon={icon(item.icon)} label={item.label} hint={item.hint} badge={item.badge} onPress={() => router.push(item.href)} />)}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  groupTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  group: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: 'hidden' },
});
