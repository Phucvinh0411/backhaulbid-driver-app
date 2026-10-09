// Gateway endpoints used by the shipper/carrier screens. Mirrors web-portal src/services/*;
// every permission and state rule is enforced by the backend services.
import { request } from './api';

const q = (params = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}` : '';
};
const id = (value) => encodeURIComponent(String(value));
const get = (path, params) => request(`${path}${q(params)}`);
const post = (path, body, headers) => request(path, { method: 'POST', body, headers });
const patch = (path, body) => request(path, { method: 'PATCH', body });
const del = (path) => request(path, { method: 'DELETE' });

/** bidding-service wraps payloads as { data }; lists as { data: { data, pagination } }. */
export const unwrap = (response) => (response && typeof response === 'object' && 'data' in response && !Array.isArray(response) ? response.data : response);
export function toPage(response) {
  const body = unwrap(response);
  if (Array.isArray(body)) return { items: body, pagination: { page: 1, totalPages: 1, totalItems: body.length } };
  const items = Array.isArray(body?.data) ? body.data : Array.isArray(body?.items) ? body.items : [];
  const pagination = body?.pagination || { page: body?.page ?? 1, pageSize: body?.pageSize, totalItems: body?.totalItems ?? items.length, totalPages: body?.totalPages ?? 1 };
  return { items, pagination };
}

/** Loads every page so client-side search and filters cover the full set. */
export async function loadAllPages(fetchPage, { pageSize = 100, maxPages = 10 } = {}) {
  const items = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const { items: pageItems, pagination } = toPage(await fetchPage({ page, pageSize }));
    items.push(...pageItems);
    if (!pagination?.totalPages || page >= pagination.totalPages) return { items, complete: true };
  }
  return { items, complete: false };
}

const bidding = (path) => `/api/v1/bidding${path}`;

export const biddingApi = {
  list: (params) => get(bidding('/auctions'), params),
  get: (auctionId) => get(bidding(`/auctions/${id(auctionId)}`)).then(unwrap),
  create: (payload, idempotencyKey) => post(bidding('/auctions'), payload, { 'X-Idempotency-Key': idempotencyKey }).then(unwrap),
  cancel: (auctionId, reason) => post(bidding(`/auctions/${id(auctionId)}/cancel`), reason ? { reason } : {}).then(unwrap),
  selectWinner: (auctionId, bidId) => post(bidding(`/auctions/${id(auctionId)}/winner`), { bidId }).then(unwrap),
  bids: (auctionId, params) => get(bidding(`/auctions/${id(auctionId)}/bids`), params).then(unwrap),
  placeBid: (auctionId, payload) => post(bidding(`/auctions/${id(auctionId)}/bids`), payload).then(unwrap),
  access: (auctionId) => get(bidding(`/auctions/${id(auctionId)}/registrations/access`)).then(unwrap),
  register: (auctionId, payload) => post(bidding(`/auctions/${id(auctionId)}/registrations`), payload).then(unwrap),
  retryPayment: (auctionId, registrationId, payload) => post(bidding(`/auctions/${id(auctionId)}/registrations/${id(registrationId)}/retry-payment`), payload).then(unwrap),
  cancelRegistration: (auctionId, registrationId) => del(bidding(`/auctions/${id(auctionId)}/registrations/${id(registrationId)}`)),
  myRegistrations: (params) => get(bidding('/my-registrations'), params),
};

export const contractApi = {
  mine: () => get('/api/v1/contracts/mine'),
  get: (contractId) => get(`/api/v1/contracts/${id(contractId)}`),
  sign: (contractId) => patch(`/api/v1/contracts/${id(contractId)}/sign`),
};

export const walletApi = {
  me: () => get('/api/v1/wallets/me'),
  transactions: (params) => get('/api/v1/wallets/me/transactions', params),
  transaction: (transactionId) => get(`/api/v1/wallets/me/transactions/${id(transactionId)}`),
  createTopUp: (amount, returnUrl) => post('/api/v1/payments/sepay/top-ups', returnUrl ? { amount, returnUrl } : { amount }),
  topUps: (params) => get('/api/v1/payments/sepay/top-ups', params),
  topUp: (invoiceNumber) => get(`/api/v1/payments/sepay/top-ups/${id(invoiceNumber)}`),
  cancelTopUp: (invoiceNumber) => post(`/api/v1/payments/sepay/top-ups/${id(invoiceNumber)}/cancel`),
  withdraw: (payload) => post('/api/v1/wallets/me/withdrawals', payload),
  withdrawals: (params) => get('/api/v1/wallets/me/withdrawals', params),
};

export const fleetApi = {
  vehicles: () => get('/api/v1/vehicles/mine'),
  createVehicle: (payload) => post('/api/v1/vehicles', payload),
  updateVehicle: (vehicleId, payload) => patch(`/api/v1/vehicles/${id(vehicleId)}`, payload),
  deactivateVehicle: (vehicleId) => del(`/api/v1/vehicles/${id(vehicleId)}`),
  drivers: () => get('/api/v1/drivers/mine'),
  createDriver: (payload) => post('/api/v1/drivers', payload),
  updateDriver: (driverId, payload) => patch(`/api/v1/drivers/${id(driverId)}`, payload),
  deleteDriver: (driverId) => del(`/api/v1/drivers/${id(driverId)}`),
};

export const carrierProfileApi = {
  company: (carrierId) => get(`/api/v1/business-verifications/public/${id(carrierId)}`),
  vehicles: (carrierId) => get(`/api/v1/vehicles/carrier/${id(carrierId)}`),
  drivers: (carrierId) => get(`/api/v1/drivers/carrier/${id(carrierId)}`),
  reputation: (carrierId) => get(`/api/v1/fleet/reputation/carrier/${id(carrierId)}/history`),
};

export const complaintApi = {
  list: (params) => get('/api/v1/complaints', params),
  get: (complaintId) => get(`/api/v1/complaints/${id(complaintId)}`),
  create: (payload) => post('/api/v1/complaints', payload),
  addMessage: (complaintId, payload) => post(`/api/v1/complaints/${id(complaintId)}/messages`, payload),
};

export const addressApi = {
  list: () => get('/api/v1/addresses'),
  create: (payload) => post('/api/v1/addresses', payload),
  update: (addressId, payload) => patch(`/api/v1/addresses/${id(addressId)}`, payload),
  remove: (addressId) => del(`/api/v1/addresses/${id(addressId)}`),
};

export const notificationApi = {
  mine: () => get('/api/v1/notifications/mine'),
  unreadCount: () => get('/api/v1/notifications/unread-count'),
  markAllRead: () => post('/api/v1/notifications/mark-all-read', {}),
};

export const accountApi = {
  me: () => get('/api/v1/accounts/me'),
  representative: () => get('/api/v1/representative-verifications/me'),
  representativeOverview: (reveal = false) => get('/api/v1/representative-verifications/me/overview', { reveal }),
  business: () => get('/api/v1/business-verifications/me'),
  lookupTaxCode: (taxCode) => get(`/api/v1/business-verifications/lookup/${id(taxCode)}`),
  submitBusiness: (fields) => request('/api/v1/business-verifications', {
    method: 'POST',
    body: Object.entries(fields).filter(([, value]) => value).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&'),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    raw: true,
  }),
};

export const statisticsApi = {
  bidding: (params) => get('/api/v1/bidding/statistics/me', params).then(unwrap),
  trips: (params) => get('/api/v1/trips/statistics/me', params).then(unwrap),
  fleet: (params) => get('/api/v1/fleet/statistics/me', params).then(unwrap),
};

export const newKey = () => globalThis.crypto?.randomUUID?.() || `k-${Date.now()}-${Math.random().toString(16).slice(2)}`;
