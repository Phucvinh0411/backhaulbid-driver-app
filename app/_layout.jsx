import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/lib/auth';
import { colors, fonts } from '@/constants/theme';
import { canAccessRoute } from '@/lib/roles';
import OwnerAvatarMenu from '@/components/OwnerAvatarMenu';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.brand, background: colors.canvas, card: colors.surface, text: colors.ink, border: colors.line },
};

export default function RootLayout() {
  // DESIGN.md typeface; each weight is a separate family (see constants/theme.js fonts).
  const [loaded, error] = useFonts({ ...FontAwesome.font, BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="dark" />
          <AuthGate />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** Uses the server role for route permissions; QR payloads never switch accounts. */
function AuthGate() {
  const { session, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    const onAuth = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'driver-code';
    if (!session && !onAuth) router.replace('/login');
    if (session && onAuth) router.replace('/');
    if (session && !onAuth && !canAccessRoute(session, segments)) router.replace('/');
  }, [ready, router, segments, session]);

  // Screens mount only after the stored session is loaded, so their first request carries
  // the right account's token (a deep link would otherwise call the API anonymously).
  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerTintColor: colors.brand, headerTitleStyle: { fontFamily: fonts.bold }, headerBackTitle: 'Quay lại', headerRight: () => <OwnerAvatarMenu /> }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="driver-code" options={{ title: 'Nhập mã nhận chuyến' }} />
      <Stack.Screen name="trips/[tripId]/index" options={{ title: 'Chi tiết chuyến' }} />
      <Stack.Screen name="trips/[tripId]/milestones" options={{ title: 'Cột mốc hành trình' }} />
      <Stack.Screen name="business/trips/[tripId]" options={{ title: 'Theo dõi chuyến' }} />
      <Stack.Screen name="verification/index" options={{ title: 'Xác thực người đại diện' }} />
      <Stack.Screen name="statistics" options={{ title: 'Thống kê' }} />
    </Stack>
  );
}
