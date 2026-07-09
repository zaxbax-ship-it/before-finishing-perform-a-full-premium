import { NextResponse } from 'next/server';
import { guardApiPermission } from '@/lib/auth/guards';
import { buildAdminHealthReport } from '@/lib/admin/healthAdminService';
import { internalServerError } from '@/lib/api/communitySecurity';

// Detailed system health for the admin console (the public /api/health stays
// minimal). Real checks and probes only.
export async function GET() {
  const guard = await guardApiPermission('audit.read');
  if (!guard.ok) return guard.response;

  try {
    const report = await buildAdminHealthReport();
    return NextResponse.json({ ok: true, report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalServerError('admin-health:get', error);
  }
}
