// Map and queue boundaries. Only coordinates and public journey labels enter the map.
export const QUEUE_LIMIT = 120;
export const QUEUE_TTL = 30 * 60 * 1000;
export const MAP_POINT_LIMIT = 1500;
export const GPS_STATUSES = ['WAITING_PICKUP', 'PICKED_UP', 'IN_TRANSIT'];
export const locationTime = (point) => point?.capturedAt || point?.recordedAt;

export function validPoint(point) {
  return point?.latitude != null && point?.longitude != null
    && String(point.latitude).trim() !== '' && String(point.longitude).trim() !== ''
    && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))
    && Math.abs(Number(point.latitude)) <= 90 && Math.abs(Number(point.longitude)) <= 180;
}

export function trimQueue(points, now = Date.now()) {
  const unique = new Map();
  for (const point of points) {
    const captured = Date.parse(point.capturedAt);
    if (!point.sampleId || !validPoint(point) || !Number.isFinite(captured)
      || captured < now - QUEUE_TTL || captured > now + 30_000
      || !Number.isFinite(point.accuracyMeters) || point.accuracyMeters < 0 || point.accuracyMeters > 100) continue;
    unique.set(point.sampleId, point);
  }
  return [...unique.values()].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt)).slice(-QUEUE_LIMIT);
}

export function acknowledge(points, receipt) {
  const acknowledged = new Set([...(receipt?.accepted || []), ...(receipt?.duplicates || []), ...(receipt?.dropped || [])]);
  return points.filter((point) => !acknowledged.has(point.sampleId));
}

export function mergeLocations(existing, incoming, limit = MAP_POINT_LIMIT) {
  const points = new Map();
  for (const point of [...existing, ...incoming]) {
    if (!validPoint(point)) continue;
    points.set(point.id || point.sampleId || `${locationTime(point)}:${point.latitude}:${point.longitude}`, point);
  }
  const ordered = [...points.values()].sort((a, b) => Date.parse(locationTime(a)) - Date.parse(locationTime(b)));
  if (ordered.length <= limit) return ordered;
  if (limit <= 1) return limit === 1 ? ordered.slice(-1) : [];
  return Array.from({ length: limit }, (_, index) => ordered[Math.round(index * (ordered.length - 1) / (limit - 1))]);
}

/**
 * One anchor pair and its geometry from a single snapshot (same rules as the web portal): pairs never
 * mix sources or route versions, an invalid tracking pair cannot hide the valid trip pair of the same
 * version, and the road geometry only belongs to the tracking pair it was computed from.
 */
export function selectRouteAnchors({ trip, tracking } = {}) {
  const tripVersion = Number(trip?.routeVersion ?? 0);
  const trackingVersion = tracking ? Number(tracking.routeVersion ?? 0) : null;
  const pair = (source, name) => {
    const pickup = validPoint(source?.pickupPoint) ? source.pickupPoint : null;
    const delivery = validPoint(source?.deliveryPoint) ? source.deliveryPoint : null;
    return { pickup, delivery, source: name, count: (pickup ? 1 : 0) + (delivery ? 1 : 0) };
  };
  const fromTrip = pair(trip, 'trip'), fromTracking = pair(tracking, 'tracking');
  let chosen = fromTrip, version = tripVersion;
  if (tracking && trackingVersion > tripVersion) { chosen = fromTracking; version = trackingVersion; }
  else if (tracking && trackingVersion === tripVersion && fromTracking.count >= fromTrip.count) chosen = fromTracking;
  const geometry = chosen.source === 'tracking' && chosen.count === 2 ? tracking?.routeGeometry || null : null;
  return {
    pickup: chosen.pickup, delivery: chosen.delivery, routeVersion: version, geometry,
    routingStatus: chosen.source === 'tracking' ? tracking?.routingStatus || null : null,
  };
}

export function mapPayload({ trip, tracking, points = [], milestones = [] }) {
  const anchors = selectRouteAnchors({ trip, tracking });
  const compact = (point, label) => validPoint(point) ? { latitude: Number(point.latitude), longitude: Number(point.longitude), label: String(label || point.label || '').slice(0, 200) } : null;
  // Warehouse pins carry the side ("A · Lấy hàng") and the address for the always-visible label.
  const anchor = (point, side, fallback) => point ? { ...compact(point, side), address: String(point.label || point.address || fallback || '').slice(0, 200) } : null;
  const gps = mergeLocations([], points).map((point) => ({ ...compact(point, point.label), capturedAt: locationTime(point), source: point.source || 'MANUAL', accuracyMeters: point.accuracyMeters }));
  const segments = [];
  let segment = [];
  for (const point of gps) {
    const capturedAt = Date.parse(point.capturedAt);
    const validGps = point.source === 'GPS' && Number.isFinite(capturedAt)
      && (point.accuracyMeters == null || (Number.isFinite(Number(point.accuracyMeters)) && Number(point.accuracyMeters) >= 0 && Number(point.accuracyMeters) <= 100));
    const previous = segment.at(-1), elapsed = previous ? capturedAt - Date.parse(previous.capturedAt) : null;
    if (!validGps || (previous && (elapsed <= 0 || elapsed > 5 * 60_000 || distanceMeters(previous, point) / (elapsed / 1000) > 200 / 3.6))) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (validGps) segment.push(point);
  }
  if (segment.length) segments.push(segment);
  return {
    pickup: anchor(anchors.pickup, 'A · Lấy hàng', trip?.pickupLocation),
    delivery: anchor(anchors.delivery, 'B · Giao hàng', trip?.deliveryLocation),
    anchorKey: `${trip?.id || ''}:${anchors.routeVersion}:${[anchors.pickup, anchors.delivery].map((p) => p ? `${Number(p.latitude)},${Number(p.longitude)}` : '-').join(';')}`,
    routingStatus: anchors.routingStatus,
    latest: compact(tracking ? tracking.latestLocation : gps.at(-1), 'Vị trí ghi nhận gần nhất'),
    milestones: milestones.map((milestone) => compact({ latitude: milestone.targetLat, longitude: milestone.targetLng }, milestone.milestoneName)).filter(Boolean).slice(0, 100),
    manual: gps.filter((point) => point.source !== 'GPS').slice(-100),
    segments,
    route: roadRoute(anchors.geometry),
  };
}

function distanceMeters(from, to) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(to.latitude - from.latitude), dLng = radians(to.longitude - from.longitude);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

// The server validates and simplifies the route (meters tolerance), so the client only rejects
// malformed geometry; it does not resample by index, which could cut across curves.
function roadRoute(geometry) {
  const coordinates = geometry?.type === 'LineString' && Array.isArray(geometry.coordinates) ? geometry.coordinates : null;
  if (!coordinates || coordinates.length < 2 || coordinates.length > 10000) return null;
  const valid = coordinates.every((p) => Array.isArray(p) && p.length >= 2 && validPoint({ latitude: p[1], longitude: p[0] }));
  return valid ? coordinates.map((p) => [Number(p[0]), Number(p[1])]) : null;
}

export function freshnessLabel(tracking) {
  return ({ NONE: 'Chưa chia sẻ vị trí', FRESH: 'Vị trí vừa cập nhật', STALE: 'Vị trí đã cũ', LOST: 'Chưa nhận vị trí mới', STOPPED: 'Đã dừng chia sẻ' })[tracking?.freshness] || 'Chưa có dữ liệu vị trí';
}
