// CSV import for vehicles and drivers. Same columns, checks and file matching as the web
// portal (src/services/csvImport.js and app/carrier/{vehicles,drivers}/page.jsx).

export function parseSimpleCsv(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV phải có dòng tiêu đề và ít nhất một bản ghi.');
  const headers = lines[0].split(',').map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error('CSV có tên cột trống.');
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim());
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {});
  });
}

export const VEHICLE_TEMPLATE = 'licensePlate,payloadCapacity,vehicleType,bodyType,registrationFile,inspectionFile\n29H-123.45,10.5,TRUCK_MEDIUM,Thung bat,29H12345_cavet.jpg,29H12345_dangkiem.jpg';
export const DRIVER_TEMPLATE = 'fullName,phone,licenseNumber,licenseImageFile\nNguyen Van A,0901234567,B2,gplx001.jpg';

export function mapVehicleRows(rows) {
  const mapped = rows.map((row) => ({
    licensePlate: row.licensePlate,
    payloadCapacity: Number(row.payloadCapacity),
    vehicleType: row.vehicleType || 'TRUCK_MEDIUM',
    bodyType: row.bodyType || '',
    registrationFile: row.registrationFile || row.cavetImage || '',
    inspectionFile: row.inspectionFile || row.dangKiemImage || '',
  }));
  if (mapped.some((row) => !row.licensePlate || !Number.isFinite(row.payloadCapacity) || row.payloadCapacity <= 0)) {
    throw new Error('Mỗi dòng phải có licensePlate và payloadCapacity lớn hơn 0.');
  }
  return mapped;
}

export function mapDriverRows(rows) {
  const mapped = rows.map((row) => ({
    fullName: row.fullName,
    phone: row.phone,
    licenseNumber: row.licenseNumber,
    licenseImageFile: row.licenseImageFile || row.licenseImage || row.licenseImageUrl || '',
  }));
  if (mapped.some((row) => !row.fullName || !row.phone || !row.licenseNumber)) {
    throw new Error('Mỗi dòng phải có fullName, phone và licenseNumber.');
  }
  return mapped;
}

const DOCUMENT_TYPES = /^image\/(jpeg|png)$|^application\/pdf$/;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/** Returns an error message for the first unusable document file, or null. */
export function validateDocumentFiles(files) {
  const invalid = files.find((file) => (file.mimeType && !DOCUMENT_TYPES.test(file.mimeType)) || (file.size || 0) > MAX_DOCUMENT_BYTES);
  return invalid ? `Tệp ${invalid.name} không hợp lệ. Chỉ nhận JPG, PNG hoặc PDF, tối đa 5MB mỗi tệp.` : null;
}

export const findDocument = (files, name) => files.find((file) => String(file.name || '').toLowerCase() === String(name || '').trim().toLowerCase());

/** Lists document names referenced by the CSV that were not selected. */
export function missingDocuments(rows, files, kind) {
  return rows.flatMap((row) => (kind === 'vehicle'
    ? [[row.registrationFile, `cà vẹt của ${row.licensePlate}`], [row.inspectionFile, `đăng kiểm của ${row.licensePlate}`]]
    : [[row.licenseImageFile, `GPLX của ${row.fullName}`]])
    .filter(([name]) => !findDocument(files, name))
    .map(([, label]) => label));
}
