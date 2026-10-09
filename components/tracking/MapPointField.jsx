import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, FieldError, TextField } from '@/components/ui';
import Sheet from '@/components/Sheet';
import JourneyMap from './JourneyMap';
import { validPoint } from '@/lib/trackingData';
import { space, type } from '@/constants/theme';

export default function MapPointField({ label = 'Vị trí kho', point, onChange, required = false }) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState({ latitude: '', longitude: '' }), [error, setError] = useState('');
  const openPicker = () => { setDraft(validPoint(point) ? point : { latitude: '', longitude: '' }); setError(''); setOpen(true); };
  const confirm = () => {
    if (!validPoint(draft) || String(draft.latitude).trim() === '' || String(draft.longitude).trim() === '') { setError('Chọn pin trên bản đồ hoặc nhập đủ vĩ độ (-90–90) và kinh độ (-180–180).'); return; }
    onChange({ latitude: Number(draft.latitude), longitude: Number(draft.longitude), coordinateSource: 'USER_CONFIRMED', coordinateConfirmedAt: new Date().toISOString() }); setOpen(false);
  };
  return <View style={{ gap: space.sm }}>
    <Text style={type.secondary}>{validPoint(point) ? `${label}: ${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)}` : `${label} chưa có pin.${required ? ' Xác nhận vị trí trước khi lưu.' : ' Chọn đúng kho để hành trình hiện trên bản đồ.'}`}</Text>
    <Button label={validPoint(point) ? 'Kiểm tra / đổi pin kho' : 'Chọn pin trên bản đồ'} variant="secondary" onPress={openPicker} />
    {validPoint(point) && !required ? <Button label="Bỏ tọa độ kho" variant="secondary" onPress={() => onChange(null)} /> : null}
    <Sheet visible={open} title={label} onClose={() => setOpen(false)} footer={<><Button label="Xác nhận vị trí kho" onPress={confirm} /><Button label="Quay lại" variant="secondary" onPress={() => setOpen(false)} /></>}>
      <Text style={type.secondary}>Phóng to, chạm đúng kho rồi xác nhận. Pin chỉ ghi tọa độ; địa chỉ bạn đã nhập vẫn giữ nguyên.</Text>
      <JourneyMap picker payload={{ pickup: validPoint(draft) ? { latitude: Number(draft.latitude), longitude: Number(draft.longitude), label } : null, milestones: [], manual: [], segments: [] }} onPointSelected={(next) => { setDraft(next); setError(''); }} height={300} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <TextField label="Vĩ độ" style={{ flex: 1 }} value={draft.latitude} keyboardType="numbers-and-punctuation" onChangeText={(latitude) => setDraft((current) => ({ ...current, latitude }))} />
        <TextField label="Kinh độ" style={{ flex: 1 }} value={draft.longitude} keyboardType="numbers-and-punctuation" onChangeText={(longitude) => setDraft((current) => ({ ...current, longitude }))} />
      </View><FieldError message={error} />
    </Sheet>
  </View>;
}
