import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { uploadImage } from '@/lib/media';
import { formatDateTime, isClosed, statusOf } from '@/lib/trips';
import { getCarrierSteps, getCompletionSummary, getOwnerNextStep, validateMilestone } from '@/lib/tracking';
import { Button, FieldError, Section, StateView, StatusBadge } from '@/components/ui';
import Sheet from '@/components/Sheet';
import ProofImage from '@/components/ProofImage';
import JourneyOverview from '@/components/tracking/JourneyOverview';
import RoutePinsSheet from '@/components/tracking/RoutePinsSheet';
import DriverCodeQr from '@/components/DriverCodeQr';
import TripReviewSection from '@/components/reviews/TripReviewSection';
import { colors, radius, space, TOUCH, type, fonts } from '@/constants/theme';

const asList = (value) => (Array.isArray(value) ? value : value?.data || []);
const money = new Intl.NumberFormat('vi-VN');
const formatMoney = (value) => (value === null || value === undefined ? '—' : `${money.format(Number(value))} ₫`);

export default function BusinessTripGate() {
  const { session, ready } = useAuth();
  // Wait for the stored session; redirecting earlier would drop deep links.
  if (!ready || !session) return null;
  if (!['SHIPPER', 'CARRIER'].includes(session?.role)) return <Redirect href="/" />;
  return <BusinessTrip key={`${session.accountId}:${session.role}`} role={session.role} />;
}

function Banner({ tone = 'success', title, children }) {
  const palette = { success: [colors.successSoft, colors.success], warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger], info: [colors.infoSoft, colors.info] }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette[0] }]} accessibilityLiveRegion="polite">
      {title ? <Text style={[styles.bannerTitle, { color: palette[1] }]}>{title}</Text> : null}
      {children ? <Text style={{ color: palette[1], fontSize: 14, lineHeight: 20 }}>{children}</Text> : null}
    </View>
  );
}

function BusinessTrip({ role }) {
  const { tripId } = useLocalSearchParams();
  const id = encodeURIComponent(String(tripId));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState(null);
  const [events, setEvents] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const generation = useRef(0), loadFlight = useRef(false);
  const [pinsOpen, setPinsOpen] = useState(false);

  const [sheet, setSheet] = useState(null); // 'confirm' | 'accept' | 'lateCancel' | 'incident' | 'proof' | 'assign' | 'milestone' | 'code'
  const [confirmStep, setConfirmStep] = useState(null);
  const [sheetError, setSheetError] = useState('');
  const [note, setNote] = useState('');
  const [proofAsset, setProofAsset] = useState(null);
  const [savedProofUrl, setSavedProofUrl] = useState('');
  const [drivers, setDrivers] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState({ name: '', lat: '', lng: '' });
  const [milestoneErrors, setMilestoneErrors] = useState({});

  const load = useCallback(async ({ pull = false } = {}) => {
    if (loadFlight.current) return;
    loadFlight.current = true;
    const token = ++generation.current;
    if (pull) setRefreshing(true);
    try {
      const tripData = await api.get(`/api/v1/trips/${id}`);
      const [eventData, proofData, milestoneData, settlementData] = await Promise.all([
        api.get(`/api/v1/trips/${id}/journey-events`).catch(() => []),
        api.get(`/api/v1/trips/${id}/delivery-proofs`).catch(() => []),
        api.get(`/api/v1/trips/${id}/milestones`).catch(() => []),
        api.get(`/api/v1/trips/${id}/delay-settlements`).catch(() => []),
      ]);
      if (token !== generation.current) return;
      setTrip(tripData);
      setEvents(asList(eventData).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)));
      setProofs(asList(proofData));
      setMilestones(asList(milestoneData).sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0)));
      setSettlements(asList(settlementData).sort((a, b) => (a.tier || 0) - (b.tier || 0)));
      setError('');
      setState('ready');
    } catch (loadError) {
      if (token !== generation.current) return;
      setError(loadError.message);
      if ([401, 403, 404].includes(loadError.status)) { setTrip(null); setEvents([]); setProofs([]); setState(loadError.status === 403 ? 'forbidden' : 'error'); }
        else setState((current) => (current === 'ready' ? 'ready' : 'error'));
    } finally {
      loadFlight.current = false;
      if (token === generation.current) setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); const timer = setInterval(() => { if (AppState.currentState === 'active' && globalThis.document?.visibilityState !== 'hidden') void load(); }, 15_000); return () => { clearInterval(timer); generation.current++; }; }, [load]));

  const completion = useMemo(() => getCompletionSummary(trip, events), [trip, events]);

  const singleFlight = async (work) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const openSheet = (name) => {
    setSheetError('');
    setNotice('');
    setActionError('');
    setSheet(name);
  };
  const closeSheet = () => {
    if (busy) return;
    setSheet(null);
    setNote('');
    setProofAsset(null);
    setSavedProofUrl('');
    setSheetError('');
  };

  const run = (work, success) =>
    singleFlight(async () => {
      setSheetError('');
      try {
        await work();
        setSheet(null);
        setNote('');
        setNotice(success);
      } catch (failure) {
        setSheetError(failure.message);
      }
      await load();
    });

  const recordStep = (step) => run(
    () => api.post(`/api/v1/trips/${id}/journey-events`, { eventType: step.eventType, ...(step.status ? { status: step.status } : {}) }),
    `Đã ghi nhận: ${step.label}.`,
  );
  const acceptDelivery = () => run(
    () => api.post(`/api/v1/trips/${id}/journey-events`, { eventType: 'DELIVERY_ACCEPTED', status: 'COMPLETED', note: note.trim() || undefined }),
    'Đã xác nhận nhận hàng. Đơn hàng hoàn tất.',
  );
  const cancelLate = () => run(
    () => api.post(`/api/v1/trips/${id}/cancel-late`, { reason: note.trim() || 'Chủ hàng hủy do giao trễ hơn 1 giờ' }),
    'Đã hủy chuyến do giao trễ.',
  );
  const reportIncident = () => {
    if (!note.trim()) return setSheetError('Mô tả sự cố để các bên nắm được.');
    return run(() => api.post(`/api/v1/trips/${id}/journey-events`, { eventType: 'INCIDENT_REPORTED', note: note.trim() }), 'Đã gửi báo cáo sự cố.');
  };

  const pickProof = async (fromCamera) => {
    setSheetError('');
    const permission = fromCamera && Platform.OS !== 'web' ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
    if (!permission.granted) return setSheetError('Chưa có quyền dùng camera. Bật quyền trong Cài đặt hoặc chọn ảnh có sẵn.');
    const options = { mediaTypes: ['images'], quality: 0.7 };
    const result = fromCamera && Platform.OS !== 'web' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets?.[0]) setProofAsset(result.assets[0]);
    return undefined;
  };

  // A retry after the proof is saved only repeats the status change, never the upload.
  const submitProof = () =>
    singleFlight(async () => {
      setSheetError('');
      if (!savedProofUrl && !proofAsset) return setSheetError('Chụp hoặc chọn một ảnh bằng chứng.');
      let url = savedProofUrl;
      try {
        if (!url) {
          const imageUrl = await uploadImage(proofAsset);
          await api.post(`/api/v1/trips/${id}/delivery-proofs`, { imageUrl, note: note.trim() || undefined });
          url = imageUrl;
          setSavedProofUrl(imageUrl);
        }
        await api.post(`/api/v1/trips/${id}/journey-events`, { eventType: 'DELIVERY_PROOF_SUBMITTED', status: 'DELIVERED', note: note.trim() || undefined, evidenceUrl: url });
        setSheet(null);
        setNote('');
        setProofAsset(null);
        setSavedProofUrl('');
        setNotice('Đã báo giao hàng. Chờ chủ hàng xác nhận.');
      } catch (failure) {
        setSheetError(url ? `Ảnh đã được lưu nhưng chưa cập nhật trạng thái chuyến. ${failure.message} Bấm “Thử lại”.` : failure.message);
      }
      await load();
      return undefined;
    });

  const openAssign = () => {
    openSheet('assign');
    setDrivers(null);
    api.get('/api/v1/drivers/mine')
      .then((data) => setDrivers(asList(data)))
      .catch((failure) => { setDrivers([]); setSheetError(failure.message); });
  };
  const assignDriver = (driver) =>
    singleFlight(async () => {
      setSheetError('');
      try {
        const result = await api.patch(`/api/v1/trips/${id}/assignment`, { driverId: driver.id });
        setAssignment({ ...result, driverName: driver.fullName });
        setSheet('code');
      } catch (failure) {
        setSheetError(failure.message);
      }
      await load();
    });
  // Same fleet profile on an active trip (lost phone/session): status and history stay, the old code stops.
  const reissueCode = () =>
    singleFlight(async () => {
      setSheetError('');
      try {
        const result = await api.post(`/api/v1/trips/${id}/driver-access/reissue`, {});
        setAssignment({ ...result, driverName: 'tài xế đang được giao' });
        setSheet('code');
      } catch (failure) {
        setError(failure.message);
      }
      await load();
    });
  const shareCode = () => {
    if (!assignment?.code) return;
    // The share sheet also offers "Copy"; the code never goes into a link.
    void Share.share({ message: `BackHaulBid - Mã nhận chuyến\n${assignment.code}\nMở app BackHaulBid, chọn "Nhập mã nhận chuyến" rồi dán mã hoặc quét QR.\nHết hạn: ${formatDateTime(assignment.expiresAt)}` });
  };
  const closeCode = () => { setAssignment(null); setSheet(null); };

  const addMilestone = () => {
    const result = validateMilestone(milestoneForm);
    setMilestoneErrors(result.errors);
    if (!result.valid) return undefined;
    const sequenceOrder = milestones.reduce((max, item) => Math.max(max, Number(item.sequenceOrder) || 0), 0) + 1;
    return run(async () => {
      await api.post(`/api/v1/trips/${id}/milestones`, { ...result.value, sequenceOrder });
      setMilestoneForm({ name: '', lat: '', lng: '' });
    }, 'Đã thêm cột mốc.');
  };

  if (state === 'loading') return <View style={styles.center}><StateView kind="loading" title="Đang tải chuyến" /></View>;
  if (state === 'forbidden') return <View style={styles.center}><StateView kind="error" title="Không có quyền xem chuyến" message="Chuyến này không thuộc tài khoản của bạn." actionLabel="Về danh sách" onAction={() => router.replace('/')} /></View>;
  if (!trip) return <View style={styles.center}><StateView kind="error" title="Không tải được chuyến" message={error} actionLabel="Thử lại" onAction={() => load()} /></View>;

  const closed = isClosed(trip.status);
  const carrierSteps = role === 'CARRIER' ? getCarrierSteps(trip.status) : [];
  const primary = carrierSteps.find((step) => step.primary);
  const secondary = carrierSteps.find((step) => !step.primary);
  const canAssign = role === 'CARRIER' && trip.status === 'WAITING_PICKUP';
  const canReissue = role === 'CARRIER' && trip.driverId && ['WAITING_PICKUP', 'PICKED_UP', 'IN_TRANSIT'].includes(trip.status);
  const shipperAccept = role === 'SHIPPER' && trip.status === 'DELIVERED';
  const showBar = !closed && (role === 'CARRIER' || shipperAccept || trip.canCancelForLateDelivery);
  const driverText = trip.driverConnected ? 'Tài xế đã nhận chuyến bằng mã'
    : trip.driverId ? 'Đã phân công, chờ tài xế nhập mã nhận chuyến' : 'Chưa phân công';
  const reached = milestones.filter((item) => item.status === 'REACHED').length;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: showBar ? 190 + insets.bottom : space.xxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ pull: true })} tintColor={colors.brand} />}
      >
        {notice ? <Banner>{notice}</Banner> : null}
        {actionError ? <Banner tone="danger">{actionError}</Banner> : null}
        {error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}

        <JourneyOverview trip={trip} events={events} milestones={milestones} nextStep={getOwnerNextStep(trip, role)}>{role === 'SHIPPER' && trip.status === 'WAITING_PICKUP' ? <Button label="Xác nhận pin kho lấy / giao" variant="secondary" onPress={() => setPinsOpen(true)} /> : null}</JourneyOverview>

        {completion ? (
          <Banner title="Đơn hàng đã hoàn tất">
            {[
              completion.deliveredAt ? `Giao lúc ${formatDateTime(completion.deliveredAt)}` : 'Đã giao',
              completion.completedAt ? `chủ hàng xác nhận lúc ${formatDateTime(completion.completedAt)}` : null,
              completion.onTime === true ? 'đúng hạn' : null,
              completion.onTime === false ? `trễ ${completion.lateMinutes} phút` : null,
              completion.incidentCount ? `${completion.incidentCount} sự cố đã ghi nhận` : null,
            ].filter(Boolean).join(' · ')}
          </Banner>
        ) : null}

        {trip.expectedDeliveryAt && !closed ? (
          <Banner tone={trip.lateMinutes > 0 ? 'warning' : 'info'} title={`Hạn giao ${formatDateTime(trip.expectedDeliveryAt)}`}>
            {trip.lateMinutes > 0 ? `Đang trễ ${trip.lateMinutes} phút.` : 'Chưa quá hạn giao.'}
            {trip.latePolicyEnabled ? ' Bồi thường giao trễ trừ từ tiền đặt trước của nhà xe.' : ''}
          </Banner>
        ) : null}

        {settlements.length ? (
          <Section title="Xử lý giao trễ">
            {settlements.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.strong}>Bậc {item.tier} · {item.cumulativePenaltyPercent}% tiền đặt trước</Text>
                  <Text style={[type.caption, type.tabular]}>Bồi thường {formatMoney(item.totalCompensationAmount)} · trừ {item.pointsDeducted} điểm uy tín</Text>
                  {item.lastError ? <Text style={[type.caption, { color: colors.danger }]}>{item.lastError}</Text> : null}
                </View>
                <StatusBadge label={item.overallStatus === 'COMPLETED' ? 'Đã xử lý' : 'Đang thử lại'} tone={item.overallStatus === 'COMPLETED' ? 'success' : 'warning'} />
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="Cột mốc" right={milestones.length ? <Text style={type.caption}>{reached}/{milestones.length} đã check-in</Text> : null}>
          {milestones.length === 0 ? <Text style={type.secondary}>{role === 'CARRIER' ? 'Thêm cột mốc để tài xế check-in theo vị trí.' : 'Nhà xe chưa đặt cột mốc cho chuyến này.'}</Text> : null}
          {milestones.map((milestone) => (
            <View key={milestone.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.strong}>{milestone.sequenceOrder}. {milestone.milestoneName}</Text>
                <Text style={[type.caption, type.tabular]}>{milestone.reachedAt ? `Check-in ${formatDateTime(milestone.reachedAt)}` : 'Chưa đến'}</Text>
              </View>
              <StatusBadge label={milestone.status === 'REACHED' ? 'Đã đến' : 'Chưa đến'} tone={milestone.status === 'REACHED' ? 'success' : 'neutral'} />
            </View>
          ))}
          {role === 'CARRIER' && !closed ? <Button label="Thêm cột mốc" variant="secondary" onPress={() => { setMilestoneErrors({}); openSheet('milestone'); }} /> : null}
        </Section>

        {proofs.length > 0 ? (
          <Section title="Bằng chứng giao hàng">
            <View style={styles.grid}>
              {proofs.map((proof) => (
                <View key={proof.id} style={styles.proofCard}>
                  <ProofImage url={proof.imageUrl} style={styles.proofImage} label={proof.note || 'Ảnh bằng chứng giao hàng'} />
                  <Text style={[type.caption, type.tabular]}>{formatDateTime(proof.uploadedAt)}</Text>
                  {proof.note ? <Text style={type.secondary}>{proof.note}</Text> : null}
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {role === 'SHIPPER' ? <TripReviewSection tripId={trip.id} status={trip.status} /> : null}

        <Section title="Thông tin chuyến">
          <Info label="Giá hợp đồng" value={formatMoney(trip.agreedPrice)} />
          <Info label="Tài xế" value={driverText} />
          <Info label="Tạo lúc" value={formatDateTime(trip.createdAt)} />
          {trip.deliveredAt ? <Info label="Đã giao lúc" value={formatDateTime(trip.deliveredAt)} /> : null}
          <Info label="Mã chuyến" value={trip.id} selectable />
          {role === 'SHIPPER' ? <Button label="Hồ sơ nhà xe" variant="secondary" onPress={() => router.push(`/carriers/${trip.carrierId}`)} /> : null}
          <Button label="Gửi khiếu nại về chuyến này" variant="secondary" onPress={() => router.push(`/complaints?tripId=${trip.id}`)} />
        </Section>
      </ScrollView>

      {showBar ? (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          {shipperAccept ? <Button label="Xác nhận đã nhận hàng" onPress={() => openSheet('accept')} disabled={busy} /> : null}
          {role === 'SHIPPER' && trip.canCancelForLateDelivery ? <Button label="Hủy chuyến do giao trễ" variant="danger" onPress={() => openSheet('lateCancel')} disabled={busy} /> : null}
          {role === 'CARRIER' && canAssign ? <Button label={trip.driverId ? 'Đổi tài xế' : 'Phân công tài xế'} variant={trip.driverId ? 'secondary' : 'primary'} onPress={openAssign} disabled={busy} /> : null}
          {canReissue ? <Button label="Cấp lại mã nhận chuyến" variant="secondary" onPress={reissueCode} disabled={busy} /> : null}
          {role === 'CARRIER' && primary ? (
            <Button label={primary.label} onPress={() => (primary.proof ? openSheet('proof') : (setConfirmStep(primary), openSheet('confirm')))} disabled={busy} />
          ) : null}
          {role === 'CARRIER' ? (
            <View style={styles.barRow}>
              {secondary ? <Button label={secondary.label} variant="secondary" onPress={() => recordStep(secondary)} disabled={busy} style={{ flex: 1 }} /> : null}
              {trip.status !== 'DELIVERED' ? <Button label="Báo sự cố" variant="warning" onPress={() => openSheet('incident')} disabled={busy} style={{ flex: 1 }} /> : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {pinsOpen ? <RoutePinsSheet trip={trip} onClose={() => setPinsOpen(false)} onSaved={load} /> : null}
      <Sheet visible={sheet === 'confirm'} title={confirmStep?.label || ''} busy={busy} onClose={closeSheet}
        footer={<><Button label="Xác nhận" onPress={() => recordStep(confirmStep)} loading={busy} /><Button label="Quay lại" variant="secondary" onPress={closeSheet} disabled={busy} /></>}>
        <Text style={type.body}>Trạng thái chuyến sẽ chuyển sang “{statusOf(confirmStep?.status).label}”. Chủ hàng và tài xế thấy cập nhật này; không quay lại bước trước được.</Text>
        <FieldError message={sheetError} />
      </Sheet>

      <Sheet visible={sheet === 'accept'} title="Xác nhận đã nhận hàng" busy={busy} onClose={closeSheet}
        footer={<><Button label="Xác nhận hoàn thành" onPress={acceptDelivery} loading={busy} /><Button label="Chưa, kiểm tra lại" variant="secondary" onPress={closeSheet} disabled={busy} /></>}>
        <Text style={type.body}>Chỉ xác nhận khi đã kiểm đủ hàng và xem bằng chứng giao hàng. Đơn hàng chuyển sang “Hoàn thành” và không hoàn tác được.</Text>
        <TextInput accessibilityLabel="Ghi chú nhận hàng" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="Ghi chú (không bắt buộc)" placeholderTextColor={colors.inkSubtle} style={styles.textarea} />
        <FieldError message={sheetError} />
      </Sheet>

      <Sheet visible={sheet === 'lateCancel'} title="Hủy chuyến do giao trễ?" busy={busy} onClose={closeSheet}
        footer={<><Button label="Hủy chuyến" variant="danger" onPress={cancelLate} loading={busy} /><Button label="Giữ chuyến" variant="secondary" onPress={closeSheet} disabled={busy} /></>}>
        <Text style={type.body}>Xe đã trễ hơn 1 giờ so với hạn giao. Bồi thường được máy chủ xử lý theo mức trễ hiện tại; thao tác không hoàn tác được.</Text>
        <TextInput accessibilityLabel="Lý do hủy" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="Lý do (không bắt buộc)" placeholderTextColor={colors.inkSubtle} style={styles.textarea} />
        <FieldError message={sheetError} />
      </Sheet>

      <Sheet visible={sheet === 'incident'} title="Báo sự cố" busy={busy} onClose={closeSheet}
        footer={<><Button label="Gửi báo cáo" onPress={reportIncident} loading={busy} /><Button label="Hủy" variant="secondary" onPress={closeSheet} disabled={busy} /></>}>
        <Text style={type.secondary}>Sự cố được ghi vào hành trình; trạng thái chuyến không đổi.</Text>
        <TextInput accessibilityLabel="Mô tả sự cố" value={note} onChangeText={(value) => { setNote(value); setSheetError(''); }} multiline maxLength={500} placeholder="Ví dụ: kẹt xe, hỏng xe..." placeholderTextColor={colors.inkSubtle} style={styles.textarea} />
        <FieldError message={sheetError} />
      </Sheet>

      <Sheet visible={sheet === 'proof'} title="Bằng chứng giao hàng" busy={busy} onClose={closeSheet}
        footer={<><Button label={savedProofUrl ? 'Thử lại' : 'Gửi và báo đã giao'} onPress={submitProof} loading={busy} /><Button label="Hủy" variant="secondary" onPress={closeSheet} disabled={busy} /></>}>
        <Text style={type.secondary}>Chủ hàng xem ảnh này trước khi xác nhận hoàn thành.</Text>
        {proofAsset ? <Text style={styles.strong}>Đã chọn 1 ảnh</Text> : null}
        {!savedProofUrl ? (
          <View style={styles.barRow}>
            <Button label={Platform.OS === 'web' ? 'Chọn ảnh' : 'Chụp ảnh'} variant="secondary" onPress={() => pickProof(true)} disabled={busy} style={{ flex: 1 }} />
            {Platform.OS !== 'web' ? <Button label="Chọn ảnh có sẵn" variant="secondary" onPress={() => pickProof(false)} disabled={busy} style={{ flex: 1 }} /> : null}
          </View>
        ) : null}
        <TextInput accessibilityLabel="Ghi chú giao hàng" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="Ghi chú (không bắt buộc)" placeholderTextColor={colors.inkSubtle} style={styles.textarea} />
        <FieldError message={sheetError} />
      </Sheet>

      <Sheet visible={sheet === 'assign'} title="Phân công tài xế" busy={busy} onClose={closeSheet}
        footer={<Button label="Đóng" variant="secondary" onPress={closeSheet} disabled={busy} />}>
        <Text style={type.secondary}>Chỉ tài xế đã được duyệt trong đội xe của bạn. Máy chủ kiểm tra lại rồi cấp một mã nhận chuyến; mã và phiên cũ của chuyến bị thu hồi.</Text>
        {drivers === null ? <StateView kind="loading" title="Đang tải đội xe" /> : null}
        {drivers && drivers.filter((driver) => driver.status === 'VERIFIED').length === 0 ? <Text style={type.body}>Chưa có tài xế đã duyệt. Thêm và chờ duyệt hồ sơ tài xế trước.</Text> : null}
        {(drivers || []).filter((driver) => driver.status === 'VERIFIED').map((driver) => (
          <Pressable key={driver.id} accessibilityRole="button" onPress={() => assignDriver(driver)} disabled={busy}
            style={({ pressed }) => [styles.driverRow, pressed && { backgroundColor: colors.surfaceSunken }, trip.driverId === driver.id && { borderColor: colors.brand }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.strong}>{driver.fullName}</Text>
              <Text style={type.caption}>{driver.phone}{driver.licenseNumber ? ` · GPLX ${driver.licenseNumber}` : ''}</Text>
            </View>
            <Text style={styles.link}>{trip.driverId === driver.id ? 'Cấp mã mới' : 'Chọn'}</Text>
          </Pressable>
        ))}
        <FieldError message={sheetError} />
      </Sheet>

      <Sheet visible={sheet === 'code'} title="Gửi mã nhận chuyến cho tài xế" onClose={closeCode}
        footer={<><Button label="Chia sẻ mã" onPress={shareCode} /><Button label="Xong" variant="secondary" onPress={closeCode} /></>}>
        <Text style={type.body}>Đã cấp mã cho {assignment?.driverName}. Mã chỉ hiện một lần; gửi cho đúng tài xế. Tài xế quét QR hoặc dán mã trong app, không cần tài khoản.</Text>
        <DriverCodeQr value={assignment?.code} />
        <Text style={styles.code} selectable>{assignment?.code}</Text>
        <Text style={type.caption}>Hết hạn {formatDateTime(assignment?.expiresAt)}. Dùng một lần; mã cũ của chuyến đã bị thu hồi.</Text>
      </Sheet>

      <Sheet visible={sheet === 'milestone'} title="Thêm cột mốc" busy={busy} onClose={closeSheet}
        footer={<><Button label="Thêm cột mốc" onPress={addMilestone} loading={busy} /><Button label="Hủy" variant="secondary" onPress={closeSheet} disabled={busy} /></>}>
        <TextInput accessibilityLabel="Tên cột mốc" value={milestoneForm.name} onChangeText={(name) => setMilestoneForm((form) => ({ ...form, name }))} placeholder="Ví dụ: Trạm thu phí Long Thành" placeholderTextColor={colors.inkSubtle} style={styles.input} />
        <FieldError message={milestoneErrors.name} />
        <View style={styles.barRow}>
          <View style={{ flex: 1 }}>
            <TextInput accessibilityLabel="Vĩ độ" value={milestoneForm.lat} onChangeText={(lat) => setMilestoneForm((form) => ({ ...form, lat }))} placeholder="Vĩ độ" keyboardType="numbers-and-punctuation" placeholderTextColor={colors.inkSubtle} style={styles.input} />
            <FieldError message={milestoneErrors.lat} />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput accessibilityLabel="Kinh độ" value={milestoneForm.lng} onChangeText={(lng) => setMilestoneForm((form) => ({ ...form, lng }))} placeholder="Kinh độ" keyboardType="numbers-and-punctuation" placeholderTextColor={colors.inkSubtle} style={styles.input} />
            <FieldError message={milestoneErrors.lng} />
          </View>
        </View>
        <Text style={type.caption}>Tài xế chỉ check-in được khi ở gần tọa độ này; máy chủ kiểm tra khoảng cách.</Text>
        <FieldError message={sheetError} />
      </Sheet>
    </View>
  );
}

function Info({ label, value, selectable }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={type.caption}>{label}</Text>
      <Text style={[styles.strong, type.tabular]} selectable={selectable}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, justifyContent: 'center', padding: space.lg, backgroundColor: colors.canvas },
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  banner: { borderRadius: radius.md, padding: space.md, gap: 4 },
  bannerTitle: { fontSize: 15, fontFamily: fonts.bold },
  strong: { fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  proofCard: { width: '47%', flexGrow: 1, gap: 4 },
  proofImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  barRow: { flexDirection: 'row', gap: space.sm },
  textarea: { minHeight: TOUCH * 2, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, padding: space.md, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  input: { minHeight: TOUCH, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16, color: colors.ink },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 8, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md },
  link: { color: colors.brand, fontFamily: fonts.bold },
  code: { fontSize: 13, fontFamily: fonts.medium, color: colors.ink, textAlign: 'center', backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: space.sm },
});
