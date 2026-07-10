import { NextResponse } from 'next/server';
import { resolvePlayerKey } from '@/lib/rewards/playerKey';
import { getRewardsRepository } from '@/lib/rewards/repositoryFactory';
import { toStr } from '@/lib/rewards/requestParsing';
import { equipTitleForPlayer } from '@/lib/rewards/service';

/** POST /api/rewards/title - equip an earned title (server validates ownership). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const player = await resolvePlayerKey(body.playerKey);
    if (!player) return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    const titleId = body.titleId === null ? null : toStr(body.titleId) || null;
    const activeTitleId = await equipTitleForPlayer(getRewardsRepository(), player.playerKey, titleId);
    return NextResponse.json({ ok: true, activeTitleId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not equip title.' }, { status: 500 });
  }
}
