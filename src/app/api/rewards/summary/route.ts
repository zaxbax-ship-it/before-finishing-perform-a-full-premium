import { NextResponse } from 'next/server';
import { resolvePlayerKey } from '@/lib/rewards/playerKey';
import { getRewardsRepository } from '@/lib/rewards/repositoryFactory';
import { getRewardsSummary } from '@/lib/rewards/service';

/** GET /api/rewards/summary — the lightweight summary that powers disclosure. */
export async function GET(request: Request) {
  try {
    const anon = new URL(request.url).searchParams.get('playerKey');
    const player = await resolvePlayerKey(anon);
    if (!player) {
      return NextResponse.json({ ok: false, status: 'invalid_request' }, { status: 400 });
    }
    const summary = await getRewardsSummary(getRewardsRepository(), player.playerKey);
    return NextResponse.json({ ok: true, ...summary }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not load rewards summary.' }, { status: 500 });
  }
}
