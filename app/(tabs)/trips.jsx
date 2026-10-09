import BusinessHome from '@/components/BusinessHome';
import { useAuth } from '@/lib/auth';

export default function OwnerTripsTab() {
  const { session } = useAuth();
  if (!session || session.role === 'DRIVER') return null;
  return <BusinessHome key={session.accountId} />;
}
