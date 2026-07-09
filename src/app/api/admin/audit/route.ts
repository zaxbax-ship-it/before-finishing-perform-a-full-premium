import { NextResponse } from 'next/server';
import { guardApiPermission } from '@/lib/auth/guards';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { internalServerError } from '@/lib/api/communitySecurity';

// Audit center feed: the newest 1000 audit entries (filtering/search happen
// client-side over this bounded window; export includes the filtered set).
export async function GET() {
  const guard = await guardApiPermission('audit.read');
  if (!guard.ok) return guard.response;

  try {
    const entries = await getRepositoryProvider().auditLogs.list({ limit: 1000 });
    return NextResponse.json({ ok: true, entries }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalServerError('admin-audit:get', error);
  }
}
