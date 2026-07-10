import { NextResponse } from 'next/server';
import { guardApiPermission } from '@/lib/auth/guards';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { getRewardsRepository } from '@/lib/rewards/repositoryFactory';
import { internalServerError, readLimitedJson } from '@/lib/api/communitySecurity';
import {
  getRewardsAdminOverview,
  getRewardsCatalogue,
  grantReward,
  inspectPlayerRewards,
  revokeReward,
  type GrantRequest,
  type RevokeRequest
} from '@/lib/admin/rewardsAdminService';

/**
 * Admin Console — reward management API.
 *
 * GET (rewards.read): rewards health/observability, the live reward catalogue
 * (`?view=catalogue`), or a single player's entitlements + Career-Earnings ledger
 * (`?playerKey=…`).
 *
 * POST (rewards.manage): a secure, audit-logged grant/revoke. Every mutation is
 * server-authoritative and records the acting administrator. Dollars only — the
 * sole monetary grant is an idempotent Career-Earnings ledger adjustment.
 */

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function GET(request: Request) {
  const guard = await guardApiPermission('rewards.read');
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const view = url.searchParams.get('view');
    const playerKey = url.searchParams.get('playerKey');

    if (view === 'catalogue') {
      return NextResponse.json({ ok: true, catalogue: getRewardsCatalogue() }, NO_STORE);
    }
    if (playerKey) {
      const inspection = await inspectPlayerRewards(getRewardsRepository(), playerKey);
      return NextResponse.json({ ok: true, inspection }, NO_STORE);
    }
    const overview = await getRewardsAdminOverview(getRepositoryProvider());
    return NextResponse.json({ ok: true, ...overview }, NO_STORE);
  } catch (error) {
    return internalServerError('admin-rewards:get', error);
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parseGrant(raw: unknown): GrantRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case 'cosmetic':
      return str(r.cosmeticId) ? { kind: 'cosmetic', cosmeticId: str(r.cosmeticId) } : null;
    case 'title':
      return str(r.titleId) ? { kind: 'title', titleId: str(r.titleId) } : null;
    case 'badge':
      return str(r.badgeId) ? { kind: 'badge', badgeId: str(r.badgeId) } : null;
    case 'career-adjustment': {
      const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount);
      if (!Number.isFinite(amount) || amount === 0) return null;
      const reason = str(r.reason) || 'admin adjustment';
      const idempotencyKey = str(r.idempotencyKey) || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
      return { kind: 'career-adjustment', amount, reason, idempotencyKey };
    }
    default:
      return null;
  }
}

function parseRevoke(raw: unknown): RevokeRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case 'cosmetic':
      return str(r.cosmeticId) ? { kind: 'cosmetic', cosmeticId: str(r.cosmeticId) } : null;
    case 'title':
      return str(r.titleId) ? { kind: 'title', titleId: str(r.titleId) } : null;
    case 'badge':
      return str(r.badgeId) ? { kind: 'badge', badgeId: str(r.badgeId) } : null;
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const guard = await guardApiPermission('rewards.manage');
  if (!guard.ok) return guard.response;

  try {
    const body = await readLimitedJson<{ action?: unknown; playerKey?: unknown; request?: unknown }>(request);
    const action = str(body.action);
    const playerKey = str(body.playerKey);
    if (!playerKey) return NextResponse.json({ ok: false, error: 'A playerKey is required.' }, { status: 400 });

    const rewardsRepo = getRewardsRepository();
    const repositories = getRepositoryProvider();

    if (action === 'grant') {
      const parsed = parseGrant(body.request);
      if (!parsed) return NextResponse.json({ ok: false, error: 'A valid grant request is required.' }, { status: 400 });
      const result = await grantReward(rewardsRepo, repositories, guard.context, playerKey, parsed);
      if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true, inspection: result.inspection }, NO_STORE);
    }

    if (action === 'revoke') {
      const parsed = parseRevoke(body.request);
      if (!parsed) return NextResponse.json({ ok: false, error: 'A valid revoke request is required.' }, { status: 400 });
      const result = await revokeReward(rewardsRepo, repositories, guard.context, playerKey, parsed);
      if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true, inspection: result.inspection }, NO_STORE);
    }

    return NextResponse.json({ ok: false, error: 'action must be grant or revoke.' }, { status: 400 });
  } catch (error) {
    return internalServerError('admin-rewards:post', error);
  }
}
