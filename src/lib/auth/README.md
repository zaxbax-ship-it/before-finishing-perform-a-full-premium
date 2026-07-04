# Auth layer (Stage 3)

Production authentication (Supabase Auth) + server-enforced authorization on top
of the existing repository abstraction. No schema was redesigned.

## Modules
- `config.ts` — env-driven configuration + enforcement gating.
- `supabaseBrowserClient.ts` / `supabaseServerClient.ts` — cookie-backed clients (`@supabase/ssr`).
- `session.ts` — `getAuthUser()` via `auth.getUser()` (JWT verified server-side).
- `adminAccess.ts` — resolves an `AdminContext` from the auth user through
  `admins/roles/permissions` repositories, with an `ADMIN_EMAILS` bootstrap.
- `guards.ts` — `requireAuth` / `requireAdmin` / `requirePermission` + `guardApiPermission`.
- `authService.ts` — browser sign-in/up/OAuth/reset/logout service.
- `../../middleware.ts` — session refresh + coarse `/admin` redirect.

## Enforcement model
Auth is enforced only when Supabase Auth is configured
(`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Until then the app
runs in **open local mode** — existing gameplay and the admin dashboard behave
exactly as before, and `guardApiPermission` yields a synthetic local-admin so
audit logging keeps working. Set `AUTH_ENFORCED=false` to run a configured
project without enforcement (staging).

## Adding an administrator
1. The user signs in (Google or email/password).
2. Grant access either by adding their email to `ADMIN_EMAILS` (bootstrap →
   `super_admin`) or by inserting an active row in the `admins` table with the
   desired `roleSlugs` (the DB record wins over the allowlist).

## Protecting a new admin endpoint
```ts
const guard = await guardApiPermission('moderation.read');
if (!guard.ok) return guard.response;
// guard.context = the acting administrator
```
This is the seam future AI-moderation, audit, reputation and contributor
endpoints reuse — each becomes a one-line permission check.
