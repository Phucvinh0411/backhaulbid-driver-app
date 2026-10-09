/** Presentation follows the recorded conclusion; it never infers failure from upload completion. */
export function nfcResultPresentation(report = {}) {
  if (report.status === 'REJECTED') return { title: 'Hồ sơ cần thực hiện lại', message: report.reviewReason || 'Xem lý do và thực hiện lại bước cần thiết.', tone: 'danger' };
  if (report.status === 'VERIFIED' && report.verificationMethod === 'MANUAL_DOCUMENT_REVIEW') return { title: 'Hồ sơ đã được duyệt', message: 'Phương thức: duyệt hồ sơ bởi quản trị viên.', tone: 'success' };
  if (report.status === 'VERIFIED' && report.verificationMethod === 'LOCAL_NFC_DEVELOPMENT') return { title: 'Đã hoàn tất kiểm tra NFC', message: 'Các kiểm tra đạt theo chính sách phát triển trên môi trường local. Mức kiểm chứng được ghi trong chi tiết.', tone: 'success' };
  if (report.status === 'VERIFIED') return { title: 'Danh tính đã được xác minh', message: 'Xem phương thức và kết quả từng bước trong hồ sơ.', tone: 'success' };
  switch (report.captureConclusion || report.conclusion) {
    case 'COMPLETED': return { title: 'Đã hoàn tất kiểm tra eKYC', message: 'Các bước kiểm tra trên thiết bị đều đạt. Bạn có thể xem lại hồ sơ và mức kiểm chứng từng bước.', tone: 'success' };
    case 'NEEDS_REVIEW': return { title: 'Kết quả cần đánh giá thêm', message: 'Đã thu thập đủ bằng chứng. Một số kiểm tra đang ở mức phát triển hoặc chưa đủ điều kiện kết luận đầy đủ.', tone: 'warning' };
    case 'INCOMPLETE': return { title: 'Chưa đủ dữ liệu để kết luận', message: 'Hoàn thành các bước còn thiếu để có kết quả.', tone: 'neutral' };
    case 'FAILED_STAGE': return { title: 'Một bước kiểm tra không đạt', message: 'Xem lý do và thực hiện lại bước được hướng dẫn.', tone: 'danger' };
    default: return { title: 'Đang xử lý kết quả', message: 'Kết quả sẽ cập nhật theo hồ sơ trên máy chủ.', tone: 'neutral' };
  }
}

export const NFC_CHECK_LABELS = Object.freeze({
  documentReadiness: 'Thông tin giấy tờ', nfcRead: 'Đọc chip NFC', documentComparison: 'Đối chiếu giấy tờ',
  activeLiveness: 'Thử thách khuôn mặt', passiveLiveness: 'Kiểm tra người thật', faceMatch: 'Đối chiếu khuôn mặt',
  chipIntegrity: 'Tính toàn vẹn dữ liệu chip', issuerTrust: 'Kiểm chứng nguồn cấp', faceComparison: 'Đối chiếu khuôn mặt khi duyệt', liveness: 'Kiểm tra người thật phía máy chủ',
});
export const NFC_CHECK_STATUS = Object.freeze({ PASS: 'Đạt', DEVELOPMENT_PASS: 'Đạt ở mức phát triển', FAIL: 'Không đạt',
  UNAVAILABLE: 'Chưa có nguồn kiểm chứng', NOT_EVALUATED: 'Chưa thực hiện', NOT_RUN: 'Chưa thực hiện',
  INCONCLUSIVE: 'Chưa đủ dữ liệu', ERROR: 'Lỗi kiểm tra', CANCELLED: 'Đã dừng' });

// Same rules as the web portal (src/services/nfcResultPresentation.js).
const MISSING = 'Chưa có thông tin';

/** Status line for the owner: one title, one short reason and the action that fits the state. */
export function ownerStatusPresentation(summary = {}) {
  switch (summary.status) {
    case 'VERIFIED': return { title: 'Đã xác thực danh tính', message: '', tone: 'success', action: null };
    case 'PENDING': return { title: 'Đang chờ duyệt', message: summary.statusReason || 'Hồ sơ đang chờ quản trị viên xem xét.', tone: 'warning', action: 'refresh' };
    case 'REJECTED': return { title: 'Hồ sơ chưa được chấp nhận', message: summary.statusReason || 'Hồ sơ chưa được chấp nhận.', tone: 'danger', action: 'retry' };
    default: return { title: 'Chưa có kết quả', message: summary.statusReason || '', tone: 'neutral', action: 'refresh' };
  }
}

/** dd/MM/yyyy from an ISO date; anything else is shown as missing rather than guessed. */
export function formatIdentityDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

/** The five rows the owner sees after eKYC. Missing sources show "Chưa có thông tin". */
export function ownerIdentityRows(summary = {}) {
  const field = (name) => summary[name] || {};
  const text = (name, format = (value) => value) => {
    const value = field(name);
    if (!value.available) return MISSING;
    if (value.masked) return name === 'dateOfBirth' ? '••/••/••••' : '••••••';
    return format(value.value) || MISSING;
  };
  return [
    ['Họ và tên', text('fullName')],
    ['Số CCCD', text('citizenId')],
    ['Ngày sinh', text('dateOfBirth', formatIdentityDate)],
    ['Giới tính', text('gender', (value) => ({ M: 'Nam', F: 'Nữ' })[value])],
    ['Nơi ở', text('residenceAddress')],
  ];
}

/** True when some field is hidden and the owner can ask to show it. */
export const ownerHasMaskedField = (summary = {}) => ['citizenId', 'dateOfBirth'].some((name) => summary[name]?.available && summary[name]?.masked);
