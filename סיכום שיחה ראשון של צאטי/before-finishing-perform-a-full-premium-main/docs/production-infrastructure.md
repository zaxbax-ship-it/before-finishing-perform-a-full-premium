# Production Infrastructure Layer

This milestone adds a centralized production infrastructure layer without connecting any external service.

## Core Modules

`src/lib/infrastructure/environment.ts`
Central environment reader and validator. It defines every known environment variable, allowed values and visibility.

`src/lib/infrastructure/config.ts`
Central configuration manager. It aggregates database, advertising, authentication, AI, payments, email, captcha and analytics settings.

`src/lib/infrastructure/secrets.ts`
Server-only secrets manager. It exposes presence checks and explicit `require()` calls, but does not serialize secrets to the browser.

`src/lib/infrastructure/featureFlags.ts`
Feature flags for optional production systems.

`src/lib/infrastructure/serviceRegistry.ts`
Single service registry for config, secrets, logging, error reporting and external adapters.

`src/lib/infrastructure/health.ts`
Health check system for environment, local fallback and optional services.

`src/lib/infrastructure/logger.ts`
Logging abstraction. Current provider is console/local.

`src/lib/infrastructure/errorReporter.ts`
Error reporting abstraction. Current provider is local logging only.

`src/lib/infrastructure/adapters`
Prepared adapters for optional external services.

## Prepared External Adapters

- Supabase
- PostgreSQL
- OpenAI
- Google OAuth
- Google AdSense
- Google Ad Manager
- Stripe
- Resend
- Cloudflare Turnstile
- Analytics providers

All adapters are optional. If credentials are missing, the app remains on the current local implementation.

## Security Rules

- Server secrets do not use the `NEXT_PUBLIC_` prefix.
- Browser-safe keys use `NEXT_PUBLIC_`.
- Missing credentials must not break the app.
- Live integrations should be implemented server-side unless a provider explicitly requires a public browser key.

## Remaining Public Launch Blockers

1. Real authentication and protected admin routes.
2. Supabase/PostgreSQL database connection and migrations.
3. RLS policies and server-only moderation writes.
4. Production moderation provider and abuse prevention.
5. CAPTCHA on public submission forms.
6. Email verification and notification delivery.
7. Payment provider only if paid features are introduced.
8. Analytics privacy review and consent handling.
9. AdSense approval and ad policy review.
10. Full staging QA on desktop and mobile.

## Connection Priority

1. Supabase/PostgreSQL
2. Google OAuth
3. Cloudflare Turnstile
4. OpenAI moderation
5. Resend
6. Analytics
7. Google AdSense
8. Google Ad Manager
9. Stripe
