import { NextResponse } from 'next/server';
import { resolvePlayerKey } from '@/lib/rewards/playerKey';
import { getRewardsRepository } from '@/lib/rewards/repositoryFactory';
import { getFullProfile } from '@/lib/rewards/service';

/** GET /api/rewards/profile — the full Profile payload (identity + depth). */
export async function GET(request: Request) {
  try {
    const anon = new URL(request.url).searchParams.get('playerKey');
    const player = await resolvePlayerKey(anon);
    if (!player) {
      return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    }
    const profile = await getFullProfile(getRewardsRepository(), player.playerKey);
    return NextResponse.json({ ok: true, ...profile }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not load profile.' }, { status: 500 });
  }
}
