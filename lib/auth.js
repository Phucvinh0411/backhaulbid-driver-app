import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { configureApi, request, ApiError } from './api';
import {
  clearPendingRedeem, clearSession, loadPendingRedeem, loadSession, PENDING_REDEEM_WINDOW_MS, saveSession, savePendingRedeem, subscribeSession,
} from './session';
import { accountSession, driverSession, ekycAccountOf, isDriverSession, normalizeDriverCode, sameScope } from './sessionModel';
import EkycNative from '@/modules/backhaulbid-ekyc';
import { reconcileTracking, stopTripTracking } from './driverTracking';

const AuthContext = createContext(null);

/**
 * One sign-in at a time: a shipper/carrier account (phone + password) or a driver session redeemed from a
 * "mã nhận chuyến". Native eKYC is bound only to owner accounts.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [recovery, setRecovery] = useState(null);
  const [signOutNotice, setSignOutNotice] = useState('');
  const sessionRef = useRef(null);

  const store = useCallback(async (next) => {
    if (sessionRef.current && !sameScope(next, sessionRef.current)) {
      await EkycNative?.setAccount(null); // Cancel chip/camera capture before any network stop.
      await stopTripTracking(); // Stops the tracker and clears the old assignment's GPS queue.
    }
    sessionRef.current = next;
    setSession(next);
    await EkycNative?.setAccount(ekycAccountOf(next));
    if (next) await saveSession(next);
    else await clearSession();
  }, []);

  /** Sends the redeem and stores the session before forgetting the pending code (crash-safe). */
  const finishRedeem = useCallback(async (pending) => {
    let data;
    try {
      data = await request('/api/v1/auth/driver/redeem', { method: 'POST', body: { code: pending.code, redeemRequestId: pending.requestId }, auth: false });
    } catch (error) {
      // Definite answers end the attempt; a network failure keeps it for a retry with the same request ID.
      if (!error.isNetwork) await clearPendingRedeem();
      throw error;
    }
    const next = driverSession(data);
    if (!next.sessionId || !next.tripId || !next.accessToken || !next.refreshToken) {
      await clearPendingRedeem();
      throw new ApiError('Máy chủ trả về phiên tài xế không hợp lệ.', { status: 502 });
    }
    setExpired(false);
    await store(next);
    await clearPendingRedeem();
    return next;
  }, [store]);

  useEffect(() => {
    const unsubscribe = subscribeSession((next) => {
      // A headless refresh is reflected in React; it cannot change the sign-in scope.
      if (sameScope(next, sessionRef.current)) { sessionRef.current = next; setSession(next); }
    });
    configureApi({
      getSession: () => sessionRef.current,
      setSession: store,
      expire: () => {
        setExpired(true);
        void store(null);
      },
    });
    (async () => {
      const saved = await loadSession();
      sessionRef.current = saved;
      setSession(saved);
      await EkycNative?.setAccount(ekycAccountOf(saved));
      const pending = await loadPendingRedeem();
      if (pending && saved) await clearPendingRedeem(); // A stored session wins; drop the code.
      else if (pending && Date.now() - pending.createdAt > PENDING_REDEEM_WINDOW_MS) {
        await clearPendingRedeem();
        setRecovery({ state: 'expired' });
      } else if (pending) {
        setRecovery({ state: 'retrying' });
        try { await finishRedeem(pending); setRecovery(null); }
        catch (error) { setRecovery({ state: error.isNetwork ? 'offline' : 'failed', message: error.message }); }
      }
      setReady(true);
      void reconcileTracking(sessionRef.current);
    })();
    return unsubscribe;
  }, [store, finishRedeem]);

  const signIn = useCallback(
    async (phone, password) => {
      const data = await request('/api/v1/auth/login', { method: 'POST', body: { phone, password }, auth: false });
      if (data?.role !== 'SHIPPER' && data?.role !== 'CARRIER') {
        // Clear the server cookies set by this login so the other account does not linger.
        await request('/api/v1/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${data?.accessToken}` }, auth: false }).catch(() => {});
        throw new ApiError(data?.role === 'DRIVER'
          ? 'Tài xế đăng nhập bằng mã nhận chuyến do chủ xe gửi, không dùng số điện thoại.'
          : 'Ứng dụng hỗ trợ tài khoản Chủ hàng và Chủ xe.', { status: 403 });
      }
      setExpired(false);
      await store(accountSession(data));
    },
    [store],
  );

  const signInWithCode = useCallback(async (input) => {
    const code = normalizeDriverCode(input);
    if (!code) throw new ApiError('Mã nhận chuyến không đúng. Hãy dán hoặc quét đúng mã chủ xe gửi.', { status: 400 });
    const existing = await loadPendingRedeem();
    const pending = existing?.code === code && Date.now() - existing.createdAt <= PENDING_REDEEM_WINDOW_MS
      ? existing : { code, requestId: Crypto.randomUUID(), createdAt: Date.now() };
    await savePendingRedeem(pending);
    setRecovery(null);
    return finishRedeem(pending);
  }, [finishRedeem]);

  /**
   * Driver: stops GPS, then asks the server to revoke the session (access token and GPS stop at once).
   * Returns serverConfirmed=false when offline: the device is signed out but the server did not confirm.
   */
  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    if (isDriverSession(current)) {
      await stopTripTracking();
      let serverConfirmed = false;
      try {
        await request('/api/v1/auth/driver/logout', { method: 'POST' });
        serverConfirmed = true;
      } catch { /* reported to the user below */ }
      // Offline: the phone is signed out but the server did not confirm revoking the session.
      setSignOutNotice(serverConfirmed ? '' : 'Đã thoát trên điện thoại này nhưng chưa xác nhận được với máy chủ. Nếu mất điện thoại, báo chủ xe cấp lại mã nhận chuyến.');
      await store(null);
      await clearPendingRedeem();
      return { serverConfirmed };
    }
    const token = current?.accessToken;
    await store(null); // Cancel native capture/evidence before waiting on network logout.
    try {
      await request('/api/v1/auth/logout', { method: 'POST', auth: false, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch {
      // The local session is cleared regardless; the server cookie expires on its own.
    }
    return { serverConfirmed: true };
  }, [store]);

  const value = useMemo(() => ({ session, ready, expired, recovery, signOutNotice, signIn, signInWithCode, signOut }),
    [expired, ready, recovery, signOutNotice, session, signIn, signInWithCode, signOut]);
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
