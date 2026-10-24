// Maps a stored notification (type + referenceId) to the app screen that resolves it.
// Same rules as web-portal src/lib/notificationRouting.js; unknown types return null so the
// message is shown without a fake link.
//   bidding-service: NEW_AUCTION, AUCTION_* (referenceId = auctionId)
//   contract-service: LATE_DELIVERY (referenceId = tripId)

const CARRIER_CONTRACT_TYPES = new Set(['AUCTION_AWARD_INVITATION', 'AUCTION_CONTRACT_SIGNED']);
const CARRIER_AUCTION_RESULT_TYPES = new Set(['AUCTION_AWARD_EXPIRED', 'AUCTION_AWARD_CLOSED']);
const SHIPPER_CONTRACT_TYPES = new Set(['AUCTION_SHIPPER_SIGNATURE_REQUIRED', 'AUCTION_CONTRACT_SIGNED']);

export function getNotificationDestination(notification, role) {
  const type = notification?.type;
  const ref = notification?.referenceId ? encodeURIComponent(notification.referenceId) : null;
  if (!type) return null;
  if (role === 'CARRIER') {
    if (type === 'NEW_AUCTION' && ref) return { href: `/auctions/${ref}`, label: 'Mở phiên đấu giá' };
    if (CARRIER_CONTRACT_TYPES.has(type)) return { href: '/contracts', label: 'Mở hợp đồng' };
    if (CARRIER_AUCTION_RESULT_TYPES.has(type)) return { href: '/registrations', label: 'Xem phiên của tôi' };
    if (type === 'LATE_DELIVERY' && ref) return { href: `/business/trips/${ref}`, label: 'Mở chuyến' };
    return null;
  }
  if (role === 'SHIPPER') {
    if (SHIPPER_CONTRACT_TYPES.has(type)) return { href: '/contracts', label: 'Mở hợp đồng' };
    if (type.startsWith('AUCTION_') && ref) return { href: `/auctions/${ref}`, label: 'Mở phiên đấu giá' };
    if (type === 'LATE_DELIVERY' && ref) return { href: `/business/trips/${ref}`, label: 'Mở chuyến' };
    return null;
  }
  if (role === 'DRIVER' && type === 'LATE_DELIVERY' && ref) return { href: `/trips/${ref}`, label: 'Mở chuyến' };
  return null;
}
