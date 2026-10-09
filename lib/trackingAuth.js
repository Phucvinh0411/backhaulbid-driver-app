import { Platform } from 'react-native';
import { API_BASE_URL, ApiError } from './api';
import { loadSession, replaceSessionIfCurrent } from './session';
import { refreshTokenData } from './refreshGate';
import { isDriverSession, scopeKey } from './sessionModel';

export async function trackingRequest(path, scope, { method = 'GET', body } = {}) {
  const ownedSession = async () => {
    // scope.ownerKey is the driver session + trip + assignment version the GPS belongs to.
    const session = await loadSession();
    if (!isDriverSession(session) || scopeKey(session) !== scope.ownerKey) {
      throw new ApiError('Phiên Tài xế đã thay đổi. Chia sẻ vị trí đã dừng.', { status: 403 });
    }
    return session;
  };
  const send = async (session) => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15_000);
    try { return await fetch(`${API_BASE_URL}${path}`, {
    method, credentials: 'omit', signal: controller.signal,
    headers: { Accept: 'application/json', Authorization: `Bearer ${session.accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    }); } finally { clearTimeout(timeout); }
  };
  let session = await ownedSession();
  let response = await send(session);
  await ownedSession();
  if (response.status === 401 && session.refreshToken) {
    const newer = await ownedSession();
    if (newer.accessToken !== session.accessToken) session = newer;
    else {
      const data = await refreshTokenData(API_BASE_URL, session, Platform.OS !== 'web');
      await ownedSession();
      if (!data) throw new ApiError('Đăng nhập lại để tiếp tục chia sẻ vị trí.', { status: 401 });
      await replaceSessionIfCurrent(session, { ...session, accessToken: data.accessToken, refreshToken: data.refreshToken || session.refreshToken });
      session = await ownedSession();
    }
    response = await send(session);
  }
  await ownedSession();
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.message || 'Chưa gửi được vị trí.', { status: response.status });
  return data;
}
