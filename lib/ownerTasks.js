// "What needs me now" for shipper/carrier home screens, built only from live server data.
// Same rules as web-portal components/dashboard/ActionInbox.jsx, with app routes.
import { getShipperNextStep } from './shared/statusMeta.js';
import { formatDateTime, shortId } from './shared/format.js';

const signedBy = (contract, role) => (contract.signatures || []).some((item) => item.role === role && item.signedAt);
const route = (from, to) => `${from || '?'} → ${to || '?'}`;
const ORDER = { danger: 0, warning: 1, success: 2, info: 3, neutral: 4 };
const enc = encodeURIComponent;

export function shipperTasks({ auctions = [], contracts = [], trips = [] }) {
  const tasks = [];
  auctions.forEach((auction) => {
    const next = getShipperNextStep(auction);
    if (!next) return;
    tasks.push({
      key: `auction-${auction.id}`, tone: 'danger', label: next.label,
      title: route(auction.pickupLocation?.province || auction.origin, auction.deliveryLocation?.province || auction.destination),
      detail: `${auction.title || 'Phiên'} · #${shortId(auction.id)}`,
      href: next.label === 'Ký hợp đồng' ? '/contracts' : `/auctions/${enc(auction.id)}`,
    });
  });
  contracts
    .filter((contract) => ['DRAFT', 'WAITING_SIGNATURE'].includes(contract.status) && signedBy(contract, 'CARRIER') && !signedBy(contract, 'SHIPPER'))
    .forEach((contract) => tasks.push({
      key: `contract-${contract.id}`, tone: 'danger', label: 'Ký hợp đồng',
      title: route(contract.trip?.pickupLocation, contract.trip?.deliveryLocation),
      detail: `Hợp đồng ${contract.contractCode || shortId(contract.id)}${contract.signingDeadlineAt ? ` · hạn ${formatDateTime(contract.signingDeadlineAt)}` : ''}`,
      href: `/contracts/${enc(contract.id)}`,
    }));
  trips.forEach((trip) => {
    if (trip.status !== 'DELIVERED' && !trip.canCancelForLateDelivery) return;
    tasks.push({
      key: `trip-${trip.id}`, tone: trip.status === 'DELIVERED' ? 'danger' : 'warning',
      label: trip.status === 'DELIVERED' ? 'Xác nhận nhận hàng' : `Xe trễ ${trip.lateMinutes} phút`,
      title: route(trip.pickupLocation, trip.deliveryLocation), detail: `Chuyến #${shortId(trip.id)}`,
      href: `/business/trips/${enc(trip.id)}`,
    });
  });
  return tasks.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}

export function carrierTasks({ registrations = [], contracts = [], trips = [] }) {
  const tasks = [];
  registrations.forEach(({ auction, access }) => {
    const status = access?.accessStatus;
    if (!auction || (status !== 'AUCTION_OPEN' && status !== 'PAYMENT_INCOMPLETE')) return;
    tasks.push({
      key: `auction-${auction.id}`, tone: status === 'AUCTION_OPEN' ? 'success' : 'danger',
      label: status === 'AUCTION_OPEN' ? 'Phòng đang mở' : 'Thanh toán lại',
      title: route(auction.pickupLocation?.province || auction.origin, auction.deliveryLocation?.province || auction.destination),
      detail: status === 'AUCTION_OPEN' ? `Kết thúc ${formatDateTime(auction.endTime)}` : `Mở phiên ${formatDateTime(auction.startTime)}`,
      href: `/auctions/${enc(auction.id)}`,
    });
  });
  contracts
    .filter((contract) => ['DRAFT', 'WAITING_SIGNATURE'].includes(contract.status) && !signedBy(contract, 'CARRIER'))
    .forEach((contract) => tasks.push({
      key: `contract-${contract.id}`, tone: 'danger', label: 'Ký hợp đồng',
      title: route(contract.trip?.pickupLocation, contract.trip?.deliveryLocation),
      detail: `Hợp đồng ${contract.contractCode || shortId(contract.id)}${contract.signingDeadlineAt ? ` · hạn ${formatDateTime(contract.signingDeadlineAt)}` : ''}`,
      href: `/contracts/${enc(contract.id)}`,
    }));
  trips.forEach((trip) => {
    const noDriver = trip.status === 'WAITING_PICKUP' && !trip.driverId;
    if (!noDriver && trip.status !== 'IN_TRANSIT' && trip.status !== 'PICKED_UP') return;
    tasks.push({
      key: `trip-${trip.id}`, tone: noDriver ? 'danger' : 'info',
      label: noDriver ? 'Phân công tài xế' : trip.status === 'IN_TRANSIT' ? 'Đang chạy' : 'Đã lấy hàng',
      title: route(trip.pickupLocation, trip.deliveryLocation),
      detail: `Chuyến #${shortId(trip.id)}${trip.lateMinutes > 0 ? ` · trễ ${trip.lateMinutes} phút` : ''}`,
      href: `/business/trips/${enc(trip.id)}`,
    });
  });
  return tasks.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}
