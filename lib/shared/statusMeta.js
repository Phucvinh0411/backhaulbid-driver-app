// Shared, backend-derived status vocabulary. Every label pairs with a tone and
// an icon key so status is never conveyed by colour alone.
// Tones: neutral | info | success | warning | danger | brand

/** Auction lifecycle (bidding-service AuctionStatus) combined with result fields. */
export function getAuctionPhase(auction = {}) {
  const status = auction.status;
  const sealed = auction.auctionType === "SEALED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "OPEN") return auction.roomOpen === false ? "CLOSING" : "OPEN";
  if (status === "PENDING") return auction.registrationOpen ? "REGISTRATION" : "WAITING_START";
  if (status === "COMPLETED") {
    if (auction.winningBidId) return "WINNER_DECIDED";
    return sealed ? "AWAITING_WINNER" : "ENDED_NO_WINNER";
  }
  return "UNKNOWN";
}

export const AUCTION_PHASE_META = Object.freeze({
  REGISTRATION: { label: "Đang nhận đăng ký", tone: "info", icon: "schedule" },
  WAITING_START: { label: "Chờ mở phiên", tone: "neutral", icon: "schedule" },
  OPEN: { label: "Đang đấu giá", tone: "success", icon: "live" },
  CLOSING: { label: "Đang chốt kết quả", tone: "warning", icon: "hourglass" },
  AWAITING_WINNER: { label: "Chờ chọn người thắng", tone: "warning", icon: "pending" },
  WINNER_DECIDED: { label: "Đã có người thắng", tone: "brand", icon: "done" },
  ENDED_NO_WINNER: { label: "Kết thúc, không có giá", tone: "neutral", icon: "close" },
  CANCELLED: { label: "Đã hủy", tone: "danger", icon: "cancel" },
  UNKNOWN: { label: "Chưa xác định", tone: "neutral", icon: "help" },
});

export const getAuctionPhaseMeta = (auction) => AUCTION_PHASE_META[getAuctionPhase(auction)];

export const AUCTION_TYPE_META = Object.freeze({
  PUBLIC: { label: "Công khai", description: "Giá thấp nhất hiện tại được công bố cho mọi nhà xe trong phòng.", icon: "public" },
  SEALED: { label: "Đấu giá kín", description: "Mỗi nhà xe chỉ thấy giá của mình. Chủ hàng chọn người thắng sau khi phiên kết thúc.", icon: "lock" },
});

/** Carrier access to an auction (auction-registration accessStatus). */
export const ACCESS_STATUS_META = Object.freeze({
  REGISTRATION_REQUIRED: { label: "Chưa đăng ký", tone: "info", icon: "how_to_reg" },
  REGISTRATION_CLOSED: { label: "Hết hạn đăng ký", tone: "neutral", icon: "close" },
  REPUTATION_TOO_LOW: { label: "Chưa đủ điểm uy tín", tone: "warning", icon: "error" },
  PAYMENT_INCOMPLETE: { label: "Thanh toán chưa hoàn tất", tone: "danger", icon: "error" },
  REGISTRATION_CANCELLED: { label: "Đã hủy đăng ký", tone: "neutral", icon: "cancel" },
  WAITING_FOR_START: { label: "Đã đăng ký, chờ mở phòng", tone: "success", icon: "schedule" },
  AUCTION_OPEN: { label: "Được vào phòng", tone: "success", icon: "live" },
  AUCTION_COMPLETED: { label: "Phiên đã kết thúc", tone: "neutral", icon: "done" },
  AUCTION_CANCELLED: { label: "Phiên đã hủy", tone: "danger", icon: "cancel" },
});

export const getAccessStatusMeta = (status) =>
  ACCESS_STATUS_META[status] || { label: status || "Chưa xác định", tone: "neutral", icon: "help" };

/**
 * The carrier's own outcome, derived only from data the carrier is allowed to see:
 * the auction's winningBidId and the carrier's own bid ids.
 */
export function getMyBidOutcome({ auction, myBidIds = [] }) {
  const phase = getAuctionPhase(auction);
  if (phase === "CANCELLED") return "CANCELLED";
  if (!myBidIds.length) return phase === "OPEN" ? "NO_BID_YET" : "NOT_PARTICIPATED";
  if (phase === "WINNER_DECIDED") return myBidIds.includes(auction.winningBidId) ? "WON" : "LOST";
  if (phase === "AWAITING_WINNER" || phase === "CLOSING") return "AWAITING_RESULT";
  if (phase === "ENDED_NO_WINNER") return "LOST";
  return "BID_PLACED";
}

export const MY_BID_OUTCOME_META = Object.freeze({
  NO_BID_YET: { label: "Chưa đặt giá", tone: "neutral", icon: "edit" },
  BID_PLACED: { label: "Đã đặt giá", tone: "info", icon: "gavel" },
  AWAITING_RESULT: { label: "Chờ kết quả", tone: "warning", icon: "pending" },
  WON: { label: "Bạn thắng phiên", tone: "success", icon: "emoji_events" },
  LOST: { label: "Không trúng", tone: "neutral", icon: "close" },
  NOT_PARTICIPATED: { label: "Không tham gia", tone: "neutral", icon: "remove" },
  CANCELLED: { label: "Phiên đã hủy", tone: "danger", icon: "cancel" },
});

/** Trip lifecycle (contract-service TripStatus). */
export const TRIP_STATUS_META = Object.freeze({
  WAITING_PICKUP: { label: "Chờ lấy hàng", tone: "warning", icon: "schedule", step: 0 },
  PICKED_UP: { label: "Đã lấy hàng", tone: "info", icon: "inventory", step: 1 },
  IN_TRANSIT: { label: "Đang vận chuyển", tone: "brand", icon: "local_shipping", step: 2 },
  DELIVERED: { label: "Đã giao, chờ xác nhận", tone: "info", icon: "assignment_turned_in", step: 3 },
  COMPLETED: { label: "Hoàn thành", tone: "success", icon: "done", step: 4 },
  CANCELLED: { label: "Đã hủy", tone: "danger", icon: "cancel", step: -1 },
});

export const TRIP_STEPS = ["WAITING_PICKUP", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED"];

export const getTripStatusMeta = (status) =>
  TRIP_STATUS_META[status] || { label: status || "Chưa xác định", tone: "neutral", icon: "help", step: -1 };

export const isTripClosed = (status) => status === "COMPLETED" || status === "CANCELLED";

export const JOURNEY_EVENT_LABELS = Object.freeze({
  DRIVER_ACCEPTED: "Tài xế nhận chuyến",
  ARRIVED_PICKUP: "Đến điểm lấy hàng",
  PICKUP_CONFIRMED: "Xác nhận đã lấy hàng",
  DEPARTED_PICKUP: "Rời điểm lấy hàng",
  ARRIVED_DELIVERY: "Đến điểm giao hàng",
  DELIVERY_PROOF_SUBMITTED: "Đã gửi bằng chứng giao hàng",
  DELIVERY_ACCEPTED: "Chủ hàng xác nhận nhận hàng",
  INCIDENT_REPORTED: "Báo cáo sự cố",
  ADMIN_OVERRIDE: "Điều chỉnh từ quản trị",
});

/**
 * Next journey steps an executor (carrier or driver) may record for a trip status.
 * Mirrors TripService#addJourneyEvent + isAllowedTransition; the backend stays the
 * authority and rejects anything invalid. Completion and cancellation are not
 * offered here: completion is the shipper's acceptance, cancellation is separate.
 */
export function getExecutorJourneySteps(status) {
  switch (status) {
    case "WAITING_PICKUP":
      return [
        { eventType: "ARRIVED_PICKUP", status: null, label: "Đã đến điểm lấy hàng" },
        { eventType: "PICKUP_CONFIRMED", status: "PICKED_UP", label: "Xác nhận đã lấy hàng", primary: true },
      ];
    case "PICKED_UP":
      return [{ eventType: "DEPARTED_PICKUP", status: "IN_TRANSIT", label: "Bắt đầu vận chuyển", primary: true }];
    case "IN_TRANSIT":
      return [
        { eventType: "ARRIVED_DELIVERY", status: null, label: "Đã đến điểm giao hàng" },
        { eventType: "DELIVERY_PROOF_SUBMITTED", status: "DELIVERED", label: "Gửi bằng chứng và báo đã giao", primary: true, requiresProof: true },
      ];
    default:
      return [];
  }
}

export const CONTRACT_STATUS_META = Object.freeze({
  PENDING_SIGNATURE: { label: "Chờ ký", tone: "warning", icon: "draw" },
  WAITING_SIGNATURE: { label: "Chờ bên còn lại ký", tone: "warning", icon: "draw" },
  SIGNED: { label: "Đã ký", tone: "success", icon: "done" },
  ACTIVE: { label: "Đang hiệu lực", tone: "success", icon: "done" },
  COMPLETED: { label: "Hoàn thành", tone: "brand", icon: "done" },
  CANCELLED: { label: "Đã hủy", tone: "danger", icon: "cancel" },
});

export const getContractStatusMeta = (status) =>
  CONTRACT_STATUS_META[status] || { label: status || "Chưa xác định", tone: "neutral", icon: "help" };

/**
 * Contract award after an auction ends (bidding-service auction.awardStatus).
 * The winner signs first, then the shipper; on expiry up to 3 backup carriers are invited in price order.
 */
export const AWARD_STATUS_META = Object.freeze({
  PENDING: { label: "Đang chuẩn bị hợp đồng", tone: "info", icon: "hourglass" },
  CREATING_CONTRACT: { label: "Đang tạo hợp đồng", tone: "info", icon: "hourglass" },
  CREATION_FAILED: { label: "Tạo hợp đồng lỗi, hệ thống đang thử lại", tone: "warning", icon: "error" },
  AWAITING_CARRIER_SIGNATURE: { label: "Chờ nhà xe ký hợp đồng", tone: "warning", icon: "draw" },
  AWAITING_SHIPPER_SIGNATURE: { label: "Đến lượt bạn ký hợp đồng", tone: "danger", icon: "draw" },
  SIGNED: { label: "Hợp đồng đã ký", tone: "success", icon: "done" },
  SHIPPER_SIGNATURE_EXPIRED: { label: "Đã quá hạn ký hợp đồng", tone: "danger", icon: "cancel" },
  NO_CARRIER_SIGNED: { label: "Không nhà xe nào ký", tone: "neutral", icon: "close" },
  NO_WINNER: { label: "Không có giá để trao thầu", tone: "neutral", icon: "close" },
});

export const getAwardStatusMeta = (status) => (status ? AWARD_STATUS_META[status] || { label: status, tone: "neutral", icon: "help" } : null);

/** What the shipper must do next for one of their auctions, or null. */
export function getShipperNextStep(auction = {}) {
  const phase = getAuctionPhase(auction);
  if (phase === "AWAITING_WINNER") return { label: "Chọn người thắng", tone: "danger" };
  if (auction.awardStatus === "AWAITING_SHIPPER_SIGNATURE") return { label: "Ký hợp đồng", tone: "danger" };
  return null;
}

/**
 * Facts for the "order finished" summary, read only from server data:
 * delivery time from the trip, completion time from the shipper's DELIVERY_ACCEPTED event.
 */
export function getTripCompletionSummary(trip, events = []) {
  if (!trip || trip.status !== "COMPLETED") return null;
  const accepted = events
    .filter((event) => event.eventType === "DELIVERY_ACCEPTED")
    .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];
  const lateMinutes = Number(trip.lateMinutes) || 0;
  return {
    deliveredAt: trip.deliveredAt || null,
    completedAt: accepted?.recordedAt || null,
    onTime: trip.expectedDeliveryAt ? lateMinutes === 0 : null,
    lateMinutes,
    depositReleased: Boolean(trip.depositReleasedAt),
    incidentCount: events.filter((event) => event.eventType === "INCIDENT_REPORTED").length,
  };
}

export const MILESTONE_STATUS_META = Object.freeze({
  PENDING: { label: "Chưa đến", tone: "neutral" },
  REACHED: { label: "Đã check-in", tone: "success" },
});
