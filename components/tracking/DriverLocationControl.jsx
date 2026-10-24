import { useEffect, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { Button, FieldError } from '@/components/ui';
import Sheet from '@/components/Sheet';
import { getTrackingState, subscribeTracking, startTripTracking, stopTripTracking } from '@/lib/driverTracking';
import { GPS_STATUSES } from '@/lib/trackingData';
import { colors, space, type, fonts } from '@/constants/theme';

export default function DriverLocationControl({ trip }) {
  const [state, setState] = useState(getTrackingState), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => subscribeTracking(setState), []);
  const active = state.active?.tripId === trip.id;
  useEffect(() => { if (active && !GPS_STATUSES.includes(trip.status)) void stopTripTracking({ notifyServer: false }); }, [active, trip.status]);
  if (!GPS_STATUSES.includes(trip.status)) return null;
  const start = async (background) => {
    if (busy) return; setBusy(true); setError('');
    try { await startTripTracking(trip, { background }); setOpen(false); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const stop = async () => { if (busy) return; setBusy(true); try { await stopTripTracking(); } finally { setBusy(false); } };
  return <View style={{ gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.md }}>
    <Text style={{ ...type.body, fontFamily: fonts.bold }}>{active ? 'Đang chia sẻ vị trí chuyến này' : 'Chia sẻ vị trí của bạn'}</Text>
    <Text style={type.secondary}>{active ? `${state.mode === 'background' ? 'Có thể tiếp tục khi khóa màn hình.' : 'Chỉ cập nhật khi app đang mở.'}${state.queued ? ` ${state.queued} điểm đang chờ gửi.` : ''}` : 'Chủ hàng và Chủ xe xem vị trí trong thời gian bạn thực hiện chuyến. Bạn chủ động bật và có thể dừng bất cứ lúc nào.'}</Text>
    {state.error ? <FieldError message={state.error} /> : null}
    <Button label={active ? 'Dừng chia sẻ vị trí' : 'Bật chia sẻ vị trí'} variant={active ? 'secondary' : 'primary'} loading={busy} onPress={active ? stop : () => { setError(''); setOpen(true); }} />
    {active && state.mode === 'foreground' && Platform.OS !== 'web' ? <Button label="Cho phép khi khóa màn hình" variant="secondary" onPress={() => { setError(''); setOpen(true); }} /> : null}
    <Sheet visible={open} title="Chia sẻ vị trí cho chuyến" busy={busy} onClose={() => setOpen(false)} footer={<>
      {Platform.OS !== 'web' ? <Button label="Cho phép cả khi khóa màn hình" loading={busy} onPress={() => start(true)} /> : null}
      <Button label="Chỉ khi app đang mở" variant="secondary" loading={busy} onPress={() => start(false)} />
      <Button label="Để sau" variant="secondary" disabled={busy} onPress={() => setOpen(false)} />
    </>}>
      <Text style={type.body}>App ghi vị trí khoảng mỗi 15 giây khi di chuyển. Chia sẻ kết thúc khi bạn dừng, đăng xuất, bị đổi phân công hoặc đã giao hàng.</Text>
      {state.active && !active ? <Text style={type.secondary}>Chuyến đang chia sẻ trước đó sẽ dừng khi bạn bật cho chuyến này.</Text> : null}
      {Platform.OS !== 'web' ? <Text style={type.secondary}>Để tiếp tục khi khóa màn hình, chọn quyền vị trí “Luôn cho phép” trong phần Cài đặt Android. Máy sẽ hiện thông báo khi app đang chia sẻ. Force-stop hoặc tiết kiệm pin có thể ngừng GPS.</Text> : null}
      <FieldError message={error} />
      {error && Platform.OS !== 'web' ? <Button label="Mở Cài đặt quyền" variant="secondary" onPress={() => Linking.openSettings()} /> : null}
    </Sheet>
  </View>;
}
