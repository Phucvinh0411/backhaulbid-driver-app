export const COMPLAINT_STATUS_META = Object.freeze({
  PENDING: { label: "Chờ xử lý", tone: "warning", icon: "pending", color: "warning", closed: false },
  PROCESSING: { label: "Đang xử lý", tone: "info", icon: "hourglass", color: "info", closed: false },
  RESOLVED: { label: "Đã giải quyết", tone: "success", icon: "done", color: "success", closed: true },
  REJECTED: { label: "Đã từ chối", tone: "danger", icon: "cancel", color: "error", closed: true },
});

export const COMPLAINT_DECISION_LABELS = Object.freeze({
  SHIPPER_WIN: "Chủ hàng thắng khiếu nại",
  CARRIER_WIN: "Chủ xe thắng khiếu nại",
  BOTH: "Hai bên cùng chịu trách nhiệm",
});

export const COMPLAINT_ROLE_LABELS = Object.freeze({
  CARRIER: "Chủ xe",
  SHIPPER: "Chủ hàng",
  ADMIN: "Quản trị viên",
});

/**
 * Complaint taxonomy. Codes mirror contract-service ComplaintCategory exactly;
 * `roles` mirrors ComplaintCategory#reporterRoles (the server enforces it).
 */
export const COMPLAINT_CATEGORIES = Object.freeze([
  {
    code: "CARGO_DAMAGE_LOSS",
    label: "Hàng hư hỏng, thất lạc hoặc thiếu",
    description: "Hàng bị vỡ, ướt, móp hoặc thiếu kiện so với lúc giao cho nhà xe.",
    roles: ["SHIPPER"],
  },
  {
    code: "CARGO_INFO_MISMATCH",
    label: "Hàng thực tế khác thông tin đăng",
    description: "Khối lượng, loại hàng hoặc kích thước khác với thông tin trong phiên đấu giá.",
    roles: ["CARRIER"],
  },
  {
    code: "SCHEDULE_DELAY",
    label: "Trễ lịch lấy hoặc giao hàng",
    description: "Xe đến trễ, hoặc kho chậm bốc xếp, chậm nhận hàng so với lịch đã thống nhất.",
    roles: ["SHIPPER", "CARRIER"],
  },
  {
    code: "VEHICLE_DRIVER_ISSUE",
    label: "Phương tiện hoặc tài xế không đúng yêu cầu",
    description: "Sai loại xe, không đạt nhiệt độ yêu cầu, hoặc tài xế khác người được phân công.",
    roles: ["SHIPPER"],
  },
  {
    code: "DELIVERY_CONFIRMATION",
    label: "Tranh chấp xác nhận giao, nhận hàng",
    description: "Bằng chứng giao hàng không khớp thực tế, hoặc một bên không xác nhận giao nhận.",
    roles: ["SHIPPER", "CARRIER"],
  },
  {
    code: "PAYMENT_DEPOSIT",
    label: "Thanh toán, đặt cọc hoặc bồi thường",
    description: "Khấu trừ cọc, phí hoặc khoản bồi thường chưa đúng với thỏa thuận.",
    roles: ["SHIPPER", "CARRIER"],
  },
  {
    code: "CANCELLATION",
    label: "Hủy chuyến hoặc không thực hiện",
    description: "Bên còn lại hủy chuyến hoặc không thực hiện chuyến đã ký.",
    roles: ["SHIPPER", "CARRIER"],
  },
  {
    code: "CONDUCT",
    label: "Thái độ, ứng xử",
    description: "Ứng xử không phù hợp trong quá trình giao nhận hoặc trao đổi.",
    roles: ["SHIPPER", "CARRIER"],
  },
  {
    code: "OTHER",
    label: "Vấn đề khác",
    description: "Không thuộc các nhóm trên. Mô tả rõ để quản trị viên phân loại khi xử lý.",
    roles: ["SHIPPER", "CARRIER"],
  },
]);

/** Query value the API accepts for complaints created before categories existed. */
export const UNCATEGORIZED = "UNCATEGORIZED";

const UNCATEGORIZED_META = Object.freeze({ code: null, label: "Chưa phân loại", description: "Khiếu nại được tạo trước khi có phân loại.", roles: [] });

export function getComplaintCategoryMeta(code) {
  if (!code) return UNCATEGORIZED_META;
  return COMPLAINT_CATEGORIES.find((category) => category.code === code) || { code, label: code, description: "", roles: [] };
}

/** Categories a reporter role may choose (SHIPPER | CARRIER). */
export function getCategoriesForRole(role) {
  const normalized = String(role || "").toUpperCase();
  return COMPLAINT_CATEGORIES.filter((category) => category.roles.includes(normalized));
}

export function getComplaintStatusMeta(status) {
  return COMPLAINT_STATUS_META[status] || { label: status || "Chưa xác định", tone: "neutral", icon: "help", color: "default", closed: false };
}

export function isComplaintClosed(status) {
  return getComplaintStatusMeta(status).closed;
}

export function getComplaintDecisionLabel(decision) {
  return COMPLAINT_DECISION_LABELS[decision] || decision || "Chưa có kết luận";
}

export function formatComplaintTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function normalizeComplaintCollection(response) {
  if (Array.isArray(response)) return response;
  return Array.isArray(response?.data) ? response.data : [];
}

/** Client-side validation mirroring CreateComplaintRequest; returns field -> message. */
export function validateComplaintDraft(draft, role) {
  const errors = {};
  if (!draft.tripId) errors.tripId = "Chọn chuyến vận chuyển liên quan.";
  if (!draft.category) errors.category = "Chọn loại vấn đề.";
  else if (!getCategoriesForRole(role).some((category) => category.code === draft.category)) {
    errors.category = "Loại vấn đề này không áp dụng cho vai trò của bạn.";
  }
  const title = String(draft.title || "").trim();
  if (!title) errors.title = "Nhập tiêu đề ngắn gọn.";
  else if (title.length > 200) errors.title = "Tiêu đề tối đa 200 ký tự.";
  const description = String(draft.description || "").trim();
  if (!description) errors.description = "Mô tả điều đã xảy ra.";
  else if (description.length > 5000) errors.description = "Nội dung tối đa 5000 ký tự.";
  return errors;
}

export const REALTIME_STATUS_LABELS = Object.freeze({
  connected: "Đang cập nhật trực tiếp",
  connecting: "Đang kết nối cập nhật trực tiếp",
  reconnecting: "Mất kết nối trực tiếp, đang thử lại",
});
