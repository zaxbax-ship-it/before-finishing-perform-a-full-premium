# Sentry Setup

This project now supports optional Sentry error monitoring for Next.js.

## Required for basic event capture

Add these environment variables in Vercel or your local environment:

```env
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=
NEXT_PUBLIC_SENTRY_RELEASE=
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=
```

Recommended values:

- `NEXT_PUBLIC_SENTRY_ENVIRONMENT=development` for local work
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT=preview` for preview deployments
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT=production` for the public site
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0` locally unless tracing is needed
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.05` in production as a conservative default

## Security notes

- The DSN is a public identifier and is safe to expose to the browser.
- Do not expose auth tokens or any server-only credentials with a `NEXT_PUBLIC_` prefix.
- If `NEXT_PUBLIC_SENTRY_DSN` is missing, Sentry stays disabled and the app continues to work normally.

## Health endpoint

The app now exposes:

```text
/api/health
```

It returns only safe status information:

- app liveness
- runtime mode
- database mode
- auth enforcement state
- optional service status flags
- internal health check results

It does not expose secrets or raw credentials.
