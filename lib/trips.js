// Trip vocabulary and the driver's allowed steps. Mirrors contract-service TripService:
// a DRIVER may record journey events and delivery proofs but may not complete or cancel a trip.

export const TRIP_STATUS = {
  WAITING_PICKUP: { label: 'Chờ lấy hàng', tone: 'warning', step: 0 },
  PICKED_UP: { label: 'Đã lấy hàng', tone: 'info', step: 1 },
  IN_TRANSIT: { label: 'Đang vận chuyển', tone: 'brand', step: 2 },
  DELIVERED: { label: 'Đã giao, chờ chủ hàng xác nhận', tone: 'info', step: 3 },
  COMPLETED: { label: 'Hoàn thành', tone: 'success', step: 4 },
  CANCELLED: { label: 'Đã hủy', tone: 'danger', step: -1 },
};

export const STEP_ORDER = ['WAITING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];
export const STEP_SHORT = { WAITING_PICKUP: 'Chờ lấy', PICKED_UP: 'Đã lấy', IN_TRANSIT: 'Đang chạy', DELIVERED: 'Đã giao', COMPLETED: 'Xong' };

export const statusOf = (status) => TRIP_STATUS[status] || { label: status || 'Chưa xác định', tone: 'neutral', step: -1 };
export const isClosed = (status) => status === 'COMPLETED' || status === 'CANCELLED';

export const EVENT_LABELS = {
  DRIVER_ACCEPTED: 'Tài xế nhận chuyến',
  ARRIVED_PICKUP: 'Đến điểm lấy hàng',
  PICKUP_CONFIRMED: 'Xác nhận đã lấy hàng',
  DEPARTED_PICKUP: 'Rời điểm lấy hàng',
  ARRIVED_DELIVERY: 'Đến điểm giao hàng',
  DELIVERY_PROOF_SUBMITTED: 'Đã gửi bằng chứng giao hàng',
  DELIVERY_ACCEPTED: 'Chủ hàng xác nhận nhận hàng',
  INCIDENT_REPORTED: 'Báo cáo sự cố',
  ADMIN_OVERRIDE: 'Điều chỉnh từ quản trị',
};

/**
 * The single next step the driver should take, plus an optional secondary step.
 * `accepted` is true once the driver has recorded DRIVER_ACCEPTED for this trip.
 */
export function getDriverSteps(status, { accepted = false, arrivedPickup = false, arrivedDelivery = false } = {}) {
  switch (status) {
    case 'WAITING_PICKUP':
      if (!accepted) return { primary: { eventType: 'DRIVER_ACCEPTED', status: null, label: 'Nhận chuyến', hint: 'Xác nhận bạn sẽ thực hiện chuyến này.' } };
      if (!arrivedPickup) {
        return {
          primary: { eventType: 'ARRIVED_PICKUP', status: null, label: 'Đã đến điểm lấy hàng', hint: 'Bấm khi xe đã ở kho lấy hàng.' },
          secondary: { eventType: 'PICKUP_CONFIRMED', status: 'PICKED_UP', label: 'Đã lấy hàng xong' },
        };
      }
      return { primary: { eventType: 'PICKUP_CONFIRMED', status: 'PICKED_UP', label: 'Đã lấy hàng xong', hint: 'Bấm khi hàng đã lên xe đầy đủ.' } };
    case 'PICKED_UP':
      return { primary: { eventType: 'DEPARTED_PICKUP', status: 'IN_TRANSIT', label: 'Bắt đầu chạy', hint: 'Bấm khi xe rời kho lấy hàng.' } };
    case 'IN_TRANSIT':
      if (!arrivedDelivery) {
        return {
          primary: { eventType: 'ARRIVED_DELIVERY', status: null, label: 'Đã đến điểm giao', hint: 'Bấm khi xe đến nơi giao hàng.' },
          secondary: { proof: true, label: 'Gửi bằng chứng giao hàng' },
        };
      }
      return { primary: { proof: true, label: 'Gửi bằng chứng giao hàng', hint: 'Chụp biên bản hoặc hàng tại điểm giao để báo đã giao.' } };
    default:
      return {};
  }
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hour12: false });

export function formatDateTime(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : dateFormatter.format(date);
}

export const shortId = (value) => (value ? String(value).slice(0, 8).toUpperCase() : '—');

/** Active trips first (most advanced first), then newest. */
export function sortTrips(trips) {
  return [...trips].sort((a, b) => {
    const ca = isClosed(a.status) ? 1 : 0;
    const cb = isClosed(b.status) ? 1 : 0;
    if (ca !== cb) return ca - cb;
    if (!ca) return statusOf(b.status).step - statusOf(a.status).step;
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });
}
