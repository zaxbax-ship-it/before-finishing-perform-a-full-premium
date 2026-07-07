import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/session';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import type { LeaderboardResponse } from '@/lib/api/contracts';

type LeaderboardPostBody = {
  nickname?: unknown;
  prize?: unknown;
  correctCount?: unknown;
  claimOnly?: unknown;
  displayName?: unknown;
};

const NICKNAME_PATTERN = /^[\p{L}\p{N} _.-]{3,20}$/u;
const RESERVED_NICKNAMES = new Set([
  'admin',
  'administrator',
  'moderator',
  'owner',
  'support',
  'official',
  'system',
  'staff',
  'team',
  'google',
  'supabase',
  'root',
  'null',
  'undefined'
]);

function numberFromBody(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function cleanNickname(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 20) : '';
}

function displayNameFromUser(email?: string) {
  if (!email) return undefined;
  return email.split('@')[0]?.trim() || undefined;
}

export async function GET() {
  try {
    const repositories = getRepositoryProvider();
    const entries = await repositories.leaderboard.listTop({ limit: 25 });
    return NextResponse.json({ ok: true, provider: repositories.kind, entries } satisfies LeaderboardResponse, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, entries: [] }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as LeaderboardPostBody;
    const nickname = cleanNickname(body.nickname);

    if (!NICKNAME_PATTERN.test(nickname)) {
      return NextResponse.json(
        { ok: false, error: 'Nickname must be 3-20 characters and may include letters, numbers, spaces, dots, underscores or hyphens.' },
        { status: 400 }
      );
    }

    if (RESERVED_NICKNAMES.has(nickname.toLowerCase())) {
      return NextResponse.json(
        { ok: false, status: 'nickname_reserved', error: 'This nickname is reserved. Try another one.' },
        { status: 400 }
      );
    }

    const user = await getAuthUser();
    const repositories = getRepositoryProvider();
    const result = await repositories.leaderboard.submitScore({
      nickname,
      prize: numberFromBody(body.prize),
      correctCount: numberFromBody(body.correctCount),
      claimOnly: body.claimOnly === true,
      displayName: typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : displayNameFromUser(user?.email),
      authUserId: user?.id
    });

    if (result.status === 'nickname_taken') {
      return NextResponse.json({ ok: false, status: result.status }, { status: 409 });
    }

    const entries = await repositories.leaderboard.listTop({ limit: 25 });
    return NextResponse.json({ ok: true, status: result.status, entry: result.entry, entries }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not update leaderboard right now.' }, { status: 500 });
  }
}
