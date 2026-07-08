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
Every admin surface (the `/admin` page, admin APIs, and the middleware) consults
one rule — `adminAccessMode()` in `guards.ts` — which yields exactly one of:

| Mode | When | Behavior |
|---|---|---|
| `enforced` | Supabase Auth configured (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and `AUTH_ENFORCED` is not `false` | Real authentication; only `ADMIN_EMAILS` / active `admins`-table users pass. Anonymous → `/login`, authenticated non-admins → `/forbidden` (401/403 on APIs). |
| `open-dev` | Not enforced, **non-production** runtime | Local development fallback: dashboard and admin APIs work with a synthetic local-admin. Every access logs a `warn` ("Admin protection is DISABLED"). |
| `locked` | Not enforced, **production** runtime (`NODE_ENV=production`) | **Fails closed.** `/admin` redirects everyone to `/forbidden` (middleware + page), admin APIs return 403 for every caller, each attempt logs a `warn` with the fix hint. |

A misconfigured production deployment can therefore never expose an open admin.
Note that `AUTH_ENFORCED=false` in production now **locks** admin rather than
opening it — the staging escape hatch only affects non-admin enforcement.

## Required environment variables (production admin access)
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL — activates Supabase Auth. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key — required alongside the URL. |
| `ADMIN_EMAILS` | Comma-separated admin allowlist, e.g. `owner@example.com, ops@example.com`. Case-insensitive, whitespace-tolerant. |
| `AUTH_ENFORCED` | Optional; leave unset. Only `false` disables enforcement (never set it in production). |

## Verifying admin protection in production
1. Deploy, then open `/admin` in a private/incognito window → you must land on
   `/login` (enforced) — never on the dashboard. If you land on `/forbidden`,
   the deployment is in locked mode: Supabase env vars are missing.
2. `curl -i https://<site>/api/community/submissions` → expect `401` (enforced)
   or `403` (locked) — never `200`.
3. Sign in with a non-allowlisted account and open `/admin` → `/forbidden`.
4. Sign in with an `ADMIN_EMAILS` account → dashboard renders with the auth bar,
   and moderation actions audit-log your real email.

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
