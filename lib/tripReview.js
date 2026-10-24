// Rules for the shipper's review of a completed trip in the owner app. Pure: no imports, no network.
// The server enforces the same limits and the one-review-per-trip rule; this only keeps the form honest.

export const REVIEW_COMMENT_MAX = 1000;

const RATING_LABEL = ['', 'Rất tệ', 'Chưa tốt', 'Bình thường', 'Tốt', 'Rất tốt'];

export function ratingLabel(rating) {
  return RATING_LABEL[rating] ?? '';
}

/**
 * Returns { ok: true, payload } for POST /api/v1/trips/{id}/reviews, or { ok: false, error }.
 * The comment is optional; a blank comment is sent as null. Contact details are refused client-side too.
 */
export function buildReviewPayload({ rating, comment }) {
  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { ok: false, error: 'Chọn từ 1 đến 5 sao.' };
  }
  const text = String(comment ?? '').trim();
  if (text.length > REVIEW_COMMENT_MAX) {
    return { ok: false, error: `Nhận xét tối đa ${REVIEW_COMMENT_MAX} ký tự.` };
  }
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text) || /(\+?84|0)[\s.-]?\d{1,4}[\s.-]?\d{3}[\s.-]?\d{3,4}/.test(text)) {
    return { ok: false, error: 'Nhận xét không ghi email hoặc số điện thoại.' };
  }
  return { ok: true, payload: { rating: stars, comment: text || null } };
}

/**
 * Whether the shipper may review the trip now. Only a COMPLETED trip (delivery accepted by the shipper) can be
 * reviewed; a DELIVERED trip must first be accepted, and a review that already exists is shown read-only.
 */
export function reviewState(trip, existingReview) {
  if (existingReview) return { canReview: false, message: 'Bạn đã đánh giá chuyến này.' };
  if (trip?.status === 'COMPLETED') return { canReview: true, message: 'Chuyến đã hoàn tất. Đánh giá giúp chủ hàng khác biết chất lượng vận chuyển.' };
  if (trip?.status === 'DELIVERED') return { canReview: false, message: 'Xác nhận đã nhận hàng trước, sau đó mới đánh giá nhà xe.' };
  return { canReview: false, message: '' };
}
