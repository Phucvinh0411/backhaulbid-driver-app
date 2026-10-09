/** Pairing metadata only; never accept origins, roles, accounts or access tokens from a QR. */
export function parseVerificationQr(raw) {
  if (typeof raw !== 'string' || raw.length > 512) throw new Error('Mã QR xác thực không hợp lệ.');
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('Mã QR xác thực không hợp lệ.'); }
  if (!value || Array.isArray(value) || value.v !== 1 ||
      Object.keys(value).sort().join(',') !== 'pairingToken,sessionId,v' ||
      typeof value.sessionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.sessionId) ||
      typeof value.pairingToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value.pairingToken)) {
    throw new Error('Mã QR xác thực không hợp lệ. Hãy tạo mã mới trên web BackHaulBid.');
  }
  return { sessionId: value.sessionId.toLowerCase(), pairingToken: value.pairingToken };
}
