# Database Layer

The app still defaults to local JSON mode. Supabase/PostgreSQL is now implemented as an optional repository provider and should be enabled only after the schema is created and data is seeded.

## Migration

Run this file in the Supabase SQL Editor:

```text
database/001_supabase_core_schema.sql
```

It creates the production tables, indexes, role/permission seed data and Row Level Security.

## Required Tables

- `users`
- `admins`
- `roles`
- `permissions`
- `role_permissions`
- `question_submissions`
- `approved_questions`
- `review_queue`
- `moderation_results`
- `audit_logs`
- `contributor_reputation`
- `reputation_events`
- `anti_spam_events`
- `notifications`

## Environment Variables

```env
NEXT_PUBLIC_DATABASE_MODE=local
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is optional for now. The repository provider uses `SUPABASE_SERVICE_ROLE_KEY` on the server only.

## Safe Activation

1. Keep `NEXT_PUBLIC_DATABASE_MODE=local`.
2. Create the Supabase project.
3. Run `database/001_supabase_core_schema.sql`.
4. Add `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`.
5. Seed or import approved questions.
6. Run `npm run build`.
7. Switch `NEXT_PUBLIC_DATABASE_MODE=supabase`.

If the Supabase URL or service role key is missing, the provider factory falls back to local JSON mode.
