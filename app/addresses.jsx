import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { ActionBar, Banner, Button, Card, Screen, StateView, TextField, useResource, useSingleFlight } from '@/components/ui';
import Sheet from '@/components/Sheet';
import MapPointField from '@/components/tracking/MapPointField';
import { addressApi } from '@/lib/services';
import { validateAddress } from '@/lib/validators';
import { VIETNAM_PROVINCES } from '@/lib/shared/provinces';
import { colors, radius, space, type, fonts } from '@/constants/theme';

const EMPTY = { label: '', province: '', detail: '', contactName: '', contactPhone: '', latitude: null, longitude: null };
const PROVINCES = VIETNAM_PROVINCES.map((item) => item.name);

export default function AddressBookScreen() {
  const { data, state, error, refreshing, reload } = useResource(() => addressApi.list(), []);
  const items = Array.isArray(data) ? data : [];
  const [editing, setEditing] = useState(null); // null | { id?: string }
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [sheetError, setSheetError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, run] = useSingleFlight();
  const set = (field) => (value) => { setForm((current) => ({ ...current, [field]: value, ...(['province', 'detail'].includes(field) ? { latitude: null, longitude: null, coordinateSource: null, coordinateConfirmedAt: null } : {}) })); setErrors((current) => ({ ...current, [field]: undefined })); };
  const needle = form.province.trim().toLocaleLowerCase('vi');
  const suggestions = needle && !PROVINCES.includes(form.province) ? PROVINCES.filter((name) => name.toLocaleLowerCase('vi').includes(needle)).slice(0, 6) : [];

  const open = (address) => {
    setForm(address ? { label: address.label || '', province: address.province || '', detail: address.detail || '', contactName: address.contactName || '', contactPhone: address.contactPhone || '', latitude: address.latitude, longitude: address.longitude, coordinateSource: address.coordinateSource, coordinateConfirmedAt: address.coordinateConfirmedAt } : EMPTY);
    setErrors({});
    setSheetError('');
    setEditing(address ? { id: address.id } : {});
  };

  const save = () => run(async () => {
    const nextErrors = validateAddress(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSheetError('');
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
    try {
      if (editing.id) await addressApi.update(editing.id, payload);
      else await addressApi.create(payload);
      setEditing(null);
      setNotice(editing.id ? 'Đã cập nhật địa chỉ.' : 'Đã thêm địa chỉ.');
    } catch (failure) {
      setSheetError(failure.message);
    }
    await reload();
  });

  const remove = () => run(async () => {
    try {
      await addressApi.remove(toDelete.id);
      setToDelete(null);
      setNotice('Đã xóa địa chỉ.');
    } catch (failure) {
      setSheetError(failure.message);
    }
    await reload();
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Sổ địa chỉ kho' }} />
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })} bottomInset={90}>
        <Text style={type.secondary}>Kho thường dùng để chọn nhanh điểm lấy và giao khi tạo phiên đấu giá.</Text>
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        {state === 'loading' && <StateView kind="loading" title="Đang tải sổ địa chỉ" />}
        {state === 'error' && <StateView kind="error" title="Không tải được sổ địa chỉ" message={error} actionLabel="Thử lại" onAction={() => reload()} />}
        {state === 'ready' && items.length === 0 && <StateView title="Chưa có địa chỉ" message="Thêm kho đầu tiên của bạn." />}
        {items.map((address) => (
          <Card key={address.id}>
            <Text style={{ fontSize: 16, fontFamily: fonts.bold, color: colors.ink }}>{address.label}</Text>
            <Text style={type.body}>{address.detail}, {address.province}</Text>
            <Text style={type.caption}>{address.contactName} · {address.contactPhone}</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="Sửa" variant="secondary" onPress={() => open(address)} style={{ flex: 1 }} />
              <Button label="Xóa" variant="danger" onPress={() => { setSheetError(''); setToDelete(address); }} style={{ flex: 1 }} />
            </View>
          </Card>
        ))}
      </Screen>
      <ActionBar><Button label="Thêm địa chỉ" onPress={() => open(null)} /></ActionBar>

      <Sheet visible={Boolean(editing)} title={editing?.id ? 'Sửa địa chỉ' : 'Thêm địa chỉ'} busy={busy} onClose={() => setEditing(null)}
        footer={<><Button label="Lưu địa chỉ" onPress={save} loading={busy} /><Button label="Hủy" variant="secondary" onPress={() => setEditing(null)} disabled={busy} /></>}>
        <TextField label="Tên kho" required value={form.label} onChangeText={set('label')} error={errors.label} placeholder="Ví dụ: Kho tổng Đông Anh" />
        <TextField label="Tỉnh / thành phố" required value={form.province} onChangeText={set('province')} error={errors.province} />
        {suggestions.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {suggestions.map((name) => (
              <Pressable key={name} accessibilityRole="button" onPress={() => set('province')(name)} style={{ minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.lg, backgroundColor: colors.brandSoft, justifyContent: 'center' }}>
                <Text style={{ color: colors.brand, fontFamily: fonts.semibold }}>{name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <TextField label="Địa chỉ chi tiết" required value={form.detail} onChangeText={set('detail')} error={errors.detail} multiline />
        <MapPointField label="Pin kho" point={form} onChange={(point) => setForm((current) => ({ ...current, latitude: point?.latitude ?? null, longitude: point?.longitude ?? null, coordinateSource: point?.coordinateSource ?? null, coordinateConfirmedAt: point?.coordinateConfirmedAt ?? null }))} />
        <TextField label="Người liên hệ" required value={form.contactName} onChangeText={set('contactName')} error={errors.contactName} />
        <TextField label="Số điện thoại" required value={form.contactPhone} onChangeText={set('contactPhone')} error={errors.contactPhone} keyboardType="phone-pad" />
        {sheetError ? <Banner tone="danger">{sheetError}</Banner> : null}
      </Sheet>

      <Sheet visible={Boolean(toDelete)} title="Xóa địa chỉ?" busy={busy} onClose={() => setToDelete(null)}
        footer={<><Button label="Xóa" variant="danger" onPress={remove} loading={busy} /><Button label="Giữ lại" variant="secondary" onPress={() => setToDelete(null)} disabled={busy} /></>}>
        <Text style={type.body}>Xóa “{toDelete?.label}” khỏi sổ địa chỉ. Các phiên đã tạo không bị ảnh hưởng.</Text>
        {sheetError ? <Banner tone="danger">{sheetError}</Banner> : null}
      </Sheet>
    </View>
  );
}
