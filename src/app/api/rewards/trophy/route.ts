import { NextResponse } from 'next/server';
import { enforceRewardsWriteRateLimit } from '@/lib/api/rewardsSecurity';
import { resolvePlayerKey } from '@/lib/rewards/playerKey';
import { getRewardsRepository } from '@/lib/rewards/repositoryFactory';
import { toNum, toStr } from '@/lib/rewards/requestParsing';
import { setTrophySlot } from '@/lib/rewards/service';

/** POST /api/rewards/trophy - place or clear a trophy-cabinet slot (earned items only). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const player = await resolvePlayerKey(body.playerKey);
    if (!player) return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    const limited = await enforceRewardsWriteRateLimit(request, 'trophy', player.playerKey);
    if (limited) return limited;
    const slotIndex = toNum(body.slotIndex);
    const itemId = body.itemId === null || body.itemId === undefined ? null : toStr(body.itemId) || null;
    const trophyCabinet = await setTrophySlot(getRewardsRepository(), player.playerKey, slotIndex, itemId);
    return NextResponse.json({ ok: true, trophyCabinet }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not update trophy cabinet.' }, { status: 500 });
  }
}
