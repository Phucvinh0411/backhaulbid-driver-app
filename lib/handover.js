// Rules for the pickup handover form in the driver app. Pure: no imports, no storage, no network.
// The server enforces the same limits; these checks only keep the form honest before it is sent.
// A photo in the form is { ref, preview }: ref is what the server accepts (the upload URL of a new photo, or the
// path of a photo the record already has); preview is what the screen shows (a device URI or the photo path).

export const HANDOVER_MAX_PHOTOS = 10;

export const HANDOVER_CONDITIONS = [
  { value: 'GOOD', label: 'Nguyên vẹn' },
  { value: 'DAMAGED', label: 'Có hư hỏng' },
];

export function emptyHandoverForm() {
  return {
    cargoCategory: '',
    grossWeightKg: '',
    packageCount: '',
    conditionStatus: 'GOOD',
    conditionNote: '',
    sealNumber: '',
    placeNote: '',
    photos: [],
  };
}

/** Form values from a saved handover, so an unconfirmed record can be corrected and sent again. */
export function formFromHandover(handover) {
  if (!handover) return emptyHandoverForm();
  return {
    cargoCategory: handover.cargoCategory ?? '',
    grossWeightKg: handover.grossWeightKg == null ? '' : String(handover.grossWeightKg),
    packageCount: handover.packageCount == null ? '' : String(handover.packageCount),
    conditionStatus: handover.conditionStatus === 'DAMAGED' ? 'DAMAGED' : 'GOOD',
    conditionNote: handover.conditionNote ?? '',
    sealNumber: handover.sealNumber ?? '',
    placeNote: handover.placeNote ?? '',
    photos: Array.isArray(handover.photoPaths)
      ? handover.photoPaths.map((path) => ({ ref: path, preview: path }))
      : [],
  };
}

/** Returns { ok: true, payload } for the server, or { ok: false, error } with a message for the driver. */
export function buildHandoverPayload(form) {
  const fail = (error) => ({ ok: false, error });

  const cargoCategory = String(form.cargoCategory ?? '').trim();
  if (!cargoCategory) return fail('Nhập loại hàng hóa.');
  if (cargoCategory.length > 80) return fail('Loại hàng tối đa 80 ký tự.');

  const weightText = String(form.grossWeightKg ?? '').trim();
  if (!/^\d{1,10}([.,]\d{1,2})?$/.test(weightText) || Number(weightText.replace(',', '.')) <= 0) {
    return fail('Nhập khối lượng hợp lệ theo kg, tối đa 2 chữ số thập phân.');
  }

  let packageCount = null;
  const countText = String(form.packageCount ?? '').trim();
  if (countText) {
    if (!/^\d{1,6}$/.test(countText) || Number(countText) < 1) return fail('Số kiện phải là số nguyên dương.');
    packageCount = Number(countText);
  }

  const conditionStatus = form.conditionStatus === 'DAMAGED' ? 'DAMAGED' : 'GOOD';
  const conditionNote = String(form.conditionNote ?? '').trim();
  if (conditionStatus === 'DAMAGED' && !conditionNote) return fail('Mô tả hư hỏng đã thấy trên hàng.');
  if (conditionNote.length > 500) return fail('Ghi chú hư hỏng tối đa 500 ký tự.');

  const sealNumber = String(form.sealNumber ?? '').trim();
  if (sealNumber.length > 60) return fail('Số niêm phong tối đa 60 ký tự.');
  const placeNote = String(form.placeNote ?? '').trim();
  if (placeNote.length > 255) return fail('Ghi chú vị trí tối đa 255 ký tự.');

  const photoUrls = (form.photos ?? []).map((photo) => photo?.ref).filter(Boolean);
  if (photoUrls.length < 1) return fail('Chụp ít nhất 1 ảnh hàng hóa trước khi lấy hàng.');
  if (photoUrls.length > HANDOVER_MAX_PHOTOS) return fail(`Tối đa ${HANDOVER_MAX_PHOTOS} ảnh hàng hóa.`);

  return {
    ok: true,
    payload: {
      cargoCategory,
      packageCount,
      grossWeightKg: Number(weightText.replace(',', '.')),
      conditionStatus,
      conditionNote: conditionStatus === 'DAMAGED' ? conditionNote : null,
      sealNumber: sealNumber || null,
      placeNote: placeNote || null,
      photoUrls,
    },
  };
}

/**
 * What the trip screen shows: whether a record exists, whether the shipper confirmed it, and whether the
 * pickup button may be used. Pickup is never enabled from this alone; the server re-checks it.
 */
export function getHandoverStatus(handover) {
  if (!handover) {
    return {
      recorded: false,
      confirmed: false,
      pickupReady: false,
      message: 'Ghi biên bản bàn giao (loại hàng, khối lượng, tình trạng và ảnh) trước khi lấy hàng.',
    };
  }
  if (handover.shipperConfirmedAt) {
    return { recorded: true, confirmed: true, pickupReady: Boolean(handover.readyForPickup), message: 'Chủ hàng đã xác nhận bàn giao.' };
  }
  return {
    recorded: true,
    confirmed: false,
    pickupReady: false,
    message: 'Đã gửi biên bản. Chờ chủ hàng xác nhận đã giao hàng trước khi bấm lấy hàng.',
  };
}
