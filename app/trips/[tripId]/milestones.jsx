import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import DriverMilestoneTracker from '../../components/DriverMilestoneTracker';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8080';

/**
 * Screen: /trips/[tripId]/milestones
 *
 * Sử dụng: expo-router dynamic route
 * URL mẫu: /trips/uuid-here/milestones
 */
export default function TripMilestonesScreen() {
  const { tripId } = useLocalSearchParams();

  const [milestones, setMilestones] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    if (!tripId) return;
    fetchMilestones();
  }, [tripId]);

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/api/v1/trips/${tripId}/milestones`,
        {
          headers: {
            // Trong production: lấy từ auth context / SecureStore
            'X-User-Id':   'driver-uuid-here',
            'X-User-Role': 'DRIVER',
          },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMilestones(data);
    } catch (err) {
      setError(err?.message ?? 'Không thể tải danh sách cột mốc');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Đang tải hành trình...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>⚠️ {error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <DriverMilestoneTracker
        tripId={tripId}
        initialMilestones={milestones ?? []}
        apiBaseUrl={API_BASE_URL}
        authHeaders={{
          'X-User-Id':   'driver-uuid-here',
          'X-User-Role': 'DRIVER',
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 15,
    marginTop: 12,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
