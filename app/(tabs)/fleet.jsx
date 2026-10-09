import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Banner, Button, Card, Screen, StateView, StatusBadge, Tabs, TextField, useResource } from '@/components/ui';
import FleetImportSheet from '@/components/fleet/FleetImportSheet';
import { useAuth } from '@/lib/auth';
import { fleetApi } from '@/lib/services';
import { FLEET_STATUS, metaOf } from '@/lib/ownerMeta';
import { VEHICLE_TYPES } from '@/lib/shared/auctionForm';
import { colors, space, type, fonts } from '@/constants/theme';

const STATUS_FILTERS = [{ value: '', label: 'Tất cả' }, { value: 'VERIFIED', label: 'Đã duyệt' }, { value: 'PENDING', label: 'Chờ duyệt' }, { value: 'REJECTED', label: 'Bị từ chối' }];

export default function FleetTab() {
  const { session } = useAuth();
  if (session?.role !== 'CARRIER') return null;
  return <Fleet key={session.accountId} />;
}

function Fleet() {
  const router = useRouter();
  const [section, setSection] = useState('vehicles');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(null);
  const [notice, setNotice] = useState('');
  const { data, state, error, refreshing, reload } = useResource(async () => {
    const [vehicles, drivers] = await Promise.all([fleetApi.vehicles(), fleetApi.drivers()]);
    return { vehicles: Array.isArray(vehicles) ? vehicles : [], drivers: Array.isArray(drivers) ? drivers : [] };
  }, []);
  const list = useMemo(() => {
    const items = data?.[section] || [];
    const needle = query.trim().toLocaleLowerCase('vi');
    return items.filter((item) => (!status || item.status === status)
      && (!needle || [item.licensePlate, item.bodyType, item.fullName, item.phone, item.licenseNumber].join(' ').toLocaleLowerCase('vi').includes(needle)));
  }, [data, query, section, status]);
  const counts = { vehicles: data?.vehicles.length ?? 0, drivers: data?.drivers.length ?? 0 };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })}>
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        <Tabs label="Đội xe" value={section} onChange={(value) => { setSection(value); setStatus(''); }} options={[{ value: 'vehicles', label: 'Phương tiện', count: counts.vehicles }, { value: 'drivers', label: 'Tài xế', count: counts.drivers }]} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label={section === 'vehicles' ? 'Thêm xe' : 'Thêm tài xế'} onPress={() => router.push(section === 'vehicles' ? '/fleet/vehicle/new' : '/fleet/driver/new')} style={{ flex: 1 }} />
          <Button label="Nhập CSV" variant="secondary" onPress={() => setImporting(section === 'vehicles' ? 'vehicle' : 'driver')} style={{ flex: 1 }} />
        </View>
        <TextField placeholder={section === 'vehicles' ? 'Tìm biển số, loại thùng' : 'Tìm tên, số điện thoại, GPLX'} value={query} onChangeText={setQuery} accessibilityLabel="Tìm trong đội xe" />
        <Tabs label="Trạng thái duyệt" value={status} onChange={setStatus} options={STATUS_FILTERS} />
        {state === 'loading' && <StateView kind="loading" title="Đang tải đội xe" />}
        {state === 'error' && <StateView kind="error" title="Không tải được đội xe" message={error} actionLabel="Thử lại" onAction={() => reload()} />}
        {state === 'ready' && error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}
        {state === 'ready' && list.length === 0 && <StateView title={section === 'vehicles' ? 'Chưa có phương tiện phù hợp' : 'Chưa có tài xế phù hợp'} message="Hồ sơ mới được quản trị viên duyệt trước khi dùng để đấu giá hoặc phân công." />}
        {section === 'vehicles' && list.map((vehicle) => (
          <Card key={vehicle.id} onPress={() => router.push(`/fleet/vehicle/${vehicle.id}`)} accessibilityLabel={`Xe ${vehicle.licensePlate}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={{ fontSize: 17, fontFamily: fonts.bold, color: colors.ink }}>{vehicle.licensePlate}</Text>
              <StatusBadge {...metaOf(FLEET_STATUS, vehicle.status)} />
            </View>
            <Text style={type.secondary}>{VEHICLE_TYPES.find((item) => item.value === vehicle.vehicleType)?.label || vehicle.vehicleType}{vehicle.bodyType ? ` · ${vehicle.bodyType}` : ''} · {vehicle.payloadCapacity} tấn</Text>
            {vehicle.status === 'REJECTED' && vehicle.rejectionReason ? <Text style={[type.caption, { color: colors.danger }]}>Lý do: {vehicle.rejectionReason}</Text> : null}
          </Card>
        ))}
        {section === 'drivers' && list.map((driver) => (
          <Card key={driver.id} onPress={() => router.push(`/fleet/driver/${driver.id}`)} accessibilityLabel={`Tài xế ${driver.fullName}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={{ fontSize: 16, fontFamily: fonts.bold, color: colors.ink, flex: 1 }}>{driver.fullName}</Text>
              <StatusBadge {...metaOf(FLEET_STATUS, driver.status)} />
            </View>
            <Text style={[type.secondary, type.tabular]}>{driver.phone} · GPLX {driver.licenseNumber}</Text>
            {driver.status === 'REJECTED' && driver.rejectionReason ? <Text style={[type.caption, { color: colors.danger }]}>Lý do: {driver.rejectionReason}</Text> : null}
          </Card>
        ))}
      </Screen>
      {importing ? <FleetImportSheet kind={importing} onClose={() => setImporting(null)} onDone={(message) => { setImporting(null); setNotice(message); void reload(); }} /> : null}
    </View>
  );
}
