import { isDriverSession, scopeKey } from './sessionModel.js';

// Both React and the headless GPS worker share a single refresh per credential scope. A driver refresh
// rotates the refresh token, so two concurrent callers must reuse one request (the server also accepts
// the just-rotated token briefly for a lost response).
const inFlight = new Map();
export function refreshTokenData(baseUrl, session, native) {
  const scope = `${scopeKey(session)}:${session.refreshToken}`;
  if (inFlight.has(scope)) return inFlight.get(scope);
  const promise = (async () => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      if (isDriverSession(session)) {
        const response = await fetch(`${baseUrl}/api/v1/auth/driver/refresh`, {
          method: 'POST', credentials: 'omit', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
        if (!response.ok) return null;
        const data = await response.json();
        const view = data?.session;
        // Never accept tokens for another session, trip or assignment version.
        const same = view?.sessionId === session.sessionId && view?.tripId === session.tripId
          && Number(view?.assignmentVersion) === session.assignmentVersion;
        return data?.accessToken && data?.refreshToken && same ? { accessToken: data.accessToken, refreshToken: data.refreshToken } : null;
      }
      const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: 'POST', credentials: native ? 'omit' : 'include',
        signal: controller.signal,
        headers: native ? { Cookie: `refreshToken=${session.refreshToken}` } : {},
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data?.accessToken && data.accountId === session.accountId && data.role === session.role ? data : null;
    } finally { clearTimeout(timeout); }
  })().finally(() => { if (inFlight.get(scope) === promise) inFlight.delete(scope); });
  inFlight.set(scope, promise);
  return promise;
}
