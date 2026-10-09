import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, FieldError, Section } from '@/components/ui';
import ProofImage from '@/components/ProofImage';
import { api } from '@/lib/api';
import { uploadImage } from '@/lib/media';
import { pickImage } from '@/lib/filePick';
import { buildHandoverPayload, formFromHandover, getHandoverStatus, HANDOVER_CONDITIONS, HANDOVER_MAX_PHOTOS } from '@/lib/handover';
import { formatDateTime } from '@/lib/trips';
import { colors, radius, space, TOUCH, type, fonts } from '@/constants/theme';

/**
 * Pickup handover of a trip, recorded by the driver before pickup: load, condition and photos. Saved photos are read
 * through the trip check on the server; a photo just picked is shown from the device until the record is saved.
 * Once the shipper confirmed it, the record is read-only here. The server refuses pickup until that confirmation exists.
 */
export default function HandoverSection({ tripId, handover, active, onSaved }) {
  const status = getHandoverStatus(handover);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => formFromHandover(handover));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const editMode = active && !status.confirmed && (editing || !handover);

  const startEdit = () => {
    setForm(formFromHandover(handover));
    setError('');
    setEditing(true);
  };

  /** Adds one photo from the camera or library and uploads it to the private handover-photos folder. */
  const addPhoto = async (fromCamera) => {
    setError('');
    if (form.photos.length >= HANDOVER_MAX_PHOTOS) {
      setError(`Tối đa ${HANDOVER_MAX_PHOTOS} ảnh hàng hóa.`);
      return;
    }
    setBusy(true);
    try {
      const asset = await pickImage({ camera: fromCamera });
      if (!asset) return;
      const ref = await uploadImage(asset, 'handover-photos');
      setForm((current) => ({ ...current, photos: [...current.photos, { ref, preview: asset.uri }] }));
    } catch (uploadError) {
      setError(uploadError.message || 'Chưa tải được ảnh. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = (index) => {
    setForm((current) => ({ ...current, photos: current.photos.filter((_, position) => position !== index) }));
  };

  /** Validates locally, then sends the whole record; the server replaces the record for this trip. */
  const save = async () => {
    const built = buildHandoverPayload(form);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.put(`/api/v1/trips/${tripId}/handover`, built.payload);
      setEditing(false);
      await onSaved?.();
    } catch (saveError) {
      setError(saveError.message || 'Chưa gửi được biên bản. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  if (!handover && !active) return null;

  return (
    <Section title="Biên bản bàn giao lấy hàng">
      <Text style={type.secondary}>{status.message}</Text>

      {handover && !editMode ? (
        <View style={styles.summary}>
          <Text style={type.body}>
            {handover.cargoCategory} · {handover.grossWeightKg} kg{handover.packageCount ? ` · ${handover.packageCount} kiện` : ''}
          </Text>
          <Text style={type.body}>Tình trạng: {handover.conditionStatus === 'DAMAGED' ? 'Có hư hỏng' : 'Nguyên vẹn'}</Text>
          {handover.conditionNote ? <Text style={type.secondary}>{handover.conditionNote}</Text> : null}
          {handover.sealNumber ? <Text style={type.secondary}>Niêm phong: {handover.sealNumber}</Text> : null}
          {handover.placeNote ? <Text style={type.secondary}>Vị trí: {handover.placeNote}</Text> : null}
          <View style={styles.photoRow}>
            {handover.photoPaths.map((path, index) => (
              <ProofImage key={path} url={path} style={styles.thumb} label={`Ảnh hàng hóa ${index + 1}`} />
            ))}
          </View>
          {handover.shipperConfirmedAt ? (
            <Text style={type.secondary}>
              Chủ hàng xác nhận: {handover.shipperSignerName} · {formatDateTime(handover.shipperConfirmedAt)}
            </Text>
          ) : null}
          {active && !status.confirmed ? <Button label="Sửa biên bản" variant="secondary" onPress={startEdit} /> : null}
        </View>
      ) : null}

      {editMode ? (
        <View style={styles.form}>
          <Field label="Loại hàng hóa" value={form.cargoCategory} maxLength={80} placeholder="VD: Điện tử đóng thùng"
            onChangeText={(value) => setForm({ ...form, cargoCategory: value })} />
          <Field label="Khối lượng (kg)" value={form.grossWeightKg} keyboardType="decimal-pad" placeholder="VD: 4200"
            onChangeText={(value) => setForm({ ...form, grossWeightKg: value })} />
          <Field label="Số kiện (không bắt buộc)" value={form.packageCount} keyboardType="number-pad" placeholder="VD: 12"
            onChangeText={(value) => setForm({ ...form, packageCount: value })} />

          <Text style={styles.label}>Tình trạng hàng khi nhận</Text>
          <View style={styles.choiceRow}>
            {HANDOVER_CONDITIONS.map((option) => (
              <Button
                key={option.value}
                label={option.label}
                variant={form.conditionStatus === option.value ? 'primary' : 'secondary'}
                onPress={() => setForm({ ...form, conditionStatus: option.value })}
                disabled={busy}
              />
            ))}
          </View>
          {form.conditionStatus === 'DAMAGED' ? (
            <Field label="Mô tả hư hỏng đã thấy" value={form.conditionNote} maxLength={500} multiline
              placeholder="VD: thùng ngoài móp góc phải"
              onChangeText={(value) => setForm({ ...form, conditionNote: value })} />
          ) : null}

          <Field label="Số niêm phong (nếu có)" value={form.sealNumber} maxLength={60}
            onChangeText={(value) => setForm({ ...form, sealNumber: value })} />
          <Field label="Ghi chú vị trí (nếu có)" value={form.placeNote} maxLength={255}
            onChangeText={(value) => setForm({ ...form, placeNote: value })} />

          <Text style={styles.label}>Ảnh hàng hóa ({form.photos.length}/{HANDOVER_MAX_PHOTOS})</Text>
          <View style={styles.photoRow}>
            {form.photos.map((photo, index) => (
              <View key={photo.ref} style={styles.thumbWrap}>
                <ProofImage url={photo.preview} style={styles.thumb} label={`Ảnh hàng hóa ${index + 1}`} />
                <Button label="Xóa ảnh" variant="secondary" onPress={() => removePhoto(index)} disabled={busy} />
              </View>
            ))}
          </View>
          <View style={styles.choiceRow}>
            <Button label="Chụp ảnh" variant="secondary" onPress={() => addPhoto(true)} disabled={busy} />
            <Button label="Chọn ảnh có sẵn" variant="secondary" onPress={() => addPhoto(false)} disabled={busy} />
          </View>

          <FieldError message={error} />
          <Button label={busy ? 'Đang gửi...' : 'Gửi biên bản cho chủ hàng'} onPress={save} loading={busy} />
          {handover ? <Button label="Hủy sửa" variant="secondary" onPress={() => { setEditing(false); setError(''); }} disabled={busy} /> : null}
        </View>
      ) : null}
      {!editMode && error ? <FieldError message={error} /> : null}
    </Section>
  );
}

function Field({ label, value, onChangeText, multiline = false, keyboardType, placeholder, maxLength }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSubtle}
        maxLength={maxLength}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCorrect={false}
        autoCapitalize="sentences"
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: space.xs },
  form: { gap: space.sm },
  label: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink, marginTop: space.xs },
  input: {
    minHeight: TOUCH, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm, fontSize: 15, color: colors.ink, backgroundColor: colors.surface,
  },
  multiline: { minHeight: TOUCH * 2, textAlignVertical: 'top' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  thumbWrap: { width: 120, gap: space.xs },
  thumb: { width: 120, height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },
});
