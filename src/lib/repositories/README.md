# Repository Layer

The application is now database-agnostic at the page data boundary.

## Providers

`local-json`
Uses the existing `src/data/questions.json` question bank and keeps the current browser-local behavior untouched.

`database`
Implements the same contracts, but is intentionally a stub until Supabase/PostgreSQL credentials, RLS policies and migrations are confirmed.

## Switching Providers

The factory reads:

```env
NEXT_PUBLIC_DATABASE_MODE=local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

The app stays on `local-json` unless `NEXT_PUBLIC_DATABASE_MODE=supabase` and Supabase public variables are present.

## Clean Architecture Flow

Page -> Service -> Repository Interface -> Provider

This keeps UI screens independent from storage details and leaves room for server actions, API routes, background moderation jobs and analytics workers.
