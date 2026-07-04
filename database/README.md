# Database Layer Plan

This project still runs from the local JSON and browser storage flow. The files in `database/` prepare the production database layer without forcing the app to use it yet.

## Target

PostgreSQL, with Supabase as the first planned provider.

The future connection should be controlled by environment variables:

```env
NEXT_PUBLIC_DATABASE_MODE=local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

`NEXT_PUBLIC_DATABASE_MODE=local` keeps the current local behavior. A later phase can switch this to `supabase` after authentication, policies and data migration are confirmed.

## Tables

`admin_users`
Stores dashboard users. It is designed to connect to Supabase Auth through `auth_user_id`, while keeping display and activation data in the app schema.

`admin_roles`
Defines roles such as `super_admin`, `admin` and `moderator`.

`admin_permissions`
Defines granular permissions such as `submissions.review`, `questions.write` and `audit.read`.

`admin_user_roles`
Connects users to roles.

`admin_role_permissions`
Connects roles to permissions.

`contributors`
Stores community contributor reputation without keeping plain email addresses. The app should store a hash for privacy.

`community_question_submissions`
Stores every question sent by the public form, including status, language, category, difficulty, answers and reviewer fields.

`review_queue_items`
Stores submissions that need manual review, with priority, assignment and lock fields for a future multi-admin dashboard.

`moderation_results`
Stores local, AI and manual moderation decisions. It keeps score, recommendation, reasons, normalized text and raw provider output.

`approved_questions`
Stores questions that are actually available for gameplay after approval. This can later replace or sync with `src/data/questions.json`.

`contributor_reputation_events`
Stores every reputation change so contributor scores are explainable and reversible.

`anti_spam_events`
Stores rate-limit, duplicate, unsafe wording and manual spam signals.

`audit_logs`
Stores administrative and system actions for compliance and debugging.

## Production Notes

1. Enable Supabase Auth before giving real admin access.
2. Enable Row Level Security before exposing Supabase directly to the browser.
3. Keep moderation writes behind server-side code because service-role keys must never be exposed to the client.
4. Migrate existing JSON questions into `approved_questions` only after a backup is created.
5. Keep local JSON fallback until the deployed database path is tested on staging.
