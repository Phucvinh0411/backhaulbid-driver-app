import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Banner, Button, Row, Screen, Section, StatusBadge, Tabs, useResource } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { roleLabel } from '@/lib/roles';
import { accountApi } from '@/lib/services';
import { type } from '@/constants/theme';
import VerificationOverview from '@/components/verification/VerificationOverview';
import { isDriverSession } from '@/lib/sessionModel';
import { shortId } from '@/lib/trips';

const REP_STATUS = { VERIFIED: { label: 'Đã xác thực', tone: 'success' }, PENDING: { label: 'Đang xử lý', tone: 'warning' } };

export default function AccountScreen() {
  const { session } = useAuth();
  if (!session) return null;
  return isDriverSession(session) ? <DriverSessionAccount /> : <OwnerAccount />;
}

/** A driver code session has no account: show what it is scoped to and let the driver sign out. */
function DriverSessionAccount() {
  const { session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <Screen>
      <Section title="Phiên tài xế">
        <Row label="Đăng nhập bằng" value="Mã nhận chuyến" />
        <Row label="Chuyến" value={`#${shortId(session.tripId)}`} />
        <Row label="Phân công" value={`Lần ${session.assignmentVersion}`} />
        <Text style={type.secondary}>
          Phiên này chỉ dùng cho chuyến được giao. Bạn ghi nhận hành trình, chia sẻ vị trí, gửi ảnh giao hàng và check-in cột mốc. Chủ hàng xác nhận hoàn thành; bạn không tự hoàn thành hoặc hủy chuyến.
        </Text>
      </Section>
      <Button label={signingOut ? 'Đang đăng xuất...' : 'Đăng xuất'} variant="danger" loading={signingOut} onPress={async () => {
        setSigningOut(true);
        // The sign-in screen shows whether the server confirmed the revocation.
        await signOut();
      }} />
    </Screen>
  );
}

function OwnerAccount() {
  const router = useRouter();
  const { session } = useAuth();
  const owner = session?.role === 'SHIPPER' || session?.role === 'CARRIER';
  const [section, setSection] = useState('account');
  const profile = useResource(async () => {
    const [me, representative] = await Promise.all([
      accountApi.me(),
      owner ? accountApi.representative().catch(() => null) : Promise.resolve(null),
    ]);
    return { me, representative };
  }, [owner]);
  const businessProfile = useResource(() => accountApi.business(), [owner]);
  const me = profile.data?.me;
  const representative = profile.data?.representative;
  const business = businessProfile.data?.data ?? businessProfile.data;
  const companyState = businessProfile.state;
  const refreshProfile = () => {
    void profile.reload({ pull: true });
    if (owner) void businessProfile.reload({ pull: true });
  };
  const verifiedBusiness = ['APPROVED', 'VERIFIED'].includes(business?.status);
  const businessStatus = verifiedBusiness
    ? { label: 'Đã xác minh', tone: 'success' }
    : business?.status === 'PENDING' ? { label: 'Đang xử lý', tone: 'warning' }
      : business?.status === 'REJECTED' ? { label: 'Cần bổ sung', tone: 'danger' }
        : { label: 'Chưa gửi', tone: 'neutral' };

  return (
    <Screen refreshing={profile.refreshing || businessProfile.refreshing} onRefresh={refreshProfile}>
      <Tabs label="Nhóm thông tin hồ sơ" value={section} onChange={setSection} options={[
        { value: 'account', label: 'Tài khoản' },
        { value: 'business', label: 'Doanh nghiệp' },
        { value: 'representative', label: 'Đại diện' },
      ]} />
      {section === 'account' ? <Section title={`Tài khoản ${roleLabel(session?.role).toLowerCase()}`}>
        <Row label="Họ tên" value={me?.fullName} />
        <Row label="Số điện thoại" value={me?.phone || session?.phone} />
        <Row label="Email" value={me?.email} />
        <Row label="Vai trò" value={roleLabel(session?.role)} />
        {profile.state === 'error' ? <Text style={type.caption}>Chưa tải được hồ sơ: {profile.error}</Text> : null}
      </Section> : null}
      {section === 'business' ? <>
        {companyState === 'error' ? <Banner tone="danger" title="Không tải được hồ sơ doanh nghiệp">{businessProfile.error}</Banner> : null}
        {companyState === 'loading' ? <Section title="Doanh nghiệp"><Text style={type.secondary}>Đang tải thông tin…</Text></Section> : null}
        {companyState === 'ready' ? <Section title="Doanh nghiệp" right={<StatusBadge {...businessStatus} />}>
          <Row label="Tên doanh nghiệp" value={business?.companyName} />
          <Row label="Mã số thuế" value={business?.taxCode} />
          <Row label="Địa chỉ đăng ký" value={business?.address} />
          <Row label="Người đại diện" value={business?.legalRepresentative} />
          {business?.rejectionReason ? <Text style={type.secondary}>{business.rejectionReason}</Text> : null}
          <Button label="Mở hồ sơ doanh nghiệp" variant="secondary" onPress={() => router.push('/company')} />
        </Section> : null}
      </> : null}
      {section === 'representative' ? <>
        <Section title="Người đại diện" right={<StatusBadge {...(representative?.status === 'VERIFIED' && representative?.verificationMethod === 'LOCAL_NFC_DEVELOPMENT' ? { label: 'Kiểm tra NFC hoàn tất', tone: 'success' } : representative?.status === 'VERIFIED' && representative?.verificationMethod === 'MANUAL_DOCUMENT_REVIEW' ? { label: 'Hồ sơ đã duyệt', tone: 'success' } : REP_STATUS[representative?.status] || { label: 'Chưa xác thực', tone: 'neutral' })} />}>
          {representative?.fullName ? <Row label="Họ tên đã xác thực" value={representative.fullName} /> : null}
          {representative?.failureReason ? <Text style={type.secondary}>{representative.failureReason}</Text> : null}
        </Section>
        <VerificationOverview key={session.accountId} onRetry={() => router.push('/verification')} />
        <Button label="Mở xác thực người đại diện" variant="secondary" onPress={() => router.push('/verification')} />
      </> : null}
      {section === 'account' ? <Section title="Chuyển tài khoản">
        <Text style={type.secondary}>Mỗi tài khoản có vai trò do hệ thống cấp. Để dùng vai trò khác, đăng xuất rồi đăng nhập tài khoản tương ứng.</Text>
      </Section> : null}
    </Screen>
  );
}
