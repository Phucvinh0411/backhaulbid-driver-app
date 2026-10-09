import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionBar, Banner, Button, CheckRow, Row, Screen, Section, StateView, StatusBadge, useResource, useSingleFlight } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { contractApi } from '@/lib/services';
import { mapContractResponse } from '@/lib/shared/contractMapper';
import { formatDateTime, formatMoney } from '@/lib/shared/format';
import { CONTRACT_VIEW_STATUS } from '@/lib/ownerMeta';
import { colors, type } from '@/constants/theme';

const ROLE_LABEL = { CARRIER: 'Nhà xe', SHIPPER: 'Chủ hàng' };

export default function ContractDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const role = session?.role === 'SHIPPER' ? 'shipper' : 'carrier';
  const { data, state, error, refreshing, reload } = useResource(() => contractApi.get(String(id)), [id]);
  const [agreed, setAgreed] = useState(false);
  const [signError, setSignError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, run] = useSingleFlight();

  const sign = () => run(async () => {
    if (!agreed) return setSignError('Xác nhận đã đọc và đồng ý điều khoản trước khi ký.');
    setSignError('');
    try {
      await contractApi.sign(String(id));
      setNotice('Đã ký hợp đồng.');
      setAgreed(false);
    } catch (failure) {
      setSignError(failure.message);
    }
    await reload();
    return undefined;
  });

  if (state === 'loading') return <StateView kind="loading" title="Đang tải hợp đồng" />;
  if (state === 'forbidden') return <StateView kind="error" title="Không có quyền xem hợp đồng" message="Hợp đồng này không thuộc tài khoản của bạn." />;
  if (!data) return <StateView kind="error" title="Không tải được hợp đồng" message={error} actionLabel="Thử lại" onAction={() => reload()} />;

  const contract = mapContractResponse(data, role);
  const trip = data.trip || {};
  const canSign = contract.status === 'PENDING_SIGNATURE' && contract.canSign;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Hợp đồng vận chuyển' }} />
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })} bottomInset={canSign ? 200 : 0}>
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        {error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}
        <Section title={contract.id} right={<StatusBadge {...(CONTRACT_VIEW_STATUS[contract.status] || { label: contract.status, tone: 'neutral' })} />}>
          <Row label="Tuyến" value={`${contract.origin} → ${contract.destination}`} />
          <Row label="Giá trị hợp đồng" value={formatMoney(trip.agreedPrice)} strong />
          <Row label="Hạn giao" value={formatDateTime(trip.expectedDeliveryAt)} />
          <Row label="Tiền đặt trước của nhà xe" value={trip.depositAmount ? formatMoney(trip.depositAmount) : 'Không áp dụng'} />
          <Row label="Hạn ký" value={formatDateTime(data.signingDeadlineAt)} />
          <Row label={role === 'shipper' ? 'Nhà xe' : 'Chủ hàng'} value={contract.partnerId} selectable />
          <Row label="Tạo lúc" value={formatDateTime(data.createdAt)} />
        </Section>
        {contract.status === 'PENDING_SIGNATURE' ? <Banner tone={canSign ? 'warning' : 'info'}>{contract.pendingMessage}</Banner> : null}
        <Section title="Chữ ký">
          {['CARRIER', 'SHIPPER'].map((signer) => {
            const signature = contract.signatures.find((item) => item.role === signer && item.signedAt);
            return <Row key={signer} label={ROLE_LABEL[signer]} value={signature ? `Đã ký ${formatDateTime(signature.signedAt)}` : 'Chưa ký'} />;
          })}
          <Text style={type.caption}>Với hợp đồng từ đấu giá, nhà xe ký trước rồi chủ hàng ký.</Text>
        </Section>
        {contract.pdfUrl ? <Button label="Mở bản PDF" variant="secondary" onPress={() => Linking.openURL(contract.pdfUrl)} /> : null}
        {contract.tripId ? <Button label="Theo dõi chuyến" variant="secondary" onPress={() => router.push(`/business/trips/${contract.tripId}`)} /> : null}
      </Screen>
      {canSign ? (
        <ActionBar>
          <CheckRow label="Tôi đã đọc, hiểu rõ và đồng ý với điều khoản hợp đồng vận chuyển." value={agreed} onChange={(value) => { setAgreed(value); setSignError(''); }} />
          {signError ? <Banner tone="danger">{signError}</Banner> : null}
          <Button label="Ký hợp đồng" onPress={sign} loading={busy} disabled={!agreed} />
        </ActionBar>
      ) : null}
    </View>
  );
}
