import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { mapHtml } from '@/lib/mapHtml';
import { colors, type } from '@/constants/theme';

export default function JourneyMap({ payload, picker = false, onPointSelected, height = 290 }) {
  const frame = useRef(null), latest = useRef(payload);
  const [tileError, setTileError] = useState(false);
  latest.current = payload;
  const html = useMemo(() => mapHtml({ picker }), [picker]);
  const send = () => frame.current?.contentWindow?.postMessage({ type: 'mapData', payload: latest.current }, '*');
  useEffect(send, [payload]);
  useEffect(() => {
    const handle = (event) => {
      if (event.source !== frame.current?.contentWindow || !event.data || typeof event.data !== 'object') return;
      const data = event.data;
      if (data.type === 'ready') send();
      if (data.type === 'tileError') setTileError(true);
      if (data.type === 'tilesReady') setTileError(false);
      if (picker && data.type === 'pointSelected' && Number.isFinite(data.latitude) && Number.isFinite(data.longitude) && Math.abs(data.latitude) <= 90 && Math.abs(data.longitude) <= 180) onPointSelected?.({ latitude: data.latitude, longitude: data.longitude });
    };
    window.addEventListener('message', handle); return () => window.removeEventListener('message', handle);
  }, [picker, onPointSelected]);
  return <View style={{ gap: 6 }}>
    <iframe ref={frame} srcDoc={html} title={picker ? 'Chọn vị trí kho trên bản đồ' : 'Bản đồ hành trình chuyến hàng'} sandbox="allow-scripts" referrerPolicy="strict-origin-when-cross-origin" onLoad={send} style={{ width: '100%', height, border: `1px solid ${colors.line}`, borderRadius: 14 }} />
    {tileError ? <Text style={type.caption}>Chưa tải được bản đồ nền. Điểm và hành trình vẫn hiển thị; kiểm tra mạng để tải lại.</Text> : null}
  </View>;
}
