// Where a typed address sits on the map. Same rules as the web portal's create-auction hint: the result only moves the
// picker; the shipper still confirms the pin, and nothing is saved from the search alone.
const SEARCH_API = 'https://nominatim.openstreetmap.org/search';
// Nominatim answers 403 to generic library agents such as Android's default "okhttp/4.x", so the app names itself.
// Browsers (Expo web preview) drop this header and send their own, which Nominatim accepts.
const USER_AGENT = 'BackHaulBid/1.1.0 (mobile app)';
const MIN_QUERY_LENGTH = 6;
const VIETNAM = { minLat: 8, maxLat: 24, minLng: 102, maxLng: 110 };

/** Search text from the parts the shipper typed. Empty parts are dropped. */
export function buildHintQuery({ detail, ward, province } = {}) {
  return [detail, ward, province].map((part) => String(part || '').trim()).filter(Boolean).join(', ');
}

/** A search needs the street part and a province; a province alone would only point at a whole area. */
export function isHintReady(address = {}) {
  return Boolean(String(address.detail || '').trim()) && Boolean(String(address.province || '').trim())
    && buildHintQuery(address).length >= MIN_QUERY_LENGTH;
}

/** First search result as a point inside Vietnam, or null when there is no usable result. */
export function parseHintResult(data) {
  const first = Array.isArray(data) ? data[0] : null;
  const latitude = Number(first?.lat), longitude = Number(first?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const inside = latitude >= VIETNAM.minLat && latitude <= VIETNAM.maxLat && longitude >= VIETNAM.minLng && longitude <= VIETNAM.maxLng;
  return inside ? { latitude, longitude } : null;
}

/** Resolves to a point, or null when the address is not found. Rejects when the search itself fails. */
export async function searchAddressHint(address, { fetchImpl = fetch, signal } = {}) {
  const query = buildHintQuery(address);
  const response = await fetchImpl(`${SEARCH_API}?format=json&limit=1&countrycodes=vn&q=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/json', 'Accept-Language': 'vi', 'User-Agent': USER_AGENT },
    signal,
  });
  if (!response.ok) throw new Error('address search failed');
  return parseHintResult(await response.json());
}
