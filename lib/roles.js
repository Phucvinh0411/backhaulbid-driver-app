import { isDriverSession } from './sessionModel.js';

const LABELS = Object.freeze({ SHIPPER: 'Chủ hàng', CARRIER: 'Chủ xe', DRIVER: 'Tài xế' });

export const supportsRole = (role) => Object.hasOwn(LABELS, role);
export const roleLabel = (role) => LABELS[role] || 'Tài khoản';
export const sameAccount = (a, b) => Boolean(a?.accountId && b?.accountId && a.accountId === b.accountId && a.role === b.role);

const OWNERS = ['SHIPPER', 'CARRIER'];

// Bottom tabs per owner role. A driver code session has its own, smaller set (DRIVER_TABS).
export const TAB_ROLES = Object.freeze({
  index: OWNERS,
  auctions: OWNERS,
  trips: OWNERS,
  wallet: OWNERS,
  fleet: ['CARRIER'],
  history: [],
  notifications: OWNERS,
  more: OWNERS,
  account: OWNERS,
});
// One trip per driver session: no history, and no account-wide notifications (blocked by the gateway).
const DRIVER_TABS = Object.freeze(['index', 'account']);

// First path segment outside the tabs -> owner roles that may open it.
const ROUTE_ROLES = Object.freeze({
  business: OWNERS,
  verification: OWNERS,
  auctions: OWNERS,
  registrations: ['CARRIER'],
  contracts: OWNERS,
  complaints: OWNERS,
  fleet: ['CARRIER'],
  addresses: ['SHIPPER'],
  carriers: ['SHIPPER'],
  company: OWNERS,
  statistics: OWNERS,
});
const PUBLIC_ROOTS = ['login', 'driver-code', 'register', '+not-found'];

// Backend Account.role is singular. Changing context requires another sign-in; a role selector must never
// mutate the current JWT role. The backend stays the authority; this only keeps users out of screens they
// cannot use. `who` is the stored session (or an owner role string, kept for older call sites/tests).
export function canAccessRoute(who, segments = []) {
  const [root, leaf] = segments;
  if (!root || PUBLIC_ROOTS.includes(root)) return Boolean(who);
  if (typeof who === 'object' && isDriverSession(who)) {
    if (root === '(tabs)') return DRIVER_TABS.includes(leaf || 'index');
    // The trip screen also checks that the trip in the URL is the session's own trip.
    return root === 'trips';
  }
  const role = typeof who === 'string' ? who : who?.role;
  if (!OWNERS.includes(role)) return false;
  if (root === '(tabs)') return (TAB_ROLES[leaf || 'index'] || []).includes(role);
  if (root === 'auctions' && leaf === 'new') return role === 'SHIPPER';
  return (ROUTE_ROLES[root] || []).includes(role);
}

export function tabVisible(who, name) {
  if (typeof who === 'object' && isDriverSession(who)) return DRIVER_TABS.includes(name);
  const role = typeof who === 'string' ? who : who?.role;
  return (TAB_ROLES[name] || []).includes(role);
}
