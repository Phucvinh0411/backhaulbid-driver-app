import { useMemo } from 'react';
import { View } from 'react-native';
import QRCode from 'qrcode';
import { colors } from '@/constants/theme';

/**
 * QR for a "mã nhận chuyến", drawn with plain views (no native SVG module). The value only lives in
 * memory while the sheet is open; it is never written to a URL, log or storage.
 */
export default function DriverCodeQr({ value, size = 220 }) {
  const matrix = useMemo(() => {
    if (!value) return null;
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const rows = [];
    for (let y = 0; y < modules.size; y++) {
      const row = [];
      for (let x = 0; x < modules.size; x++) row.push(modules.get(x, y));
      rows.push(row);
    }
    return rows;
  }, [value]);
  if (!matrix) return null;
  const quiet = 4;
  const cell = Math.floor(size / (matrix.length + quiet * 2));
  return (
    <View accessibilityLabel="Mã QR nhận chuyến" accessible style={{ alignSelf: 'center', padding: cell * quiet, backgroundColor: '#fff', borderRadius: 8 }}>
      {matrix.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.map((dark, x) => <View key={x} style={{ width: cell, height: cell, backgroundColor: dark ? colors.ink : '#fff' }} />)}
        </View>
      ))}
    </View>
  );
}
