import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, Image, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { isDriverSession, scopeKey } from '@/lib/sessionModel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Button, FieldError, Section, StateView } from '@/components/ui';
import Sheet from '@/components/Sheet';
import ProofImage from '@/components/ProofImage';
import JourneyOverview from '@/components/tracking/JourneyOverview';
import DriverLocationControl from '@/components/tracking/DriverLocationControl';
import { api } from '@/lib/api';
import { uploadImage } from '@/lib/media';
import { getHandoverStatus } from '@/lib/handover';
import HandoverSection from '@/components/handover/HandoverSection';
import { formatDateTime, getDriverSteps, isClosed, statusOf } from '@/lib/trips';
import { colors, radius, space, TOUCH, type, fonts } from '@/constants/theme';

const asList = (value) => (Array.isArray(value) ? value : value?.data || []);

function useLocalSearchParamsTrip() {
  return String(useLocalSearchParams().tripId || '').toLowerCase();
}

export default function DriverTripGate() {
  const { session, ready } = useAuth();
  const tripId = useLocalSearchParamsTrip();
  // Wait for the stored session; redirecting earlier would drop deep links.
  if (!ready || !session) return null;
  // A driver code session opens only its own trip; any other ID (old link, other trip) goes home.
  if (!isDriverSession(session) || tripId !== session.tripId) return <Redirect href="/" />;
  return <TripDetail key={scopeKey(session)} />;
}

function TripDetail() {
  const { tripId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState(null);
  const [events, setEvents] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [handover, setHandover] = useState(null);
  const generation = useRef(0), loading = useRef(false);
  const milestoneCount = milestones.length;
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const [confirmStep, setConfirmStep] = useState(null);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentNote, setIncidentNote] = useState('');
  const [incidentError, setIncidentError] = useState('');
  const [proofOpen, setProofOpen] = useState(false);
  const [proofAsset, setProofAsset] = useState(null);
  const [proofNote, setProofNote] = useState('');
  const [proofError, setProofError] = useState('');
  const [savedProofUrl, setSavedProofUrl] = useState('');

  const load = useCallback(
    async ({ pull = false } = {}) => {
      if (loading.current) return;
      loading.current = true; const token = generation.current;
      if (pull) setRefreshing(true);
      try {
        const tripData = await api.get(`/api/v1/trips/${tripId}`);
        const [eventData, proofData, milestoneData, handoverData] = await Promise.all([
          api.get(`/api/v1/trips/${tripId}/journey-events`).catch(() => []),
          api.get(`/api/v1/trips/${tripId}/delivery-proofs`).catch(() => []),
          api.get(`/api/v1/trips/${tripId}/milestones`).catch(() => []),
          api.get(`/api/v1/trips/${tripId}/handover`).catch(() => []),
        ]);
        if (token !== generation.current) return;
        setTrip(tripData);
        setEvents(asList(eventData).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)));
        setProofs(asList(proofData));
        setMilestones(asList(milestoneData));
        setHandover(asList(handoverData)[0] ?? null);
        setError('');
        setState('ready');
      } catch (loadError) {
        if (token !== generation.current) return;
        setError(loadError.message);
        if ([401, 403, 404].includes(loadError.status)) { setTrip(null); setEvents([]); setProofs([]); setState(loadError.status === 403 ? 'forbidden' : 'error'); }
        else setState((current) => (current === 'ready' ? 'ready' : 'error'));
      } finally {
        loading.current = false;
        if (token === generation.current) setRefreshing(false);
      }
    },
    [tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => { if (AppState.currentState === 'active' && globalThis.document?.visibilityState !== 'hidden') void load(); }, 15_000);
      return () => { clearInterval(timer); generation.current++; };
    }, [load]),
  );

  const flags = useMemo(() => {
    const has = (type) => events.some((event) => event.eventType === type);
    return { accepted: has('DRIVER_ACCEPTED'), arrivedPickup: has('ARRIVED_PICKUP'), arrivedDelivery: has('ARRIVED_DELIVERY') };
  }, [events]);
  const steps = trip ? getDriverSteps(trip.status, flags) : {};
  // Pickup is confirmed only with a photographed, shipper-confirmed handover; the server re-checks it.
  const blockedByHandover = (step) => step?.eventType === 'PICKUP_CONFIRMED' && !getHandoverStatus(handover).pickupReady;

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

  const recordStep = (step) =>
    singleFlight(async () => {
      setActionError('');
      try {
        await api.post(`/api/v1/trips/${tripId}/journey-events`, { eventType: step.eventType, ...(step.status ? { status: step.status } : {}) });
        setConfirmStep(null);
        setNotice(`Đã ghi nhận: ${step.label}.`);
      } catch (stepError) {
        setActionError(stepError.message);
      }
      await load();
    });

  const submitIncident = () =>
    singleFlight(async () => {
      if (!incidentNote.trim()) {
        setIncidentError('Mô tả sự cố để chủ xe và chủ hàng nắm được.');
        return;
      }
      try {
        await api.post(`/api/v1/trips/${tripId}/journey-events`, { eventType: 'INCIDENT_REPORTED', note: incidentNote.trim() });
        setIncidentOpen(false);
        setIncidentNote('');
        setNotice('Đã gửi báo cáo sự cố.');
        await load();
      } catch (incidentFailure) {
        setIncidentError(incidentFailure.message);
      }
    });

  const pickProof = async (fromCamera) => {
    setProofError('');
    const permission = fromCamera && Platform.OS !== 'web' ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
    if (!permission.granted) {
      setProofError('Chưa có quyền dùng camera. Bật quyền trong Cài đặt hoặc chọn ảnh có sẵn.');
      return;
    }
    const options = { mediaTypes: ['images'], quality: 0.7 };
    const result = fromCamera && Platform.OS !== 'web' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets?.[0]) setProofAsset(result.assets[0]);
  };

  const submitProof = () =>
    singleFlight(async () => {
      setProofError('');
      if (!savedProofUrl && !proofAsset) {
        setProofError('Chụp hoặc chọn một ảnh bằng chứng.');
        return;
      }
      let url = savedProofUrl;
      try {
        if (!url) {
          const imageUrl = await uploadImage(proofAsset);
          await api.post(`/api/v1/trips/${tripId}/delivery-proofs`, { imageUrl, note: proofNote.trim() || undefined });
          url = imageUrl;
          setSavedProofUrl(imageUrl);
        }
        await api.post(`/api/v1/trips/${tripId}/journey-events`, {
          eventType: 'DELIVERY_PROOF_SUBMITTED',
          status: 'DELIVERED',
          note: proofNote.trim() || undefined,
          evidenceUrl: url,
        });
        setProofOpen(false);
        setProofAsset(null);
        setProofNote('');
        setSavedProofUrl('');
        setNotice('Đã báo giao hàng. Chờ chủ hàng xác nhận.');
        await load();
      } catch (proofFailure) {
        setProofError(url ? `Ảnh đã được lưu nhưng chưa cập nhật trạng thái chuyến. ${proofFailure.message} Bấm “Thử lại”.` : proofFailure.message);
      }
    });

  const openStep = (step) => {
    setActionError('');
    setNotice('');
    if (step.proof) setProofOpen(true);
    else if (step.status) setConfirmStep(step);
    else void recordStep(step);
  };

  if (state === 'loading') return <View style={styles.center}><StateView kind="loading" title="Đang tải chuyến" /></View>;
  if (state === 'forbidden') return <View style={styles.center}><StateView kind="error" title="Không có quyền xem chuyến" message="Chuyến này không được giao cho tài khoản của bạn." actionLabel="Về danh sách chuyến" onAction={() => router.replace('/')} /></View>;
  if (!trip) return <View style={styles.center}><StateView kind="error" title="Không tải được chuyến" message={error} actionLabel="Thử lại" onAction={() => load()} /></View>;

  const closed = isClosed(trip.status);
  const showBar = !closed && (steps.primary || trip.status !== 'DELIVERED');

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: showBar ? 180 + insets.bottom : space.xxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ pull: true })} tintColor={colors.brand} />}
      >
        {notice ? <View style={styles.notice} accessibilityLiveRegion="polite"><Text style={styles.noticeText}>{notice}</Text></View> : null}
        {actionError ? <View style={styles.errorBox} accessibilityRole="alert"><Text style={styles.errorText}>{actionError}</Text></View> : null}
        {error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}

        <JourneyOverview trip={trip} events={events} milestones={milestones} nextStep={steps.primary?.hint}>
          <DriverLocationControl trip={trip} />
        </JourneyOverview>

        {trip.status === 'WAITING_PICKUP' || handover ? (
          <HandoverSection tripId={trip.id} handover={handover} active={trip.status === 'WAITING_PICKUP'} onSaved={load} />
        ) : null}

        {steps.primary?.hint && !closed ? (
          <Section title="Bước tiếp theo">
            <Text style={type.body}>{steps.primary.hint}</Text>
          </Section>
        ) : null}
        {trip.status === 'DELIVERED' ? (
          <Section title="Đã giao">
            <Text style={type.body}>Đang chờ chủ hàng xác nhận nhận hàng. Tài xế không tự hoàn thành chuyến.</Text>
          </Section>
        ) : null}

        {milestoneCount > 0 ? (
          <Section title="Cột mốc hành trình">
            <Text style={type.secondary}>{milestoneCount} cột mốc do chủ xe thiết lập. Check-in khi đến gần từng cột mốc.</Text>
            <Button label="Mở cột mốc" variant="secondary" onPress={() => router.push(`/trips/${trip.id}/milestones`)} />
          </Section>
        ) : null}

        {proofs.length > 0 ? (
          <Section title="Bằng chứng đã gửi">
            {proofs.map((proof) => (
              <View key={proof.id} style={styles.proofRow}>
                <ProofImage url={proof.imageUrl} style={styles.proofImage} label={proof.note || 'Ảnh bằng chứng giao hàng'} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.secondary, type.tabular]}>{formatDateTime(proof.uploadedAt)}</Text>
                  {proof.note ? <Text style={type.body}>{proof.note}</Text> : null}
                </View>
              </View>
            ))}
          </Section>
        ) : null}

      </ScrollView>

      {showBar ? (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          {blockedByHandover(steps.primary) ? (
            <Text style={[type.caption, { color: colors.warning }]}>Ghi biên bản bàn giao và chờ chủ hàng xác nhận trước khi xác nhận đã lấy hàng.</Text>
          ) : null}
          {steps.primary ? <Button label={steps.primary.label} onPress={() => openStep(steps.primary)} loading={busy && !confirmStep && !proofOpen} disabled={blockedByHandover(steps.primary)} /> : null}
          <View style={styles.barRow}>
            {steps.secondary ? <Button label={steps.secondary.label} variant="secondary" onPress={() => openStep(steps.secondary)} disabled={busy || blockedByHandover(steps.secondary)} style={{ flex: 1 }} /> : null}
            <Button label="Báo sự cố" variant="warning" onPress={() => { setIncidentError(''); setIncidentOpen(true); }} disabled={busy} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}

      <Sheet
        visible={Boolean(confirmStep)}
        title={confirmStep?.label || ''}
        busy={busy}
        onClose={() => setConfirmStep(null)}
        footer={
          <>
            <Button label="Xác nhận" onPress={() => recordStep(confirmStep)} loading={busy} />
            <Button label="Chưa, quay lại" variant="secondary" onPress={() => setConfirmStep(null)} disabled={busy} />
          </>
        }
      >
        <Text style={type.body}>
          {confirmStep?.status
            ? `Trạng thái chuyến sẽ chuyển sang “${statusOf(confirmStep.status).label}”. Chủ xe và chủ hàng thấy cập nhật này; bạn không thể quay lại bước trước.`
            : `Ghi nhận mốc “${confirmStep?.label || ""}” vào hành trình. Chủ xe và chủ hàng thấy cập nhật này; trạng thái chuyến giữ nguyên.`}
        </Text>
      </Sheet>

      <Sheet
        visible={incidentOpen}
        title="Báo sự cố"
        busy={busy}
        onClose={() => setIncidentOpen(false)}
        footer={
          <>
            <Button label="Gửi báo cáo" onPress={submitIncident} loading={busy} />
            <Button label="Hủy" variant="secondary" onPress={() => setIncidentOpen(false)} disabled={busy} />
          </>
        }
      >
        <Text style={type.secondary}>Sự cố được ghi vào hành trình; trạng thái chuyến không đổi.</Text>
        <TextInput
          accessibilityLabel="Mô tả sự cố"
          value={incidentNote}
          onChangeText={(value) => {
            setIncidentNote(value);
            setIncidentError('');
          }}
          multiline
          maxLength={500}
          placeholder="Ví dụ: kẹt xe, hỏng xe, hàng bị đổ..."
          placeholderTextColor={colors.inkSubtle}
          style={[styles.textarea, incidentError && { borderColor: colors.danger, borderWidth: 2 }]}
        />
        <FieldError message={incidentError} />
      </Sheet>

      <Sheet
        visible={proofOpen}
        title="Bằng chứng giao hàng"
        busy={busy}
        onClose={() => setProofOpen(false)}
        footer={
          <>
            <Button label={savedProofUrl ? 'Thử lại' : 'Gửi và báo đã giao'} onPress={submitProof} loading={busy} />
            <Button label="Hủy" variant="secondary" onPress={() => setProofOpen(false)} disabled={busy} />
          </>
        }
      >
        <Text style={type.secondary}>Chụp biên bản hoặc hàng tại điểm giao. Chủ hàng xem ảnh này trước khi xác nhận.</Text>
        {proofAsset ? <Image source={{ uri: proofAsset.uri }} style={styles.preview} accessibilityLabel="Ảnh đã chọn" /> : null}
        {!savedProofUrl ? (
          <View style={styles.barRow}>
            <Button label={Platform.OS === 'web' ? 'Chọn ảnh' : 'Chụp ảnh'} variant="secondary" onPress={() => pickProof(true)} disabled={busy} style={{ flex: 1 }} />
            {Platform.OS !== 'web' ? <Button label="Chọn ảnh có sẵn" variant="secondary" onPress={() => pickProof(false)} disabled={busy} style={{ flex: 1 }} /> : null}
          </View>
        ) : null}
        <TextInput
          accessibilityLabel="Ghi chú giao hàng"
          value={proofNote}
          onChangeText={setProofNote}
          multiline
          maxLength={500}
          placeholder="Ghi chú (không bắt buộc)"
          placeholderTextColor={colors.inkSubtle}
          style={styles.textarea}
        />
        <FieldError message={proofError} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, justifyContent: 'center', padding: space.lg, backgroundColor: colors.canvas },
  content: { padding: space.lg, gap: space.lg },
  notice: { backgroundColor: colors.successSoft, borderRadius: radius.md, padding: space.md },
  noticeText: { color: colors.success, fontFamily: fonts.semibold },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space.md },
  errorText: { color: colors.danger, fontFamily: fonts.semibold },
  proofRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  proofImage: { width: 72, height: 54, borderRadius: radius.sm, backgroundColor: colors.surfaceSunken },
  preview: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  barRow: { flexDirection: 'row', gap: space.sm },
  textarea: { minHeight: TOUCH * 2, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, padding: space.md, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
});
