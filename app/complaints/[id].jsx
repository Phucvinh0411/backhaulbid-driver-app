import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionBar, Banner, Button, Row, Screen, Section, StateView, StatusBadge, TextField, useResource, useSingleFlight } from '@/components/ui';
import ProofImage from '@/components/ProofImage';
import { useAuth } from '@/lib/auth';
import { complaintApi } from '@/lib/services';
import { COMPLAINT_ROLE_LABELS, getComplaintCategoryMeta, getComplaintDecisionLabel, getComplaintStatusMeta } from '@/lib/shared/complaints';
import { formatDateTime, shortId } from '@/lib/shared/format';
import { colors, radius, space, type, fonts } from '@/constants/theme';

const POLL_MS = 20_000;

export default function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const { data, setData, state, error, refreshing, reload } = useResource(() => complaintApi.get(String(id)), [id]);
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState('');
  const [busy, run] = useSingleFlight();
  const statusMeta = data ? getComplaintStatusMeta(data.status) : null;

  // Messages from the other party or an administrator arrive by polling while the case is open.
  const closed = statusMeta?.closed;
  const open = Boolean(data) && !closed;
  useEffect(() => {
    if (!open) return undefined;
    const interval = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(interval);
  }, [open, reload]);

  const send = () => run(async () => {
    const content = message.trim();
    if (!content) return setSendError('Nhập nội dung tin nhắn.');
    setSendError('');
    try {
      setData(await complaintApi.addMessage(String(id), { message: content }));
      setMessage('');
    } catch (failure) {
      setSendError(failure.message);
    }
    return undefined;
  });

  if (state === 'loading') return <StateView kind="loading" title="Đang tải khiếu nại" />;
  if (state === 'forbidden') return <StateView kind="error" title="Không có quyền xem khiếu nại" message="Khiếu nại này không liên quan đến tài khoản của bạn." />;
  if (!data) return <StateView kind="error" title="Không tải được khiếu nại" message={error} actionLabel="Thử lại" onAction={() => reload()} />;

  const messages = [...(data.messages || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const category = getComplaintCategoryMeta(data.category);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: `Khiếu nại #${shortId(data.id)}` }} />
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })} bottomInset={closed ? 0 : 200}>
        {error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}
        <Section title={data.title} right={<StatusBadge {...statusMeta} />}>
          <Row label="Loại vấn đề" value={category.label} />
          <Row label="Chuyến" value={`#${shortId(data.tripId)}`} />
          <Row label="Bạn là" value={data.reporterId === session?.accountId ? 'Người gửi khiếu nại' : 'Bên bị khiếu nại'} />
          <Row label="Gửi lúc" value={formatDateTime(data.createdAt)} />
          <Text style={type.body}>{data.description}</Text>
          {data.evidenceUrl ? <ProofImage url={data.evidenceUrl} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md }} label="Ảnh bằng chứng khiếu nại" /> : null}
          <Button label="Mở chuyến" variant="secondary" onPress={() => router.push(`/business/trips/${data.tripId}`)} />
        </Section>
        {data.decision || data.resolution ? (
          <Banner tone={data.status === 'REJECTED' ? 'danger' : 'success'} title={getComplaintDecisionLabel(data.decision) || 'Kết quả xử lý'}>{data.resolution || ''}</Banner>
        ) : null}
        <Section title={`Trao đổi (${messages.length})`}>
          {messages.length === 0 ? <Text style={type.secondary}>Chưa có tin nhắn. Quản trị viên và bên liên quan sẽ phản hồi tại đây.</Text> : null}
          {messages.map((item) => {
            const mine = item.senderId === session?.accountId;
            return (
              <View key={item.id || `${item.createdAt}-${item.senderId}`} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: mine ? colors.brandSoft : colors.surfaceSunken, borderRadius: radius.md, padding: space.md, gap: 2 }}>
                <Text style={[type.caption, { fontFamily: fonts.bold }]}>{mine ? 'Bạn' : COMPLAINT_ROLE_LABELS[item.senderRole] || 'Bên liên quan'}</Text>
                <Text style={type.body}>{item.message || item.content}</Text>
                <Text style={[type.caption, type.tabular]}>{formatDateTime(item.createdAt)}</Text>
              </View>
            );
          })}
          {closed ? <Text style={type.secondary}>Khiếu nại đã đóng, không gửi thêm tin nhắn.</Text> : null}
        </Section>
      </Screen>
      {!closed ? (
        <ActionBar>
          <TextField placeholder="Nhập tin nhắn" value={message} onChangeText={(value) => { setMessage(value); setSendError(''); }} multiline maxLength={2000} error={sendError} accessibilityLabel="Tin nhắn" />
          <Button label="Gửi tin nhắn" onPress={send} loading={busy} disabled={!message.trim()} />
        </ActionBar>
      ) : null}
    </View>
  );
}
