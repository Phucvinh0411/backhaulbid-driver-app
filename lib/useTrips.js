import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { api } from './api';
import { sortTrips } from './trips';
import { useAuth } from './auth';
import { scopeKey } from './sessionModel';

/** Trips assigned to the signed-in driver (GET /api/v1/trips/mine), refreshed when the screen gains focus. */
export function useTrips() {
  const { session } = useAuth();
  const scope = scopeKey(session);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const mounted = useRef(true);
  const [loadedScope, setLoadedScope] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [trips, setTrips] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const flight = useRef(false);

  const load = useCallback(async ({ pull = false } = {}) => {
    const owner = scope;
    if (!owner || flight.current) return;
    flight.current = true;
    if (pull) setRefreshing(true);
    try {
      const data = await api.get('/api/v1/trips/mine');
      if (!mounted.current || currentScope.current !== owner) return;
      setLoadedScope(owner);
      setTrips(sortTrips(Array.isArray(data) ? data : data?.data || []));
      setError('');
      setState('ready');
    } catch (loadError) {
      if (!mounted.current || currentScope.current !== owner) return;
      setLoadedScope(owner);
      setError(loadError.message);
      setState((current) => (current === 'ready' ? 'ready' : 'error'));
    } finally {
      flight.current = false;
      if (mounted.current && currentScope.current === owner) setRefreshing(false);
    }
  }, [scope]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => { if (AppState.currentState === 'active' && globalThis.document?.visibilityState !== 'hidden') void load(); }, 15_000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const matching = loadedScope === scope;
  return { trips: matching ? trips : [], state: matching ? state : 'loading', error: matching ? error : '', refreshing: matching && refreshing, reload: load };
}
