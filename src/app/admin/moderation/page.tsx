import { ModerationClient } from './ModerationClient';

// Authorization is enforced by the admin layout; the API re-checks permissions.
export const dynamic = 'force-dynamic';

export default function ModerationPage() {
  return <ModerationClient />;
}
