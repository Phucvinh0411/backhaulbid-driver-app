import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

/** Photo from the camera (asks permission) or the library. Returns an asset or null. */
export async function pickImage({ camera = false } = {}) {
  if (camera && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Chưa có quyền dùng camera. Bật quyền trong Cài đặt hoặc chọn ảnh có sẵn.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    return result.canceled ? null : result.assets?.[0] || null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  return result.canceled ? null : result.assets?.[0] || null;
}

/** JPG/PNG/PDF documents (or any type passed in). Returns an array of assets. */
export async function pickDocuments({ multiple = false, type = ['image/jpeg', 'image/png', 'application/pdf'] } = {}) {
  const result = await DocumentPicker.getDocumentAsync({ type, multiple, copyToCacheDirectory: true });
  return result.canceled ? [] : result.assets || [];
}

/** Text content of a picked file (CSV import). */
export async function readText(asset) {
  if (asset?.file?.text) return asset.file.text();
  const response = await fetch(asset.uri);
  return response.text();
}
