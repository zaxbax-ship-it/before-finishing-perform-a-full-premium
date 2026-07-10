import { NextResponse } from 'next/server';
import { resolvePlayerKey } from '@/lib/rewards/playerKey';
import { getRewardsRepository } from '@/lib/rewards/repositoryFactory';
import { toStr } from '@/lib/rewards/requestParsing';
import { equipCosmeticForPlayer } from '@/lib/rewards/service';

/** POST /api/rewards/cosmetics — equip an owned cosmetic (server validates ownership). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const player = await resolvePlayerKey(body.playerKey);
    if (!player) return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    const cosmeticId = toStr(body.cosmeticId);
    if (!cosmeticId) return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    const cosmetics = await equipCosmeticForPlayer(getRewardsRepository(), player.playerKey, cosmeticId);
    return NextResponse.json({ ok: true, cosmetics }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not equip cosmetic.' }, { status: 500 });
  }
}
