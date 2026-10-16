import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, FieldError, TextField } from '@/components/ui';
import Sheet from '@/components/Sheet';
import JourneyMap from './JourneyMap';
import { validPoint } from '@/lib/trackingData';
import { isHintReady, searchAddressHint } from '@/lib/addressHint';
import { space, type } from '@/constants/theme';

const HINT_TEXT = {
  idle: 'Phóng to, chạm đúng kho rồi xác nhận. Pin chỉ ghi tọa độ; địa chỉ bạn đã nhập vẫn giữ nguyên.',
  loading: 'Đang tìm vị trí theo địa chỉ đã nhập…',
  found: 'Pin đang ở vị trí gần đúng theo địa chỉ, chưa lưu. Chạm đúng cổng kho để chỉnh rồi xác nhận.',
  notFound: 'Không tìm thấy vị trí theo địa chỉ này. Chạm vào bản đồ để đặt pin.',
  error: 'Chưa tìm được vị trí theo địa chỉ. Chạm vào bản đồ để đặt pin.',
};

/** address ({ detail, ward, province }) is optional; when given, an empty picker opens at that address. */
export default function MapPointField({ label = 'Vị trí kho', point, onChange, required = false, address }) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState({ latitude: '', longitude: '' }), [error, setError] = useState('');
  const [hint, setHint] = useState('idle');
  const search = useRef(null);
  const stopSearch = () => { search.current?.abort(); search.current = null; };
  useEffect(() => stopSearch, []);

  const openPicker = () => {
    const hasPin = validPoint(point);
    setDraft(hasPin ? point : { latitude: '', longitude: '' }); setError(''); setOpen(true);
    stopSearch();
    if (hasPin || !isHintReady(address)) { setHint('idle'); return; }
    const controller = new AbortController();
    search.current = controller;
    setHint('loading');
    searchAddressHint(address, { signal: controller.signal })
      .then((found) => {
        if (search.current !== controller) return;
        search.current = null;
        if (!found) { setHint('notFound'); return; }
        setDraft(found); setHint('found');
      })
      .catch(() => { if (search.current === controller) { search.current = null; setHint('error'); } });
  };
  const close = () => { stopSearch(); setOpen(false); };
  // A tap or typed coordinates always win over a search that is still running.
  const pick = (next) => { stopSearch(); setHint('idle'); setDraft(next); setError(''); };
  const confirm = () => {
    if (!validPoint(draft) || String(draft.latitude).trim() === '' || String(draft.longitude).trim() === '') { setError('Chọn pin trên bản đồ hoặc nhập đủ vĩ độ (-90–90) và kinh độ (-180–180).'); return; }
    onChange({ latitude: Number(draft.latitude), longitude: Number(draft.longitude), coordinateSource: 'USER_CONFIRMED', coordinateConfirmedAt: new Date().toISOString() }); close();
  };
  return <View style={{ gap: space.sm }}>
    <Text style={type.secondary}>{validPoint(point) ? `${label}: ${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)}` : `${label} chưa có pin.${required ? ' Xác nhận vị trí trước khi lưu.' : ' Chọn đúng kho để hành trình hiện trên bản đồ.'}`}</Text>
    <Button label={validPoint(point) ? 'Kiểm tra / đổi pin kho' : 'Chọn pin trên bản đồ'} variant="secondary" onPress={openPicker} />
    {validPoint(point) && !required ? <Button label="Bỏ tọa độ kho" variant="secondary" onPress={() => onChange(null)} /> : null}
    <Sheet visible={open} title={label} onClose={close} footer={<><Button label="Xác nhận vị trí kho" onPress={confirm} /><Button label="Quay lại" variant="secondary" onPress={close} /></>}>
      <Text style={type.secondary}>{HINT_TEXT[hint]}</Text>
      <JourneyMap picker payload={{ pickup: validPoint(draft) ? { latitude: Number(draft.latitude), longitude: Number(draft.longitude), label } : null, milestones: [], manual: [], segments: [] }} onPointSelected={pick} height={300} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <TextField label="Vĩ độ" style={{ flex: 1 }} value={String(draft.latitude)} keyboardType="numbers-and-punctuation" onChangeText={(latitude) => { stopSearch(); setHint('idle'); setDraft((current) => ({ ...current, latitude })); }} />
        <TextField label="Kinh độ" style={{ flex: 1 }} value={String(draft.longitude)} keyboardType="numbers-and-punctuation" onChangeText={(longitude) => { stopSearch(); setHint('idle'); setDraft((current) => ({ ...current, longitude })); }} />
      </View><FieldError message={error} />
    </Sheet>
  </View>;
}
