import 'server-only';
import { createLogger } from '@/lib/infrastructure/logger';

/**
 * Email notification provider abstraction.
 *
 * Mirrors the repository/payments provider pattern: callers depend on the
 * {@link EmailNotificationProvider} interface, never on a vendor. The Resend
 * implementation activates only when RESEND_API_KEY is present; otherwise the
 * no-op provider keeps every flow working (email is always best-effort — the
 * calling flow must already have persisted its data).
 *
 * Environment variables:
 * - RESEND_API_KEY       Resend server API key (provider stays inactive without it).
 * - CONTACT_NOTIFY_EMAIL Destination inbox for contact-form notifications.
 * - CONTACT_FROM_EMAIL   Verified sender (defaults to Resend's sandbox sender,
 *                        which only delivers to the account owner's address).
 */

export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain-text body; kept vendor-neutral and native-client friendly. */
  text: string;
  replyTo?: string;
};

export type EmailSendResult = { ok: boolean; id?: string; error?: string };

export type EmailNotificationProvider = {
  kind: 'resend' | 'noop';
  send(message: EmailMessage): Promise<EmailSendResult>;
};

const emailLogger = createLogger('email');

const DEFAULT_FROM = 'Trivia Contact <onboarding@resend.dev>';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getContactNotifyEmail(): string | undefined {
  return process.env.CONTACT_NOTIFY_EMAIL?.trim() || undefined;
}

const noopProvider: EmailNotificationProvider = {
  kind: 'noop',
  async send(message) {
    emailLogger.info('Email provider not configured; message not sent.', {
      to: message.to,
      subject: message.subject
    });
    return { ok: false, error: 'email_not_configured' };
  }
};

function createResendProvider(apiKey: string): EmailNotificationProvider {
  return {
    kind: 'resend',
    async send(message) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            from: process.env.CONTACT_FROM_EMAIL?.trim() || DEFAULT_FROM,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            ...(message.replyTo ? { reply_to: message.replyTo } : {})
          })
        });
        const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
        if (!response.ok) {
          emailLogger.warn('Email delivery failed.', { status: response.status, error: data.message });
          return { ok: false, error: data.message || `resend_http_${response.status}` };
        }
        return { ok: true, id: data.id };
      } catch (error) {
        emailLogger.warn('Email delivery failed.', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return { ok: false, error: 'email_send_failed' };
      }
    }
  };
}

/** Returns the active provider: Resend when configured, otherwise a no-op. */
export function getEmailProvider(): EmailNotificationProvider {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  return apiKey ? createResendProvider(apiKey) : noopProvider;
}
