import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { getTrackingState, subscribeTracking, startTripTracking, stopTripTracking } from './driverTracking';
import { GPS_STATUSES } from './trackingData';

/**
 * Automatically starts GPS sharing when a driver opens an active trip (WAITING_PICKUP, PICKED_UP, IN_TRANSIT)
 * and stops when the trip leaves active statuses.
 */
export function useAutoTripTracking(trip) {
  const [state, setState] = useState(getTrackingState);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const attemptedTripRef = useRef(null);

  useEffect(() => subscribeTracking(setState), []);

  const tripId = trip?.id;
  const tripStatus = trip?.status;
  const isTrackable = Boolean(tripId && GPS_STATUSES.includes(tripStatus));
  const active = Boolean(tripId && state.active?.tripId === tripId);

  const ensureTracking = useCallback(async () => {
    if (!trip || !isTrackable) return;
    setStarting(true);
    setStartError('');
    try {
      await startTripTracking(trip, { background: Platform.OS !== 'web' });
    } catch (err) {
      setStartError(err?.message || 'Chưa bật được định vị trực tiếp.');
    } finally {
      setStarting(false);
    }
  }, [trip, isTrackable]);

  useEffect(() => {
    if (!isTrackable) {
      if (active) {
        void stopTripTracking({ notifyServer: false });
      }
      attemptedTripRef.current = null;
      return;
    }
    if (active) {
      setStartError('');
      return;
    }
    const key = `${tripId}:${tripStatus}`;
    if (attemptedTripRef.current === key) return;
    attemptedTripRef.current = key;
    void ensureTracking();
  }, [tripId, tripStatus, isTrackable, active, ensureTracking]);

  return {
    active,
    starting,
    mode: state.mode,
    queued: state.queued,
    error: startError || state.error,
    retry: ensureTracking,
  };
}

