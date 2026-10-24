// Client-side hints that mirror bidding-service BidService#place. The server stays
// the authority: these only explain the limit before the carrier submits.
import { formatMoney } from "./format.js";

/**
 * Highest amount the carrier may offer right now.
 * PUBLIC: below the current lowest bid by at least the price step (or ≤ max price when no bids).
 * SEALED: anything up to the max price; competitors' bids are never visible.
 */
export function getBidCeiling({ auctionType, maxPrice, priceStep, lowestBid }) {
  const max = Number(maxPrice) || 0;
  if (auctionType === "SEALED" || lowestBid === null || lowestBid === undefined) {
    return { ceiling: max, inclusive: true, basis: "maxPrice" };
  }
  const lowest = Number(lowestBid);
  const step = Number(priceStep) || 0;
  if (step > 0) return { ceiling: Math.min(max, lowest - step), inclusive: true, basis: "step" };
  return { ceiling: Math.min(max, lowest), inclusive: lowest > max, basis: "lowest" };
}

/** Returns a Vietnamese message when the amount would be rejected, otherwise null. */
export function validateBidAmount(amount, context) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "Nhập số tiền lớn hơn 0.";
  if (!Number.isInteger(value)) return "Nhập số tiền theo đồng, không có phần lẻ.";
  if (context.remainingBids !== null && context.remainingBids !== undefined && context.remainingBids <= 0) {
    return "Bạn đã dùng hết số lượt đặt giá.";
  }
  const maxPrice = Number(context.maxPrice) || 0;
  if (value > maxPrice) return `Giá không được vượt giá trần ${formatMoney(maxPrice)}.`;
  const { ceiling, inclusive, basis } = getBidCeiling(context);
  const tooHigh = inclusive ? value > ceiling : value >= ceiling;
  if (tooHigh) {
    if (basis === "step") return `Giá phải từ ${formatMoney(ceiling)} trở xuống (thấp hơn giá hiện tại ít nhất một bước giá).`;
    if (basis === "lowest") return `Giá phải thấp hơn giá thấp nhất hiện tại ${formatMoney(context.lowestBid)}.`;
  }
  if (ceiling <= 0) return "Giá hiện tại đã thấp tới mức không thể giảm thêm một bước giá.";
  return null;
}

/** Suggested quick amounts: one, two and five price steps under the ceiling (PUBLIC only). */
export function getQuickBidAmounts(context) {
  if (context.auctionType === "SEALED") return [];
  const { ceiling } = getBidCeiling(context);
  const step = Number(context.priceStep) || 0;
  if (!step || ceiling <= 0) return ceiling > 0 ? [Math.floor(ceiling)] : [];
  return [0, 1, 4].map((multiplier) => Math.floor(ceiling - step * multiplier)).filter((value) => value > 0);
}
