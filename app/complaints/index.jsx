import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionBar, Banner, Button, Card, ChoiceChips, Screen, StateView, StatusBadge, Tabs, TextField, useResource, useSingleFlight } from '@/components/ui';
import Sheet from '@/components/Sheet';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { complaintApi } from '@/lib/services';
import { uploadImage } from '@/lib/media';
import { pickImage } from '@/lib/filePick';
import { UNCATEGORIZED, getCategoriesForRole, getComplaintCategoryMeta, getComplaintStatusMeta, normalizeComplaintCollection, validateComplaintDraft } from '@/lib/shared/complaints';
import { formatDateTime, shortId } from '@/lib/shared/format';
import { colors, radius, space, type, fonts } from '@/constants/theme';

const STATUS_FILTERS = [{ value: '', label: 'Tất cả' }, { value: 'OPEN', label: 'Đang mở' }, { value: 'CLOSED', label: 'Đã đóng' }];
const EMPTY = { tripId: '', category: '', title: '', description: '' };

export default function ComplaintsScreen() {
  const router = useRouter();
  const { tripId: initialTripId } = useLocalSearchParams();
  const { session } = useAuth();
  const role = session?.role;
  const categories = getCategoriesForRole(role);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(Boolean(initialTripId));
  // Category filtering happens on the server (?category=), so counts stay correct with paging.
  const { data, state, error, refreshing, reload } = useResource(() => complaintApi.list(category ? { category } : undefined), [category]);
  const items = normalizeComplaintCollection(data)
    .filter((item) => !status || (status === 'OPEN') === !getComplaintStatusMeta(item.status).closed)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Khiếu nại' }} />
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })} bottomInset={90}>
        <Tabs label="Loại vấn đề" value={category} onChange={setCategory}
          options={[{ value: '', label: 'Mọi loại' }, ...categories.map((item) => ({ value: item.code, label: item.label })), { value: UNCATEGORIZED, label: 'Chưa phân loại' }]} />
        <Tabs label="Trạng thái" value={status} onChange={setStatus} options={STATUS_FILTERS} />
        {state === 'loading' && <StateView kind="loading" title="Đang tải khiếu nại" />}
        {state === 'error' && <StateView kind="error" title="Không tải được khiếu nại" message={error} actionLabel="Thử lại" onAction={() => reload()} />}
        {state === 'ready' && items.length === 0 && <StateView title="Chưa có khiếu nại phù hợp" message="Gửi khiếu nại khi có vấn đề với một chuyến vận chuyển." />}
        {items.map((item) => (
          <Card key={item.id} onPress={() => router.push(`/complaints/${item.id}`)} accessibilityLabel={item.title}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={[type.caption, type.tabular]}>#{shortId(item.id)} · chuyến #{shortId(item.tripId)}</Text>
              <StatusBadge {...getComplaintStatusMeta(item.status)} />
            </View>
            <Text style={{ fontSize: 16, fontFamily: fonts.bold, color: colors.ink }}>{item.title}</Text>
            <Text style={type.secondary}>{getComplaintCategoryMeta(item.category).label}</Text>
            <Text style={[type.caption, type.tabular]}>Cập nhật {formatDateTime(item.updatedAt || item.createdAt)}{item.messages?.length ? ` · ${item.messages.length} tin nhắn` : ''}</Text>
          </Card>
        ))}
      </Screen>
      <ActionBar><Button label="Gửi khiếu nại mới" onPress={() => setCreateOpen(true)} /></ActionBar>
      {createOpen ? (
        <CreateComplaintSheet role={role} initialTripId={initialTripId ? String(initialTripId) : ''} onClose={() => setCreateOpen(false)}
          onCreated={(created) => { setCreateOpen(false); void reload(); if (created?.id) router.push(`/complaints/${created.id}`); }} />
      ) : null}
    </View>
  );
}

function CreateComplaintSheet({ role, initialTripId, onClose, onCreated }) {
  const trips = useResource(() => api.get('/api/v1/trips/mine'), []);
  const [draft, setDraft] = useState({ ...EMPTY, tripId: initialTripId });
  const [errors, setErrors] = useState({});
  const [evidence, setEvidence] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [busy, run] = useSingleFlight();
  const set = (field) => (value) => { setDraft((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })); };
  const tripList = (Array.isArray(trips.data) ? trips.data : []).slice(0, 30);

  const submit = () => run(async () => {
    const nextErrors = validateComplaintDraft(draft, role);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitError('');
    try {
      const evidenceUrl = evidence ? await uploadImage(evidence, 'complaints') : null;
      const created = await complaintApi.create({ tripId: draft.tripId, category: draft.category, title: draft.title.trim(), description: draft.description.trim(), evidenceUrl });
      onCreated(created);
    } catch (failure) {
      setSubmitError(`${failure.message} Nội dung bạn nhập vẫn được giữ.`);
    }
  });

  return (
    <Sheet visible title="Gửi khiếu nại" busy={busy} onClose={onClose}
      footer={<><Button label="Gửi khiếu nại" onPress={submit} loading={busy} /><Button label="Hủy" variant="secondary" onPress={onClose} disabled={busy} /></>}>
      <Text style={{ fontSize: 14, fontFamily: fonts.semibold, color: colors.ink }}>Chuyến liên quan *</Text>
      {trips.state === 'loading' ? <Text style={type.secondary}>Đang tải chuyến...</Text> : null}
      {trips.state === 'error' ? <Banner tone="danger">{trips.error}</Banner> : null}
      <View style={{ gap: space.xs }}>
        {tripList.map((trip) => {
          const selected = draft.tripId === trip.id;
          return (
            <Pressable key={trip.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => set('tripId')(trip.id)}
              style={{ borderWidth: 1, borderColor: selected ? colors.brand : colors.line, backgroundColor: selected ? colors.brandSoft : colors.surface, borderRadius: radius.md, padding: space.sm }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.ink }} numberOfLines={1}>{trip.pickupLocation} → {trip.deliveryLocation}</Text>
              <Text style={[type.caption, type.tabular]}>#{shortId(trip.id)} · {formatDateTime(trip.createdAt)}</Text>
            </Pressable>
          );
        })}
      </View>
      {errors.tripId ? <Text style={{ color: colors.danger, fontFamily: fonts.semibold }}>{errors.tripId}</Text> : null}
      <ChoiceChips label="Loại vấn đề" required options={getCategoriesForRole(role).map((item) => ({ value: item.code, label: item.label }))} value={draft.category} onChange={set('category')} error={errors.category} />
      {draft.category ? <Text style={type.caption}>{getComplaintCategoryMeta(draft.category).description}</Text> : null}
      <TextField label="Tiêu đề" required value={draft.title} onChangeText={set('title')} error={errors.title} maxLength={200} />
      <TextField label="Mô tả chi tiết" required value={draft.description} onChangeText={set('description')} error={errors.description} multiline maxLength={5000} />
      <Button label={evidence ? 'Đã chọn ảnh bằng chứng · đổi ảnh' : 'Thêm ảnh bằng chứng (không bắt buộc)'} variant="secondary"
        onPress={async () => { try { const asset = await pickImage(); if (asset) setEvidence(asset); } catch (failure) { setSubmitError(failure.message); } }} disabled={busy} />
      {submitError ? <Banner tone="danger">{submitError}</Banner> : null}
    </Sheet>
  );
}
