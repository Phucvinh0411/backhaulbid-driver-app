import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Row, Screen, Section, StateView, StatusBadge, useResource } from '@/components/ui';
import { carrierProfileApi } from '@/lib/services';
import { FLEET_STATUS, metaOf } from '@/lib/ownerMeta';
import { VEHICLE_TYPES } from '@/lib/shared/auctionForm';
import { formatDateTime, shortId } from '@/lib/shared/format';
import { colors, radius, space, type, fonts } from '@/constants/theme';

const list = (value) => (Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : []);

/** Public carrier profile for a shipper choosing a winner: only data the services expose publicly. */
export default function CarrierProfileScreen() {
  const { id } = useLocalSearchParams();
  const carrierId = String(id);
  const { data, state, error, refreshing, reload } = useResource(async () => {
    const [company, vehicles, drivers, reputation] = await Promise.allSettled([
      carrierProfileApi.company(carrierId),
      carrierProfileApi.vehicles(carrierId),
      carrierProfileApi.drivers(carrierId),
      carrierProfileApi.reputation(carrierId),
    ]);
    const value = (result, fallback) => (result.status === 'fulfilled' ? result.value?.data || result.value || fallback : fallback);
    return { company: value(company, null), vehicles: list(value(vehicles, [])), drivers: list(value(drivers, [])), reputation: value(reputation, null) };
  }, [carrierId]);

  if (state === 'loading') return <StateView kind="loading" title="Đang tải hồ sơ nhà xe" />;
  if (state === 'error') return <StateView kind="error" title="Không tải được hồ sơ" message={error} actionLabel="Thử lại" onAction={() => reload()} />;
  const company = data.company || {};
  const verified = company.verificationStatus === 'VERIFIED';
  const history = Array.isArray(data.reputation?.history) ? data.reputation.history : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Hồ sơ nhà xe' }} />
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })}>
        <Section title={company.companyName || `Nhà xe #${shortId(carrierId)}`} right={<StatusBadge label={verified ? 'Đã xác minh' : 'Chưa hoàn tất xác minh'} tone={verified ? 'success' : 'neutral'} />}>
          <Row label="Mã số thuế" value={company.taxCode} />
          <Row label="Người đại diện" value={company.legalRepresentative} />
          <Row label="Địa chỉ" value={company.address} />
          <Row label="Điện thoại" value={company.contactPhone} />
          <Row label="Email" value={company.contactEmail} />
        </Section>
        <Section title="Điểm uy tín" right={data.reputation?.score != null ? <Text style={[styles.score, type.tabular]}>{data.reputation.score}/100</Text> : null}>
          <Text style={type.caption}>Dùng để xét điều kiện tham gia phiên; giảm khi vi phạm chính sách giao trễ.</Text>
          {data.reputation == null ? <Text style={type.secondary}>Chưa có dữ liệu.</Text> : history.length === 0 ? <Text style={type.secondary}>Chưa có lần điều chỉnh điểm nào.</Text> : null}
          {history.map((entry) => (
            <View key={`${entry.tripId}-${entry.tier}`} style={styles.entry}>
              <Text style={styles.strong}>{entry.reason}</Text>
              <Text style={[type.caption, type.tabular]}>Chuyến #{shortId(entry.tripId)} · {formatDateTime(entry.createdAt)} · {entry.pointsDelta} điểm · còn {entry.scoreAfter}</Text>
            </View>
          ))}
        </Section>
        <Section title={`Phương tiện (${data.vehicles.length})`}>
          {data.vehicles.length === 0 ? <Text style={type.secondary}>Chưa có phương tiện công khai.</Text> : null}
          {data.vehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.entry}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <Text style={styles.strong}>{vehicle.licensePlate}</Text>
                <StatusBadge {...metaOf(FLEET_STATUS, vehicle.status)} />
              </View>
              <Text style={type.caption}>{VEHICLE_TYPES.find((item) => item.value === vehicle.vehicleType)?.label || vehicle.vehicleType}{vehicle.bodyType ? ` · ${vehicle.bodyType}` : ''} · {vehicle.payloadCapacity} tấn</Text>
            </View>
          ))}
        </Section>
        <Section title={`Tài xế (${data.drivers.length})`}>
          {data.drivers.length === 0 ? <Text style={type.secondary}>Chưa có tài xế công khai.</Text> : null}
          {data.drivers.map((driver) => (
            <View key={driver.id} style={[styles.entry, { flexDirection: 'row', justifyContent: 'space-between' }]}>
              <Text style={styles.strong}>{driver.fullName}</Text>
              <StatusBadge {...metaOf(FLEET_STATUS, driver.status)} />
            </View>
          ))}
        </Section>
      </Screen>
    </View>
  );
}

const styles = {
  score: { fontSize: 18, fontFamily: fonts.bold, color: colors.brand },
  entry: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm, gap: 2, borderRadius: radius.sm },
  strong: { fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
};
