// Order tracking for shipper and carrier accounts. Mirrors contract-service TripService rules;
// the server remains the authority and rejects anything outside these steps.

// S3 objects are private; media-service streams operational images to signed-in users.
const S3_OBJECT = /^https:\/\/[^/]+\.s3\.[^/]+\.amazonaws\.com\/([a-z-]+)\/([^/?#]+)$/i;
const READABLE_FOLDERS = new Set(['delivery-proofs', 'auction-goods', 'complaints']);

/**
 * Gateway URL for a stored image (load it with the bearer header); other URLs pass through.
 * A path under the API (a handover photo of this trip, checked by the server) is joined to the gateway base.
 */
export function mediaViewUrl(url, baseUrl) {
  if (!url || typeof url !== 'string') return null;
  if (url.trim().startsWith('/api/v1/')) return `${String(baseUrl || '').replace(/\/+$/, '')}${url.trim()}`;
  const match = url.trim().match(S3_OBJECT);
  if (!match) return /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
  if (!READABLE_FOLDERS.has(match[1])) return null;
  return `${String(baseUrl || '').replace(/\/+$/, '')}/api/v1/media/files/${match[1]}/${match[2]}`;
}

/** Journey steps a carrier may record for its own trip; never completion or cancellation. */
export function getCarrierSteps(status) {
  switch (status) {
    case 'WAITING_PICKUP':
      return [
        { eventType: 'ARRIVED_PICKUP', status: null, label: 'Đã đến điểm lấy hàng' },
        { eventType: 'PICKUP_CONFIRMED', status: 'PICKED_UP', label: 'Xác nhận đã lấy hàng', primary: true },
      ];
    case 'PICKED_UP':
      return [{ eventType: 'DEPARTED_PICKUP', status: 'IN_TRANSIT', label: 'Bắt đầu vận chuyển', primary: true }];
    case 'IN_TRANSIT':
      return [
        { eventType: 'ARRIVED_DELIVERY', status: null, label: 'Đã đến điểm giao hàng' },
        { proof: true, label: 'Gửi bằng chứng và báo đã giao', primary: true },
      ];
    default:
      return [];
  }
}

/** What the owner should look at or do next, in plain words. */
export function getOwnerNextStep(trip, role) {
  if (!trip) return '';
  // driverConnected: the assigned driver signed in with the code (or a legacy driver account).
  const driverPending = !trip.driverConnected && !trip.driverAccountId;
  switch (trip.status) {
    case 'WAITING_PICKUP':
      if (role === 'CARRIER') {
        if (!trip.driverId) return 'Phân công tài xế để nhận chuyến.';
        if (driverPending) return 'Chờ tài xế nhập mã nhận chuyến. Nếu mã hết hạn hoặc thất lạc, cấp lại mã.';
        return 'Tài xế đã nhận chuyến, đang đến kho lấy hàng.';
      }
      return driverPending ? 'Nhà xe đang sắp xếp tài xế.' : 'Tài xế đang đến kho lấy hàng.';
    case 'PICKED_UP':
      return 'Hàng đã lên xe, chuẩn bị xuất phát.';
    case 'IN_TRANSIT':
      return trip.lateMinutes > 0 ? `Đang vận chuyển, trễ ${trip.lateMinutes} phút so với hạn giao.` : 'Đang vận chuyển đến điểm giao.';
    case 'DELIVERED':
      return role === 'SHIPPER' ? 'Kiểm tra bằng chứng và xác nhận đã nhận hàng.' : 'Đã giao, chờ chủ hàng xác nhận.';
    case 'COMPLETED':
      return 'Đơn hàng đã hoàn tất.';
    case 'CANCELLED':
      return trip.cancellationReason ? `Đã hủy: ${trip.cancellationReason}` : 'Chuyến đã hủy.';
    default:
      return '';
  }
}

/** Summary for a completed order, read only from server data. */
export function getCompletionSummary(trip, events = []) {
  if (!trip || trip.status !== 'COMPLETED') return null;
  const accepted = events
    .filter((event) => event.eventType === 'DELIVERY_ACCEPTED')
    .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];
  const lateMinutes = Number(trip.lateMinutes) || 0;
  return {
    deliveredAt: trip.deliveredAt || null,
    completedAt: accepted?.recordedAt || null,
    onTime: trip.expectedDeliveryAt ? lateMinutes === 0 : null,
    lateMinutes,
    depositReleased: Boolean(trip.depositReleasedAt),
    incidentCount: events.filter((event) => event.eventType === 'INCIDENT_REPORTED').length,
  };
}

export function validateMilestone({ name, lat, lng }) {
  const errors = {};
  const latitude = Number(String(lat).replace(',', '.'));
  const longitude = Number(String(lng).replace(',', '.'));
  if (!String(name || '').trim()) errors.name = 'Nhập tên cột mốc.';
  if (String(lat).trim() === '' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.lat = 'Vĩ độ từ -90 đến 90.';
  if (String(lng).trim() === '' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.lng = 'Kinh độ từ -180 đến 180.';
  return { valid: Object.keys(errors).length === 0, errors, value: { milestoneName: String(name || '').trim(), targetLat: latitude, targetLng: longitude } };
}

export const OWNER_GROUPS = [
  { key: 'action', label: 'Cần xử lý' },
  { key: 'active', label: 'Đang chạy' },
  { key: 'done', label: 'Đã kết thúc' },
];

/** Splits owner trips into the three list tabs. */
export function groupOwnerTrips(trips, role) {
  const groups = { action: [], active: [], done: [] };
  for (const trip of trips) {
    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') groups.done.push(trip);
    else if ((role === 'SHIPPER' && (trip.status === 'DELIVERED' || trip.canCancelForLateDelivery))
      || (role === 'CARRIER' && trip.status === 'WAITING_PICKUP' && !trip.driverId)) groups.action.push(trip);
    else groups.active.push(trip);
  }
  return groups;
}
