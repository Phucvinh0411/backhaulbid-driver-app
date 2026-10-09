// Form checks for owner screens. They mirror the web portal so both clients reject the same
// input before it reaches the server; the backend services remain the authority.

const text = (value) => String(value ?? '').trim();

export function validateWalletAction(kind, { amount, bankName, bankAccountNumber, accountHolderName }) {
  const value = Number(amount);
  if (!Number.isInteger(value) || value < 10000) return `${kind === 'topup' ? 'Số tiền nạp' : 'Số tiền rút'} phải là số nguyên và từ 10.000 ₫.`;
  if (kind === 'withdraw' && (!text(bankName) || !/^[0-9]{6,30}$/.test(text(bankAccountNumber)) || !text(accountHolderName))) {
    return 'Nhập đủ ngân hàng, số tài khoản 6–30 chữ số và tên chủ tài khoản.';
  }
  return null;
}

// Same leniency as the web forms: the services validate the final value.
export const PHONE_PATTERN = /^[0-9+().\s-]{8,20}$/;

export function validateAddress(form) {
  const errors = {};
  if (!text(form.label)) errors.label = 'Nhập tên kho / địa điểm.';
  if (!text(form.province)) errors.province = 'Nhập tỉnh / thành phố.';
  if (!text(form.detail)) errors.detail = 'Nhập địa chỉ chi tiết.';
  if (!text(form.contactName)) errors.contactName = 'Nhập người liên hệ.';
  if (!PHONE_PATTERN.test(text(form.contactPhone))) errors.contactPhone = 'Nhập số điện thoại hợp lệ.';
  return errors;
}

export function validateVehicle(form, { requireDocuments = false } = {}) {
  const errors = {};
  if (!text(form.licensePlate)) errors.licensePlate = 'Nhập biển số xe.';
  if (!(Number(form.payloadCapacity) > 0)) errors.payloadCapacity = 'Tải trọng phải lớn hơn 0.';
  if (!text(form.vehicleType)) errors.vehicleType = 'Chọn loại xe.';
  if (requireDocuments && !form.registration) errors.registration = 'Tải lên cà vẹt / đăng ký xe.';
  if (requireDocuments && !form.inspection) errors.inspection = 'Tải lên giấy đăng kiểm.';
  return errors;
}

export function validateDriver(form, { requireLicense = false } = {}) {
  const errors = {};
  if (!text(form.fullName)) errors.fullName = 'Nhập họ tên tài xế.';
  if (!PHONE_PATTERN.test(text(form.phone))) errors.phone = 'Nhập số điện thoại hợp lệ.';
  if (!text(form.licenseNumber)) errors.licenseNumber = 'Nhập số giấy phép lái xe.';
  if (requireLicense && !form.license) errors.license = 'Tải lên ảnh giấy phép lái xe.';
  return errors;
}
