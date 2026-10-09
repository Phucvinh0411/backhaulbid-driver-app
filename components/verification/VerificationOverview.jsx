import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Button, Row, Section, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { nfcResultPresentation, ownerHasMaskedField, ownerIdentityRows, ownerStatusPresentation } from '@/lib/shared/verification';
import { colors, type } from '@/constants/theme';

/**
 * Owner's eKYC result: status, one short reason and five identity rows. Checks, method and evidence
 * images stay in the admin review. A response is kept only for the account that requested it, so a
 * logout or account switch during loading never shows the previous owner's data.
 */
export default function VerificationOverview({ refreshKey = 0, fallback, onLoaded, onRetry }) {
  const { session } = useAuth();
  const owner = session?.accountId;
  const [loaded, setLoaded] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let live = true;
    setError('');
    api.get(`/api/v1/representative-verifications/me/overview?reveal=${reveal}`)
      .then((value) => { if (live && value?.status) { setLoaded({ owner, summary: value }); onLoaded?.(value); } })
      .catch((e) => { if (live && e.status !== 404) setError(e.message); });
    return () => { live = false; };
    // onLoaded is a notification callback; refetching when it changes identity is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, refreshKey, reveal, generation]);
  const summary = loaded?.owner === owner ? loaded.summary : null;
  if (!summary && !fallback && !error) return null;
  // Before the server summary exists, the capture result only describes what was just read.
  const status = summary ? ownerStatusPresentation(summary) : { ...nfcResultPresentation(fallback), action: 'refresh' };
  const verified = summary?.status === 'VERIFIED';
  return <Section title={status.title} right={<StatusBadge label={verified ? 'Đã xác thực' : status.tone === 'danger' ? 'Chưa đạt' : 'Đang xử lý'} tone={status.tone} />}>
    {status.message ? <Text style={type.secondary}>{status.message}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={[type.secondary, { color: colors.danger }]}>{error}</Text> : null}
    {verified ? ownerIdentityRows(summary).map(([label, value]) => <Row key={label} label={label} value={value} />) : null}
    {verified && ownerHasMaskedField(summary) ? <Button label="Hiện ngày sinh" variant="secondary" onPress={() => setReveal(true)} /> : null}
    {verified && reveal ? <Button label="Ẩn ngày sinh" variant="secondary" onPress={() => setReveal(false)} /> : null}
    {status.action === 'retry' && onRetry ? <Button label="Thực hiện lại" onPress={onRetry} /> : null}
    {status.action === 'refresh' ? <Button label="Cập nhật kết quả" variant="secondary" onPress={() => setGeneration((v) => v + 1)} /> : null}
  </Section>;
}
