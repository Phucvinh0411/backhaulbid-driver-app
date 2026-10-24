import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { isDriverSession, scopeKey } from '@/lib/sessionModel';
import DriverMilestoneTracker from '@/components/DriverMilestoneTracker';
import { Section, StateView } from '@/components/ui';
import { api } from '@/lib/api';
import { colors, radius, space, fonts } from '@/constants/theme';

function useLocalSearchParamsTrip() {
  return String(useLocalSearchParams().tripId || '').toLowerCase();
}

export default function DriverMilestoneGate() {
  const { session, ready } = useAuth();
  const tripId = useLocalSearchParamsTrip();
  // Wait for the stored session; redirecting earlier would drop deep links.
  if (!ready || !session) return null;
  // A driver code session opens only its own trip; any other ID (old link, other trip) goes home.
  if (!isDriverSession(session) || tripId !== session.tripId) return <Redirect href="/" />;
  return <TripMilestonesScreen key={scopeKey(session)} />;
}

function TripMilestonesScreen() {
  const { tripId } = useLocalSearchParams();
  const [milestones, setMilestones] = useState([]);
  const [tripStatus, setTripStatus] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async ({ pull = false } = {}) => {
      if (pull) setRefreshing(true);
      try {
        const [trip, list] = await Promise.all([api.get(`/api/v1/trips/${tripId}`), api.get(`/api/v1/trips/${tripId}/milestones`)]);
        setTripStatus(trip?.status || null);
        setMilestones(Array.isArray(list) ? list : list?.data || []);
        setError('');
        setState('ready');
      } catch (loadError) {
        setError(loadError.message);
        setState((current) => (current === 'ready' ? 'ready' : 'error'));
      } finally {
        setRefreshing(false);
      }
    },
    [tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ pull: true })} tintColor={colors.brand} />}
    >
      {notice ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
      {state === 'loading' && <StateView kind="loading" title="Đang tải cột mốc" />}
      {state === 'error' && <StateView kind="error" title="Không tải được cột mốc" message={error} actionLabel="Thử lại" onAction={() => load()} />}
      {state === 'ready' && milestones.length === 0 && <StateView title="Chuyến chưa có cột mốc" message="Chủ xe chưa thiết lập cột mốc cho chuyến này." />}
      {state === 'ready' && milestones.length > 0 && (
        <Section title="Check-in theo thứ tự">
          <DriverMilestoneTracker
            tripId={tripId}
            milestones={milestones}
            tripStatus={tripStatus}
            onChanged={async (message) => {
              setNotice(message);
              await load();
            }}
          />
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, gap: space.lg },
  notice: { backgroundColor: colors.successSoft, borderRadius: radius.md, padding: space.md },
  noticeText: { color: colors.success, fontFamily: fonts.semibold },
});
