import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Banner, Button, Screen, StateView, useResource, useSingleFlight } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isDriverSession } from '@/lib/sessionModel';
import { Redirect } from 'expo-router';
import { notificationApi } from '@/lib/services';
import { getNotificationDestination } from '@/lib/notificationRouting';
import { formatDateTime } from '@/lib/shared/format';
import { colors, radius, space, type, fonts } from '@/constants/theme';

export default function NotificationsTab() {
  const { session } = useAuth();
  if (!session) return null;
  // Notifications are account-wide; a driver code session has no account and the gateway blocks them.
  if (isDriverSession(session)) return <Redirect href="/" />;
  return <Notifications key={session.accountId} role={session.role} />;
}

function Notifications({ role }) {
  const router = useRouter();
  const { data, setData, state, error, refreshing, reload } = useResource(() => notificationApi.mine(), []);
  const [notice, setNotice] = useState('');
  const [busy, run] = useSingleFlight();
  const items = (Array.isArray(data) ? data : data?.data || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unread = items.filter((item) => !item.isRead).length;

  const markAll = () => run(async () => {
    try {
      await notificationApi.markAllRead();
      setData((current) => (Array.isArray(current) ? current.map((item) => ({ ...item, isRead: true })) : current));
      setNotice('Đã đánh dấu tất cả là đã đọc.');
    } catch (failure) {
      setNotice(failure.message);
    }
  });

  return (
    <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })}>
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      {unread ? <Button label={`Đánh dấu đã đọc (${unread})`} variant="secondary" onPress={markAll} loading={busy} /> : null}
      {state === 'loading' && <StateView kind="loading" title="Đang tải thông báo" />}
      {state === 'error' && <StateView kind="error" title="Không tải được thông báo" message={error} actionLabel="Thử lại" onAction={() => reload()} />}
      {state === 'ready' && items.length === 0 && <StateView title="Chưa có thông báo" message="Thông báo về phiên đấu giá, hợp đồng và chuyến sẽ xuất hiện ở đây." />}
      {items.map((item) => {
        const destination = getNotificationDestination(item, role);
        return (
          <Pressable key={item._id || item.id} accessibilityRole={destination ? 'link' : undefined} disabled={!destination}
            accessibilityLabel={`${item.isRead ? '' : 'Chưa đọc. '}${item.title}`}
            onPress={() => destination && router.push(destination.href)}
            style={({ pressed }) => [styles.item, !item.isRead && styles.unread, pressed && { backgroundColor: colors.surfaceSunken }]}>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              {!item.isRead ? <View style={styles.dot} /> : null}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={type.secondary}>{item.message}</Text>
                <Text style={[type.caption, type.tabular]}>{formatDateTime(item.createdAt)}</Text>
                {destination ? <Text style={styles.link}>{destination.label} ›</Text> : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.lg },
  unread: { borderColor: colors.brandSoft, backgroundColor: colors.canvas },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand, marginTop: 6 },
  title: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  link: { color: colors.brand, fontFamily: fonts.bold },
});
