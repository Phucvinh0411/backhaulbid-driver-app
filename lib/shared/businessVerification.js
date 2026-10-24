export const BUSINESS_VERIFICATION_PATH = "/api/v1/business-verifications";
export const BUSINESS_VERIFICATION_STATUS_PATH =
  `${BUSINESS_VERIFICATION_PATH}/me`;

export const businessVerificationLookupPath = (taxCode) =>
  `${BUSINESS_VERIFICATION_PATH}/lookup/${encodeURIComponent(taxCode)}`;
export const businessVerificationDocumentPath = (
  verificationId,
  documentType = "businessLicense"
) => {
  const basePath = `${BUSINESS_VERIFICATION_PATH}/${encodeURIComponent(
    verificationId
  )}/document`;
  return documentType === "businessLicense"
    ? basePath
    : `${basePath}?type=${encodeURIComponent(documentType)}`;
};

const ALLOWED_LICENSE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
const MAX_LICENSE_SIZE = 5 * 1024 * 1024;

export function validateVerificationDocument(
  file,
  documentLabel = "tài liệu"
) {
  if (!file) {
    return {
      valid: false,
      message: `Vui lòng chọn ${documentLabel}.`,
    };
  }
  if (file.size > MAX_LICENSE_SIZE) {
    return {
      valid: false,
      message: "Tài liệu vượt quá dung lượng tối đa 5MB.",
    };
  }
  if (!ALLOWED_LICENSE_TYPES.has(file.type)) {
    return {
      valid: false,
      message: "Tài liệu phải có định dạng PDF, PNG hoặc JPG.",
    };
  }
  return { valid: true, message: "" };
}

export function validateBusinessLicense(file) {
  return validateVerificationDocument(
    file,
    "giấy phép đăng ký kinh doanh"
  );
}

export function validateAuthorizationLetter(file) {
  return validateVerificationDocument(file, "giấy ủy quyền người đại diện");
}

export function normalizeRepresentativeName(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function compareRepresentativeNames(ekycName, businessRepresentative) {
  const normalizedEkycName = normalizeRepresentativeName(ekycName);
  const normalizedBusinessRepresentative = normalizeRepresentativeName(
    businessRepresentative
  );

  if (!normalizedEkycName || !normalizedBusinessRepresentative) {
    return "UNKNOWN";
  }

  return normalizedEkycName === normalizedBusinessRepresentative
    ? "MATCH"
    : "MISMATCH";
}
