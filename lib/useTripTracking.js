import { useCallback, useRef, useState } from 'react';
import { scopeKey } from './sessionModel';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from './api';
import { mergeLocations, MAP_POINT_LIMIT } from './trackingData';
import { useAuth } from './auth';

export function useTripTracking(tripId) {
  const { session } = useAuth();
  const scope = `${scopeKey(session)}:${tripId || ''}`;
  const [tracking, setTracking] = useState(null), [points, setPoints] = useState([]), [error, setError] = useState('');
  const [loadedScope, setLoadedScope] = useState('');
  const [sampling, setSampling] = useState({ sampled: false, totalPoints: 0 });
  const owner = useRef(scope), cursor = useRef(null), generation = useRef(0), flight = useRef(null), received = useRef([]);
  const samplingRef = useRef({ sampled: false, totalPoints: 0 });
  if (owner.current !== scope) { owner.current = scope; cursor.current = null; received.current = []; samplingRef.current = { sampled: false, totalPoints: 0 }; generation.current++; }
  const reload = useCallback(async () => {
    if (flight.current?.scope === scope || !tripId || !session) return;
    const requestOwner = { scope }; flight.current = requestOwner;
    const token = generation.current, base = `/api/v1/trips/${encodeURIComponent(tripId)}`;
    try {
      const snapshot = await api.get(`${base}/tracking`);
      if (token !== generation.current || owner.current !== scope) return;
      let after = cursor.current, incoming = [];
      // Bound catch-up after offline periods; another poll can continue from the cursor.
      for (let page = 0; page < 3; page++) {
        const history = await api.get(`${base}/locations/history?limit=${after ? 200 : 1000}${after ? `&cursor=${encodeURIComponent(after)}` : ''}`);
        if (token !== generation.current || owner.current !== scope) return;
        const totalPoints = Math.max(samplingRef.current.totalPoints, Number(history.totalPoints) || 0);
        samplingRef.current = { sampled: samplingRef.current.sampled || Boolean(history.sampled) || totalPoints > MAP_POINT_LIMIT, totalPoints };
        incoming.push(...(history.points || []));
        after = history.nextCursor || after;
        if (!history.hasMore) break;
      }
      cursor.current = after;
      received.current = mergeLocations(received.current, incoming);
      setLoadedScope(scope); setTracking(snapshot); setPoints(received.current); setSampling(samplingRef.current); setError('');
    } catch (failure) {
      if (token === generation.current && owner.current === scope) {
        if ([401, 403, 404].includes(failure.status)) {
          cursor.current = null; received.current = []; samplingRef.current = { sampled: false, totalPoints: 0 };
          setTracking(null); setPoints([]); setSampling(samplingRef.current);
        }
        setLoadedScope(scope); setError(failure.message);
      }
    } finally { if (flight.current === requestOwner) flight.current = null; }
  }, [tripId, scope, Boolean(session)]);
  useFocusEffect(useCallback(() => {
    void reload();
    const timer = setInterval(() => { if (AppState.currentState === 'active' && (Platform.OS !== 'web' || globalThis.document?.visibilityState !== 'hidden')) void reload(); }, 15_000);
    return () => { clearInterval(timer); generation.current++; };
  }, [reload]));
  const matching = loadedScope === scope;
  return { tracking: matching ? tracking : null, points: matching ? points : [], sampling: matching ? sampling : { sampled: false, totalPoints: 0 }, error: matching ? error : '', reload };
}
