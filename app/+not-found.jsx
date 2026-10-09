import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { StateView } from '@/components/ui';
import { colors, space } from '@/constants/theme';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Không tìm thấy' }} />
      <View style={styles.container}>
        <StateView title="Không tìm thấy màn hình" message="Đường dẫn không tồn tại hoặc đã thay đổi." actionLabel="Về danh sách chuyến" onAction={() => router.replace('/')} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: space.lg, backgroundColor: colors.canvas },
});
