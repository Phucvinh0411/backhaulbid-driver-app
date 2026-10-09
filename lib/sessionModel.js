// Session union stored by the app (version 2):
//   ACCOUNT            - shipper/carrier signed in with phone + password (accountId is an Account)
//   DRIVER_ASSIGNMENT  - driver signed in with a "mã nhận chuyến", scoped to one trip (no Account)
// A driver session ID is never used as an account ID; everything that must not mix two sign-ins
// compares scopeKey().
export const SESSION_VERSION = 2;
export const ACCOUNT = 'ACCOUNT';
export const DRIVER_ASSIGNMENT = 'DRIVER_ASSIGNMENT';
const OWNER_ROLES = ['SHIPPER', 'CARRIER'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isDriverSession = (session) => session?.type === DRIVER_ASSIGNMENT;
export const isOwnerSession = (session) => session?.type === ACCOUNT && OWNER_ROLES.includes(session.role);

/** Stable identity of a sign-in: changes when the account, the trip or the assignment version changes. */
export function scopeKey(session) {
  if (isDriverSession(session)) return `D:${session.sessionId}:${session.tripId}:${session.assignmentVersion}`;
  if (session?.type === ACCOUNT) return `A:${session.accountId}:${session.role}`;
  return '';
}

export const sameScope = (a, b) => Boolean(scopeKey(a)) && scopeKey(a) === scopeKey(b);

/** Native eKYC may only run for a signed-in shipper or carrier account. */
export const ekycAccountOf = (session) => (isOwnerSession(session) ? session.accountId : null);

export function accountSession(data) {
  return { v: SESSION_VERSION, type: ACCOUNT, subjectId: data.accountId, accountId: data.accountId, role: data.role, phone: data.phone,
    accessToken: data.accessToken, refreshToken: data.refreshToken };
}

/** Builds the stored session from /api/v1/auth/driver/redeem or /refresh. */
export function driverSession(data) {
  const view = data?.session || {};
  return { v: SESSION_VERSION, type: DRIVER_ASSIGNMENT, role: 'DRIVER', subjectId: view.sessionId, sessionId: view.sessionId,
    tripId: view.tripId, driverProfileId: view.driverProfileId, assignmentId: view.assignmentId,
    assignmentVersion: Number(view.assignmentVersion), accessToken: data?.accessToken, refreshToken: data?.refreshToken,
    refreshExpiresAt: data?.refreshExpiresAt || null };
}

/**
 * Accepts only complete sessions. Older stored shapes (no `v`) become ACCOUNT sessions for owners; a
 * legacy DRIVER *account* session is dropped: drivers now sign in with a code only.
 */
export function normalizeSession(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.v === SESSION_VERSION && raw.type === DRIVER_ASSIGNMENT) {
    const ok = UUID.test(raw.sessionId || '') && UUID.test(raw.tripId || '') && UUID.test(raw.driverProfileId || '')
      && Number.isInteger(raw.assignmentVersion) && raw.accessToken && raw.refreshToken && raw.role === 'DRIVER';
    return ok ? { ...raw, subjectId: raw.sessionId } : null;
  }
  const account = raw.v === SESSION_VERSION ? raw : { ...raw, type: ACCOUNT };
  if (account.type !== ACCOUNT || !OWNER_ROLES.includes(account.role) || !account.accountId || !account.accessToken) return null;
  return accountSession(account);
}

/** Same rule the server applies: "<uuidv7>.<43 base64url>"; whitespace from paste/QR is removed. */
export function normalizeDriverCode(input) {
  const value = String(input || '').replace(/[\s​-‍﻿]/g, '');
  const dot = value.indexOf('.');
  if (dot < 0 || value.indexOf('.', dot + 1) >= 0) return null;
  const id = value.slice(0, dot).toLowerCase(), secret = value.slice(dot + 1);
  if (!UUID.test(id) || id[14] !== '7' || !/^[89ab]$/.test(id[19]) || !/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
  return `${id}.${secret}`;
}
