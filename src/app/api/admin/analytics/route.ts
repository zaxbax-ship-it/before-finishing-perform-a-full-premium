import { NextResponse } from 'next/server';
import { guardApiPermission } from '@/lib/auth/guards';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { buildAdminAnalytics } from '@/lib/admin/analyticsService';
import { internalServerError } from '@/lib/api/communitySecurity';

// Business analytics — computed from repositories; unavailable metrics are
// reported with reasons, never fabricated.
export async function GET() {
  const guard = await guardApiPermission('audit.read');
  if (!guard.ok) return guard.response;

  try {
    const analytics = await buildAdminAnalytics(getRepositoryProvider());
    return NextResponse.json({ ok: true, analytics }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalServerError('admin-analytics:get', error);
  }
}
