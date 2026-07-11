import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/session';
import {
  enforceMultiplayerRateLimit,
  getMultiplayerRepositories,
  logMultiplayerActionFailure,
  multiplayerApiErrorResponse,
  readMultiplayerJson
} from '@/lib/api/multiplayerSecurity';
import { getMultiplayerLobbyRateLimit } from '@/lib/infrastructure/rateLimit';
import { createMultiplayerService } from '@/lib/multiplayer/service';
import type { Locale } from '@/lib/types';

type MultiplayerLobbyBody = {
  action?: unknown;
  nickname?: unknown;
  anonymousId?: unknown;
  maxPlayers?: unknown;
  locale?: unknown;
  category?: unknown;
};

const LOCALES: Locale[] = ['he', 'en', 'ar', 'ru', 'am'];

export async function GET() {
  try {
    const repositories = getMultiplayerRepositories('list_lobbies');
    const service = createMultiplayerService(repositories);
    const lobbies = await service.listOpenLobbies();
    return NextResponse.json({ ok: true, lobbies }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return multiplayerApiErrorResponse('multiplayer-lobbies:get', error);
  }
}

export async function POST(request: Request) {
  let action = 'create_lobby';
  try {
    const repositories = getMultiplayerRepositories('create_lobby');
    const body = await readMultiplayerJson<MultiplayerLobbyBody>(request);
    action = body.action === 'quick_match' ? 'quick_match' : 'create_lobby';
    const limited = await enforceMultiplayerRateLimit(
      request,
      repositories,
      action,
      getMultiplayerLobbyRateLimit(),
      stringValue(body.anonymousId).slice(0, 120) || 'anonymous'
    );
    if (limited) return limited;

    const user = await getAuthUser();
    const service = createMultiplayerService(repositories);
    const input = {
      nickname: stringValue(body.nickname).slice(0, 40),
      anonymousId: stringValue(body.anonymousId).slice(0, 120),
      authUserId: user?.id,
      displayName: displayNameFromUser(user?.email),
      locale: localeValue(body.locale),
      maxPlayers: maxPlayersValue(body.maxPlayers),
      category: stringValue(body.category).trim() || undefined
    };

    if (!input.anonymousId) {
      logMultiplayerActionFailure('multiplayer-lobbies:post', action, 400, 'MULTIPLAYER_MISSING_IDENTITY');
      return NextResponse.json({ ok: false, error: 'Missing player identity.', errorCode: 'missing_identity' }, { status: 400 });
    }

    const result = body.action === 'quick_match'
      ? await service.quickMatch(input)
      : await service.createLobby(input);

    if (!result.ok) {
      logMultiplayerActionFailure('multiplayer-lobbies:post', action, 400);
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return multiplayerApiErrorResponse('multiplayer-lobbies:post', error, { action });
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function maxPlayersValue(_value: unknown): 2 {
  // Head-to-head is the only supported mode: any requested count collapses to two.
  return 2;
}

function localeValue(value: unknown): Locale {
  return LOCALES.includes(value as Locale) ? value as Locale : 'he';
}

function displayNameFromUser(email?: string) {
  if (!email) return undefined;
  return email.split('@')[0]?.trim() || undefined;
}
