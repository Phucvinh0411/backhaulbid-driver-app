import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ActionBar, Banner, Button, Row, Screen, Section, StateView, StatusBadge, TextField, useResource, useSingleFlight } from '@/components/ui';
import DocumentField from '@/components/fleet/DocumentField';
import { accountApi } from '@/lib/services';
import { uploadImage } from '@/lib/media';
import { compareRepresentativeNames } from '@/lib/shared/businessVerification';
import { colors, type } from '@/constants/theme';

const STATUS = {
  NOT_STARTED: { label: 'Chưa bắt đầu', tone: 'neutral' },
  NOT_SUBMITTED: { label: 'Chưa nộp hồ sơ', tone: 'neutral' },
  EKYC_VERIFIED: { label: 'Đã eKYC', tone: 'info' },
  BUSINESS_INFO_FILLED: { label: 'Đã điền thông tin', tone: 'info' },
  REQUIRES_AUTHORIZATION: { label: 'Cần giấy ủy quyền', tone: 'warning' },
  PENDING_DOCUMENTS: { label: 'Cần bổ sung giấy tờ', tone: 'warning' },
  PENDING_ADMIN_REVIEW: { label: 'Đang chờ duyệt', tone: 'warning' },
  PENDING: { label: 'Đang chờ duyệt', tone: 'warning' },
  APPROVED: { label: 'Đã xác minh', tone: 'success' },
  VERIFIED: { label: 'Đã xác minh', tone: 'success' },
  REJECTED: { label: 'Cần bổ sung lại', tone: 'danger' },
  EXPIRED: { label: 'Hồ sơ hết hiệu lực', tone: 'danger' },
};
const REP_STATUS = { VERIFIED: { label: 'Đã xác thực', tone: 'success' }, PENDING: { label: 'Đang xử lý', tone: 'warning' } };
const LOCKED = new Set(['PENDING', 'PENDING_ADMIN_REVIEW', 'APPROVED', 'VERIFIED']);

const normalizeLookup = (data, taxCode) => ({
  valid: Boolean(data?.valid ?? data?.taxCode ?? data?.companyName),
  taxCode: data?.taxCode || taxCode,
  companyName: data?.companyName || data?.name || '',
  address: data?.address || data?.businessAddress || '',
  legalRepresentative: data?.legalRepresentative || data?.representative || data?.legalRepresentativeName || '',
  operationStatus: data?.operationStatus || data?.statusText || '',
  message: data?.message,
});
const representativeName = (data) => data?.fullName || data?.representativeName || data?.identityName || data?.ocrFullName || data?.personalInfo?.fullName || '';

/** Representative eKYC status and business verification, as on the web settings page. */
export default function CompanyScreen() {
  const router = useRouter();
  const { data, setData, state, error, refreshing, reload } = useResource(async () => {
    const [business, representative] = await Promise.all([
      accountApi.business().catch(() => ({ status: 'NOT_SUBMITTED' })),
      accountApi.representative().catch(() => ({ status: 'NOT_SUBMITTED' })),
    ]);
    return { business: business || { status: 'NOT_SUBMITTED' }, representative: representative || { status: 'NOT_SUBMITTED' } };
  }, []);
  const [taxCode, setTaxCode] = useState('');
  const [lookup, setLookup] = useState(null);
  const [lookupMessage, setLookupMessage] = useState('');
  const [license, setLicense] = useState(null);
  const [authorization, setAuthorization] = useState(null);
  const [message, setMessage] = useState({ tone: 'info', text: '' });
  const [busy, run] = useSingleFlight();
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    if (data?.business?.taxCode) {
      setTaxCode((current) => current || data.business.taxCode);
      if (data.business.companyName) setLookup((current) => current || normalizeLookup(data.business, data.business.taxCode));
    }
  }, [data]);

  // Tax code lookup runs shortly after the user stops typing a 10- or 13-digit code.
  useEffect(() => {
    const value = taxCode.trim();
    if (!/^\d{10}(\d{3})?$/.test(value) || lookup?.taxCode === value) return undefined;
    const timer = setTimeout(async () => {
      setLooking(true);
      setLookupMessage('');
      setLookup(null);
      setAuthorization(null);
      try {
        const result = normalizeLookup(await accountApi.lookupTaxCode(value), value);
        if (!result.valid) setLookupMessage(result.message || 'Không tìm thấy doanh nghiệp hợp lệ với mã số thuế này.');
        else { setLookup(result); setLookupMessage('Đã tra cứu và tự điền thông tin doanh nghiệp.'); }
      } catch (failure) {
        setLookupMessage(failure.message);
      } finally {
        setLooking(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [lookup?.taxCode, taxCode]);

  if (state === 'loading') return <StateView kind="loading" title="Đang tải hồ sơ" />;
  if (state === 'error') return <StateView kind="error" title="Không tải được hồ sơ" message={error} actionLabel="Thử lại" onAction={() => reload()} />;

  const business = data.business;
  const representative = data.representative;
  const repName = representativeName(representative);
  const repVerified = representative.status === 'VERIFIED';
  const comparison = compareRepresentativeNames(repName, lookup?.legalRepresentative);
  const requiresAuthorization = comparison === 'MISMATCH';
  const canSubmit = !LOCKED.has(business.status);
  const taxInvalid = taxCode.length >= 10 && !/^\d{10}(\d{3})?$/.test(taxCode);

  const submit = () => run(async () => {
    if (!repVerified) return setMessage({ tone: 'danger', text: 'Cần xác thực người đại diện trước khi gửi hồ sơ doanh nghiệp.' });
    if (!lookup?.valid) return setMessage({ tone: 'danger', text: 'Nhập mã số thuế hợp lệ để hệ thống tự điền thông tin doanh nghiệp.' });
    if (!license) return setMessage({ tone: 'danger', text: 'Vui lòng chọn giấy phép đăng ký kinh doanh.' });
    if (requiresAuthorization && !authorization) return setMessage({ tone: 'danger', text: 'Vui lòng chọn giấy ủy quyền người đại diện.' });
    setMessage({ tone: 'info', text: '' });
    try {
      const businessLicenseUrl = await uploadImage(license, 'business-verifications/licenses');
      const authorizationLetterUrl = requiresAuthorization ? await uploadImage(authorization, 'business-verifications/authorization') : '';
      const result = await accountApi.submitBusiness({ taxCode: lookup.taxCode, ekycRepresentativeName: repName, businessLicenseUrl, authorizationLetterUrl });
      setData((current) => ({ ...current, business: result || current.business }));
      setLicense(null);
      setAuthorization(null);
      setMessage({ tone: 'success', text: 'Hồ sơ đã được gửi và đang chờ ban quản trị xét duyệt.' });
    } catch (failure) {
      setMessage({ tone: 'danger', text: failure.message });
    }
    return undefined;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Hồ sơ doanh nghiệp' }} />
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })} bottomInset={canSubmit ? 100 : 0}>
        {message.text ? <Banner tone={message.tone}>{message.text}</Banner> : null}
        <Section title="1. Người đại diện" right={<StatusBadge {...(REP_STATUS[representative.status] || { label: 'Chưa xác thực', tone: 'neutral' })} />}>
          {repName ? <Row label="Họ tên đã xác thực" value={repName} /> : null}
          {representative.failureReason ? <Text style={type.secondary}>{representative.failureReason}</Text> : null}
          {!repVerified ? <Text style={type.secondary}>Mở mã QR xác thực trên web (Cài đặt tài khoản), rồi quét bằng ứng dụng để đọc căn cước gắn chip.</Text> : null}
          {!repVerified ? <Button label="Quét QR xác thực" variant="secondary" onPress={() => router.push('/verification')} /> : null}
        </Section>

        <Section title="2. Doanh nghiệp" right={<StatusBadge {...(STATUS[business.status] || STATUS.NOT_SUBMITTED)} />}>
          {business.status === 'REJECTED' ? <Banner tone="danger" title="Hồ sơ cần bổ sung">{business.rejectionReason || business.reviewNote || 'Kiểm tra lại giấy tờ rồi gửi lại.'}</Banner> : null}
          {!canSubmit ? (
            <>
              <Row label="Mã số thuế" value={business.taxCode} />
              <Row label="Tên doanh nghiệp" value={business.companyName} />
              <Row label="Địa chỉ" value={business.address} />
            </>
          ) : (
            <>
              <TextField label="Mã số thuế" required value={taxCode} onChangeText={(value) => setTaxCode(value.replace(/\D/g, '').slice(0, 13))} keyboardType="number-pad"
                error={taxInvalid ? 'Mã số thuế phải gồm 10 hoặc 13 chữ số.' : lookup ? undefined : lookupMessage || undefined}
                hint={looking ? 'Đang tra cứu...' : lookup ? lookupMessage : 'Nhập 10 hoặc 13 chữ số; hệ thống tự tra cứu.'} />
              {lookup ? (
                <>
                  <Row label="Tên doanh nghiệp" value={lookup.companyName} />
                  <Row label="Địa chỉ" value={lookup.address} />
                  <Row label="Người đại diện pháp luật" value={lookup.legalRepresentative} />
                  {lookup.operationStatus ? <Row label="Tình trạng" value={lookup.operationStatus} /> : null}
                  {comparison === 'MATCH' ? <Banner tone="success">Tên người đại diện khớp với người đã xác thực.</Banner> : null}
                  {requiresAuthorization ? <Banner tone="warning">Người xác thực khác người đại diện pháp luật. Cần giấy ủy quyền.</Banner> : null}
                </>
              ) : null}
              <DocumentField label="Giấy phép đăng ký kinh doanh" required file={license} onChange={setLicense} onError={(text) => setMessage({ tone: 'danger', text })} disabled={busy} />
              {requiresAuthorization ? <DocumentField label="Giấy ủy quyền người đại diện" required file={authorization} onChange={setAuthorization} onError={(text) => setMessage({ tone: 'danger', text })} disabled={busy} /> : null}
            </>
          )}
        </Section>
      </Screen>
      {canSubmit ? (
        <ActionBar>
          <Button label="Gửi hồ sơ doanh nghiệp" onPress={submit} loading={busy} disabled={!repVerified || !lookup?.valid} />
          {!repVerified ? <Text style={type.caption}>Cần xác thực người đại diện trước.</Text> : null}
        </ActionBar>
      ) : null}
    </View>
  );
}
