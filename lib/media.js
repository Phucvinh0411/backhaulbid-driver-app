import { Platform } from 'react-native';
import { request } from './api';

/** Uploads a picked image or document to media-service (POST /api/v1/media/upload) and returns its stored URL. */
export async function uploadImage(asset, folder = 'delivery-proofs') {
  const form = new FormData();
  const name = asset.fileName || asset.name || `upload-${Date.now()}.jpg`;
  const mimeType = asset.mimeType || 'image/jpeg';
  if (Platform.OS === 'web') {
    const blob = asset.file || (await (await fetch(asset.uri)).blob());
    form.append('file', blob, name);
  } else {
    form.append('file', { uri: asset.uri, name, type: mimeType });
  }
  form.append('folder', folder);
  const data = await request('/api/v1/media/upload', { method: 'POST', body: form });
  const url = data?.url || data?.data?.url;
  if (!url) throw new Error('Máy chủ không trả về đường dẫn ảnh. Vui lòng thử lại.');
  return url;
}
