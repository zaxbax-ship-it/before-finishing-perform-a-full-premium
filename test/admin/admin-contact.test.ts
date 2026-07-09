import { describe, expect, it } from 'vitest';
import { POST as submitContact } from '@/app/api/contact/route';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';

/**
 * Phase 7 — contact center: a public contact submission becomes a ticket;
 * the repository supports the full inbox lifecycle (status, priority,
 * assignment, notes, search).
 */
describe('Contact center tickets', () => {
  it('creates an open ticket from a public contact submission', async () => {
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ticket QA',
        email: 'ticket-qa@example.com',
        message: 'My multiplayer room disappeared, please help.'
      })
    });
    const response = await submitContact(request);
    expect(response.status).toBe(200);

    const repositories = getRepositoryProvider();
    const tickets = await repositories.contactTickets.list({ search: 'ticket-qa@example.com' });
    expect(tickets.length).toBeGreaterThanOrEqual(1);
    expect(tickets[0].status).toBe('open');
    expect(tickets[0].priority).toBe('normal');
    expect(tickets[0].body).toContain('multiplayer room');
  });

  it('supports the full inbox lifecycle: priority, assignment, notes, close', async () => {
    const repositories = getRepositoryProvider();
    const ticket = await repositories.contactTickets.create({
      status: 'open',
      priority: 'normal',
      requesterName: 'Lifecycle QA',
      requesterEmail: 'lifecycle@example.com',
      subject: 'Lifecycle test',
      body: 'Testing the ticket lifecycle.'
    });

    await repositories.contactTickets.update(ticket.id, { priority: 'urgent', assigneeEmail: 'ops@example.com' });
    await repositories.contactTickets.addNote(ticket.id, { authorEmail: 'ops@example.com', body: 'Looking into it.' });
    const closed = await repositories.contactTickets.update(ticket.id, { status: 'closed' });

    expect(closed?.priority).toBe('urgent');
    expect(closed?.assigneeEmail).toBe('ops@example.com');
    const final = await repositories.contactTickets.findById(ticket.id);
    expect(final?.notes).toHaveLength(1);
    expect(final?.notes[0].body).toContain('Looking into it');
    expect(final?.status).toBe('closed');
  });

  it('filters by status and searches across fields', async () => {
    const repositories = getRepositoryProvider();
    const open = await repositories.contactTickets.list({ status: 'open' });
    expect(open.every(ticket => ticket.status === 'open')).toBe(true);

    const byName = await repositories.contactTickets.list({ search: 'Lifecycle QA' });
    expect(byName.some(ticket => ticket.requesterName === 'Lifecycle QA')).toBe(true);
  });
});
