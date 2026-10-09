import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { PermissionsAndroid, Platform } from 'react-native';
export const LOCATION_TASK = 'backhaulbid-driver-trip-gps-v3';
let handler;
export const setLocationHandler = (next) => { handler = next; };
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  if (data?.locations) await handler?.(data.locations);
});
export async function startBackground() {
  if (!await TaskManager.isAvailableAsync()) return false;
  const permission = await Location.getBackgroundPermissionsAsync();
  if (!permission.granted) return false;
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const notifications = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (notifications !== PermissionsAndroid.RESULTS.GRANTED) return false;
  }
  if (!await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High, timeInterval: 15_000, distanceInterval: 30,
      deferredUpdatesInterval: 15_000, pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: { notificationTitle: 'BackHaulBid · Đang thực hiện chuyến', notificationBody: 'Đang chia sẻ vị trí với Chủ hàng và Chủ xe. Mở chuyến để dừng.', notificationColor: '#1565C0', killServiceOnDestroy: true },
    });
  }
  return true;
}
export async function stopBackground() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}
