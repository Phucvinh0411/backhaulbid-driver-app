import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { loadSession } from './session';
import { trackingRequest } from './trackingAuth';
import { trackingStore } from './trackingStore';
import { setLocationHandler, startBackground, stopBackground } from './locationTask';
import { GPS_STATUSES, trimQueue } from './trackingData';
import { isDriverSession, scopeKey } from './sessionModel';

let watcher = null, retryTimer = null, uploading = null, lifecycle = Promise.resolve();
let sourceEpoch = 0;
let backoff = 0, retryAt = 0;
let snapshot = { active: null, queued: 0, mode: null, error: '' };
const listeners = new Set();
export const getTrackingState = () => snapshot;
export const subscribeTracking = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
function emit(next) { snapshot = { ...snapshot, ...next }; for (const listener of listeners) listener(snapshot); }
const serial = (work) => { const promise = lifecycle.then(work, work); lifecycle = promise.catch(() => {}); return promise; };
// ownerKey = driver session + trip + assignment version; sessionId here is the GPS tracking session.
const same = (a, b) => Boolean(a?.ownerKey) && a?.ownerKey === b?.ownerKey && a?.sessionId === b?.sessionId;

async function releaseLocal(scope) {
  // A stored scope from the previous app version has no ownerKey: it is always released.
  if (scope?.ownerKey && !same(await trackingStore.read(), scope)) return;
  // Invalidate before waiting on native shutdown, so any late task has no owner.
  await trackingStore.clear(scope);
  watcher?.remove(); watcher = null;
  clearInterval(retryTimer); retryTimer = null;
  await stopBackground().catch(() => {});
  emit({ active: null, queued: 0, mode: null }); backoff = 0; retryAt = 0;
}

async function validate(scope) {
  const session = await loadSession();
  if (!isDriverSession(session) || scopeKey(session) !== scope.ownerKey) throw Object.assign(new Error('Chia sẻ vị trí đã dừng do phiên tài xế thay đổi.'), { status: 403 });
  if (!same(await trackingStore.read(), scope)) throw Object.assign(new Error('Phiên chia sẻ đã dừng.'), { status: 409 });
}

export function flushLocations() {
  if (uploading) return uploading;
  uploading = (async () => {
    const scope = await trackingStore.read();
    if (!scope) return;
    try {
      await validate(scope);
      const server = await trackingRequest(`/api/v1/trips/${encodeURIComponent(scope.tripId)}/tracking`, scope);
      await validate(scope);
      if (!GPS_STATUSES.includes(server.status) || server.trackingSession?.id !== scope.sessionId
        || server.trackingSession.status !== 'ACTIVE' || server.trackingSession.driverSessionId !== scope.subjectId) {
        throw Object.assign(new Error('Chia sẻ vị trí đã dừng do chuyến hoặc phân công thay đổi.'), { status: 409 });
      }
      const points = await trackingStore.peek(scope);
      emit({ queued: points.length });
      if (!points.length || Date.now() < retryAt) return;
      const receipt = await trackingRequest(`/api/v1/trips/${encodeURIComponent(scope.tripId)}/locations/batch`, scope, { method: 'POST', body: { trackingSessionId: scope.sessionId, points: points.slice(0, 50) } });
      await validate(scope);
      await trackingStore.ack(scope, receipt);
      backoff = 0; retryAt = 0;
      emit({ queued: (await trackingStore.peek(scope)).length, error: '' });
    } catch (error) {
      if (!same(await trackingStore.read(), scope)) return;
      if ([401, 403, 404, 409, 410].includes(error.status)) {
        sourceEpoch++;
        await releaseLocal(scope); emit({ error: error.message || 'Phiên chia sẻ đã kết thúc. Mở chuyến để bật lại.' });
      } else {
        backoff = Math.min(backoff ? backoff * 2 : 15_000, 120_000); retryAt = Date.now() + backoff;
        emit({ error: 'Chưa gửi được vị trí. App giữ tối đa 120 điểm trong 30 phút và thử lại khi có mạng.' });
      }
    }
  })().finally(() => { uploading = null; });
  return uploading;
}

async function receiveLocations(locations, expectedScope) {
  const scope = await trackingStore.read();
  if (!scope || (expectedScope && !same(scope, expectedScope))) return;
  if (expectedScope && AppState.currentState !== 'active') return;
  if (!expectedScope && !scope.background) return;
  try {
    await validate(scope);
    const fresh = locations.filter((location) => location.timestamp >= Date.parse(scope.startedAt));
    if (!fresh.length) { await flushLocations(); return; }
    const points = trimQueue(fresh.map((location) => ({
      sampleId: Crypto.randomUUID(),
      capturedAt: new Date(location.timestamp).toISOString(), latitude: location.coords.latitude, longitude: location.coords.longitude,
      accuracyMeters: location.coords.accuracy,
    })));
    if (!points.length) {
      emit({ error: fresh.some((location) => location.coords.accuracy > 100)
        ? 'GPS chưa đủ chính xác (cần sai số không quá 100 m). Ra nơi thoáng và bật vị trí chính xác.'
        : 'Chưa có vị trí hợp lệ cho phiên theo dõi. Kiểm tra ngày giờ tự động và dịch vụ vị trí trên điện thoại.' });
      await flushLocations();
      return;
    }
    await trackingStore.append(scope, points);
    await flushLocations();
  } catch (error) {
    if ([401, 403, 409].includes(error.status)) await releaseLocal(scope);
    else emit({ error: 'Chưa ghi được vị trí. Hãy kiểm tra GPS và mở lại chuyến.' });
  }
}
setLocationHandler(receiveLocations);

async function runLocationSource(scope, epoch = sourceEpoch) {
  watcher?.remove(); watcher = null;
  let background = false;
  if (scope.background && Platform.OS !== 'web') background = await startBackground().catch(() => false);
  if (epoch !== sourceEpoch) { await stopBackground().catch(() => {}); throw new Error('Chia sẻ vị trí đã dừng.'); }
  if (!background) await stopBackground().catch(() => {});
  if (!background) {
    const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 15_000, distanceInterval: 30 }, (point) => { void receiveLocations([point], scope); }, () => emit({ error: 'Không lấy được GPS. Kiểm tra quyền và dịch vụ vị trí.' }));
    if (epoch !== sourceEpoch) { subscription.remove(); throw new Error('Chia sẻ vị trí đã dừng.'); }
    watcher = subscription;
  }
  emit({ mode: background ? 'background' : 'foreground' });
  clearInterval(retryTimer); retryTimer = setInterval(() => { void flushLocations(); }, 15_000);
}

export function startTripTracking(trip, { background = false } = {}) {
  const epoch = ++sourceEpoch;
  const stillRequested = () => { if (epoch !== sourceEpoch) throw new Error('Thao tác chia sẻ vị trí đã bị hủy.'); };
  return serial(async () => {
    stillRequested();
    const session = await loadSession();
    if (!isDriverSession(session) || trip.id !== session.tripId || !GPS_STATUSES.includes(trip.status)) throw new Error('Chỉ Tài xế đã nhận chuyến đang thực hiện được chia sẻ vị trí.');
    if (!await Location.hasServicesEnabledAsync()) throw new Error('Bật dịch vụ vị trí trên điện thoại rồi thử lại.');
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) throw new Error('Chưa có quyền vị trí. Bạn vẫn có thể ghi mốc và giao hàng; bật quyền trong Cài đặt để chia sẻ GPS.');
    if (background && Platform.OS !== 'web') await Location.requestBackgroundPermissionsAsync();
    stillRequested();
    const old = await trackingStore.read();
    if (old && (old.tripId !== trip.id || old.ownerKey !== scopeKey(session))) {
      await releaseLocal(old);
      await trackingRequest(`/api/v1/trips/${encodeURIComponent(old.tripId)}/tracking-sessions/${encodeURIComponent(old.sessionId)}/stop`, old, { method: 'POST' }).catch(() => {});
    }
    const owner = { ownerKey: scopeKey(session) };
    const server = await trackingRequest(`/api/v1/trips/${encodeURIComponent(trip.id)}/tracking-sessions`, owner, { method: 'POST' });
    if (epoch !== sourceEpoch) {
      await trackingRequest(`/api/v1/trips/${encodeURIComponent(trip.id)}/tracking-sessions/${encodeURIComponent(server.id)}/stop`, owner, { method: 'POST' }).catch(() => {});
      stillRequested();
    }
    const current = await loadSession();
    if (scopeKey(current) !== owner.ownerKey) throw new Error('Phiên tài xế đã thay đổi. Vui lòng thử lại.');
    const scope = { ownerKey: owner.ownerKey, subjectId: session.sessionId, tripId: trip.id, sessionId: server.id, startedAt: server.startedAt, background };
    await trackingStore.set(scope);
    emit({ active: scope, error: '' });
    try { await runLocationSource(scope, epoch); }
    catch (error) {
      await releaseLocal(scope);
      await trackingRequest(`/api/v1/trips/${encodeURIComponent(scope.tripId)}/tracking-sessions/${encodeURIComponent(scope.sessionId)}/stop`, scope, { method: 'POST' }).catch(() => {});
      throw error;
    }
    // First point should not wait for a movement threshold.
    void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then((point) => receiveLocations([point], scope)).catch(() => {});
    return snapshot;
  });
}

export async function stopTripTracking({ notifyServer = true } = {}) {
    // Cancellation never waits behind a permission dialog or an in-flight start.
    sourceEpoch++;
    const scope = await trackingStore.read();
    if (!scope) return;
    await releaseLocal(scope); emit({ error: '' });
    if (notifyServer) await trackingRequest(`/api/v1/trips/${encodeURIComponent(scope.tripId)}/tracking-sessions/${encodeURIComponent(scope.sessionId)}/stop`, scope, { method: 'POST' }).catch(() => {});
}

export function reconcileTracking(session) {
  const epoch = sourceEpoch;
  return serial(async () => {
    if (epoch !== sourceEpoch) return;
    const scope = await trackingStore.read();
    if (!scope) return;
    // A different sign-in, trip or assignment version never inherits the old GPS queue.
    if (!isDriverSession(session) || scopeKey(session) !== scope.ownerKey) { await releaseLocal(scope); return; }
    try {
      const trip = await trackingRequest(`/api/v1/trips/${encodeURIComponent(scope.tripId)}`, scope);
      if (!GPS_STATUSES.includes(trip.status) || trip.id !== session.tripId) { await releaseLocal(scope); return; }
      const current = await trackingRequest(`/api/v1/trips/${encodeURIComponent(scope.tripId)}/tracking`, scope);
      if (current.trackingSession?.id !== scope.sessionId || current.trackingSession.status !== 'ACTIVE') { await releaseLocal(scope); return; }
      if (epoch !== sourceEpoch || !same(await trackingStore.read(), scope)) return;
      emit({ active: scope }); await runLocationSource(scope, epoch); await flushLocations();
    } catch (error) {
      if ([401, 403, 404, 409].includes(error.status)) await releaseLocal(scope);
      else emit({ active: scope, error: 'Chưa kết nối được máy chủ. Mở chuyến để kiểm tra chia sẻ vị trí.' });
    }
  });
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') void loadSession().then(reconcileTracking);
  else if (snapshot.mode === 'foreground') {
    watcher?.remove(); watcher = null;
    clearInterval(retryTimer); retryTimer = null;
    emit({ mode: 'paused' });
  }
});
