import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { mapHtml, MAP_BASE_URL } from '@/lib/mapHtml';
import { colors, type } from '@/constants/theme';

export default function JourneyMap({ payload, picker = false, onPointSelected, height = 290 }) {
  const view = useRef(null), ready = useRef(false), latest = useRef(payload);
  const [tileError, setTileError] = useState(false);
  latest.current = payload;
  const source = useMemo(() => ({ html: mapHtml({ picker }), baseUrl: MAP_BASE_URL }), [picker]);
  const send = () => {
    if (!ready.current || !latest.current) return;
    const raw = JSON.stringify(latest.current).replace(/</g, '\\u003c');
    view.current?.injectJavaScript(`window.setMapPayload(${raw});true;`);
  };
  useEffect(send, [payload]);
  return <View style={{ gap: 6 }}>
    <View style={{ height, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
      <WebView ref={view} source={source} style={{ flex: 1 }} javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} allowUniversalAccessFromFileURLs={false} mixedContentMode="never" setSupportMultipleWindows={false} applicationNameForUserAgent="BackHaulBid/1.1.0" originWhitelist={['https://backhaulbid.local']} onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url === MAP_BASE_URL}
        onLoad={() => { ready.current = true; send(); }}
        onMessage={(event) => { if (event.nativeEvent.data.length > 1000) return; try { const data = JSON.parse(event.nativeEvent.data); if (data.type === 'ready') { ready.current = true; send(); } if (data.type === 'tileError') setTileError(true); if (data.type === 'tilesReady') setTileError(false); if (picker && data.type === 'pointSelected' && Number.isFinite(data.latitude) && Number.isFinite(data.longitude) && Math.abs(data.latitude) <= 90 && Math.abs(data.longitude) <= 180) onPointSelected?.({ latitude: data.latitude, longitude: data.longitude }); } catch {} }} />
    </View>
    {tileError ? <Text style={type.caption}>Chưa tải được bản đồ nền. Điểm và hành trình vẫn hiển thị; kiểm tra mạng để tải lại.</Text> : null}
  </View>;
}
