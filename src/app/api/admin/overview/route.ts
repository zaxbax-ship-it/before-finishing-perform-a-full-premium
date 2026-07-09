import { NextResponse } from 'next/server';
import { guardApiPermission } from '@/lib/auth/guards';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { buildAdminOverview } from '@/lib/admin/metricsService';
import { internalServerError } from '@/lib/api/communitySecurity';

// Admin overview metrics. Same contract for the web console and future native
// admin clients; every value is computed from repositories or explicitly
// reported as unavailable.
export async function GET() {
  const guard = await guardApiPermission('audit.read');
  if (!guard.ok) return guard.response;

  try {
    const overview = await buildAdminOverview(getRepositoryProvider());
    return NextResponse.json(overview, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalServerError('admin-overview:get', error);
  }
}
