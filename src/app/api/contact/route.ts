import { NextResponse } from 'next/server';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { getClientIdentity, hashIdentity, internalServerError, publicJsonError, readLimitedJson } from '@/lib/api/communitySecurity';
import { checkRateLimit, getCommunitySubmissionRateLimit } from '@/lib/infrastructure/rateLimit';
import { getContactNotifyEmail, getEmailProvider } from '@/lib/email';
import { createLogger } from '@/lib/infrastructure/logger';
import type { ContactSubmitResponse } from '@/lib/api/contracts';

/**
 * Contact form intake. Success is returned only after the message is actually
 * persisted: it is stored through the repository layer as an admin-channel
 * notification, mirrored into the audit log (visible in the admin dashboard),
 * and written to the structured server log. Email delivery is a documented
 * follow-up (Resend is staged in .env.example but not configured).
 */
const contactLogger = createLogger('contact');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type ContactBody = { name?: unknown; email?: unknown; message?: unknown };

export async function POST(request: Request) {
  try {
    const repositories = getRepositoryProvider();
    const client = getClientIdentity(request);
    const body = await readLimitedJson<ContactBody>(request);

    const name = text(body.name).slice(0, 80);
    const email = text(body.email).toLowerCase().slice(0, 160);
    const message = text(body.message).slice(0, 4000);
    if (name.length < 2) return publicJsonError('Name is too short.');
    if (!EMAIL_PATTERN.test(email)) return publicJsonError('Email address is invalid.');
    if (message.length < 5) return publicJsonError('Message is too short.');

    const limit = getCommunitySubmissionRateLimit();
    const rate = await checkRateLimit({
      key: `contact:${client.ipHash || 'unknown'}:${hashIdentity(email) || 'anonymous'}`,
      ...limit
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, error: 'Too many messages. Please wait before trying again.' } satisfies ContactSubmitResponse,
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      );
    }

    const notification = await repositories.notifications.create({
      locale: 'he',
      channel: 'in_app',
      type: 'contact_message',
      title: `Contact from ${name}`,
      body: message,
      metadata: { name, email, ipHash: client.ipHash }
    });
    await repositories.auditLogs.create({
      actorLabel: email,
      action: 'contact_message_received',
      targetType: 'contact_message',
      targetId: notification.id,
      details: { name, email, preview: message.slice(0, 160) }
    });
    contactLogger.info('Contact message received.', {
      notificationId: notification.id,
      name,
      email,
      preview: message.slice(0, 160)
    });

    // Best-effort email notification: the message is already persisted above,
    // so delivery failures (or a missing provider) never affect the response.
    const notifyEmail = getContactNotifyEmail();
    if (notifyEmail) {
      void getEmailProvider()
        .send({
          to: notifyEmail,
          subject: `New contact message from ${name}`,
          text: `Name: ${name}
Email: ${email}

${message}`,
          replyTo: email
        })
        .then(result => {
          if (result.ok) contactLogger.info('Contact notification email sent.', { id: result.id });
        })
        .catch(() => undefined);
    }

    return NextResponse.json(
      { ok: true, id: notification.id } satisfies ContactSubmitResponse,
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return internalServerError('contact:post', error);
  }
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
