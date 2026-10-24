// Maps backend messages (contract, bidding, wallet, fleet, identity, media) to Vietnamese guidance.
// Bid/contract/wallet wording follows web-portal src/services/errorMessage.js.
const RULES = [
  [/invalid assignment PIN/i, 'PIN không đúng. Kiểm tra lại mã do chủ xe gửi; sau 5 lần sai phải cấp lại PIN.'],
  [/PIN must contain exactly six digits/i, 'PIN phải có đúng 6 chữ số.'],
  [/assignment PIN expired/i, 'PIN đã hết hạn. Nhờ chủ xe phân công lại để lấy mã mới.'],
  [/assignment PIN locked/i, 'PIN bị khóa do nhập sai 5 lần. Nhờ chủ xe cấp lại mã.'],
  [/trip has already been claimed/i, 'Chuyến đã được tài khoản tài xế khác nhận. Liên hệ chủ xe để kiểm tra.'],
  [/trip is not awaiting a driver claim/i, 'Chuyến chưa được phân công hoặc đã bắt đầu. Liên hệ chủ xe để kiểm tra.'],
  [/driver cannot complete or cancel/i, 'Tài xế không được tự hoàn thành hoặc hủy chuyến.'],
  [/invalid trip status transition/i, 'Trạng thái chuyến vừa thay đổi. Tải lại để xem bước tiếp theo.'],
  [/cannot (update|add proof to|update location for) a closed trip/i, 'Chuyến đã kết thúc, không thể cập nhật thêm.'],
  [/incident note is required/i, 'Vui lòng mô tả sự cố.'],
  [/do not have access to this trip/i, 'Chuyến này không được giao cho tài khoản của bạn.'],
  [/driver (or admin )?role required|unsupported role/i, 'Tài khoản hiện tại không có quyền thực hiện thao tác này.'],
  [/must be in PICKED_UP or IN_TRANSIT/i, 'Chỉ check-in cột mốc sau khi đã lấy hàng.'],
  [/milestone has already been reached/i, 'Cột mốc này đã được check-in.'],
  [/invalid password|user not found/i, 'Số điện thoại hoặc mật khẩu không đúng.'],
  [/bid must be lower than the current lowest bid/i, 'Giá vừa có người đặt thấp hơn. Hãy nhập giá thấp hơn giá thấp nhất hiện tại.'],
  [/improve the current lowest bid by at least the price step/i, 'Giá phải thấp hơn giá thấp nhất hiện tại ít nhất một bước giá.'],
  [/maximum number of bids/i, 'Bạn đã dùng hết số lượt đặt giá của phiên này.'],
  [/auction is not accepting bids/i, 'Phiên không còn nhận giá. Có thể phiên vừa kết thúc.'],
  [/positive and not exceed maxprice/i, 'Giá phải lớn hơn 0 và không vượt giá trần.'],
  [/carrier cannot bid: ?payment_incomplete/i, 'Bạn cần hoàn tất thanh toán đăng ký trước khi đặt giá.'],
  [/carrier cannot bid: ?(waiting_for_start)/i, 'Phòng chưa mở. Bạn chỉ đặt giá được khi đến giờ bắt đầu.'],
  [/carrier cannot bid: ?(registration_required|registration_closed|registration_cancelled)/i, 'Bạn chưa có đăng ký hợp lệ cho phiên này.'],
  [/carrier cannot bid: ?(auction_completed|auction_cancelled)/i, 'Phiên đã kết thúc hoặc đã bị hủy.'],
  [/carrier cannot bid: ?reputation_too_low|reputation/i, 'Điểm uy tín chưa đạt mức tối thiểu để tham gia phiên.'],
  [/registration for this auction is closed/i, 'Phiên đã đóng đăng ký.'],
  [/auction is not accepting registrations/i, 'Phiên hiện không nhận đăng ký.'],
  [/only sealed auctions require winner selection/i, 'Chỉ phiên đấu giá kín mới cần chọn người thắng.'],
  [/auction must be completed before selecting a winner/i, 'Chỉ chọn người thắng được sau khi phiên kết thúc.'],
  [/only pending or open auctions can be cancelled/i, 'Chỉ hủy được phiên chưa kết thúc.'],
  [/carrier must sign the contract first/i, 'Nhà xe cần ký hợp đồng trước, sau đó chủ hàng mới ký.'],
  [/contract signing deadline has passed/i, 'Đã quá hạn ký hợp đồng.'],
  [/contract (signature already recorded|cannot be signed)/i, 'Hợp đồng đã được ký hoặc không còn ký được.'],
  [/complaint is already closed/i, 'Khiếu nại đã đóng, không thể cập nhật thêm.'],
  [/registrationStartTime must be before registrationEndTime/i, 'Thời điểm mở đăng ký phải trước thời điểm đóng đăng ký.'],
  [/registrationEndTime must be in the future/i, 'Thời điểm đóng đăng ký phải ở tương lai.'],
  [/auction time order/i, 'Thứ tự thời gian phiên đấu giá chưa hợp lệ.'],
  [/insufficient (available )?balance/i, 'Số dư ví không đủ. Vui lòng nạp thêm tiền rồi thử lại.'],
  [/payment amount does not match/i, 'Số tiền thanh toán không khớp với đơn nạp.'],
  [/only waiting trips can be assigned/i, 'Chỉ phân công được chuyến đang chờ lấy hàng.'],
  [/driver (is )?not (verified|in)|not assignable|does not belong/i, 'Tài xế không thuộc đội xe của bạn hoặc chưa được duyệt.'],
  [/unsupported|invalid.*(file|type|format)|file.*(large|size)/i, 'Tệp tải lên chưa đúng định dạng hoặc quá dung lượng.'],

];

export function translateError(raw, status) {
  const text = String(raw || '');
  // Some backend messages are already written in Vietnamese (e.g. geo-fence distance).
  if (/[À-ỹ]/u.test(text) && !/exception|\.java/i.test(text)) return text;
  const rule = RULES.find(([pattern]) => pattern.test(text));
  if (rule) return rule[1];
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Tài khoản hiện tại không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Không tìm thấy dữ liệu. Tải lại để cập nhật.';
  if (status === 409) return 'Thao tác không còn hợp lệ ở trạng thái hiện tại. Tải lại để cập nhật.';
  if (status >= 500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  return 'Không thực hiện được yêu cầu. Vui lòng thử lại.';
}
