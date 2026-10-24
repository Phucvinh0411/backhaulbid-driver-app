import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionBar, Banner, Button, Screen, Section, StateView, StatusBadge, TextField, useResource, useSingleFlight } from '@/components/ui';
import Sheet from '@/components/Sheet';
import DocumentField from '@/components/fleet/DocumentField';
import { fleetApi } from '@/lib/services';
import { uploadImage } from '@/lib/media';
import { validateDriver } from '@/lib/validators';
import { FLEET_STATUS, metaOf } from '@/lib/ownerMeta';
import { colors, type } from '@/constants/theme';

const EMPTY = { fullName: '', phone: '', licenseNumber: '', license: null };

export default function DriverFormScreen() {
  const { id } = useLocalSearchParams();
  const creating = id === 'new';
  const router = useRouter();
  const { data, state, error, reload } = useResource(async () => (creating ? null : (await fleetApi.drivers()).find((item) => item.id === id) || false), [id]);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, run] = useSingleFlight();
  const set = (field) => (value) => { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })); };

  useEffect(() => {
    if (data) setForm({ fullName: data.fullName || '', phone: data.phone || '', licenseNumber: data.licenseNumber || '', license: null });
  }, [data]);

  const save = () => run(async () => {
    const nextErrors = validateDriver(form, { requireLicense: creating });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitError('');
    try {
      const licenseImageUrl = form.license ? await uploadImage(form.license, 'drivers/license') : data?.licenseImageUrl || '';
      const payload = { fullName: form.fullName.trim(), phone: form.phone.trim(), licenseNumber: form.licenseNumber.trim(), licenseImageUrl };
      if (creating) await fleetApi.createDriver(payload);
      else await fleetApi.updateDriver(id, payload);
      router.replace('/fleet');
    } catch (failure) {
      setSubmitError(failure.message);
    }
  });

  const remove = () => run(async () => {
    try {
      await fleetApi.deleteDriver(id);
      setConfirmDelete(false);
      router.replace('/fleet');
    } catch (failure) {
      setSubmitError(failure.message);
      setConfirmDelete(false);
    }
  });

  if (!creating && state === 'loading') return <StateView kind="loading" title="Đang tải tài xế" />;
  if (!creating && (state === 'error' || data === false)) return <StateView kind="error" title="Không tìm thấy tài xế" message={error || 'Tài xế không thuộc đội xe của bạn.'} actionLabel="Thử lại" onAction={() => reload()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: creating ? 'Thêm tài xế' : 'Hồ sơ tài xế' }} />
      <Screen bottomInset={140}>
        {!creating && data ? (
          <Section title={data.fullName} right={<StatusBadge {...metaOf(FLEET_STATUS, data.status)} />}>
            {data.status === 'REJECTED' ? <Banner tone="danger" title="Hồ sơ bị từ chối">{data.rejectionReason || 'Cập nhật thông tin rồi lưu để gửi duyệt lại.'}</Banner> : null}
            <Text style={type.secondary}>Chỉ tài xế đã được duyệt mới được phân công chuyến. Tài xế nhận chuyến trong ứng dụng bằng mã chuyến và PIN bạn gửi.</Text>
          </Section>
        ) : <Text style={type.secondary}>Hồ sơ tài xế được quản trị viên duyệt trước khi phân công chuyến.</Text>}
        <Section title="Thông tin tài xế">
          <TextField label="Họ và tên" required value={form.fullName} onChangeText={set('fullName')} error={errors.fullName} />
          <TextField label="Số điện thoại" required value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" />
          <TextField label="Số giấy phép lái xe" required value={form.licenseNumber} onChangeText={set('licenseNumber')} error={errors.licenseNumber} autoCapitalize="characters" />
          <DocumentField label="Ảnh giấy phép lái xe" required={creating} file={form.license} existing={data?.licenseImageUrl} onChange={set('license')} onError={setSubmitError} error={errors.license} disabled={busy} />
        </Section>
        {submitError ? <Banner tone="danger">{submitError}</Banner> : null}
        {!creating ? <Button label="Xóa tài xế" variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
      </Screen>
      <ActionBar><Button label={creating ? 'Gửi hồ sơ tài xế' : 'Lưu thay đổi'} onPress={save} loading={busy} /></ActionBar>
      <Sheet visible={confirmDelete} title="Xóa tài xế?" busy={busy} onClose={() => setConfirmDelete(false)}
        footer={<><Button label="Xóa" variant="danger" onPress={remove} loading={busy} /><Button label="Giữ lại" variant="secondary" onPress={() => setConfirmDelete(false)} disabled={busy} /></>}>
        <Text style={type.body}>Xóa {data?.fullName} khỏi đội xe. Thao tác không hoàn tác được.</Text>
      </Sheet>
    </View>
  );
}
