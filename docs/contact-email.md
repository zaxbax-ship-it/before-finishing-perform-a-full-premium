# Contact Form: Storage and Email Notifications

## Where contact messages go

Every submission to `POST /api/contact` is validated, rate limited and then
persisted **before** any success response is returned:

1. **Repository storage** — a `contact_message` notification via the
   `NotificationsRepository` (durable in the `notifications` table once the
   Supabase provider is active; in-memory in local mode).
2. **Admin audit feed** — a `contact_message_received` audit entry (sender
   email + preview) visible in the admin dashboard's audit panel.
3. **Structured server logs** — a `contact` logger line readable in the
   hosting provider's logs.

## Email notifications (Resend)

Email delivery is **best-effort** and provider-based
(`src/lib/email/index.ts`, `EmailNotificationProvider`). Without credentials
the provider is a safe no-op and persistence still succeeds.

To activate:

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | yes | Server API key from resend.com. |
| `CONTACT_NOTIFY_EMAIL` | yes | The inbox that receives contact messages. |
| `CONTACT_FROM_EMAIL` | no | A Resend-verified sender. Defaults to the Resend sandbox sender, which only delivers to the Resend account owner's address. |

Steps:

1. Create a Resend account and API key.
2. Set `RESEND_API_KEY` and `CONTACT_NOTIFY_EMAIL` in the deployment env.
3. For production delivery to any inbox, verify a sending domain in Resend
   and set `CONTACT_FROM_EMAIL` (e.g. `Trivia <contact@your-domain.com>`).

Replies go straight to the visitor: the notification email sets `reply_to`
to the submitted address.

## Native clients

Native apps call the same `POST /api/contact` endpoint; storage and email
behavior are entirely server-side, so no client-specific work is needed.
