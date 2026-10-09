import { useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ActionBar, Banner, Button, Card, ChoiceChips, DateTimeField, MoneyField, Row, Screen, Section, StateView, SwitchRow, TextField, useResource, useSingleFlight } from '@/components/ui';
import Sheet from '@/components/Sheet';
import MapPointField from '@/components/tracking/MapPointField';
import { addressApi, biddingApi, newKey } from '@/lib/services';
import { uploadImage } from '@/lib/media';
import { GOODS_CATEGORIES, INITIAL_FORM_STATE, VEHICLE_TYPES, getCreationFeeQuote, getParticipationFeeQuote, mapFormToAuctionPayload, validateCreateAuctionForm } from '@/lib/shared/auctionForm';
import { formatDateTime, formatMoney } from '@/lib/shared/format';
import { colors, radius, space, type, fonts } from '@/constants/theme';

const STEPS = ['Hàng hóa', 'Lộ trình', 'Giá và thời gian', 'Xem lại'];
const MAX_IMAGES = 5;
const MAX_VALUE_DOCUMENTS = 5;
const has = (value) => value !== undefined && value !== null && String(value).trim() !== '';

function stepError(step, form) {
  if (step === 0) {
    if (!has(form.goodsName)) return 'Vui lòng nhập tên lô hàng.';
    if (!has(form.goodsCategory)) return 'Vui lòng chọn loại hàng hóa.';
    if (!(Number(form.weight) > 0)) return 'Trọng lượng phải lớn hơn 0.';
    if (!has(form.requiredVehicleType)) return 'Vui lòng chọn loại xe yêu cầu.';
  }
  if (step === 1) {
    for (const [prefix, name] of [['from', 'lấy hàng'], ['to', 'giao hàng']]) {
      if (!['LocationName', 'Province', 'Address'].every((field) => has(form[`${prefix}${field}`]))) return `Vui lòng nhập đủ điểm ${name} (tên kho, tỉnh/thành và địa chỉ).`;
    }
  }
  if (step >= 2) return validateCreateAuctionForm(form);
  return null;
}

export default function CreateAuctionScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [error, setError] = useState('');
  const [busy, run] = useSingleFlight();
  const [imageBusy, setImageBusy] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [picker, setPicker] = useState(null); // 'from' | 'to'
  const keyRef = useRef(null);
  const set = (field) => (value) => setForm((current) => {
    const prefix = field.startsWith('from') ? 'from' : field.startsWith('to') ? 'to' : null;
    return { ...current, [field]: value, ...(prefix && ['Address', 'Province'].some((suffix) => field.endsWith(suffix)) ? { [`${prefix}Latitude`]: null, [`${prefix}Longitude`]: null, [`${prefix}CoordinateConfirmedAt`]: null } : {}) };
  });

  const next = () => {
    const message = stepError(step, form);
    setError(message || '');
    if (!message) setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const addImages = async () => {
    setError('');
    const remaining = MAX_IMAGES - form.images.length;
    if (remaining <= 0) return setError(`Tối đa ${MAX_IMAGES} ảnh cho mỗi lô hàng.`);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: remaining });
    if (result.canceled || !result.assets?.length) return undefined;
    const assets = result.assets.slice(0, remaining);
    const invalid = assets.find((asset) => asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType));
    if (invalid) return setError('Ảnh phải có định dạng JPEG, PNG hoặc WebP.');
    if (assets.some((asset) => asset.fileSize > 10 * 1024 * 1024)) return setError('Mỗi ảnh không được vượt quá 10 MB.');
    setImageBusy(true);
    try {
      const urls = await Promise.all(assets.map((asset) => uploadImage(asset, 'auction-goods')));
      setForm((current) => ({ ...current, images: [...current.images, ...urls] }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setImageBusy(false);
    }
    return undefined;
  };

  /**
   * Adds proof of the declared value (an invoice or receipt photo). Images only in this app; the file goes to the
   * private value-document folder and the form keeps its upload URL. The server checks the real file type.
   */
  const addValueDocuments = async () => {
    setError('');
    const remaining = MAX_VALUE_DOCUMENTS - form.valueDocuments.length;
    if (remaining <= 0) return setError(`Tối đa ${MAX_VALUE_DOCUMENTS} chứng từ giá trị hàng.`);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: remaining });
    if (result.canceled || !result.assets?.length) return undefined;
    const assets = result.assets.slice(0, remaining);
    const invalid = assets.find((asset) => asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType));
    if (invalid) return setError('Chứng từ phải là ảnh JPEG, PNG hoặc WebP.');
    if (assets.some((asset) => asset.fileSize > 10 * 1024 * 1024)) return setError('Mỗi chứng từ không được vượt quá 10 MB.');
    setDocumentBusy(true);
    try {
      const urls = await Promise.all(assets.map((asset) => uploadImage(asset, 'goods-value-docs')));
      setForm((current) => ({ ...current, valueDocuments: [...current.valueDocuments, ...urls] }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setDocumentBusy(false);
    }
    return undefined;
  };

  // One idempotency key per draft: a retry after a lost response does not create a second auction.
  const submit = () => run(async () => {
    const message = validateCreateAuctionForm(form);
    if (message) return setError(message);
    keyRef.current ??= newKey();
    setError('');
    try {
      const created = await biddingApi.create(mapFormToAuctionPayload(form), keyRef.current);
      const auctionId = created?.id || created?._id;
      router.replace(auctionId ? `/auctions/${auctionId}` : '/auctions');
    } catch (failure) {
      setError(failure.message);
      if (failure.status && failure.status < 500 && failure.status !== 409) keyRef.current = null;
    }
    return undefined;
  });

  const applyAddress = (address) => {
    const prefix = picker;
    setForm((current) => ({
      ...current,
      [`${prefix}LocationName`]: address.label,
      [`${prefix}Address`]: address.detail,
      [`${prefix}Province`]: address.province,
      [`${prefix}ContactName`]: address.contactName,
      [`${prefix}ContactPhone`]: address.contactPhone,
      [`${prefix}Latitude`]: address.latitude ?? null,
      [`${prefix}Longitude`]: address.longitude ?? null,
      [`${prefix}CoordinateConfirmedAt`]: address.coordinateConfirmedAt ?? null,
    }));
    setPicker(null);
  };

  const participation = getParticipationFeeQuote(form.maxPrice);
  const creation = getCreationFeeQuote(form.maxPrice);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Tạo phiên đấu giá' }} />
      <Screen bottomInset={140}>
        <View style={styles.steps} accessibilityRole="progressbar" accessibilityLabel={`Bước ${step + 1}/${STEPS.length}: ${STEPS[step]}`}>
          {STEPS.map((label, index) => (
            <Pressable key={label} onPress={() => index < step && setStep(index)} disabled={index >= step} style={styles.step} accessibilityRole="button" accessibilityLabel={`Bước ${index + 1}: ${label}`}>
              <View style={[styles.stepBar, { backgroundColor: index <= step ? colors.brand : colors.line }]} />
              <Text style={[styles.stepText, index === step && { color: colors.ink, fontFamily: fonts.bold }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Banner tone="danger">{error}</Banner> : null}

        {step === 0 && (
          <Section title="Thông tin hàng hóa">
            <TextField label="Tên lô hàng" required value={form.goodsName} onChangeText={set('goodsName')} placeholder="Ví dụ: 20 pallet linh kiện điện tử" maxLength={200} />
            <ChoiceChips label="Loại hàng" required options={GOODS_CATEGORIES} value={form.goodsCategory} onChange={set('goodsCategory')} />
            <View style={styles.pair}>
              <TextField style={{ flex: 1 }} label="Trọng lượng (tấn)" required value={form.weight} onChangeText={set('weight')} keyboardType="decimal-pad" />
              <TextField style={{ flex: 1 }} label="Thể tích (m³)" value={form.volume} onChangeText={set('volume')} keyboardType="decimal-pad" />
            </View>
            <MoneyField label="Giá trị hàng hóa" value={form.goodsValue} onChange={set('goodsValue')} hint="Không bắt buộc; giúp nhà xe đánh giá rủi ro." />
            <View style={styles.documents}>
              <Text style={styles.label}>Chứng từ giá trị hàng, không bắt buộc ({form.valueDocuments.length}/{MAX_VALUE_DOCUMENTS})</Text>
              <Text style={type.secondary}>Ảnh hóa đơn hoặc biên lai. Chứng từ được lưu riêng tư và dùng làm căn cứ khi có khiếu nại hàng hóa.</Text>
              <View style={styles.images}>
                {form.valueDocuments.map((url, index) => (
                  <Pressable key={url} accessibilityRole="button" accessibilityLabel={`Xóa chứng từ ${index + 1}`} onPress={() => setForm((current) => ({ ...current, valueDocuments: current.valueDocuments.filter((item) => item !== url) }))} style={styles.thumb}>
                    <Text style={type.secondary}>Chứng từ {index + 1}</Text>
                  </Pressable>
                ))}
              </View>
              <Button label={documentBusy ? 'Đang tải chứng từ...' : 'Thêm chứng từ'} variant="secondary" onPress={addValueDocuments} loading={documentBusy} disabled={form.valueDocuments.length >= MAX_VALUE_DOCUMENTS} />
            </View>
            <ChoiceChips label="Loại xe yêu cầu" required options={VEHICLE_TYPES} value={form.requiredVehicleType} onChange={set('requiredVehicleType')} />
            <View style={styles.pair}>
              <TextField style={{ flex: 1 }} label="Dài (m)" value={form.vehicleLength} onChangeText={set('vehicleLength')} keyboardType="decimal-pad" />
              <TextField style={{ flex: 1 }} label="Rộng (m)" value={form.vehicleWidth} onChangeText={set('vehicleWidth')} keyboardType="decimal-pad" />
              <TextField style={{ flex: 1 }} label="Cao (m)" value={form.vehicleHeight} onChangeText={set('vehicleHeight')} keyboardType="decimal-pad" />
            </View>
            <TextField label="Nhiệt độ yêu cầu" value={form.requiredTemp} onChangeText={set('requiredTemp')} placeholder="Ví dụ: 2–8°C" />
            <TextField label="Ghi chú cho nhà xe" value={form.description} onChangeText={set('description')} multiline maxLength={1000} />
            <Text style={styles.label}>Ảnh hàng hóa ({form.images.length}/{MAX_IMAGES})</Text>
            <View style={styles.images}>
              {form.images.map((url) => (
                <Pressable key={url} accessibilityRole="button" accessibilityLabel="Xóa ảnh" onPress={() => setForm((current) => ({ ...current, images: current.images.filter((item) => item !== url) }))} style={styles.thumb}>
                  <Text style={styles.thumbText}>Ảnh đã tải{'\n'}Chạm để xóa</Text>
                </Pressable>
              ))}
            </View>
            <Button label={imageBusy ? 'Đang tải ảnh...' : 'Thêm ảnh'} variant="secondary" onPress={addImages} loading={imageBusy} disabled={form.images.length >= MAX_IMAGES} />
          </Section>
        )}

        {step === 1 && ['from', 'to'].map((prefix) => (
          <Section key={prefix} title={prefix === 'from' ? 'Điểm lấy hàng' : 'Điểm giao hàng'} right={<Button label="Sổ địa chỉ" variant="secondary" onPress={() => setPicker(prefix)} style={{ minHeight: 40 }} />}>
            <TextField label="Tên kho / địa điểm" required value={form[`${prefix}LocationName`]} onChangeText={set(`${prefix}LocationName`)} />
            <TextField label="Tỉnh / thành phố" required value={form[`${prefix}Province`]} onChangeText={set(`${prefix}Province`)} />
            <TextField label="Địa chỉ chi tiết" required value={form[`${prefix}Address`]} onChangeText={set(`${prefix}Address`)} multiline />
            <MapPointField label={prefix === 'from' ? 'Pin kho lấy hàng' : 'Pin kho giao hàng'} point={{ latitude: form[`${prefix}Latitude`], longitude: form[`${prefix}Longitude`] }} onChange={(point) => setForm((current) => ({ ...current, [`${prefix}Latitude`]: point?.latitude ?? null, [`${prefix}Longitude`]: point?.longitude ?? null, [`${prefix}CoordinateConfirmedAt`]: point?.coordinateConfirmedAt ?? null }))} />
            <View style={styles.pair}>
              <TextField style={{ flex: 1 }} label="Người liên hệ" value={form[`${prefix}ContactName`]} onChangeText={set(`${prefix}ContactName`)} />
              <TextField style={{ flex: 1 }} label="Số điện thoại" value={form[`${prefix}ContactPhone`]} onChangeText={set(`${prefix}ContactPhone`)} keyboardType="phone-pad" />
            </View>
            <DateTimeField label={prefix === 'from' ? 'Lấy hàng sớm nhất' : 'Giao hàng sớm nhất'} value={form[prefix === 'from' ? 'earliestPickup' : 'earliestDelivery']} onChange={set(prefix === 'from' ? 'earliestPickup' : 'earliestDelivery')} />
            <DateTimeField label={prefix === 'from' ? 'Lấy hàng muộn nhất' : 'Giao hàng muộn nhất'} value={form[prefix === 'from' ? 'latestPickup' : 'latestDelivery']} onChange={set(prefix === 'from' ? 'latestPickup' : 'latestDelivery')} />
          </Section>
        ))}

        {step === 2 && (
          <>
            <Section title="Hình thức và giá">
              <ChoiceChips label="Hình thức đấu giá" required options={[{ value: 'PUBLIC', label: 'Công khai' }, { value: 'SEALED', label: 'Đấu giá kín' }]} value={form.auctionType} onChange={set('auctionType')} />
              <Text style={type.secondary}>{form.auctionType === 'SEALED' ? 'Mỗi nhà xe chỉ thấy giá của mình; bạn chọn người thắng sau khi phiên kết thúc.' : 'Giá thấp nhất được công bố; giá thấp nhất khi hết giờ thắng.'}</Text>
              <MoneyField label="Giá trần" required value={form.maxPrice} onChange={set('maxPrice')} />
              <MoneyField label="Bước giá" required value={form.priceStep} onChange={set('priceStep')} hint="Mỗi lần đặt phải thấp hơn giá thấp nhất ít nhất một bước." />
              <TextField label="Số lượt đặt tối đa mỗi nhà xe" value={form.maxBids} onChangeText={(value) => set('maxBids')(value.replace(/\D/g, ''))} keyboardType="number-pad" hint="Để trống theo mặc định của hệ thống." />
              <SwitchRow label="Yêu cầu tiền đặt cọc" hint="Nhà xe nộp cọc khi đăng ký; cọc của người thắng giữ đến khi giao xong." value={form.isDepositRequired} onChange={set('isDepositRequired')} />
              {form.isDepositRequired ? <MoneyField label="Tiền đặt cọc" required value={form.depositAmount} onChange={set('depositAmount')} /> : null}
            </Section>
            <Section title="Thời gian">
              <DateTimeField label="Mở đăng ký" required value={form.regStartTime} onChange={set('regStartTime')} />
              <DateTimeField label="Đóng đăng ký" required value={form.regEndTime} onChange={set('regEndTime')} />
              <DateTimeField label="Bắt đầu đấu giá" required value={form.startTime} onChange={set('startTime')} hint="Phải sau hoặc bằng lúc đóng đăng ký." />
              <DateTimeField label="Kết thúc đấu giá" required value={form.endTime} onChange={set('endTime')} />
            </Section>
          </>
        )}

        {step === 3 && (
          <>
            <Card>
              <Text style={styles.title}>{form.goodsName}</Text>
              <Text style={styles.route}>{form.fromProvince} → {form.toProvince}</Text>
              <Row label="Hàng hóa" value={`${form.goodsCategory} · ${form.weight} tấn`} />
              <Row label="Loại xe" value={VEHICLE_TYPES.find((item) => item.value === form.requiredVehicleType)?.label} />
              <Row label="Lấy hàng" value={`${form.fromLocationName}, ${form.fromAddress}`} />
              <Row label="Giao hàng" value={`${form.toLocationName}, ${form.toAddress}`} />
              <Row label="Hình thức" value={form.auctionType === 'SEALED' ? 'Đấu giá kín' : 'Công khai'} />
              <Row label="Giá trần / bước giá" value={`${formatMoney(form.maxPrice)} / ${formatMoney(form.priceStep)}`} strong />
              <Row label="Tiền đặt cọc" value={form.isDepositRequired ? formatMoney(form.depositAmount) : 'Không yêu cầu'} />
              <Row label="Đăng ký" value={`${formatDateTime(form.regStartTime)} – ${formatDateTime(form.regEndTime)}`} />
              <Row label="Đấu giá" value={`${formatDateTime(form.startTime)} – ${formatDateTime(form.endTime)}`} />
            </Card>
            <Banner tone="info" title="Phí">
              {`Phí tạo phiên ${formatMoney(creation.amount)} được giữ từ ví của bạn khi tạo. Nhà xe trả phí tham gia ${formatMoney(participation.amount)} khi đăng ký.`}
            </Banner>
          </>
        )}
      </Screen>
      <ActionBar>
        {step < STEPS.length - 1
          ? <Button label="Tiếp tục" onPress={next} />
          : <Button label="Tạo phiên đấu giá" onPress={submit} loading={busy} />}
        {step > 0 ? <Button label="Quay lại bước trước" variant="secondary" onPress={() => { setError(''); setStep(step - 1); }} disabled={busy} /> : null}
      </ActionBar>
      {picker ? <AddressPicker onClose={() => setPicker(null)} onPick={applyAddress} /> : null}
    </View>
  );
}

function AddressPicker({ onClose, onPick }) {
  const router = useRouter();
  const { data, state, error, reload } = useResource(() => addressApi.list(), []);
  const items = Array.isArray(data) ? data : [];
  return (
    <Sheet visible title="Chọn từ sổ địa chỉ" onClose={onClose} footer={<><Button label="Quản lý sổ địa chỉ" variant="secondary" onPress={() => { onClose(); router.push('/addresses'); }} /><Button label="Đóng" variant="secondary" onPress={onClose} /></>}>
      {state === 'loading' && <StateView kind="loading" title="Đang tải" />}
      {state === 'error' && <StateView kind="error" title="Không tải được sổ địa chỉ" message={error} actionLabel="Thử lại" onAction={() => reload()} />}
      {state === 'ready' && items.length === 0 && <StateView title="Sổ địa chỉ trống" message="Thêm kho thường dùng để chọn nhanh." />}
      {items.map((address) => (
        <Pressable key={address.id} accessibilityRole="button" onPress={() => onPick(address)} style={({ pressed }) => [styles.address, pressed && { backgroundColor: colors.surfaceSunken }]}>
          <Text style={styles.addressTitle}>{address.label}</Text>
          <Text style={type.secondary}>{address.detail}, {address.province}</Text>
          {address.contactName ? <Text style={type.caption}>{address.contactName} · {address.contactPhone}</Text> : null}
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 4 },
  step: { flex: 1, gap: 6, alignItems: 'center', minHeight: 40 },
  stepBar: { height: 4, borderRadius: 2, alignSelf: 'stretch' },
  stepText: { fontSize: 12, color: colors.inkMuted, textAlign: 'center' },
  pair: { flexDirection: 'row', gap: space.sm },
  label: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  documents: { gap: space.sm },
  thumb: { width: 96, height: 72, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', padding: 4 },
  thumbText: { fontSize: 11, textAlign: 'center', color: colors.brand, fontFamily: fonts.semibold },
  title: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },
  route: { fontSize: 15, fontFamily: fonts.semibold, color: colors.brand },
  address: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, gap: 2 },
  addressTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
});
