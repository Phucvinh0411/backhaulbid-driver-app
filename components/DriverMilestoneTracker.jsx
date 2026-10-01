import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type MilestoneStatus = 'PENDING' | 'REACHED';

export interface Milestone {
  id: string;
  tripId: string;
  milestoneName: string;
  targetLat: number;
  targetLng: number;
  actualLat?: number;
  actualLng?: number;
  status: MilestoneStatus;
  reachedAt?: string;
  sequenceOrder: number;
}

interface Props {
  tripId: string;
  initialMilestones: Milestone[];
  apiBaseUrl: string;
  /** JWT hoặc token để gắn vào header nếu cần */
  authHeaders?: Record<string, string>;
}

// ─────────────────────────────────────────────
// Toast helper (React Native Alert)
// ─────────────────────────────────────────────
const showToast = (title: string, message: string) => {
  Alert.alert(title, message);
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function DriverMilestoneTracker({
  tripId,
  initialMilestones,
  apiBaseUrl,
  authHeaders = {},
}: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>(
    [...initialMilestones].sort((a, b) => a.sequenceOrder - b.sequenceOrder),
  );
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [isLocating, setIsLocating]     = useState(false);

  // ─── Xin quyền + lấy GPS ──────────────────────────────────────────────────
  const getCurrentLocation = useCallback(async (): Promise<{
    lat: number;
    lng: number;
  }> => {
    // BƯỚC 1: Kiểm tra & xin quyền Location
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      throw new Error(
        'Quyền truy cập vị trí bị từ chối.\nVui lòng vào Cài đặt > Ứng dụng và bật quyền Vị trí.',
      );
    }

    // BƯỚC 2: Lấy vị trí hiện tại với độ chính xác cao
    setIsLocating(true);
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // Tương đương enableHighAccuracy: true
      });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } finally {
      setIsLocating(false);
    }
  }, []);

  // ─── Gọi API Check-in ─────────────────────────────────────────────────────
  const callCheckInApi = useCallback(
    async (milestoneId: string, lat: number, lng: number): Promise<void> => {
      const url = `${apiBaseUrl}/api/v1/trips/${tripId}/milestones/${milestoneId}/checkin`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ currentLat: lat, currentLng: lng }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({
          message: 'Lỗi không xác định từ máy chủ',
        }));
        const error = new Error(body?.message ?? `HTTP ${response.status}`);
        (error as any).statusCode = response.status;
        throw error;
      }
    },
    [tripId, apiBaseUrl, authHeaders],
  );

  // ─── Handler Check-in ─────────────────────────────────────────────────────
  const handleCheckIn = useCallback(
    async (milestone: Milestone) => {
      if (checkingInId !== null || isLocating) return;

      setCheckingInId(milestone.id);
      try {
        // 1. Lấy GPS (tự động xin quyền nếu chưa có)
        const { lat, lng } = await getCurrentLocation();

        // 2. Gọi API Spring Boot
        await callCheckInApi(milestone.id, lat, lng);

        // 3. Cập nhật UI ngay lập tức (Optimistic update)
        setMilestones(prev =>
          prev.map(m =>
            m.id === milestone.id
              ? {
                  ...m,
                  status:    'REACHED',
                  actualLat: lat,
                  actualLng: lng,
                  reachedAt: new Date().toISOString(),
                }
              : m,
          ),
        );

        showToast('✅ Check-in thành công!', `Bạn đã đến: ${milestone.milestoneName}`);
      } catch (err: unknown) {
        if (err instanceof Error) {
          const statusCode = (err as any).statusCode;
          if (statusCode === 400) {
            // Geo-fencing chặn — hiển thị message từ backend
            showToast('📍 Vị trí không hợp lệ', err.message);
          } else {
            showToast('Lỗi', err.message);
          }
        } else {
          showToast('Lỗi', 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.');
        }
      } finally {
        setCheckingInId(null);
      }
    },
    [checkingInId, isLocating, getCurrentLocation, callCheckInApi],
  );

  // ─── Render mỗi milestone trong timeline ──────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: Milestone; index: number }) => {
      const isReached     = item.status === 'REACHED';
      const isCheckingIn  = checkingInId === item.id;
      const isLoadingGPS  = isLocating && checkingInId === item.id;
      const isAnyLoading  = checkingInId !== null || isLocating;
      const isLast        = index === milestones.length - 1;

      return (
        <View style={styles.itemWrapper}>
          {/* Connector line */}
          {!isLast && (
            <View
              style={[
                styles.connector,
                isReached && styles.connectorReached,
              ]}
            />
          )}

          <View style={styles.row}>
            {/* Status Icon */}
            <View
              style={[
                styles.iconCircle,
                isReached ? styles.iconReached : styles.iconPending,
              ]}
            >
              <Text style={styles.iconText}>{isReached ? '✓' : (index + 1).toString()}</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text
                style={[styles.milestoneName, isReached && styles.milestoneNameReached]}
              >
                {item.milestoneName}
              </Text>

              {isReached && item.reachedAt && (
                <Text style={styles.reachedTime}>
                  🕐 {new Date(item.reachedAt).toLocaleTimeString('vi-VN')}
                </Text>
              )}

              {/* Nút Check-in — chỉ hiện khi PENDING */}
              {!isReached && (
                <TouchableOpacity
                  style={[
                    styles.checkinButton,
                    (isAnyLoading) && styles.checkinButtonDisabled,
                  ]}
                  onPress={() => handleCheckIn(item)}
                  disabled={isAnyLoading}
                  accessibilityLabel={`Check-in tại ${item.milestoneName}`}
                >
                  {isCheckingIn ? (
                    <View style={styles.buttonInner}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.checkinText}>
                        {isLoadingGPS ? 'Đang lấy GPS...' : 'Đang xử lý...'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.buttonInner}>
                      <Text style={styles.pinIcon}>📍</Text>
                      <Text style={styles.checkinText}>Check-in tại đây</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      );
    },
    [checkingInId, isLocating, milestones.length, handleCheckIn],
  );

  // ─── Header: progress summary ──────────────────────────────────────────────
  const reached = milestones.filter(m => m.status === 'REACHED').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🗺️ Hành trình vận chuyển</Text>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>
            {reached}/{milestones.length} cột mốc
          </Text>
        </View>
      </View>

      {/* GPS loading banner */}
      {isLocating && (
        <View style={styles.gpsBanner}>
          <ActivityIndicator color="#60a5fa" size="small" />
          <Text style={styles.gpsBannerText}>
            Đang lấy tín hiệu GPS, vui lòng đứng yên...
          </Text>
        </View>
      )}

      {/* Milestone Timeline */}
      <FlatList
        data={milestones}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const ACCENT_BLUE   = '#3b82f6';
const ACCENT_GREEN  = '#22c55e';
const DARK_BG       = '#0f172a';
const CARD_BG       = '#1e293b';
const TEXT_PRIMARY  = '#f1f5f9';
const TEXT_MUTED    = '#94a3b8';
const CONNECTOR_CLR = '#334155';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  progressBadge: {
    backgroundColor: '#1e3a5f',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: ACCENT_BLUE,
  },
  progressText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
  },
  gpsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: ACCENT_BLUE,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  gpsBannerText: {
    color: '#93c5fd',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  itemWrapper: {
    position: 'relative',
    paddingBottom: 4,
  },
  connector: {
    position: 'absolute',
    left: 19,
    top: 44,
    bottom: 0,
    width: 2,
    backgroundColor: CONNECTOR_CLR,
    zIndex: 0,
  },
  connectorReached: {
    backgroundColor: ACCENT_GREEN,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    zIndex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    zIndex: 1,
  },
  iconPending: {
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderColor: CONNECTOR_CLR,
  },
  iconReached: {
    backgroundColor: '#166534',
    borderWidth: 2,
    borderColor: ACCENT_GREEN,
  },
  iconText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingTop: 8,
  },
  milestoneName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  milestoneNameReached: {
    color: TEXT_MUTED,
  },
  reachedTime: {
    fontSize: 12,
    color: ACCENT_GREEN,
    marginBottom: 4,
  },
  checkinButton: {
    backgroundColor: ACCENT_BLUE,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  checkinButtonDisabled: {
    opacity: 0.5,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinIcon: {
    fontSize: 16,
  },
  checkinText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 4,
  },
});
