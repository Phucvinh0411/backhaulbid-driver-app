import { useState } from 'react';
import { Text } from 'react-native';
import Sheet from '@/components/Sheet';
import { Button, FieldError } from '@/components/ui';
import MapPointField from './MapPointField';
import { api } from '@/lib/api';
import { validPoint } from '@/lib/trackingData';
import { type } from '@/constants/theme';

export default function RoutePinsSheet({ trip, onClose, onSaved }) {
  const [pickup, setPickup] = useState(trip.pickupPoint), [delivery, setDelivery] = useState(trip.deliveryPoint), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const save = async () => {
    if (busy) return;
    if (!validPoint(pickup) || !validPoint(delivery)) { setError('Xác nhận đủ pin kho lấy và kho giao.'); return; }
    setBusy(true); setError('');
    try {
      await api.patch(`/api/v1/trips/${encodeURIComponent(trip.id)}/route-points`, { version: trip.routeVersion || 0, pickupPoint: { latitude: Number(pickup.latitude), longitude: Number(pickup.longitude) }, deliveryPoint: { latitude: Number(delivery.latitude), longitude: Number(delivery.longitude) } });
      await onSaved(); onClose();
    } catch (failure) { setError(failure.status === 409 ? 'Chuyến vừa thay đổi. Làm mới chuyến rồi xác nhận lại pin.' : failure.message); }
    finally { setBusy(false); }
  };
  return <Sheet visible title="Xác nhận vị trí kho" busy={busy} onClose={onClose} footer={<><Button label="Lưu pin cho chuyến" loading={busy} onPress={save} /><Button label="Để sau" variant="secondary" disabled={busy} onPress={onClose} /></>}>
    <Text style={type.secondary}>Bổ sung tọa độ cho địa chỉ đã có trong hợp đồng. Chỉ thay được khi chuyến còn chờ lấy hàng.</Text>
    <Text style={type.body}>Lấy hàng: {trip.pickupLocation}</Text><MapPointField label="Pin kho lấy hàng" required point={pickup} onChange={setPickup} />
    <Text style={type.body}>Giao hàng: {trip.deliveryLocation}</Text><MapPointField label="Pin kho giao hàng" required point={delivery} onChange={setDelivery} />
    <FieldError message={error} />
  </Sheet>;
}
