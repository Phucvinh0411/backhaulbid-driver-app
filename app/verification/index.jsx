import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Section, StateView } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, request, getNativeAccessToken, API_BASE_URL } from '@/lib/api';
import { parseVerificationQr } from '@/lib/verificationQr';
import EkycNative from '@/modules/backhaulbid-ekyc';
import VerificationOverview from '@/components/verification/VerificationOverview';
import { colors, space, type } from '@/constants/theme';

const PATH = '/api/v1/representative-verifications/sessions';
const ERROR_LABELS = {
  INVALID_REQUEST: 'Thời gian phiên không hợp lệ. Kiểm tra ngày giờ điện thoại rồi tạo mã mới trên web.',
  NFC_UNAVAILABLE: 'Điện thoại chưa có NFC hoặc NFC đang tắt.',
  BIOMETRIC_MODEL_UNAVAILABLE: 'Bản ứng dụng này chưa có bộ kiểm tra khuôn mặt.',
  SESSION_EXPIRED: 'Phiên đã hết hạn. Tạo mã mới trên web.',
  HOST_RECREATED: 'Phiên bị gián đoạn. Tạo mã mới trên web.',
};

/** Ignores best-effort session cancellation errors while leaving the screen. */
function ignoreCancellationFailure() {}

/** Guards the NFC route behind an authenticated shipper/carrier session. */
export default function VerificationGate() {
  const { session, ready } = useAuth();
  // Wait for the stored session; redirecting earlier would drop deep links.
  if (!ready || !session) return null;
  if (!['SHIPPER', 'CARRIER'].includes(session?.role)) return <Redirect href="/" />;
  return <VerificationScreen key={session.accountId} />;
}

/** Owns QR pairing, mobile capture, evidence upload and live session cleanup. */
function VerificationScreen() {
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [pair, setPair] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const locked = useRef(false);
  const alive = useRef(true);
  const sessionId = useRef(null);
  const deviceNonce = useRef(null);
  const captureGrant = useRef(null);

  useEffect(
    /** Checks device readiness and releases app/session resources on exit. */
    () => {
    alive.current = true;
    /** Tracks whether the camera preview can safely remain active. */
    const handleAppStateChange = (state) => setForeground(state === 'active');
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    /** Resolves NFC, camera, model and backend availability before scanning QR. */
    const check = async () => {
      if (Platform.OS !== 'android' || !EkycNative) { setPhase('unsupported'); return; }
      try {
        const [backend, phone] = await Promise.all([api.get(`${PATH}/capabilities`), EkycNative.capabilities()]);
        if (!alive.current) return;
        if (!backend.enabled) { setError('Luồng NFC chưa được bật trên hệ thống.'); setPhase('unavailable'); return; }
        if (!phone.nfcSupported || !phone.nfcEnabled || !phone.cameraSupported || !phone.modelsAvailable) {
          setError(!phone.nfcSupported ? 'Điện thoại này không hỗ trợ NFC.' : !phone.nfcEnabled ? 'Bật NFC trong cài đặt điện thoại rồi mở lại màn này.' : !phone.modelsAvailable ? 'Bản ứng dụng này chưa có bộ kiểm tra khuôn mặt.' : 'Điện thoại chưa có camera phù hợp.');
          setPhase('unavailable'); return;
        }
        setPhase('scan');
      } catch (e) { if (alive.current) { setError(e.message); setPhase('unavailable'); } }
    };
    void check();

    /** Cancels native work and the account-owned backend session on exit. */
    return () => {
      alive.current = false; subscription.remove();
      void EkycNative?.cancel();
      if (sessionId.current) void request(`${PATH}/${sessionId.current}/cancel`, {
        method: 'POST', auth: false, headers: { Authorization: `Bearer ${session.accessToken}` },
      }).catch(ignoreCancellationFailure);
      deviceNonce.current = null; captureGrant.current = null;
    };
  }, []);

  useEffect(
    /** Polls the paired session until web approval or termination. */
    () => {
    if (!pair || phase !== 'paired') return undefined;
    let running = false;
    /** Reads the server state and advances or stops the capture flow. */
    const poll = async () => {
      if (running) return; running = true;
      try {
        const status = await api.get(`${PATH}/${pair.sessionId}`);
        if (!alive.current) return;
        if (status.state === 'APPROVED') setPhase('approved');
        if (['EXPIRED', 'CANCELLED'].includes(status.state)) { setError('Phiên đã kết thúc. Tạo mã mới trên web.'); setPhase('unavailable'); void EkycNative?.cancel(); }
      } catch (e) { if (alive.current) setError(e.message); }
      finally { running = false; }
    };
    void poll(); const interval = setInterval(poll, 2000);
    /** Stops polling when the paired phase ends or the screen unmounts. */
    return () => clearInterval(interval);
  }, [pair, phase]);

  /** Validates a scanned web QR and pairs this authenticated device to it. */
  const scanned = async ({ data }) => {
    if (locked.current) return; locked.current = true; setError('');
    try {
      const qr = parseVerificationQr(data);
      // Nonce is random metadata, generated by the native host, never derived from the card.
      deviceNonce.current = await EkycNative.newDeviceNonce();
      const paired = await api.post(`${PATH}/${qr.sessionId}/pair`, { pairingToken: qr.pairingToken, deviceNonce: deviceNonce.current });
      sessionId.current = qr.sessionId;
      if (!alive.current) {
        void request(`${PATH}/${qr.sessionId}/cancel`, {
          method: 'POST', auth: false, headers: { Authorization: `Bearer ${session.accessToken}` },
        }).catch(ignoreCancellationFailure);
        return;
      }
      setPair(paired); setPhase('paired');
    } catch (e) { if (alive.current) { setError(e.message); locked.current = false; } }
  };

  /** Uploads captured evidence and refreshes the native token if its first use expires. */
  const upload = async () => {
    setPhase('uploading'); setError('');
    try {
      /** Sends the same capture receipt using the supplied native access token. */
      const send = (accessToken) => EkycNative.upload({ apiBaseUrl: API_BASE_URL, accountId: session.accountId,
        sessionId: pair.sessionId, accessToken, deviceNonce: deviceNonce.current,
        uploadGrant: captureGrant.current });
      let receipt;
      try { receipt = await send(await getNativeAccessToken(session)); }
      catch (e) {
        if (e.code !== 'ERR_EKYC_AUTH_REQUIRED') throw e;
        receipt = await send(await getNativeAccessToken(session, { refresh: true }));
      }
      if (!alive.current) return;
      if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(receipt.status)) throw new Error('Không nhận được trạng thái kiểm tra hợp lệ.');
      setReceipt({ ...receipt, captureConclusion: receipt.conclusion });
      setPhase('completed'); captureGrant.current = null;
    } catch (e) { if (alive.current) { setError(e.message || 'Không gửi được dữ liệu.'); setPhase('upload_retry'); } }
  };

  /** Starts an approved NFC capture and sends completed evidence to the server. */
  const capture = async () => {
    setPhase('capturing'); setError('');
    try {
      const approved = await api.post(`${PATH}/${pair.sessionId}/ready`, { deviceNonce: deviceNonce.current });
      if (!alive.current) return;
      if (approved.accountId !== session.accountId || approved.role !== session.role) throw new Error('Tài khoản của phiên không khớp.');
      captureGrant.current = approved.uploadGrant;
      const result = await EkycNative.capture({ sessionId: approved.sessionId, accountId: approved.accountId,
        role: approved.role, policyVersion: approved.policyVersion, expiresAtMillis: String(Date.parse(approved.expiresAt)) });
      if (!alive.current) return;
      if (result.status === 'CAPTURED') await upload();
      else { setError(ERROR_LABELS[result.error] || (result.status === 'CANCELLED' ? 'Bạn đã dừng thu thập dữ liệu.' : 'Chưa thu thập được đủ dữ liệu.')); setPhase('approved'); }
    } catch (e) { if (alive.current) { setError(e.message); setPhase('approved'); } }
  };

  /** Reflects the server's reviewed status in the UI after loading the summary. */
  const handleReportLoaded = (report) => setAccepted(report.status === 'VERIFIED');

  return <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
    <Section title="Xác thực người đại diện">
      <Text style={type.secondary}>Mở xác thực trên web BackHaulBid rồi quét mã QR tại đây. Hai thiết bị phải đăng nhập cùng tài khoản.</Text>
      <Text style={type.secondary}>Kết quả được cập nhật theo từng bước kiểm tra. Bạn có thể xem lại hồ sơ sau khi hoàn tất; không cần mở hồ sơ để gửi kết quả.</Text>
    </Section>
    <VerificationOverview key={receipt?.receiptId || session.accountId} refreshKey={receipt?.receiptId || 0} fallback={receipt} onLoaded={handleReportLoaded} />
    {error ? <Text accessibilityRole="alert" style={[type.secondary, { color: colors.danger }]}>{error}</Text> : null}
    {phase === 'loading' && <StateView kind="loading" title="Đang kiểm tra thiết bị" />}
    {phase === 'unsupported' && <StateView title="Cần ứng dụng Android có NFC" message="Mở bản cài đặt BackHaulBid trên điện thoại Android hỗ trợ NFC. Trình duyệt và Expo Go chưa hỗ trợ luồng này." />}
    {phase === 'scan' && !accepted && (!permission?.granted ? <Button label="Cho phép camera quét QR" onPress={requestPermission} /> :
      <View style={{ height: 280, borderRadius: 12, overflow: 'hidden' }}>
        {foreground && <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned} />}
      </View>)}
    {phase === 'paired' && <Section title="Xác nhận trên web">
      <Text style={type.secondary}>Chọn đúng mã hiển thị bên dưới trên web của bạn.</Text>
      <Text selectable style={[type.title, { textAlign: 'center', letterSpacing: 4 }]}>{pair.confirmationCode}</Text>
      <Text style={type.secondary}>Đang chờ bạn cho phép điện thoại này tiến hành xác thực.</Text>
    </Section>}
    {phase === 'approved' && <Section title="Điện thoại đã được chấp nhận">
      <Text style={type.secondary}>Chuẩn bị căn cước gắn chip và nơi đủ sáng. Bạn sẽ chụp giấy tờ, đọc NFC và làm theo hướng dẫn khuôn mặt.</Text>
      <Button label="Bắt đầu xác thực" onPress={capture} />
    </Section>}
    {['capturing', 'uploading'].includes(phase) && <StateView kind="loading" title={phase === 'uploading' ? 'Đang gửi bằng chứng' : 'Đang thu thập dữ liệu'} />}
    {phase === 'upload_retry' && <Button label="Gửi lại bằng chứng" onPress={upload} />}
  </ScrollView>;
}
