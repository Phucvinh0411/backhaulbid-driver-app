import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { Banner, Button } from '@/components/ui';
import Sheet from '@/components/Sheet';
import { fleetApi } from '@/lib/services';
import { uploadImage } from '@/lib/media';
import { pickDocuments, readText } from '@/lib/filePick';
import { DRIVER_TEMPLATE, VEHICLE_TEMPLATE, findDocument, mapDriverRows, mapVehicleRows, missingDocuments, parseSimpleCsv, validateDocumentFiles } from '@/lib/fleetImport';
import { colors, space, type } from '@/constants/theme';

/**
 * Bulk import like the web portal: a CSV plus the document files it names. Rows are sent one
 * by one and each result is reported, so a failure does not hide which rows were created.
 */
export default function FleetImportSheet({ kind, onClose, onDone }) {
  const vehicle = kind === 'vehicle';
  const [rows, setRows] = useState([]);
  const [csvName, setCsvName] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  const pickCsv = async () => {
    setError('');
    try {
      const [asset] = await pickDocuments({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'] });
      if (!asset) return;
      const parsed = parseSimpleCsv(await readText(asset));
      setRows(vehicle ? mapVehicleRows(parsed) : mapDriverRows(parsed));
      setCsvName(asset.name);
      setResults([]);
    } catch (failure) {
      setRows([]);
      setCsvName('');
      setError(failure.message || 'Không đọc được file CSV. Kiểm tra đúng định dạng file mẫu.');
    }
  };

  const pickFiles = async () => {
    setError('');
    const picked = await pickDocuments({ multiple: true });
    if (!picked.length) return;
    const message = validateDocumentFiles(picked);
    if (message) return setError(message);
    setFiles(picked);
  };

  const submit = async () => {
    if (busy) return;
    const missing = missingDocuments(rows, files, kind);
    if (missing.length) return setError(`Chưa tìm thấy ${missing.slice(0, 2).join(' và ')}${missing.length > 2 ? ' và các tệp khác' : ''}. Kiểm tra lại tên file trong CSV.`);
    setBusy(true);
    setError('');
    const outcome = [];
    for (const row of rows) {
      const name = vehicle ? row.licensePlate : row.fullName;
      try {
        if (vehicle) {
          const registrationUrl = await uploadImage(findDocument(files, row.registrationFile), 'vehicles/registration');
          const inspectionUrl = await uploadImage(findDocument(files, row.inspectionFile), 'vehicles/inspection');
          await fleetApi.createVehicle({ licensePlate: row.licensePlate, payloadCapacity: row.payloadCapacity, vehicleType: row.vehicleType, bodyType: row.bodyType, registrationUrl, inspectionUrl });
        } else {
          const licenseImageUrl = await uploadImage(findDocument(files, row.licenseImageFile), 'drivers/license');
          await fleetApi.createDriver({ fullName: row.fullName, phone: row.phone, licenseNumber: row.licenseNumber, licenseImageUrl });
        }
        outcome.push({ name, ok: true });
      } catch (failure) {
        outcome.push({ name, ok: false, message: failure.message });
      }
      setResults([...outcome]);
    }
    setBusy(false);
    const created = outcome.filter((item) => item.ok).length;
    if (created === rows.length) onDone(`Đã gửi ${created} hồ sơ ${vehicle ? 'phương tiện' : 'tài xế'} để quản trị viên duyệt.`);
    else setError(`Đã tạo ${created}/${rows.length} hồ sơ. Sửa các dòng lỗi rồi nhập lại riêng các dòng đó.`);
  };

  return (
    <Sheet visible title={vehicle ? 'Nhập phương tiện từ CSV' : 'Nhập tài xế từ CSV'} busy={busy} onClose={onClose}
      footer={<><Button label={`Gửi ${rows.length || ''} hồ sơ`} onPress={submit} loading={busy} disabled={!rows.length || !files.length} /><Button label="Đóng" variant="secondary" onPress={onClose} disabled={busy} /></>}>
      <Text style={type.secondary}>Cột: {(vehicle ? VEHICLE_TEMPLATE : DRIVER_TEMPLATE).split('\n')[0]}. Tên tệp tài liệu trong CSV phải trùng với tệp bạn chọn.</Text>
      <Button label="Chia sẻ file mẫu" variant="secondary" onPress={() => Share.share({ message: vehicle ? VEHICLE_TEMPLATE : DRIVER_TEMPLATE })} />
      <Button label={csvName ? `CSV: ${csvName} (${rows.length} dòng)` : '1. Chọn file CSV'} variant="secondary" onPress={pickCsv} disabled={busy} />
      <Button label={files.length ? `Đã chọn ${files.length} tệp tài liệu` : '2. Chọn các tệp tài liệu'} variant="secondary" onPress={pickFiles} disabled={busy || !rows.length} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {results.length ? (
        <View style={{ gap: space.xs }}>
          {results.map((item, index) => (
            <Text key={`${item.name}-${index}`} style={[type.secondary, { color: item.ok ? colors.success : colors.danger }]}>{item.ok ? '✓' : '✗'} {item.name}{item.message ? `: ${item.message}` : ''}</Text>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}
