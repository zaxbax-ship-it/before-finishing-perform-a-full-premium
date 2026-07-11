import { NextResponse } from 'next/server';
import { enforceRewardsWriteRateLimit } from '@/lib/api/rewardsSecurity';
import { resolvePlayerKey } from '@/lib/rewards/playerKey';
import { getRewardsRepository } from '@/lib/rewards/repositoryFactory';
import { toBool, toStr } from '@/lib/rewards/requestParsing';
import { setPinnedBadge } from '@/lib/rewards/service';

/** POST /api/rewards/pin - pin or unpin a showcase-eligible badge (max 3). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const player = await resolvePlayerKey(body.playerKey);
    if (!player) return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    const badgeId = toStr(body.badgeId);
    if (!badgeId) return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    const limited = await enforceRewardsWriteRateLimit(request, 'pin', player.playerKey);
    if (limited) return limited;
    const pinnedBadgeIds = await setPinnedBadge(getRewardsRepository(), player.playerKey, badgeId, toBool(body.pinned));
    return NextResponse.json({ ok: true, pinnedBadgeIds }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not update pinned badges.' }, { status: 500 });
  }
}
