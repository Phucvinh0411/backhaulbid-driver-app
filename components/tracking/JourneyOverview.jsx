import { useMemo, useRef } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button, RouteBlock, Section, StatusBadge } from '@/components/ui';
import JourneyMap from './JourneyMap';
import ProofImage from '@/components/ProofImage';
import { useTripTracking } from '@/lib/useTripTracking';
import { mapPayload, freshnessLabel, validPoint, locationTime } from '@/lib/trackingData';
import { EVENT_LABELS, STEP_ORDER, statusOf, shortId, formatDateTime } from '@/lib/trips';
import { colors, radius, space, type, fonts } from '@/constants/theme';

const STEP_LABELS = ['Chờ lấy', 'Đã lấy', 'Vận chuyển', 'Đã giao', 'Hoàn tất'];
const day = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });

function formatDistanceMeters(meters) {
  if (meters == null || !Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatEtaSeconds(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  if (seconds <= 60) return 'Sắp đến nơi';
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `~${totalMin} phút`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `~${h} giờ ${m} phút` : `~${h} giờ`;
}

export default function JourneyOverview({ trip, events = [], nextStep, children }) {
  const { tracking, points, sampling, error } = useTripTracking(trip.id);
  const ordered = useMemo(() => {
    return events
      .map((e) => ({
        ...e,
        title: EVENT_LABELS[e.eventType] || e.eventType,
      }))
      .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  }, [events]);

  // A poll can arrive while the route is still being fetched. Reuse the last road geometry only for
  // the same trip, route version and anchor pair; "no route"/"rejected" drops it. No straight line.
  const lastRoad = useRef(null);
  const payload = useMemo(() => {
    const next = mapPayload({ trip, tracking, points });
    if (next.route?.length) lastRoad.current = { key: next.anchorKey, route: next.route };
    else if (next.routingStatus === 'NO_ROUTE' || next.routingStatus === 'REJECTED') lastRoad.current = null;
    const withRoute = !next.route?.length && lastRoad.current?.key === next.anchorKey && next.pickup && next.delivery ? { ...next, route: lastRoad.current.route } : next;
    return { ...withRoute, routeNote: routeNote(withRoute) };
  }, [trip, tracking, points]);

  const status = statusOf(tracking?.status || trip.status), latestEvent = ordered[0];
  const latestPoint = tracking?.latestLocation;
  const locationDate = locationTime(latestPoint);
  const progress = payload.progress;
  const speedKmh = payload.latest?.speedKmh;
  const target = ['WAITING_PICKUP', 'PICKED_UP'].includes(trip.status) ? trip.pickupPoint : trip.deliveryPoint;
  const targetAddress = ['WAITING_PICKUP', 'PICKED_UP'].includes(trip.status) ? trip.pickupLocation : trip.deliveryLocation;
  const openDirections = () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(validPoint(target) ? `${target.latitude},${target.longitude}` : targetAddress || '')}`);
  let previousDay = null;

  return <View style={{ gap: space.lg }}>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>THEO DÕI CHUYẾN #{shortId(trip.id)}</Text>
      <Text accessibilityRole="header" style={styles.status}>{status.label}</Text>
      <Text style={type.secondary}>{latestEvent ? `${latestEvent.title || EVENT_LABELS[latestEvent.eventType] || latestEvent.eventType} · ${formatDateTime(latestEvent.recordedAt)}` : 'Chưa có mốc hành trình được ghi.'}</Text>
      {trip.expectedDeliveryAt ? <Text style={[type.caption, type.tabular]}>Hạn giao {formatDateTime(trip.expectedDeliveryAt)}{trip.lateMinutes > 0 ? ` · Trễ ${trip.lateMinutes} phút` : ''}</Text> : null}
      {trip.status === 'CANCELLED' ? <Text style={[type.body, { color: colors.danger }]}>{trip.cancellationReason || 'Chuyến đã hủy.'}</Text> : <View style={styles.steps} accessibilityLabel={`Tiến trình: ${status.label}`}>
        {STEP_ORDER.map((step, index) => <View key={step} style={styles.step}>
          <View style={styles.stepTop}>{index > 0 ? <View style={[styles.stepLine, index <= status.step && { backgroundColor: colors.brand }]} /> : <View style={styles.blankLine} />}<View style={[styles.stepDot, index <= status.step && { backgroundColor: colors.brand, borderColor: colors.brand }]}><Text style={{ color: index <= status.step ? '#fff' : colors.inkMuted, fontSize: 10 }}>{index < status.step ? '✓' : index === status.step ? '●' : ''}</Text></View>{index < 4 ? <View style={[styles.stepLine, index < status.step && { backgroundColor: colors.brand }]} /> : <View style={styles.blankLine} />}</View>
          <Text style={[styles.stepLabel, index === status.step && { color: colors.brand, fontFamily: fonts.bold }]}>{STEP_LABELS[index]}</Text>
        </View>)}
      </View>}
      {nextStep ? <View style={styles.next}><Text style={{ ...type.caption, color: colors.brand, fontFamily: fonts.bold }}>TIẾP THEO</Text><Text style={type.body}>{nextStep}</Text></View> : null}
    </View>
    <Section title="Theo dõi vị trí thời gian thực">
      <JourneyMap key={`${trip.id}:${trip.routeVersion || 0}:${tracking?.routeVersion || 0}`} payload={payload} />
      <View style={styles.liveCard}>
        <View style={styles.liveHeader}>
          <StatusBadge label={freshnessLabel(tracking)} tone={tracking?.freshness === 'FRESH' ? 'success' : 'neutral'} />
          {speedKmh != null ? <Text style={[type.caption, type.tabular, { fontFamily: fonts.bold, color: colors.brand }]}>{speedKmh} km/h</Text> : null}
        </View>
        {progress && (progress.traveledMeters > 0 || progress.remainingMeters != null) ? (
          <>
            {progress.progressRatio != null ? (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress.progressRatio * 100)}%` }]} />
              </View>
            ) : null}
            <View style={styles.metricsRow}>
              <View style={styles.metricCol}>
                <Text style={type.caption}>Đã đi</Text>
                <Text style={[styles.metricValue, type.tabular]}>{formatDistanceMeters(progress.traveledMeters)}</Text>
              </View>
              <View style={styles.metricCol}>
                <Text style={type.caption}>Còn lại</Text>
                <Text style={[styles.metricValue, type.tabular]}>{formatDistanceMeters(progress.remainingMeters)}</Text>
              </View>
              <View style={styles.metricCol}>
                <Text style={type.caption}>Dự kiến đến</Text>
                <Text style={[styles.metricValue, type.tabular]}>{formatEtaSeconds(progress.etaSeconds)}</Text>
              </View>
            </View>
          </>
        ) : null}
        {locationDate ? <Text style={[type.caption, type.tabular]}>Cập nhật lúc {formatDateTime(locationDate)}{latestPoint?.accuracyMeters != null ? ` · Sai số ±${Math.round(latestPoint.accuracyMeters)} m` : ''}</Text> : <Text style={type.caption}>Vị trí xe hiển thị tự động khi tài xế bắt đầu thực hiện chuyến.</Text>}
        {error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa cập nhật được vị trí: {error}</Text> : null}
        <MapLegend payload={payload} />
        {sampling.sampled ? <Text style={type.caption}>Đường đi được lấy mẫu từ {sampling.totalPoints.toLocaleString('vi-VN')} điểm.</Text> : null}
      </View>
      {targetAddress || validPoint(target) ? <Button label="Chỉ đường bằng ứng dụng bản đồ" variant="secondary" onPress={openDirections} /> : null}
      {children}
    </Section>
    <Section title="Lấy hàng và giao hàng"><RouteBlock from={trip.pickupPoint?.label || trip.pickupLocation} to={trip.deliveryPoint?.label || trip.deliveryLocation} fromDetail={trip.pickupPoint?.address} toDetail={trip.deliveryPoint?.address} />{!payload.pickup || !payload.delivery ? <Text style={type.caption}>Kho chưa được chủ hàng ghim tọa độ nên chưa có trên bản đồ; địa chỉ vẫn hiển thị ở đây.</Text> : null}</Section>
    <Section title="Cập nhật hành trình">
      {!ordered.length ? <Text style={type.secondary}>Các mốc giao nhận sẽ hiện tại đây khi Tài xế nhận chuyến và thực hiện giao nhận.</Text> : ordered.map((event, index) => {
        const timestamp = Date.parse(event.recordedAt), key = Number.isFinite(timestamp) ? new Date(timestamp).toDateString() : 'unknown';
        const group = key !== previousDay; previousDay = key;
        return <View key={event.id || `${event.eventType}:${event.recordedAt}`} style={{ gap: space.sm }}>
          {group && Number.isFinite(timestamp) ? <Text style={styles.day}>{day.format(timestamp)}</Text> : null}
          <View style={styles.event}><View style={styles.rail}><View style={[styles.dot, index === 0 && styles.latestDot, event.eventType === 'INCIDENT_REPORTED' && { borderColor: colors.warning, backgroundColor: colors.warningSoft }]} />{index < ordered.length - 1 ? <View style={styles.line} /> : null}</View>
            <View style={{ flex: 1, gap: 4, paddingBottom: space.lg }}><Text style={[type.body, { fontFamily: index === 0 ? fonts.bold : fonts.semibold, color: index === 0 ? colors.brand : colors.ink }]}>{event.title || EVENT_LABELS[event.eventType] || event.eventType}</Text><Text style={[type.caption, type.tabular]}>{formatDateTime(event.recordedAt)}</Text>{event.note ? <Text style={type.secondary}>{event.note}</Text> : null}{event.evidenceUrl ? <ProofImage url={event.evidenceUrl} style={{ width: '100%', height: 160, borderRadius: radius.md }} label="Bằng chứng tại mốc hành trình" /> : null}</View>
          </View>
        </View>;
      })}
    </Section>
  </View>;
}

const styles = StyleSheet.create({
  hero: { padding: space.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, gap: space.md },
  eyebrow: { fontSize: 12, fontFamily: fonts.bold, color: colors.inkMuted, letterSpacing: .6 }, status: { fontSize: 24, fontFamily: fonts.bold, color: colors.ink, lineHeight: 31 },
  steps: { flexDirection: 'row', marginHorizontal: -8, paddingVertical: 8 }, step: { flex: 1, gap: 8, alignItems: 'center' }, stepTop: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lineStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, stepLine: { flex: 1, height: 2, backgroundColor: colors.line }, blankLine: { flex: 1 }, stepLabel: { fontSize: 11, lineHeight: 15, textAlign: 'center', color: colors.inkMuted },
  next: { backgroundColor: colors.brandSoft, padding: space.md, borderRadius: radius.md, gap: 4 }, day: { fontSize: 13, fontFamily: fonts.bold, color: colors.inkMuted, marginBottom: 4 },
  event: { flexDirection: 'row', gap: space.md }, rail: { width: 18, alignItems: 'center', paddingTop: 4 }, dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.lineStrong, backgroundColor: colors.surface }, latestDot: { width: 16, height: 16, borderRadius: 8, borderColor: colors.brand, backgroundColor: colors.brand }, line: { width: 2, flex: 1, backgroundColor: colors.line, marginTop: 5, minHeight: 24 },
  liveCard: { gap: space.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: colors.line },
  liveHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.info, borderRadius: 3 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, paddingVertical: 4 },
  metricCol: { flex: 1, gap: 2 },
  metricValue: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
});

/** Why no road is drawn; the map shows only the A and B pins in that case. */
function routeNote(payload) {
  if (!payload.pickup || !payload.delivery || payload.route?.length) return '';
  return ({
    UNAVAILABLE: 'Dịch vụ tuyến đường tạm không phản hồi. Bản đồ chỉ hiện hai điểm A và B.',
    NO_ROUTE: 'Không tìm được tuyến đường bộ giữa hai kho.',
    REJECTED: 'Tuyến nhận về không hợp lệ nên không vẽ. Bản đồ chỉ hiện hai điểm A và B.',
    NOT_CONFIGURED: 'Chưa cấu hình dịch vụ tuyến đường. Bản đồ chỉ hiện hai điểm A và B.',
  })[payload.routingStatus] || 'Đang lấy tuyến đường bộ. Bản đồ chỉ hiện hai điểm A và B.';
}

function MapLegend({ payload }) {
  const rows = [];
  if (payload.segments?.some((segment) => segment.length) || payload.routePassed?.length) {
    rows.push([<View key="p" style={[legend.swatch, { height: 5, backgroundColor: colors.info }]} />, 'Đoạn đường xe đã đi']);
  }
  if (payload.route?.length) {
    rows.push([<View key="r" style={[legend.swatch, { height: 3, backgroundColor: colors.inkMuted }]} />, 'Quãng đường dự kiến còn lại']);
  }
  return <View style={{ gap: 4 }}>
    {rows.map(([swatch, text]) => <View key={text} style={legend.row}>{swatch}<Text style={type.caption}>{text}</Text></View>)}
    {payload.routeNote ? <Text style={type.caption} accessibilityLiveRegion="polite">{payload.routeNote}</Text> : null}
  </View>;
}

const legend = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 22, borderRadius: 2 },
});
