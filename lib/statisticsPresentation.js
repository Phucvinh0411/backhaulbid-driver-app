const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export const STAT_RANGES = Object.freeze([
  { value: '7d', label: '7 ngày', days: 7, bucket: 'DAY' },
  { value: '30d', label: '30 ngày', days: 30, bucket: 'DAY' },
  { value: '90d', label: '90 ngày', days: 90, bucket: 'WEEK' },
  { value: '12m', label: '12 tháng', months: 12, bucket: 'MONTH' },
]);

function vietnamDate(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function addMonths(date, months) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

export function statisticsQuery(range, now = new Date()) {
  const selected = STAT_RANGES.find((item) => item.value === range) || STAT_RANGES[1];
  const dateToLocal = vietnamDate(now);
  dateToLocal.setUTCDate(dateToLocal.getUTCDate() + 1);
  const dateFromLocal = selected.months
    ? addMonths(dateToLocal, -selected.months)
    : new Date(dateToLocal);
  if (!selected.months) dateFromLocal.setUTCDate(dateFromLocal.getUTCDate() - selected.days);
  const toInstant = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - VIETNAM_OFFSET_MS);
  return { dateFrom: toInstant(dateFromLocal).toISOString(), dateTo: toInstant(dateToLocal).toISOString(), bucket: selected.bucket };
}

export function formatStatCount(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('vi-VN').format(value)
    : '—';
}

export function formatStatCurrency(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
    : '—';
}

export function normalizeBreakdown(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item.status === 'string');
  if (value && typeof value === 'object') return Object.entries(value).map(([status, count]) => ({ status, count }));
  return [];
}
