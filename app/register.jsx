import { Redirect } from 'expo-router';

// Drivers no longer create accounts: they sign in with the "mã nhận chuyến" their carrier sends.
// Old links to the registration screen land on code entry instead.
export default function RegisterRedirect() {
  return <Redirect href="/driver-code" />;
}
