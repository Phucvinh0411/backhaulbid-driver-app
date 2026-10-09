// Copied from web-portal components/shipper/create-auction (mockData.js options + createAuctionValidation.js).
// Keep both in sync: the bidding-service enforces the same rules.
export const GOODS_CATEGORIES = [
  "Linh kiện điện tử",
  "Thực phẩm đông lạnh",
  "Nông sản khô",
  "Vật liệu xây dựng",
  "Hàng tiêu dùng nhanh (FMCG)",
  "Hóa chất & Sơn",
  "Bao bì & Giấy",
  "Khác",
];

export const VEHICLE_TYPES = [
  { value: "TRUCK_SMALL", label: "Xe tải nhỏ" },
  { value: "TRUCK_MEDIUM", label: "Xe tải trung" },
  { value: "TRUCK_HEAVY", label: "Xe tải nặng" },
  { value: "CONTAINER_TRACTOR", label: "Xe đầu kéo container" },
  { value: "REFRIGERATED_TRUCK", label: "Xe tải đông lạnh" },
  { value: "SPECIALIZED_TRUCK", label: "Xe chuyên dụng" },
];

export const getParticipationFeeQuote = (maxPrice) => {
  const value = Number(maxPrice) || 0;

  if (value <= 2000000) return { tier: "LEVEL_1", amount: 10000 };
  if (value <= 5000000) return { tier: "LEVEL_2", amount: 20000 };
  if (value <= 15000000) return { tier: "LEVEL_3", amount: 50000 };
  if (value <= 50000000) return { tier: "LEVEL_4", amount: 100000 };
  return { tier: "LEVEL_5", amount: 200000 };
};

export const getCreationFeeQuote = (maxPrice) => {
  const value = Number(maxPrice) || 0;
  if (value < 10000000) return { tier: "LEVEL_1", amount: 50000 };
  if (value < 50000000) return { tier: "LEVEL_2", amount: 100000 };
  return { tier: "LEVEL_3", amount: 150000 };
};

export const INITIAL_FORM_STATE = {
  goodsName: "",
  goodsCategory: "",
  weight: "",
  volume: "",
  goodsValue: "",
  valueDocuments: [],
  requiredVehicleType: "",
  vehicleLength: "",
  vehicleWidth: "",
  vehicleHeight: "",
  requiredTemp: "",
  description: "",
  images: [],

  fromLocationName: "",
  fromAddress: "",
  fromProvince: "",
  fromContactName: "",
  fromContactPhone: "",
  toLocationName: "",
  toAddress: "",
  toProvince: "",
  toContactName: "",
  toContactPhone: "",
  earliestPickup: "",
  latestPickup: "",
  earliestDelivery: "",
  latestDelivery: "",

  auctionType: "PUBLIC",
  maxPrice: "",
  priceStep: "",
  participationFee: "",
  isDepositRequired: true,
  depositAmount: "",
  maxBids: "",
  regStartTime: "",
  regEndTime: "",
  startTime: "",
  endTime: "",
};

export const formatCurrency = (value) => {
  if (!value || Number.isNaN(Number(value))) return "0 đ";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  })
    .format(value)
    .replace("₫", "đ");
};

export const formatDisplayNumber = (value) => {
  if (!value || Number.isNaN(Number(value)) || Number(value) <= 0) return "";
  return new Intl.NumberFormat("vi-VN").format(value);
};

export const parseDisplayNumber = (value) => {
  if (!value) return 0;
  return Number(String(value).replace(/[.\s]/g, "").replace(/[^0-9]/g, "")) || 0;
};

const requiredRouteFields = [
  "LocationName",
  "Province",
  "Address",
];

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";

const toDate = (value) => {
  if (!hasValue(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const hasCompleteLocation = (form, prefix) =>
  requiredRouteFields.every((field) => hasValue(form[`${prefix}${field}`]));

export const validateCreateAuctionForm = (form, now = new Date()) => {
  if (!hasValue(form.goodsName)) return "Vui lòng nhập tên lô hàng.";
  if (!hasValue(form.goodsCategory)) return "Vui lòng chọn loại hàng hóa.";
  if (!Number.isFinite(Number(form.weight)) || Number(form.weight) <= 0) {
    return "Trọng lượng phải lớn hơn 0.";
  }
  if (!hasValue(form.requiredVehicleType)) return "Vui lòng chọn loại xe yêu cầu.";
  if (!hasCompleteLocation(form, "from")) {
    return "Vui lòng chọn đầy đủ điểm lấy hàng (tên kho, tỉnh/thành và địa chỉ).";
  }
  if (!hasCompleteLocation(form, "to")) {
    return "Vui lòng chọn đầy đủ điểm giao hàng (tên kho, tỉnh/thành và địa chỉ).";
  }
  if (!Number.isFinite(Number(form.maxPrice)) || Number(form.maxPrice) <= 0) {
    return "Vui lòng nhập giá trần lớn hơn 0.";
  }
  if (!Number.isFinite(Number(form.priceStep)) || Number(form.priceStep) <= 0) {
    return "Vui lòng nhập bước giá lớn hơn 0.";
  }
  if (Number(form.priceStep) > Number(form.maxPrice)) {
    return "Bước giá không được lớn hơn giá trần. Vui lòng giảm bước giá hoặc tăng giá trần.";
  }
  if (form.isDepositRequired !== false && (!hasValue(form.depositAmount) || Number(form.depositAmount) <= 0)) {
    return "Vui lòng nhập tiền đặt cọc khi bật yêu cầu đặt cọc.";
  }
  if (form.isDepositRequired !== false && Number(form.depositAmount) > Number(form.maxPrice)) {
    return "Tiền đặt cọc không được lớn hơn giá trần. Vui lòng điều chỉnh lại số tiền.";
  }

  const registrationStart = toDate(form.regStartTime);
  const registrationEnd = toDate(form.regEndTime);
  const start = toDate(form.startTime);
  const end = toDate(form.endTime);
  if (hasValue(form.regStartTime) && !registrationStart) {
    return "Thời điểm mở đăng ký không hợp lệ. Vui lòng chọn lại.";
  }
  if (!registrationStart || !registrationEnd || !start || !end) {
    return "Vui lòng nhập đủ thời gian mở/đóng đăng ký và bắt đầu/kết thúc đấu giá.";
  }
  if (registrationStart && registrationStart > registrationEnd) {
    return "Thời điểm mở đăng ký phải trước thời điểm đóng đăng ký.";
  }
  if (registrationEnd <= now) {
    return "Thời điểm đóng đăng ký phải ở tương lai. Vui lòng chọn thời gian sau hiện tại.";
  }
  if (registrationEnd > start) {
    return "Thời điểm đóng đăng ký phải trước hoặc bằng thời điểm bắt đầu đấu giá.";
  }
  if (start >= end) {
    return "Thời điểm bắt đầu đấu giá phải trước thời điểm kết thúc đấu giá.";
  }

  return null;
};

const toIsoOrUndefined = (value) => {
  const date = toDate(value);
  return date ? date.toISOString() : undefined;
};

export const mapFormToAuctionPayload = (form) => ({
  title: form.goodsName.trim(),
  goodsType: form.goodsCategory,
  weight: Number(form.weight),
  volume: form.volume ? Number(form.volume) : undefined,
  goodsValue: form.goodsValue ? Number(form.goodsValue).toString() : undefined,
  // Value documents are upload URLs from the private folder; the server keeps only their keys.
  valueDocuments: (form.valueDocuments ?? []).length ? [...form.valueDocuments] : undefined,
  vehicleTypeRequired: form.requiredVehicleType,
  requiredTemp: form.requiredTemp?.trim() || undefined,
  vehicleSpecs: {
    length: form.vehicleLength ? Number(form.vehicleLength) : undefined,
    width: form.vehicleWidth ? Number(form.vehicleWidth) : undefined,
    height: form.vehicleHeight ? Number(form.vehicleHeight) : undefined,
  },
  pickupLocation: {
    ...pinPayload(form, "from"),
    locationName: form.fromLocationName?.trim() || "",
    province: form.fromProvince?.trim() || "",
    address: form.fromAddress?.trim() || "",
    contactName: form.fromContactName?.trim() || undefined,
    contactPhone: form.fromContactPhone?.trim() || undefined,
    earliestTime: toIsoOrUndefined(form.earliestPickup),
    latestTime: toIsoOrUndefined(form.latestPickup),
  },
  deliveryLocation: {
    ...pinPayload(form, "to"),
    locationName: form.toLocationName?.trim() || "",
    province: form.toProvince?.trim() || "",
    address: form.toAddress?.trim() || "",
    contactName: form.toContactName?.trim() || undefined,
    contactPhone: form.toContactPhone?.trim() || undefined,
    earliestTime: toIsoOrUndefined(form.earliestDelivery),
    latestTime: toIsoOrUndefined(form.latestDelivery),
  },
  auctionType: form.auctionType || "PUBLIC",
  maxPrice: Number(form.maxPrice).toString(),
  priceStep: Number(form.priceStep).toString(),
  participationFeeTier: getParticipationFeeQuote(form.maxPrice).tier,
  maxBids: form.maxBids ? Number(form.maxBids) : undefined,
  notes: form.description?.trim() || "",
  isDepositRequired: form.isDepositRequired !== false,
  depositAmount:
    form.isDepositRequired !== false && Number(form.depositAmount) > 0
      ? Number(form.depositAmount).toString()
      : undefined,
  registrationStartTime: toIsoOrUndefined(form.regStartTime),
  registrationEndTime: toIsoOrUndefined(form.regEndTime),
  startTime: toIsoOrUndefined(form.startTime),
  endTime: toIsoOrUndefined(form.endTime),
  images: (form.images || []).filter((image) => /^https?:\/\//.test(image)),
});

// Coordinate pins are optional for older drafts; no empty-string-to-zero conversion.
function pinPayload(form, prefix) {
  const lat = form[`${prefix}Latitude`], lng = form[`${prefix}Longitude`];
  if (lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '') return {};
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) return {};
  return { latitude: Number(lat), longitude: Number(lng), coordinateSource: 'USER_CONFIRMED', coordinateConfirmedAt: form[`${prefix}CoordinateConfirmedAt`] || new Date().toISOString() };
}
