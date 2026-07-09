import { HealthClient } from './HealthClient';

// Authorization is enforced by the admin layout; the API re-checks permissions.
export const dynamic = 'force-dynamic';

export default function AdminHealthPage() {
  return <HealthClient />;
}
