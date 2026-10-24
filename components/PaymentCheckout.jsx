import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';

const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML page that POSTs the SePay checkout form as soon as it loads. */
export function checkoutHtml(checkout) {
  const inputs = Object.entries(checkout?.formFields || {})
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join('');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head>`
    + `<body style="font-family:sans-serif;padding:24px"><p>Đang mở trang thanh toán…</p>`
    + `<form id="f" method="POST" action="${escapeHtml(checkout?.checkoutUrl)}">${inputs}</form>`
    + `<script>document.getElementById('f').submit();</script></body></html>`;
}

/** Opens the checkout in a new browser tab (web build used for testing only). */
export function openWebCheckout(checkout) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = checkout.checkoutUrl;
  form.target = '_blank';
  Object.entries(checkout.formFields || {}).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

/**
 * Full-screen SePay checkout. The balance is never updated from this page: the wallet screen
 * polls the server for the order status, so closing the page early is safe.
 */
export default function PaymentCheckout({ checkout, onClose }) {
  const insets = useSafeAreaInsets();
  if (!checkout || Platform.OS === 'web') return null;
  // Loaded lazily so the web build does not need the native module.
  const { WebView } = require('react-native-webview');
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={[type.heading, { flex: 1 }]}>Thanh toán SePay</Text>
        <Button label="Đóng" variant="secondary" onPress={onClose} style={{ minHeight: 40 }} />
      </View>
      <Text style={styles.note}>Số dư cập nhật khi hệ thống nhận xác nhận từ SePay, không dựa vào trang này.</Text>
      <WebView originWhitelist={['*']} source={{ html: checkoutHtml(checkout) }} style={{ flex: 1 }} startInLoadingState />
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  note: { fontSize: 13, color: colors.inkMuted, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.surfaceSunken },
});
