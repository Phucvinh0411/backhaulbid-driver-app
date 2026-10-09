import { Platform } from 'react-native';
import { translateError } from './errors';
import { refreshTokenData } from './refreshGate';
import { isDriverSession, sameScope } from './sessionModel';

// Gateway base URL. Android emulators reach the host through 10.0.2.2.
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080')
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, raw = '' } = {}) {
    super(message);
    this.status = status;
    this.raw = raw;
    this.isNetwork = status === 0;
  }
}

let sessionRef = { current: null };
let onSessionChange = () => {};
let onSessionExpired = () => {};

/** Wires the client to the auth provider. */
export function configureApi({ getSession, setSession, expire }) {
  sessionRef = { get current() { return getSession(); } };
  onSessionChange = setSession;
  onSessionExpired = expire;
}

async function parse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function rawMessage(body) {
  if (!body) return '';
  if (typeof body === 'string') return body;
  const message = body.message || body.error?.message || body.error;
  return Array.isArray(message) ? message.join(', ') : String(message || '');
}

// Normal calls carry only the bearer token. Cookies are used solely by login/refresh/logout:
// the gateway prefers a cookie over the bearer header, so sending cookies everywhere could
// act as a different account that signed in earlier in the same browser.
const COOKIE_PATHS = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/logout'];

async function send(path, { method = 'GET', body, headers = {}, auth = true, raw = false } = {}) {
  const session = sessionRef.current;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: COOKIE_PATHS.includes(path) ? 'include' : 'omit',
    headers: {
      Accept: 'application/json',
      ...(isForm || raw || body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(auth && session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm || raw ? body : JSON.stringify(body),
  });
  return response;
}

let refreshing = null;

/** Account refresh uses the identity cookie (native sends it explicitly); driver refresh posts its token. */
async function refreshAccessToken() {
  const session = sessionRef.current;
  if (!session?.refreshToken) return false;
  if (refreshing?.session === session) return refreshing.promise;
  const entry = { session, promise: null };
  entry.promise = (async () => {
    const data = await refreshTokenData(API_BASE_URL, session, Platform.OS !== 'web');
    if (!data?.accessToken) return false;
    // An old refresh must not restore a logged-out account or replace a new login.
    if (sessionRef.current !== session) return sameScope(sessionRef.current, session) && sessionRef.current?.accessToken === data.accessToken;
    // A driver refresh rotates the refresh token as well; keep both.
    await onSessionChange({ ...session, accessToken: data.accessToken, refreshToken: data.refreshToken || session.refreshToken });
    return true;
  })().finally(() => {
    if (refreshing === entry) refreshing = null;
  });
  refreshing = entry;
  return entry.promise;
}

/**
 * JSON request against the gateway with the driver's bearer token.
 * Throws ApiError with a Vietnamese message; never reports success before the server answers.
 */
export async function request(path, options = {}) {
  const requestedSession = sessionRef.current;
  const assertScope = () => {
    if (options.auth === false) return;
    const current = sessionRef.current;
    if (!sameScope(current, requestedSession)) {
      throw new ApiError('Tài khoản đã thay đổi. Hãy thực hiện lại thao tác.', { status: 409 });
    }
  };
  let response;
  let sentSession = requestedSession;
  try {
    response = await send(path, options);
    assertScope();
    if (response.status === 401 && options.auth !== false && (await refreshAccessToken())) {
      assertScope();
      sentSession = sessionRef.current;
      response = await send(path, options);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', { status: 0 });
  }
  const data = await parse(response);
  assertScope();
  if (!response.ok) {
    // A forbidden read of the driver's own trip means that the assignment/session is no longer current.
    // Other 403s (forbidden owner endpoints or writes) are permission errors, not a sign-out signal.
    const tripPath = isDriverSession(sentSession) ? `/api/v1/trips/${encodeURIComponent(sentSession.tripId)}` : null;
    const revokedRead = response.status === 403 && (options.method || 'GET') === 'GET' && tripPath
      && (path.split('?')[0] === tripPath || path.split('?')[0] === `${tripPath}/tracking`);
    if ((response.status === 401 || revokedRead) && options.auth !== false
      && sessionRef.current?.accessToken === sentSession?.accessToken) onSessionExpired();
    const raw = rawMessage(data);
    throw new ApiError(translateError(raw, response.status), { status: response.status, raw });
  }
  return data;
}

/** Native HTTP shares auth ownership/refresh, but never sends its proof through JS. */
export async function getNativeAccessToken(expected, { refresh = false } = {}) {
  const assertOwner = () => {
    const current = sessionRef.current;
    if (!current || !sameScope(current, expected)) {
      throw new ApiError('Tài khoản đã thay đổi. Hãy thực hiện lại thao tác.', { status: 409 });
    }
    return current;
  };
  const before = assertOwner();
  if (refresh) {
    let refreshed;
    try { refreshed = await refreshAccessToken(); }
    catch { throw new ApiError('Không thể làm mới phiên đăng nhập. Kiểm tra mạng rồi thử lại.', { status: 0 }); }
    assertOwner();
    if (!refreshed) {
      if (sessionRef.current === before) onSessionExpired();
      throw new ApiError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', { status: 401 });
    }
  } else {
    await request('/api/v1/auth/me');
  }
  return assertOwner().accessToken;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
};
