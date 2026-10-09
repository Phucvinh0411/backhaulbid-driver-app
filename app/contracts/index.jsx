import { useMemo, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, Screen, StateView, StatusBadge, Tabs, useResource } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { contractApi } from '@/lib/services';
import { mapContractResponses } from '@/lib/shared/contractMapper';
import { formatDateTime } from '@/lib/shared/format';
import { CONTRACT_VIEW_STATUS } from '@/lib/ownerMeta';
import { colors, space, type, fonts } from '@/constants/theme';

const FILTERS = [
  { value: 'ACTION', label: 'Cần ký' },
  { value: 'PENDING_SIGNATURE', label: 'Chờ ký' },
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'ALL', label: 'Tất cả' },
];

export default function ContractsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const role = session?.role === 'SHIPPER' ? 'shipper' : 'carrier';
  const [filter, setFilter] = useState(null);
  const { data, state, error, refreshing, reload } = useResource(() => contractApi.mine(), []);
  const items = useMemo(() => mapContractResponses(data, role).sort((a, b) => Number(b.canSign) - Number(a.canSign) || String(b.date).localeCompare(String(a.date))), [data, role]);
  const match = (contract, value) => (value === 'ALL' ? true : value === 'ACTION' ? contract.status === 'PENDING_SIGNATURE' && contract.canSign : contract.status === value);
  const current = filter ?? (items.some((contract) => match(contract, 'ACTION')) ? 'ACTION' : 'ALL');
  const visible = items.filter((contract) => match(contract, current));

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Hợp đồng' }} />
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })}>
        <Tabs label="Lọc hợp đồng" value={current} onChange={setFilter} options={FILTERS.map((item) => ({ ...item, count: items.filter((contract) => match(contract, item.value)).length }))} />
        {state === 'loading' && <StateView kind="loading" title="Đang tải hợp đồng" />}
        {state === 'error' && <StateView kind="error" title="Không tải được hợp đồng" message={error} actionLabel="Thử lại" onAction={() => reload()} />}
        {state === 'ready' && visible.length === 0 && <StateView title="Không có hợp đồng trong mục này" message="Hợp đồng được tạo tự động khi phiên đấu giá trao thầu." />}
        {visible.map((contract) => (
          <Card key={contract.backendId} onPress={() => router.push(`/contracts/${contract.backendId}`)} accessibilityLabel={`Hợp đồng ${contract.id}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, alignItems: 'center' }}>
              <Text style={[type.caption, type.tabular, { flex: 1 }]} numberOfLines={1}>{contract.id}</Text>
              <StatusBadge {...(CONTRACT_VIEW_STATUS[contract.status] || { label: contract.status, tone: 'neutral' })} />
            </View>
            <Text style={{ fontSize: 15, fontFamily: fonts.bold, color: colors.ink }}>{contract.origin} → {contract.destination}</Text>
            <Text style={[type.secondary, type.tabular]}>Giá trị {contract.value} · tạo {contract.date}</Text>
            {contract.status === 'PENDING_SIGNATURE' ? (
              <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: contract.canSign ? colors.danger : colors.inkMuted }}>
                {contract.pendingMessage}{contract.signingDeadlineAt ? ` Hạn ký ${formatDateTime(contract.signingDeadlineAt)}.` : ''}
              </Text>
            ) : null}
          </Card>
        ))}
      </Screen>
    </View>
  );
}
