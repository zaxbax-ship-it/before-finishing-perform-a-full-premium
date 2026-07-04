# Repository Layer

The application is now database-agnostic at the page data boundary.

## Providers

`local-json`
Uses the existing `src/data/questions.json` question bank and keeps the current browser-local behavior untouched.

`database`
Implements the same contracts through Supabase/PostgreSQL using the server-only service role key.

## Switching Providers

The factory reads:

```env
NEXT_PUBLIC_DATABASE_MODE=local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

The app stays on `local-json` unless `NEXT_PUBLIC_DATABASE_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is reserved for future browser-safe Supabase features and is not required for the current repository provider.

See `docs/supabase-setup.md` and `database/001_supabase_core_schema.sql` before switching production traffic.

## Clean Architecture Flow

Page -> Service -> Repository Interface -> Provider

This keeps UI screens independent from storage details and leaves room for server actions, API routes, background moderation jobs and analytics workers.
