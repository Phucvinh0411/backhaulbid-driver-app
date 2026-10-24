import { useEffect, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { mediaViewUrl } from '@/lib/tracking';
import { colors, type } from '@/constants/theme';

// A photo the driver has just picked is shown from its device URI until the record is saved.
const LOCAL_URI = /^(file|content|blob|data):/i;

/**
 * Image stored in the private bucket or read through the API. Native sends the bearer header with the request;
 * the web build (testing only) fetches it and shows a local object URL. Device URIs are shown as they are.
 */
export default function ProofImage({ url, style, label }) {
  const { session } = useAuth();
  const isLocal = typeof url === 'string' && LOCAL_URI.test(url.trim());
  const source = isLocal ? url.trim() : mediaViewUrl(url, API_BASE_URL);
  const token = session?.accessToken;
  const [webUri, setWebUri] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !source || isLocal) return undefined;
    let objectUrl = null;
    let active = true;
    setFailed(false);
    fetch(source, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'omit' })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setWebUri(objectUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, token, isLocal]);

  if (!source || failed) {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken }]} accessibilityLabel={label}>
        <Text style={[type.caption, { textAlign: 'center' }]}>Không hiển thị được ảnh</Text>
      </View>
    );
  }
  if (isLocal) {
    return <Image source={{ uri: source }} style={style} accessibilityLabel={label} onError={() => setFailed(true)} resizeMode="cover" />;
  }
  const imageSource = Platform.OS === 'web' ? (webUri ? { uri: webUri } : null) : { uri: source, headers: token ? { Authorization: `Bearer ${token}` } : undefined };
  if (!imageSource) return <View style={[style, { backgroundColor: colors.surfaceSunken }]} accessibilityLabel={label} />;
  return <Image source={imageSource} style={style} accessibilityLabel={label} onError={() => setFailed(true)} resizeMode="cover" />;
}
