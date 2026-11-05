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
    routeMeta: chosen.source === 'tracking' ? tracking?.routeMeta || null : null,
  };
}

export function distanceMeters(from, to) {
  if (!validPoint(from) || !validPoint(to)) return 0;
  const radians = (value) => value * Math.PI / 180;
  const lat1 = Number(from.latitude), lng1 = Number(from.longitude);
  const lat2 = Number(to.latitude), lng2 = Number(to.longitude);
  const dLat = radians(lat2 - lat1), dLng = radians(lng2 - lng1);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function computeHeading(points = [], latest = null) {
  if (latest?.heading != null && Number.isFinite(Number(latest.heading))) return Number(latest.heading);
  const valid = points.filter(validPoint);
  const target = validPoint(latest) ? latest : valid.at(-1);
  if (!target || valid.length < 1) return null;
  for (let i = valid.length - 1; i >= 0; i--) {
    const prev = valid[i];
    const dist = distanceMeters(prev, target);
    if (dist >= 3) {
      const phi1 = (Number(prev.latitude) * Math.PI) / 180;
      const phi2 = (Number(target.latitude) * Math.PI) / 180;
      const dLambda = ((Number(target.longitude) - Number(prev.longitude)) * Math.PI) / 180;
      const y = Math.sin(dLambda) * Math.cos(phi2);
      const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
      return Math.round((((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360);
    }
  }
  return null;
}

export function computeSpeedKmh(points = [], latest = null) {
  if (latest?.speedKmh != null && Number.isFinite(Number(latest.speedKmh))) return Number(latest.speedKmh);
  const valid = points.filter((p) => validPoint(p) && p.source === 'GPS');
  if (valid.length < 2) return null;
  const last = valid.at(-1), prev = valid.at(-2);
  const t1 = Date.parse(locationTime(prev)), t2 = Date.parse(locationTime(last));
  if (!Number.isFinite(t1) || !Number.isFinite(t2) || t2 <= t1) return null;
  const elapsedSec = (t2 - t1) / 1000;
  if (elapsedSec < 0.5 || elapsedSec > 300) return null;
  const speed = (distanceMeters(prev, last) / elapsedSec) * 3.6;
  return speed <= 160 ? Math.round(speed * 10) / 10 : null;
}

/**
 * Projects the current vehicle coordinate onto the planned road route (`[[lng, lat], ...]`),
 * splits the route into passed/remaining portions, and computes traveled/remaining distance & ETA.
 */
export function routeProgress(routeCoords, current, gpsSegments = [], routeMeta = null) {
  let gpsTraveled = 0;
  for (const seg of gpsSegments) {
    for (let i = 1; i < seg.length; i++) {
      gpsTraveled += distanceMeters(seg[i - 1], seg[i]);
    }
  }

  if (!Array.isArray(routeCoords) || routeCoords.length < 2) {
    return {
      routePassed: [],
      routeRemaining: [],
      traveledMeters: Math.round(gpsTraveled),
      remainingMeters: null,
      totalMeters: null,
      progressRatio: null,
      etaSeconds: null,
    };
  }

  const pts = routeCoords.map(([lng, lat]) => ({ latitude: Number(lat), longitude: Number(lng) }));
  const cumDist = [0];
  for (let i = 1; i < pts.length; i++) {
    cumDist.push(cumDist[i - 1] + distanceMeters(pts[i - 1], pts[i]));
  }
  const totalRouteMeters = cumDist.at(-1) || 0;

  if (!validPoint(current)) {
    return {
      routePassed: [],
      routeRemaining: routeCoords,
      traveledMeters: Math.round(gpsTraveled),
      remainingMeters: Math.round(totalRouteMeters),
      totalMeters: Math.round(totalRouteMeters),
      progressRatio: 0,
      etaSeconds: totalRouteMeters > 0
        ? Math.round(Number(routeMeta?.durationSeconds) > 0 ? Number(routeMeta.durationSeconds) : totalRouteMeters / 11.11)
        : 0,
    };
  }

  const cur = { latitude: Number(current.latitude), longitude: Number(current.longitude) };
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = distanceMeters(pts[i], cur);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  const passedAlongRoute = cumDist[bestIdx];
  const remainingMeters = Math.max(0, totalRouteMeters - passedAlongRoute);
  const traveledMeters = gpsTraveled > 0 ? gpsTraveled : passedAlongRoute;
  const totalMeters = Math.max(totalRouteMeters, traveledMeters + remainingMeters);
  const progressRatio = totalMeters > 0 ? Math.min(1, Math.max(0, 1 - remainingMeters / totalMeters)) : 0;

  const baseDuration = Number(routeMeta?.durationSeconds);
  const etaSeconds = remainingMeters <= 50
    ? 0
    : baseDuration > 0 && totalRouteMeters > 0
      ? Math.round(baseDuration * (remainingMeters / totalRouteMeters))
      : Math.round(remainingMeters / 11.11); // ~40 km/h fallback

  const splitCoord = [cur.longitude, cur.latitude];
  const routePassed = bestIdx > 0 ? [...routeCoords.slice(0, bestIdx + 1), splitCoord] : [];
  const routeRemaining = [splitCoord, ...routeCoords.slice(bestIdx)];

  return {
    routePassed,
    routeRemaining: routeRemaining.length >= 2 ? routeRemaining : routeCoords.slice(bestIdx),
    traveledMeters: Math.round(traveledMeters),
    remainingMeters: Math.round(remainingMeters),
    totalMeters: Math.round(totalMeters),
    progressRatio,
    etaSeconds,
  };
}

export function mapPayload({ trip, tracking, points = [] }) {
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

  const rawLatest = tracking && Object.hasOwn(tracking, 'latestLocation') ? tracking.latestLocation : gps.at(-1);
  const latestCoord = compact(rawLatest, 'Vị trí xe trực tiếp');
  const heading = computeHeading(gps, rawLatest);
  const speedKmh = computeSpeedKmh(gps, rawLatest);
  const route = roadRoute(anchors.geometry);
  const progress = routeProgress(route, latestCoord, segments, anchors.routeMeta);

  return {
    pickup: anchor(anchors.pickup, 'A · Lấy hàng', trip?.pickupLocation),
    delivery: anchor(anchors.delivery, 'B · Giao hàng', trip?.deliveryLocation),
    anchorKey: `${trip?.id || ''}:${anchors.routeVersion}:${[anchors.pickup, anchors.delivery].map((p) => p ? `${Number(p.latitude)},${Number(p.longitude)}` : '-').join(';')}`,
    routingStatus: anchors.routingStatus,
    latest: latestCoord ? { ...latestCoord, heading, speedKmh } : null,
    manual: gps.filter((point) => point.source !== 'GPS').slice(-100),
    segments,
    route,
    routePassed: progress.routePassed,
    routeRemaining: progress.routeRemaining,
    progress,
  };
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
  return ({ NONE: 'Chưa có vị trí xe', FRESH: 'Đang phát vị trí trực tiếp', STALE: 'Vị trí cập nhật cách đây ít phút', LOST: 'Gián đoạn tín hiệu GPS', STOPPED: 'Đã dừng chia sẻ vị trí' })[tracking?.freshness] || 'Chưa có dữ liệu vị trí';
}
