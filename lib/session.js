import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { normalizeSession, sameScope } from './sessionModel';

// Native: tokens live in the OS keychain/keystore. Web (testing only): sessionStorage,
// cleared when the tab closes.
const KEY = 'backhaulbid.driver.session';
const listeners = new Set();
let pendingWrite = Promise.resolve();
export const subscribeSession = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
const write = (work) => { const next = pendingWrite.then(work, work); pendingWrite = next.catch(() => {}); return next; };
const emit = (session) => { for (const listener of listeners) listener(session); };

export async function loadSession() {
  try {
    const raw = Platform.OS === 'web' ? globalThis.sessionStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    // Older or incomplete shapes never restore a session (see sessionModel.normalizeSession).
    return raw ? normalizeSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  return write(async () => {
    const raw = JSON.stringify(session);
    if (Platform.OS === 'web') globalThis.sessionStorage?.setItem(KEY, raw);
    else await SecureStore.setItemAsync(KEY, raw);
    emit(session);
  });
}

export async function clearSession() {
  return write(async () => {
    if (Platform.OS === 'web') globalThis.sessionStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
    emit(null);
  });
}

// An old refresh cannot resurrect a logout or replace the next user's credentials.
export async function replaceSessionIfCurrent(expected, next) {
  return write(async () => {
    const current = await loadSession();
    if (!current || !sameScope(current, expected)
      || current.accessToken !== expected.accessToken || current.refreshToken !== expected.refreshToken) return false;
    const raw = JSON.stringify(next);
    if (Platform.OS === 'web') globalThis.sessionStorage?.setItem(KEY, raw);
    else await SecureStore.setItemAsync(KEY, raw);
    emit(next);
    return true;
  });
}

// A driver code redeem in flight: saved before the request so a crash or lost response can retry with
// the same code + request ID. Removed once the session is stored, or when the recovery window ends.
const PENDING_KEY = 'backhaulbid.driver.pendingRedeem';
export const PENDING_REDEEM_WINDOW_MS = 2 * 60 * 1000;

export async function loadPendingRedeem() {
  try {
    const raw = Platform.OS === 'web' ? globalThis.sessionStorage?.getItem(PENDING_KEY) : await SecureStore.getItemAsync(PENDING_KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value?.code && value?.requestId && Number.isFinite(value.createdAt) ? value : null;
  } catch {
    return null;
  }
}

export async function savePendingRedeem(value) {
  const raw = JSON.stringify(value);
  if (Platform.OS === 'web') globalThis.sessionStorage?.setItem(PENDING_KEY, raw);
  else await SecureStore.setItemAsync(PENDING_KEY, raw);
}

export async function clearPendingRedeem() {
  if (Platform.OS === 'web') globalThis.sessionStorage?.removeItem(PENDING_KEY);
  else await SecureStore.deleteItemAsync(PENDING_KEY).catch(() => {});
}

