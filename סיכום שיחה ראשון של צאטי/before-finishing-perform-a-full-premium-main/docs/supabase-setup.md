# Supabase/PostgreSQL Setup

This project keeps local JSON mode as the safe default. Supabase is activated only when the environment explicitly asks for it.

## 1. Create the Supabase Project

1. Open Supabase and create a new project.
2. Choose a strong database password and save it securely.
3. Wait until the project finishes provisioning.

## 2. Create the Database Tables

1. In Supabase, open `SQL Editor`.
2. Paste and run the migration:
   `database/001_supabase_core_schema.sql`
3. Confirm that these tables exist:

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

The migration enables Row Level Security on every table. No anonymous browser access is granted yet. The server repository uses the service role key only on the server.

## 3. Environment Variables

Keep local mode while setting up:

```env
NEXT_PUBLIC_DATABASE_MODE=local
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_ID:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
```

Optional for a future browser-safe Supabase client:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Do not put `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_` variable.

## 4. Safe Switch Procedure

1. Keep `NEXT_PUBLIC_DATABASE_MODE=local`.
2. Add the Supabase variables locally and in Vercel.
3. Run the SQL migration in Supabase.
4. Seed or import approved questions into `approved_questions`.
5. Run `npm run build`.
6. Change only this value:

```env
NEXT_PUBLIC_DATABASE_MODE=supabase
```

7. Restart the app or redeploy.

If the Supabase URL or service role key is missing, the provider factory stays on local JSON mode.

## 5. Production Notes

- The service role key bypasses RLS, so it must remain server-only.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client components, browser code, or public logs.
- Public read policies can be added later if a browser-side read client becomes necessary.
- For now, the application uses the existing repository interfaces, so UI code does not need to know whether data comes from local JSON or Supabase.
