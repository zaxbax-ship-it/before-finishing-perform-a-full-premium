import { NextResponse } from 'next/server';
import { guardApiPermission } from '@/lib/auth/guards';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { getPlayerDetail, listPlayers, type ListPlayersQuery } from '@/lib/admin/userDirectoryService';
import { internalServerError } from '@/lib/api/communitySecurity';

// Admin player directory: list/search with pagination, or a single detail
// view via ?id=. Same contract for web and native admin clients.
export async function GET(request: Request) {
  const guard = await guardApiPermission('admin.users.manage');
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const repositories = getRepositoryProvider();

    const id = url.searchParams.get('id');
    if (id) {
      const detail = await getPlayerDetail(repositories, id);
      if (!detail) {
        return NextResponse.json({ ok: false, error: 'Player was not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, player: detail }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const query: ListPlayersQuery = {
      search: url.searchParams.get('search') || undefined,
      status: (url.searchParams.get('status') as ListPlayersQuery['status']) || 'all',
      kind: (url.searchParams.get('kind') as ListPlayersQuery['kind']) || 'all',
      sort: (url.searchParams.get('sort') as ListPlayersQuery['sort']) || 'lastActive',
      page: Number(url.searchParams.get('page')) || 1,
      pageSize: Number(url.searchParams.get('pageSize')) || 25
    };
    const result = await listPlayers(repositories, query);
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalServerError('admin-users:get', error);
  }
}
