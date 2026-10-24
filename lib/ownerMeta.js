// Presentation maps for owner screens (status -> label + tone). Labels follow the web portal.

export const CONTRACT_VIEW_STATUS = {
  PENDING_SIGNATURE: { label: 'Chờ ký', tone: 'warning' },
  ACTIVE: { label: 'Đang hoạt động', tone: 'info' },
  COMPLETED: { label: 'Đã hoàn thành', tone: 'success' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
  EXPIRED: { label: 'Hết hạn ký', tone: 'neutral' },
};

export const FLEET_STATUS = {
  VERIFIED: { label: 'Đã duyệt', tone: 'success' },
  PENDING: { label: 'Chờ duyệt', tone: 'warning' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
  DRAFT: { label: 'Nháp', tone: 'neutral' },
  INACTIVE: { label: 'Ngừng hoạt động', tone: 'neutral' },
  EXPIRED: { label: 'Hết hạn', tone: 'danger' },
};

export const TRANSACTION_STATUS = {
  SUCCESS: { label: 'Thành công', tone: 'success' },
  PENDING: { label: 'Đang xử lý', tone: 'warning' },
  FAILED: { label: 'Thất bại', tone: 'danger' },
};

// Same wording and sign convention as web-portal components/wallet/WalletScreen.jsx.
export const TRANSACTION_TYPE = {
  DEPOSIT: 'Nạp tiền vào ví',
  WITHDRAW: 'Yêu cầu rút tiền',
  FREEZE: 'Tạm giữ tiền đặt cọc',
  UNFREEZE: 'Hoàn trả tiền đặt cọc',
  AUCTION_FEE: 'Phí tham gia phiên đấu giá',
  REFUND: 'Hoàn tiền',
  TRANSFER: 'Điều chuyển số dư',
  PENALTY: 'Khấu trừ tiền phạt',
};
export const OUTFLOW_TYPES = new Set(['WITHDRAW', 'FREEZE', 'AUCTION_FEE', 'PENALTY']);
export const signedAmount = (transaction) => {
  const amount = Math.abs(Number(transaction?.amount || 0));
  return OUTFLOW_TYPES.has(String(transaction?.type || '').toUpperCase()) ? -amount : amount;
};

export const TOPUP_STATUS = {
  CREATED: { label: 'Chờ thanh toán', tone: 'warning' },
  PENDING: { label: 'Chờ thanh toán', tone: 'warning' },
  PAID: { label: 'Đã thanh toán', tone: 'success' },
  EXPIRED: { label: 'Hết hạn', tone: 'neutral' },
  FAILED: { label: 'Thất bại', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

export const WITHDRAWAL_STATUS = {
  PENDING: { label: 'Chờ quản trị viên duyệt', tone: 'warning' },
  APPROVED: { label: 'Đã duyệt', tone: 'success' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
};

export const metaOf = (map, status) => map[status] || { label: status || 'Chưa xác định', tone: 'neutral' };
