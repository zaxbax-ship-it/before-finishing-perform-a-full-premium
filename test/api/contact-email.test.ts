import { afterEach, describe, expect, it } from 'vitest';
import { describeEmailConfig, getEmailProvider } from '@/lib/email';
import { POST as submitContact } from '@/app/api/contact/route';

const EMAIL_ENV = ['RESEND_API_KEY', 'CONTACT_NOTIFY_EMAIL', 'CONTACT_FROM_EMAIL'] as const;
const saved = new Map<string, string | undefined>();

function setEnv(values: Partial<Record<(typeof EMAIL_ENV)[number], string>>) {
  for (const key of EMAIL_ENV) {
    if (!saved.has(key)) saved.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

describe('Contact email notification wiring', () => {
  it('describeEmailConfig reports presence only, matching the environment', () => {
    setEnv({});
    expect(describeEmailConfig()).toEqual({
      provider: 'noop',
      notifyEmailConfigured: false,
      fromEmailConfigured: false
    });

    setEnv({ RESEND_API_KEY: 're_test', CONTACT_NOTIFY_EMAIL: 'ops@example.com' });
    expect(describeEmailConfig()).toEqual({
      provider: 'resend',
      notifyEmailConfigured: true,
      fromEmailConfigured: false
    });
  });

  it('without RESEND_API_KEY the provider is a visible no-op that reports email_not_configured', async () => {
    setEnv({ CONTACT_NOTIFY_EMAIL: 'ops@example.com' });
    const provider = getEmailProvider();
    expect(provider.kind).toBe('noop');

    const result = await provider.send({ to: 'ops@example.com', subject: 'test', text: 'test' });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('email_not_configured');
  });

  it('contact persistence succeeds even when email is completely unconfigured', async () => {
    setEnv({});
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'QA Tester',
        email: 'qa-email-wiring@example.com',
        message: 'Verifying persistence is independent of email delivery.'
      })
    });

    const response = await submitContact(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(typeof body.id).toBe('string');
  });

  it('contact persistence succeeds when a notify inbox is set but the provider is inactive', async () => {
    setEnv({ CONTACT_NOTIFY_EMAIL: 'ops@example.com' });
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'QA Tester',
        email: 'qa-email-noop@example.com',
        message: 'Verifying the no-op provider never breaks the contact flow.'
      })
    });

    const response = await submitContact(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});
