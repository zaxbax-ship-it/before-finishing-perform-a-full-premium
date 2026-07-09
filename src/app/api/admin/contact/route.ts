import { NextResponse } from 'next/server';
import { guardApiPermission } from '@/lib/auth/guards';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { internalServerError, readLimitedJson } from '@/lib/api/communitySecurity';
import type { ContactTicket } from '@/lib/domain/models';

// Contact center. Viewing tickets requires moderation.read; managing them
// (status/priority/assignment/notes) requires notifications.write. Every
// change is audit-logged with the acting administrator.
export async function GET(request: Request) {
  const guard = await guardApiPermission('moderation.read');
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const repositories = getRepositoryProvider();
    const tickets = await repositories.contactTickets.list({
      status: (url.searchParams.get('status') as ContactTicket['status']) || undefined,
      priority: (url.searchParams.get('priority') as ContactTicket['priority']) || undefined,
      search: url.searchParams.get('search') || undefined,
      limit: 200
    });
    return NextResponse.json({ ok: true, tickets }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalServerError('admin-contact:get', error);
  }
}

type ActionBody = { action?: unknown; id?: unknown; value?: unknown };

const STATUSES: ContactTicket['status'][] = ['open', 'pending', 'closed'];
const PRIORITIES: ContactTicket['priority'][] = ['low', 'normal', 'high', 'urgent'];

export async function POST(request: Request) {
  const guard = await guardApiPermission('notifications.write');
  if (!guard.ok) return guard.response;

  try {
    const body = await readLimitedJson<ActionBody>(request);
    const id = typeof body.id === 'string' ? body.id : '';
    const action = typeof body.action === 'string' ? body.action : '';
    const value = typeof body.value === 'string' ? body.value : '';
    const repositories = getRepositoryProvider();

    if (!id) return NextResponse.json({ ok: false, error: 'A ticket id is required.' }, { status: 400 });

    let ticket: ContactTicket | undefined;
    if (action === 'set_status' && STATUSES.includes(value as ContactTicket['status'])) {
      ticket = await repositories.contactTickets.update(id, { status: value as ContactTicket['status'] });
    } else if (action === 'set_priority' && PRIORITIES.includes(value as ContactTicket['priority'])) {
      ticket = await repositories.contactTickets.update(id, { priority: value as ContactTicket['priority'] });
    } else if (action === 'assign') {
      ticket = await repositories.contactTickets.update(id, { assigneeEmail: value || undefined });
    } else if (action === 'add_note' && value.trim().length > 0) {
      ticket = await repositories.contactTickets.addNote(id, { authorEmail: guard.context.email, body: value.trim().slice(0, 2000) });
    } else {
      return NextResponse.json({ ok: false, error: 'Unknown or malformed ticket action.' }, { status: 400 });
    }

    if (!ticket) return NextResponse.json({ ok: false, error: 'Ticket was not found.' }, { status: 404 });

    await repositories.auditLogs.create({
      actorLabel: guard.context.email,
      action: `admin_ticket_${action}`,
      targetType: 'contact_ticket',
      targetId: id,
      details: { value: value.slice(0, 160) }
    });

    return NextResponse.json({ ok: true, ticket }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return internalServerError('admin-contact:post', error);
  }
}
