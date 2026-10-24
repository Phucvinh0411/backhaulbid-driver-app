import { Redirect } from 'expo-router';

// Trip history across trips belonged to driver accounts. A driver code session covers exactly one trip
// (shown on the "Chuyến" tab), so this tab is hidden and only redirects old links.
export default function DriverHistoryRedirect() {
  return <Redirect href="/" />;
}
