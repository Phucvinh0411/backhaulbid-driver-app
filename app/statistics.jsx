import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Banner, Row, Screen, Section, StateView, Tabs, useResource } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { roleLabel } from '@/lib/roles';
import { statisticsApi } from '@/lib/services';
import { STAT_RANGES, formatStatCount, formatStatCurrency, normalizeBreakdown, statisticsQuery } from '@/lib/statisticsPresentation';
import { colors, fonts, radius, space, type } from '@/constants/theme';

const STATUS_LABELS = {
  PENDING: 'Chờ mở', OPEN: 'Đang mở', COMPLETED: 'Đã kết thúc', CANCELLED: 'Đã hủy',
  WAITING_PICKUP: 'Chờ lấy hàng', PICKED_UP: 'Đã lấy hàng', IN_TRANSIT: 'Đang vận chuyển',
  DELIVERED: 'Đã giao', SIGNED: 'Đã ký',
};

function Metric({ label, value, note }) {
  return <View style={styles.metric}><Text style={type.caption}>{label}</Text><Text accessibilityLabel={`${label}: ${value}`} style={[styles.metricValue, type.tabular]}>{value}</Text>{note ? <Text style={type.caption}>{note}</Text> : null}</View>;
}

function Breakdown({ rows }) {
  if (!rows.length) return <Text style={type.secondary}>Chưa có dữ liệu trạng thái trong kỳ này.</Text>;
  return <View style={{ gap: space.sm }}>{rows.map(({ status, count }) => <Row key={status} label={STATUS_LABELS[status] || status} value={formatStatCount(count)} />)}</View>;
}

function Trend({ points }) {
  if (!Array.isArray(points) || points.length === 0) return <Text style={type.secondary}>Chưa có chuỗi dữ liệu trong kỳ này.</Text>;
  const maximum = Math.max(1, ...points.map((point) => Number(point.count ?? point.value) || 0));
  return <View accessibilityLabel="Biểu đồ xu hướng theo kỳ" style={styles.trend}>{points.map((point, index) => {
    const value = Number(point.count ?? point.value) || 0;
    const height = Math.max(4, Math.round((value / maximum) * 92));
    const label = point.label || point.date || String(index + 1);
    return <View key={`${label}-${index}`} style={styles.barColumn}>
      <Text style={styles.barValue}>{formatStatCount(value)}</Text>
      <View accessible accessibilityLabel={`${label}: ${formatStatCount(value)}`} style={[styles.bar, { height }]} />
      <Text numberOfLines={1} style={styles.barLabel}>{label}</Text>
    </View>;
  })}</View>;
}

function SourceState({ state, source, children, onRetry }) {
  if (state === 'loading') return <StateView kind="loading" title={`Đang tải ${source.toLowerCase()}`} />;
  if (state === 'error') return <StateView kind="error" title={`Không tải được ${source.toLowerCase()}`} message="Số liệu của mục này chưa khả dụng." actionLabel="Thử lại" onAction={onRetry} />;
  return children;
}

export default function StatisticsScreen() {
  const { session } = useAuth();
  const [range, setRange] = useState('30d');
  const [topic, setTopic] = useState('auctions');
  const carrier = session?.role === 'CARRIER';
  const query = statisticsQuery(range);
  const resource = useResource(async () => {
    const settled = async (loader) => {
      try { return { state: 'ready', data: await loader() }; }
      catch (error) { return { state: 'error', error }; }
    };
    const [bidding, trips, fleet] = await Promise.all([
      settled(() => statisticsApi.bidding(query)),
      settled(() => statisticsApi.trips(query)),
      carrier ? settled(() => statisticsApi.fleet(query)) : Promise.resolve({ state: 'skipped' }),
    ]);
    return { bidding, trips, fleet };
  }, [range, carrier]);
  const retry = () => resource.reload();
  const data = resource.data || {};
  const selectedRange = STAT_RANGES.find((item) => item.value === range);
  const sections = [
    { value: 'auctions', label: 'Đấu giá' },
    { value: 'trips', label: 'Chuyến' },
    ...(carrier ? [{ value: 'fleet', label: 'Đội xe' }] : []),
  ];

  return <Screen refreshing={resource.refreshing} onRefresh={() => resource.reload({ pull: true })}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={type.title}>Thống kê {roleLabel(session?.role).toLowerCase()}</Text>
      <Text style={type.secondary}>Số liệu tổng hợp từ các dịch vụ nghiệp vụ trong kỳ đã chọn.</Text>
    </View>
    <Tabs label="Khoảng thời gian" value={range} onChange={setRange} options={STAT_RANGES.map(({ value, label }) => ({ value, label }))} />
    <Tabs label="Nhóm thống kê" value={topic} onChange={setTopic} options={sections} />

    {topic === 'auctions' ? <SourceState state={data.bidding?.state || 'loading'} source="Đấu giá" onRetry={retry}>
      <Section title={carrier ? 'Tham gia đấu giá' : 'Phiên đấu giá'}>
        <View style={styles.metricGrid}>
          <Metric label={carrier ? 'Phiên đã tham gia' : 'Tổng số phiên'} value={formatStatCount(carrier ? data.bidding.data?.participations : data.bidding.data?.total)} />
          {carrier ? <Metric label="Phiên đã có kết quả" value={formatStatCount(data.bidding.data?.decidedAuctions)} /> : null}
          {carrier ? <Metric label="Phiên trúng" value={formatStatCount(data.bidding.data?.wonAuctions)} /> : <Metric label="Phiên đang mở" value={formatStatCount(data.bidding.data?.byStatus?.OPEN)} />}
          {carrier ? <Metric label="Tỷ lệ trúng" value={typeof data.bidding.data?.winRate === 'number' ? `${data.bidding.data.winRate}%` : '—'} note="Chỉ tính phiên đã có kết quả" /> : null}
        </View>
        <Breakdown rows={normalizeBreakdown(data.bidding.data?.byStatus)} />
      </Section>
      <Section title="Diễn biến theo kỳ"><Trend points={data.bidding.data?.series} /></Section>
      {data.bidding.data?.refreshedAt ? <Text style={type.caption}>Cập nhật lúc {new Date(data.bidding.data.refreshedAt).toLocaleString('vi-VN')}</Text> : null}
    </SourceState> : null}

    {topic === 'trips' ? <SourceState state={data.trips?.state || 'loading'} source="chuyến vận chuyển" onRetry={retry}>
      <Section title="Chuyến vận chuyển">
        <View style={styles.metricGrid}>
          <Metric label="Tổng số chuyến" value={formatStatCount(data.trips.data?.total)} />
          <Metric label="Giá trị hợp đồng" value={formatStatCurrency(data.trips.data?.agreedValue)} note="Giá trị đã thỏa thuận, không phải tiền đã thanh toán" />
        </View>
        <Breakdown rows={normalizeBreakdown(data.trips.data?.byStatus)} />
      </Section>
      <Section title="Diễn biến theo kỳ"><Trend points={data.trips.data?.series} /></Section>
    </SourceState> : null}

    {topic === 'fleet' && carrier ? <SourceState state={data.fleet?.state || 'loading'} source="đội xe" onRetry={retry}>
      <Section title="Đội xe và uy tín">
        <View style={styles.metricGrid}>
          <Metric label="Phương tiện" value={formatStatCount(data.fleet.data?.vehicleCount)} />
          <Metric label="Phương tiện đang hoạt động" value={formatStatCount(data.fleet.data?.activeVehicleCount)} />
          <Metric label="Tài xế" value={formatStatCount(data.fleet.data?.driverCount)} />
          <Metric label="Điểm uy tín" value={typeof data.fleet.data?.reputation === 'number' ? data.fleet.data.reputation.toFixed(1) : '—'} note="Nguồn: hồ sơ uy tín đội xe" />
        </View>
      </Section>
    </SourceState> : null}

    <Banner tone="neutral">Khoảng ngày dùng giờ Việt Nam (Asia/Ho_Chi_Minh); dữ liệu mới nhất có thể trễ theo thời điểm đồng bộ của từng dịch vụ.</Banner>
    {selectedRange ? <Text accessibilityLiveRegion="polite" style={styles.rangeCaption}>Khoảng đang xem: {selectedRange.label}</Text> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  heading: { gap: space.xs },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metric: { flexGrow: 1, flexBasis: '46%', minWidth: 140, minHeight: 96, padding: space.md, gap: 4, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  metricValue: { color: colors.brand, fontSize: 20, fontFamily: fonts.bold },
  trend: { minHeight: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4, paddingTop: space.lg },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barValue: { color: colors.inkMuted, fontSize: 10, fontFamily: fonts.medium },
  bar: { width: '72%', backgroundColor: colors.brand, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { color: colors.inkMuted, fontSize: 10, maxWidth: '100%' },
  rangeCaption: { color: colors.inkMuted, textAlign: 'right', fontSize: 12 },
});
