import { NextResponse } from 'next/server';
import { guardApiPermission } from '@/lib/auth/guards';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { getMultiplayerAdminOverview, terminateGame, terminateLobby } from '@/lib/admin/multiplayerAdminService';
import { internalServerError, readLimitedJson } from '@/lib/api/communitySecurity';

// Multiplayer operations console. Viewing uses moderation.read; terminating a
// lobby/game is an anti-abuse action guarded by spam.manage. Every
// termination is audit-logged with the acting administrator.
export async function GET() {
  const guard = await guardApiPermission('moderation.read');
  if (!guard.ok) return guard.response;

  try {
    const overview = await getMultiplayerAdminOverview(getRepositoryProvider());
    return NextResponse.json({ ok: true, ...overview }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalServerError('admin-multiplayer:get', error);
  }
}

export async function POST(request: Request) {
  const guard = await guardApiPermission('spam.manage');
  if (!guard.ok) return guard.response;

  try {
    const body = await readLimitedJson<{ action?: unknown; id?: unknown }>(request);
    const id = typeof body.id === 'string' ? body.id : '';
    const action = typeof body.action === 'string' ? body.action : '';
    if (!id || (action !== 'terminate_lobby' && action !== 'terminate_game')) {
      return NextResponse.json({ ok: false, error: 'A target id and a valid action are required.' }, { status: 400 });
    }

    const repositories = getRepositoryProvider();
    const result = action === 'terminate_lobby'
      ? await terminateLobby(repositories, guard.context, id)
      : await terminateGame(repositories, guard.context, id);

    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalServerError('admin-multiplayer:post', error);
  }
}
