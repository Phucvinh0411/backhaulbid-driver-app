import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Button, FieldError, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/trips';
import { colors, space, type, fonts } from '@/constants/theme';

/**
 * Milestone check-in (POST /trips/{id}/milestones/{mid}/checkin). Location is read
 * only when the driver taps "Check-in"; the server enforces the geo-fence.
 */
export default function DriverMilestoneTracker({ tripId, milestones, tripStatus, onChanged }) {
  const [activeId, setActiveId] = useState(null);
  const [phase, setPhase] = useState('');
  const [errors, setErrors] = useState({});
  const ordered = [...milestones].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const canCheckIn = tripStatus === 'PICKED_UP' || tripStatus === 'IN_TRANSIT';

  const checkIn = async (milestone) => {
    if (activeId) return;
    setActiveId(milestone.id);
    setErrors((current) => ({ ...current, [milestone.id]: '' }));
    try {
      setPhase('Đang xin quyền vị trí...');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Chưa có quyền vị trí. Bật quyền Vị trí cho ứng dụng trong Cài đặt rồi thử lại.');
      }
      setPhase('Đang lấy vị trí hiện tại...');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPhase('Đang gửi check-in...');
      await api.post(`/api/v1/trips/${tripId}/milestones/${milestone.id}/checkin`, {
        currentLat: position.coords.latitude,
        currentLng: position.coords.longitude,
      });
      await onChanged?.(`Đã check-in tại ${milestone.milestoneName}.`);
    } catch (checkInError) {
      setErrors((current) => ({ ...current, [milestone.id]: checkInError.message || 'Không check-in được. Vui lòng thử lại.' }));
    } finally {
      setActiveId(null);
      setPhase('');
    }
  };

  return (
    <View style={{ gap: space.md }}>
      {!canCheckIn && <Text style={type.secondary}>Check-in cột mốc mở sau khi bạn đã lấy hàng.</Text>}
      {ordered.map((milestone, index) => {
        const reached = milestone.status === 'REACHED';
        return (
          <View key={milestone.id} style={styles.row}>
            <View style={[styles.index, reached && { backgroundColor: colors.success, borderColor: colors.success }]}>
              <Text style={[styles.indexText, reached && { color: '#fff' }]}>{reached ? '✓' : index + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.name}>{milestone.milestoneName}</Text>
              <StatusBadge label={reached ? `Đã check-in ${formatDateTime(milestone.reachedAt)}` : 'Chưa check-in'} tone={reached ? 'success' : 'neutral'} />
              {!reached && canCheckIn ? (
                <Button
                  label={activeId === milestone.id ? phase || 'Đang xử lý...' : 'Check-in tại đây'}
                  variant="secondary"
                  loading={activeId === milestone.id}
                  disabled={Boolean(activeId) && activeId !== milestone.id}
                  onPress={() => checkIn(milestone)}
                />
              ) : null}
              <FieldError message={errors[milestone.id]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  index: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  indexText: { fontFamily: fonts.bold, color: colors.inkMuted },
  name: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
});
