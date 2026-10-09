import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionBar, Banner, Band, Button, MoneyField, Row, Screen, Section, StateView, StatusBadge, Tabs, TextField, useResource, useSingleFlight } from '@/components/ui';
import Sheet from '@/components/Sheet';
import PaymentCheckout, { openWebCheckout } from '@/components/PaymentCheckout';
import { useAuth } from '@/lib/auth';
import { toPage, walletApi } from '@/lib/services';
import { TOPUP_STATUS, TRANSACTION_STATUS, TRANSACTION_TYPE, WITHDRAWAL_STATUS, metaOf, signedAmount } from '@/lib/ownerMeta';
import { formatDateTime, formatMoney } from '@/lib/shared/format';
import { validateWalletAction } from '@/lib/validators';
import { colors, radius, space, type, fonts } from '@/constants/theme';

const PAGE_SIZE = 20;
const POLL_MS = 4000;
const POLL_LIMIT_MS = 15 * 60 * 1000;
const STATUS_FILTERS = [{ value: '', label: 'Tất cả' }, { value: 'SUCCESS', label: 'Thành công' }, { value: 'PENDING', label: 'Đang xử lý' }, { value: 'FAILED', label: 'Thất bại' }];

export default function WalletTab() {
  const { session } = useAuth();
  if (!session || session.role === 'DRIVER') return null;
  return <WalletScreen key={session.accountId} />;
}

function WalletScreen() {
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [extra, setExtra] = useState({ items: [], page: 1, totalPages: 1, loading: false });
  const { data, state, error, refreshing, reload } = useResource(async () => {
    const [wallet, transactions, withdrawals, topUps] = await Promise.all([
      walletApi.me(),
      walletApi.transactions({ page: 1, pageSize: PAGE_SIZE }),
      walletApi.withdrawals({ page: 1, pageSize: 20 }).catch(() => null),
      walletApi.topUps({ page: 1, pageSize: 10 }).catch(() => null),
    ]);
    const page = toPage(transactions);
    setExtra({ items: [], page: 1, totalPages: page.pagination.totalPages || 1, loading: false });
    return { wallet, transactions: page.items, withdrawals: withdrawals ? toPage(withdrawals).items : [], topUps: topUps ? toPage(topUps).items : [] };
  }, []);
  const [action, setAction] = useState(null); // 'topup' | 'withdraw'
  const [form, setForm] = useState({ amount: '', bankName: '', bankAccountNumber: '', accountHolderName: '' });
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [pendingInvoice, setPendingInvoice] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, run] = useSingleFlight();
  const pollStarted = useRef(0);

  // Top-up result comes from the server (SePay IPN), never from the checkout page.
  useEffect(() => {
    if (!pendingInvoice) return undefined;
    let active = true;
    let checking = false;
    pollStarted.current = Date.now();
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const result = await walletApi.topUp(pendingInvoice);
        if (!active) return;
        if (result?.status === 'PAID') {
          setPendingInvoice(null);
          setCheckout(null);
          setNotice({ tone: 'success', text: 'Nạp tiền thành công. Số dư đã được cập nhật.' });
          void reload();
        } else if (['EXPIRED', 'FAILED', 'CANCELLED'].includes(result?.status)) {
          setPendingInvoice(null);
          setNotice({ tone: 'warning', text: 'Đơn nạp tiền không hoàn tất.' });
          void reload();
        } else if (Date.now() - pollStarted.current > POLL_LIMIT_MS) {
          setPendingInvoice(null);
          setNotice({ tone: 'info', text: 'Đơn nạp đang chờ xác nhận thanh toán. Kéo xuống để tải lại sau khi thanh toán.' });
        }
      } catch {
        // SePay may deliver the IPN a few seconds after checkout finishes.
      } finally {
        checking = false;
      }
    };
    void check();
    const interval = setInterval(check, POLL_MS);
    return () => { active = false; clearInterval(interval); };
  }, [pendingInvoice, reload]);

  const loadMore = async () => {
    if (extra.loading) return;
    const next = extra.page + 1;
    setExtra((current) => ({ ...current, loading: true }));
    try {
      const page = toPage(await walletApi.transactions({ page: next, pageSize: PAGE_SIZE }));
      setExtra((current) => ({ items: [...current.items, ...page.items], page: next, totalPages: page.pagination.totalPages || current.totalPages, loading: false }));
    } catch (failure) {
      setExtra((current) => ({ ...current, loading: false }));
      setNotice({ tone: 'danger', text: failure.message });
    }
  };

  const open = (kind) => {
    setForm({ amount: '', bankName: '', bankAccountNumber: '', accountHolderName: '' });
    setFormError('');
    setAction(kind);
  };

  const submit = () => run(async () => {
    const message = validateWalletAction(action, form);
    if (message) return setFormError(message);
    setFormError('');
    try {
      const amount = Number(form.amount);
      if (action === 'withdraw') {
        await walletApi.withdraw({ amount, bankName: form.bankName.trim(), bankAccountNumber: form.bankAccountNumber.trim(), accountHolderName: form.accountHolderName.trim() });
        setNotice({ tone: 'success', text: `Đã gửi yêu cầu rút ${formatMoney(amount)}. Số tiền được tạm giữ đến khi quản trị viên xử lý.` });
        setAction(null);
        await reload();
      } else {
        const created = await walletApi.createTopUp(amount, Platform.OS === 'web' ? window.location.href : undefined);
        setAction(null);
        setPendingInvoice(created.invoiceNumber);
        if (Platform.OS === 'web') openWebCheckout(created);
        else setCheckout(created);
        setNotice({ tone: 'info', text: `Đã tạo đơn nạp ${formatMoney(amount)}. Hoàn tất thanh toán để cập nhật số dư.` });
        void reload();
      }
    } catch (failure) {
      setFormError(failure.message);
    }
    return undefined;
  });

  const cancelTopUp = (invoiceNumber) => run(async () => {
    try {
      await walletApi.cancelTopUp(invoiceNumber);
      if (pendingInvoice === invoiceNumber) setPendingInvoice(null);
      setNotice({ tone: 'success', text: 'Đã hủy đơn nạp tiền chưa thanh toán.' });
    } catch (failure) {
      setNotice({ tone: 'danger', text: failure.message });
    }
    await reload();
  });

  const openDetail = async (transaction) => {
    setDetail({ ...transaction, loading: true });
    try {
      const full = await walletApi.transaction(transaction.id);
      setDetail({ ...transaction, ...full, loading: false });
    } catch {
      setDetail({ ...transaction, loading: false });
    }
  };

  const transactions = useMemo(() => [...(data?.transactions || []), ...extra.items], [data, extra.items]);
  const needle = query.trim().toLocaleLowerCase('vi');
  const visible = transactions.filter((item) => (!status || item.status === status)
    && (!needle || [TRANSACTION_TYPE[item.type], item.description, item.referenceCode, item.id].join(' ').toLocaleLowerCase('vi').includes(needle)));
  const openTopUps = (data?.topUps || []).filter((item) => item.status === 'CREATED' || item.status === 'PENDING');

  if (state === 'loading') return <StateView kind="loading" title="Đang tải ví" />;
  if (state === 'error') return <StateView kind="error" title="Không tải được ví" message={error} actionLabel="Thử lại" onAction={() => reload()} />;
  const wallet = data.wallet || {};

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen refreshing={refreshing} onRefresh={() => reload({ pull: true })} bottomInset={90}>
        {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
        {pendingInvoice ? <Banner tone="info" title="Đang chờ xác nhận thanh toán">{`Đơn ${pendingInvoice}. Ứng dụng tự kiểm tra với máy chủ mỗi vài giây.`}</Banner> : null}
        {error ? <Text style={[type.caption, { color: colors.warning }]}>Chưa làm mới được: {error}</Text> : null}
        <Band
          eyebrow="Số dư khả dụng"
          value={formatMoney(wallet.availableBalance ?? 0)}
          caption={`Đang tạm giữ ${formatMoney(wallet.frozenBalance ?? 0)} · tổng ${formatMoney(wallet.balance ?? 0)}. Tiền tạm giữ gồm cọc đấu giá và yêu cầu rút đang chờ duyệt.`}
        />

        {openTopUps.length ? (
          <Section title="Đơn nạp chưa thanh toán">
            {openTopUps.map((item) => (
              <View key={item.invoiceNumber} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.amount, type.tabular]}>{formatMoney(item.amount)}</Text>
                  <Text style={[type.caption, type.tabular]}>{item.invoiceNumber} · hết hạn {formatDateTime(item.expiresAt)}</Text>
                </View>
                <Button label="Hủy" variant="danger" onPress={() => cancelTopUp(item.invoiceNumber)} disabled={busy} style={{ minHeight: 40 }} />
              </View>
            ))}
          </Section>
        ) : null}

        {data.withdrawals.length ? (
          <Section title="Yêu cầu rút tiền">
            {data.withdrawals.slice(0, 6).map((item) => (
              <View key={item.id} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.amount, type.tabular]}>{formatMoney(item.amount)}</Text>
                  <Text style={type.caption}>{item.bankName} · {item.maskedBankAccountNumber} · {formatDateTime(item.createdAt)}</Text>
                  {item.rejectionReason ? <Text style={[type.caption, { color: colors.danger }]}>{item.rejectionReason}</Text> : null}
                </View>
                <StatusBadge {...metaOf(WITHDRAWAL_STATUS, item.status)} />
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="Lịch sử giao dịch">
          <TextField placeholder="Tìm theo loại, mã tham chiếu" value={query} onChangeText={setQuery} accessibilityLabel="Tìm giao dịch" />
          <Tabs label="Trạng thái giao dịch" value={status} onChange={setStatus} options={STATUS_FILTERS} />
          {visible.length === 0 ? <Text style={type.secondary}>Không có giao dịch phù hợp.</Text> : null}
          {visible.map((item) => {
            const amount = signedAmount(item);
            return (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => openDetail(item)} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceSunken }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{TRANSACTION_TYPE[item.type] || item.description || 'Giao dịch ví'}</Text>
                  <Text style={[type.caption, type.tabular]}>{formatDateTime(item.createdAt)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.amount, type.tabular, { color: amount < 0 ? colors.danger : colors.success }]}>{amount < 0 ? '−' : '+'}{formatMoney(Math.abs(amount))}</Text>
                  <StatusBadge {...metaOf(TRANSACTION_STATUS, item.status)} />
                </View>
              </Pressable>
            );
          })}
          {extra.page < extra.totalPages ? <Button label="Tải thêm giao dịch" variant="secondary" onPress={loadMore} loading={extra.loading} /> : null}
        </Section>
      </Screen>

      <ActionBar>
        <View style={styles.pair}>
          <Button label="Nạp tiền" onPress={() => open('topup')} style={{ flex: 1 }} disabled={Boolean(pendingInvoice)} />
          <Button label="Rút tiền" variant="secondary" onPress={() => open('withdraw')} style={{ flex: 1 }} />
        </View>
      </ActionBar>

      <Sheet visible={Boolean(action)} title={action === 'withdraw' ? 'Rút tiền về ngân hàng' : 'Nạp tiền qua SePay'} busy={busy} onClose={() => setAction(null)}
        footer={<><Button label={action === 'withdraw' ? 'Gửi yêu cầu rút' : 'Tạo đơn và thanh toán'} onPress={submit} loading={busy} /><Button label="Hủy" variant="secondary" onPress={() => setAction(null)} disabled={busy} /></>}>
        <MoneyField label="Số tiền" required value={form.amount} onChange={(amount) => setForm((current) => ({ ...current, amount }))} hint="Tối thiểu 10.000 ₫." />
        {action === 'withdraw' ? (
          <>
            <Text style={type.secondary}>Khả dụng {formatMoney(wallet.availableBalance ?? 0)}. Số tiền được tạm giữ đến khi quản trị viên duyệt.</Text>
            <TextField label="Ngân hàng" required value={form.bankName} onChangeText={(bankName) => setForm((current) => ({ ...current, bankName }))} />
            <TextField label="Số tài khoản" required value={form.bankAccountNumber} onChangeText={(value) => setForm((current) => ({ ...current, bankAccountNumber: value.replace(/\D/g, '') }))} keyboardType="number-pad" />
            <TextField label="Tên chủ tài khoản" required value={form.accountHolderName} onChangeText={(accountHolderName) => setForm((current) => ({ ...current, accountHolderName }))} autoCapitalize="characters" />
          </>
        ) : <Text style={type.secondary}>Trang thanh toán SePay mở trong ứng dụng. Số dư chỉ cập nhật khi máy chủ nhận xác nhận thanh toán.</Text>}
        {formError ? <Banner tone="danger">{formError}</Banner> : null}
      </Sheet>

      <Sheet visible={Boolean(detail)} title="Chi tiết giao dịch" onClose={() => setDetail(null)} footer={<Button label="Đóng" variant="secondary" onPress={() => setDetail(null)} />}>
        {detail ? (
          <>
            <Row label="Loại" value={TRANSACTION_TYPE[detail.type] || detail.type} />
            <Row label="Số tiền" value={formatMoney(Math.abs(Number(detail.amount)))} strong />
            <Row label="Trạng thái" value={metaOf(TRANSACTION_STATUS, detail.status).label} />
            <Row label="Thời gian" value={formatDateTime(detail.createdAt)} />
            <Row label="Phương thức" value={detail.paymentMethod} />
            <Row label="Mã tham chiếu" value={detail.referenceCode} selectable />
            <Row label="Mô tả" value={detail.description} />
            <Row label="Mã giao dịch" value={detail.id} selectable />
          </>
        ) : null}
      </Sheet>

      <PaymentCheckout checkout={checkout} onClose={() => setCheckout(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  balance: { fontSize: 30, fontFamily: fonts.bold, color: colors.ink },
  pair: { flexDirection: 'row', gap: space.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: space.sm, borderRadius: radius.sm },
  amount: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  label: { fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
});
