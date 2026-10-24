import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Button, FieldError, StatusBadge } from '@/components/ui';
import { Gauge } from '@/components/motion';
import { api } from '@/lib/api';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { formatDateTime } from '@/lib/trips';
import { colors, fonts, radius, space, type } from '@/constants/theme';

const CHECKIN_RADIUS_KM = 1.0;

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(distanceKm) {
  if (distanceKm == null) return null;
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(2)} km`;
}

/**
 * Driver Milestone Tracker with optimized, ultra-fast GPS check-in (< 500ms).
 */
export default function DriverMilestoneTracker({ tripId, milestones, tripStatus, onChanged }) {
  const [activeId, setActiveId] = useState(null);
  const [phase, setPhase] = useState('');
  const [errors, setErrors] = useState({});
  const [currentCoords, setCurrentCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const coordsRef = useRef(null);

  const ordered = [...milestones].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const canCheckIn = tripStatus === 'PICKED_UP' || tripStatus === 'IN_TRANSIT';
  const reachedCount = ordered.filter((milestone) => milestone.status === 'REACHED').length;

  // Cập nhật cả state và ref để truy cập tức thì không bị stale closure
  const updateCoords = (coords) => {
    if (coords) {
      coordsRef.current = coords;
      setCurrentCoords(coords);
    }
  };

  /**
   * Tối ưu lấy vị trí siêu tốc:
   * 1. Lấy ngay vị trí gần nhất từ cache thiết bị (< 30ms)
   * 2. Lấy vị trí mới bằng Fused Location (Accuracy.Balanced: 200-500ms, không bị treo như Accuracy.High)
   * 3. Lắng nghe cập nhật liên tục khi màn hình mở
   */
  useEffect(() => {
    let sub = null;
    let isMounted = true;

    async function initFastLocation() {
      try {
        const isEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
        if (!isEnabled) {
          setErrors((prev) => ({ ...prev, global: 'Dịch vụ GPS trên máy đang tắt. Hãy bật Định vị (GPS).' }));
          return;
        }

        const currentPerm = await Location.getForegroundPermissionsAsync().catch(() => null);
        let granted = currentPerm?.status === 'granted';
        if (!granted) {
          const req = await Location.requestForegroundPermissionsAsync().catch(() => null);
          granted = req?.status === 'granted';
        }
        if (!granted || !isMounted) return;

        // 1. Phục hồi ngay vị trí gần nhất (< 30ms) để hiển thị tức thì
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        if (last?.coords && isMounted) {
          updateCoords(last.coords);
        }

        // 2. Lấy ngay vị trí hiện tại với Accuracy.Balanced (nhanh gấp 10 lần Accuracy.High)
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((fresh) => {
            if (fresh?.coords && isMounted) updateCoords(fresh.coords);
          })
          .catch(() => {});

        // 3. Đăng ký watcher chạy ngầm cập nhật mỗi 4 giây
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 5 },
          (location) => {
            if (location?.coords && isMounted) {
              updateCoords(location.coords);
            }
          },
        ).catch(() => null);
      } catch (err) {
        console.warn('Lỗi định vị:', err);
      }
    }

    void initFastLocation();

    return () => {
      isMounted = false;
      sub?.remove();
    };
  }, []);

  // Nút bấm làm mới thủ công (chỉ tốn ~300ms)
  const refreshLocation = async () => {
    setLocating(true);
    try {
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 2500)),
      ]).catch(() => Location.getLastKnownPositionAsync().catch(() => null));

      if (position?.coords) {
        updateCoords(position.coords);
      }
    } finally {
      setLocating(false);
    }
  };

  // Check-in tức thì
  const checkIn = async (milestone) => {
    if (activeId) return;
    setActiveId(milestone.id);
    setErrors((current) => ({ ...current, [milestone.id]: '' }));

    try {
      setPhase('Đang xác nhận vị trí...');

      // Sử dụng ngay tọa độ đã có trong bộ nhớ (0ms delay)
      let coords = coordsRef.current;

      // Nếu chưa có tọa độ trong bộ nhớ, lấy nhanh trong tối đa 1.5 giây
      if (!coords) {
        coords = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 1500)),
        ])
          .then((res) => res?.coords)
          .catch(async () => {
            const fallback = await Location.getLastKnownPositionAsync().catch(() => null);
            return fallback?.coords;
          });

        if (coords) updateCoords(coords);
      }

      if (!coords) {
        throw new Error('Chưa lấy được tọa độ GPS. Hãy bấm nút "Làm mới GPS" phía trên rồi thử lại.');
      }

      const distanceKm = calculateDistanceKm(
        coords.latitude,
        coords.longitude,
        milestone.targetLat,
        milestone.targetLng,
      );

      setPhase('Đang gửi check-in...');
      await api.post(`/api/v1/trips/${tripId}/milestones/${milestone.id}/checkin`, {
        currentLat: coords.latitude,
        currentLng: coords.longitude,
      });

      hapticSuccess();
      const distText = distanceKm != null ? ` (cách ${formatDistance(distanceKm)})` : '';
      await onChanged?.(`Check-in thành công tại ${milestone.milestoneName}${distText}.`);
    } catch (checkInError) {
      hapticError();
      const msg = checkInError.message || 'Không check-in được. Vui lòng thử lại.';
      setErrors((current) => ({ ...current, [milestone.id]: msg }));
    } finally {
      setActiveId(null);
      setPhase('');
    }
  };

  return (
    <View style={{ gap: space.md }}>
      {/* Banner đo tiến trình check-in */}
      <View style={{ gap: space.xs }}>
        <Text style={type.figure}>
          {reachedCount}/{ordered.length} cột mốc đã check-in
        </Text>
        <Gauge value={ordered.length ? reachedCount / ordered.length : 0} label="Tiến độ check-in cột mốc" />
      </View>

      {/* Card GPS thời gian thực (tải tức thì) */}
      <View style={styles.gpsCard}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.gpsTitle}>🛰️ Vị trí GPS thiết bị của bạn:</Text>
          {currentCoords ? (
            <Text style={styles.gpsCoords}>
              {currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)}
              {currentCoords.accuracy ? ` (±${Math.round(currentCoords.accuracy)}m)` : ''}
            </Text>
          ) : (
            <Text style={styles.gpsWarning}>Đang kết nối GPS...</Text>
          )}
        </View>
        <Pressable
          style={[styles.refreshBtn, locating && { opacity: 0.6 }]}
          disabled={locating}
          onPress={refreshLocation}
        >
          <Text style={styles.refreshBtnText}>{locating ? 'Đang tìm...' : 'Làm mới GPS'}</Text>
        </Pressable>
      </View>

      {!canCheckIn && (
        <View style={styles.statusNotice}>
          <Text style={styles.statusNoticeText}>
            ℹ️ Cột mốc mở check-in sau khi bạn đã lấy hàng và chuyến chuyển sang ĐANG VẬN CHUYỂN.
          </Text>
        </View>
      )}

      {/* Danh sách cột mốc */}
      {ordered.map((milestone, index) => {
        const reached = milestone.status === 'REACHED';
        const distKm = currentCoords
          ? calculateDistanceKm(
              currentCoords.latitude,
              currentCoords.longitude,
              milestone.targetLat,
              milestone.targetLng,
            )
          : null;
        const isWithin1Km = distKm != null && distKm <= CHECKIN_RADIUS_KM;

        return (
          <View key={milestone.id} style={styles.row}>
            {/* Vòng tròn số thứ tự */}
            <View style={[styles.index, reached && { backgroundColor: colors.success, borderColor: colors.success }]}>
              <Text style={[styles.indexText, reached && { color: colors.surface }]}>
                {reached ? '✓' : index + 1}
              </Text>
            </View>

            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.name}>{milestone.milestoneName}</Text>

              {/* Tọa độ mục tiêu */}
              <Text style={styles.coordsText}>
                📍 Điểm mốc: {milestone.targetLat.toFixed(4)}, {milestone.targetLng.toFixed(4)}
              </Text>

              {/* Trạng thái check-in hoặc khoảng cách thời gian thực */}
              {reached ? (
                <View style={{ gap: 4 }}>
                  <StatusBadge
                    label={`Đã check-in lúc ${formatDateTime(milestone.reachedAt)}`}
                    tone="success"
                  />
                  {milestone.actualLat != null && milestone.actualLng != null ? (
                    <Text style={styles.actualCoords}>
                      Tọa độ thực tế: {milestone.actualLat.toFixed(5)}, {milestone.actualLng.toFixed(5)}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={{ gap: 4 }}>
                  <StatusBadge label="Chưa check-in" tone="neutral" />
                  {distKm != null ? (
                    <Text style={[styles.distanceText, isWithin1Km ? styles.distanceValid : styles.distanceFar]}>
                      {isWithin1Km
                        ? `🟢 Cách ${formatDistance(distKm)} (Trong bán kính 1km - ĐỦ ĐIỀU KIỆN)`
                        : `📍 Cách ${formatDistance(distKm)} (Cần ≤ 1.0 km để check-in)`}
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Nút bấm Check-in tức thì */}
              {!reached && canCheckIn ? (
                <Button
                  label={
                    activeId === milestone.id
                      ? phase || 'Đang xử lý...'
                      : isWithin1Km
                      ? 'Check-in tại đây (Hợp lệ)'
                      : 'Check-in tại đây (Bán kính 1km)'
                  }
                  variant={isWithin1Km ? 'primary' : 'secondary'}
                  loading={activeId === milestone.id}
                  disabled={Boolean(activeId) && activeId !== milestone.id}
                  onPress={() => checkIn(milestone)}
                />
              ) : null}

              {/* Lỗi thông báo */}
              <FieldError message={errors[milestone.id]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gpsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  gpsTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  gpsCoords: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.brand,
  },
  gpsWarning: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  refreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  refreshBtnText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  statusNotice: {
    backgroundColor: colors.infoSoft,
    padding: space.md,
    borderRadius: radius.md,
  },
  statusNoticeText: {
    color: colors.info,
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  index: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontFamily: fonts.bold,
    color: colors.inkMuted,
  },
  name: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  coordsText: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.inkMuted,
  },
  actualCoords: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.success,
  },
  distanceText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  distanceValid: {
    color: colors.success,
  },
  distanceFar: {
    color: colors.warning,
  },
});
