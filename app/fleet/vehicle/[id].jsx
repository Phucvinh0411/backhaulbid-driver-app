import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionBar, Banner, Button, ChoiceChips, Row, Screen, Section, StateView, StatusBadge, TextField, useResource, useSingleFlight } from '@/components/ui';
import Sheet from '@/components/Sheet';
import DocumentField from '@/components/fleet/DocumentField';
import { fleetApi } from '@/lib/services';
import { uploadImage } from '@/lib/media';
import { validateVehicle } from '@/lib/validators';
import { FLEET_STATUS, metaOf } from '@/lib/ownerMeta';
import { VEHICLE_TYPES } from '@/lib/shared/auctionForm';
import { colors, type } from '@/constants/theme';

const EMPTY = { licensePlate: '', payloadCapacity: '', vehicleType: 'TRUCK_MEDIUM', bodyType: '', registration: null, inspection: null };

export default function VehicleFormScreen() {
  const { id } = useLocalSearchParams();
  const creating = id === 'new';
  const router = useRouter();
  const { data, state, error, reload } = useResource(async () => (creating ? null : (await fleetApi.vehicles()).find((item) => item.id === id) || false), [id]);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [busy, run] = useSingleFlight();
  const set = (field) => (value) => { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })); };

  useEffect(() => {
    if (data) setForm({ licensePlate: data.licensePlate || '', payloadCapacity: String(data.payloadCapacity ?? ''), vehicleType: data.vehicleType || 'TRUCK_MEDIUM', bodyType: data.bodyType || '', registration: null, inspection: null });
  }, [data]);

  const save = () => run(async () => {
    const nextErrors = validateVehicle(form, { requireDocuments: creating });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitError('');
    try {
      const registrationUrl = form.registration ? await uploadImage(form.registration, 'vehicles/registration') : data?.registrationDocumentUrl || '';
      const inspectionUrl = form.inspection ? await uploadImage(form.inspection, 'vehicles/inspection') : data?.inspectionDocumentUrl || '';
      const payload = { licensePlate: form.licensePlate.trim(), payloadCapacity: Number(form.payloadCapacity), vehicleType: form.vehicleType, bodyType: form.bodyType.trim(), registrationUrl, inspectionUrl };
      if (creating) await fleetApi.createVehicle(payload);
      else await fleetApi.updateVehicle(id, payload);
      router.replace('/fleet');
    } catch (failure) {
      setSubmitError(failure.message);
    }
  });

  const deactivate = () => run(async () => {
    try {
      await fleetApi.deactivateVehicle(id);
      setConfirmDeactivate(false);
      router.replace('/fleet');
    } catch (failure) {
      setSubmitError(failure.message);
      setConfirmDeactivate(false);
    }
  });

  if (!creating && state === 'loading') return <StateView kind="loading" title="Đang tải phương tiện" />;
  if (!creating && (state === 'error' || data === false)) return <StateView kind="error" title="Không tìm thấy phương tiện" message={error || 'Xe không thuộc đội xe của bạn.'} actionLabel="Thử lại" onAction={() => reload()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: creating ? 'Thêm phương tiện' : 'Phương tiện' }} />
      <Screen bottomInset={140}>
        {!creating && data ? (
          <Section title={data.licensePlate} right={<StatusBadge {...metaOf(FLEET_STATUS, data.status)} />}>
            {data.status === 'REJECTED' ? <Banner tone="danger" title="Hồ sơ bị từ chối">{data.rejectionReason || 'Cập nhật thông tin và tài liệu rồi lưu để gửi duyệt lại.'}</Banner> : null}
            {data.status === 'PENDING' ? <Text style={type.secondary}>Đang chờ quản trị viên duyệt. Xe chỉ dùng được để đấu giá sau khi được duyệt.</Text> : null}
            <Row label="Cà vẹt / đăng ký" value={data.registrationDocumentUrl ? 'Đã nộp' : 'Chưa có'} />
            <Row label="Đăng kiểm" value={data.inspectionDocumentUrl ? 'Đã nộp' : 'Chưa có'} />
          </Section>
        ) : <Text style={type.secondary}>Hồ sơ mới được quản trị viên duyệt trước khi dùng để đăng ký đấu giá.</Text>}
        <Section title="Thông tin xe">
          <TextField label="Biển số" required value={form.licensePlate} onChangeText={set('licensePlate')} error={errors.licensePlate} autoCapitalize="characters" placeholder="29H-123.45" />
          <TextField label="Tải trọng (tấn)" required value={form.payloadCapacity} onChangeText={set('payloadCapacity')} error={errors.payloadCapacity} keyboardType="decimal-pad" />
          <ChoiceChips label="Loại xe" required options={VEHICLE_TYPES} value={form.vehicleType} onChange={set('vehicleType')} error={errors.vehicleType} />
          <TextField label="Loại thùng" value={form.bodyType} onChangeText={set('bodyType')} placeholder="Ví dụ: Thùng kín, mui bạt" />
        </Section>
        <Section title="Tài liệu">
          <DocumentField label="Cà vẹt / đăng ký xe" required={creating} file={form.registration} existing={data?.registrationDocumentUrl} onChange={set('registration')} onError={setSubmitError} error={errors.registration} disabled={busy} />
          <DocumentField label="Giấy đăng kiểm" required={creating} file={form.inspection} existing={data?.inspectionDocumentUrl} onChange={set('inspection')} onError={setSubmitError} error={errors.inspection} disabled={busy} />
        </Section>
        {submitError ? <Banner tone="danger">{submitError}</Banner> : null}
        {!creating && data?.status !== 'INACTIVE' ? <Button label="Ngừng sử dụng xe" variant="danger" onPress={() => setConfirmDeactivate(true)} /> : null}
      </Screen>
      <ActionBar><Button label={creating ? 'Gửi hồ sơ xe' : 'Lưu thay đổi'} onPress={save} loading={busy} /></ActionBar>
      <Sheet visible={confirmDeactivate} title="Ngừng sử dụng xe?" busy={busy} onClose={() => setConfirmDeactivate(false)}
        footer={<><Button label="Ngừng sử dụng" variant="danger" onPress={deactivate} loading={busy} /><Button label="Giữ lại" variant="secondary" onPress={() => setConfirmDeactivate(false)} disabled={busy} /></>}>
        <Text style={type.body}>Xe {data?.licensePlate} sẽ không dùng được để đăng ký phiên mới.</Text>
      </Sheet>
    </View>
  );
}
