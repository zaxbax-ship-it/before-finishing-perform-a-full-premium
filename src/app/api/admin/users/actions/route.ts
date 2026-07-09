import { NextResponse } from 'next/server';
import { guardApiPermission } from '@/lib/auth/guards';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { applyPlayerAction, type PlayerAdminAction } from '@/lib/admin/userDirectoryService';
import { internalServerError, readLimitedJson } from '@/lib/api/communitySecurity';

const ALLOWED_ACTIONS: PlayerAdminAction[] = [
  'suspend',
  'unsuspend',
  'reset_progression',
  'grant_premium',
  'revoke_premium',
  'hide_leaderboard',
  'restore_leaderboard'
];

// Player moderation actions. Every action is permission-guarded and writes an
// audit-log entry naming the acting administrator.
export async function POST(request: Request) {
  const guard = await guardApiPermission('admin.users.manage');
  if (!guard.ok) return guard.response;

  try {
    const body = await readLimitedJson<{ id?: unknown; action?: unknown }>(request);
    const id = typeof body.id === 'string' ? body.id : '';
    const action = typeof body.action === 'string' ? (body.action as PlayerAdminAction) : undefined;

    if (!id || !action || !ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json({ ok: false, error: 'A player id and a valid action are required.' }, { status: 400 });
    }

    const result = await applyPlayerAction(getRepositoryProvider(), guard.context, id, action);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalServerError('admin-users-actions:post', error);
  }
}
