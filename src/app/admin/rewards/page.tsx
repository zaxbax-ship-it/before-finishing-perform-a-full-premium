import { RewardsAdminClient } from './RewardsAdminClient';

// Authorization is enforced by the admin layout; the API re-checks permissions
// (rewards.read for viewing, rewards.manage for grant/revoke).
export const dynamic = 'force-dynamic';

export default function AdminRewardsPage() {
  return <RewardsAdminClient />;
}
