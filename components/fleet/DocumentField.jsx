import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button, FieldLabel } from '@/components/ui';
import { pickDocuments, pickImage } from '@/lib/filePick';
import { colors, radius, space, type, fonts } from '@/constants/theme';

/**
 * One required document (photo or PDF). Shows what is selected or already on file; the
 * stored file itself stays private and is reviewed by an administrator on the web.
 */
export default function DocumentField({ label, required, file, existing, onChange, onError, error, disabled }) {
  const choose = async (source) => {
    try {
      const asset = source === 'pdf' ? (await pickDocuments())[0] : await pickImage({ camera: source === 'camera' });
      if (!asset) return;
      if ((asset.fileSize || asset.size || 0) > 5 * 1024 * 1024) return onError?.('Tệp tối đa 5MB.');
      onChange(asset);
    } catch (failure) {
      onError?.(failure.message);
    }
  };
  return (
    <View style={styles.wrap}>
      <FieldLabel label={label} required={required} />
      <View style={[styles.box, error && { borderColor: colors.danger, borderWidth: 2 }]}>
        <Text style={type.body} numberOfLines={1}>
          {file ? `Đã chọn: ${file.fileName || file.name || 'ảnh mới'}` : existing ? 'Đã có tệp trong hồ sơ' : 'Chưa có tệp'}
        </Text>
        <View style={styles.row}>
          {Platform.OS !== 'web' ? <Button label="Chụp" variant="secondary" onPress={() => choose('camera')} disabled={disabled} style={styles.button} /> : null}
          <Button label="Chọn ảnh" variant="secondary" onPress={() => choose('library')} disabled={disabled} style={styles.button} />
          <Button label="PDF" variant="secondary" onPress={() => choose('pdf')} disabled={disabled} style={styles.button} />
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  button: { flex: 1, minHeight: 40, paddingHorizontal: space.sm },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.semibold },
});
