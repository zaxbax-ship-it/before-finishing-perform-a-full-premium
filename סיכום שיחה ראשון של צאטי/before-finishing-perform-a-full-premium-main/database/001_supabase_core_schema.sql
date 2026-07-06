-- Supabase/PostgreSQL production schema for the trivia platform.
-- Run this in Supabase SQL Editor before switching NEXT_PUBLIC_DATABASE_MODE to "supabase".

create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key default gen_random_uuid()::text,
  auth_user_id text unique,
  email_hash text,
  display_name text not null,
  locale text not null default 'he',
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique,
  name text not null,
  description text not null,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_slug text not null references public.roles(slug) on delete cascade,
  permission_slug text not null references public.permissions(slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_slug, permission_slug)
);

create table if not exists public.admins (
  id text primary key default gen_random_uuid()::text,
  auth_user_id text unique,
  email text unique,
  display_name text not null,
  is_active boolean not null default true,
  role_slugs text[] not null default '{}',
  permission_slugs text[] not null default '{}',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_submissions (
  id text primary key default gen_random_uuid()::text,
  draft jsonb not null,
  moderation jsonb not null,
  question jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approved_questions (
  id text primary key,
  source_submission_id text references public.question_submissions(id) on delete set null,
  locale text not null default 'he',
  category text not null,
  difficulty text not null,
  question text not null,
  options jsonb not null,
  correct_index integer not null,
  correct_answer text,
  explanation text,
  tags jsonb not null default '[]'::jsonb,
  translations jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_queue (
  id text primary key default gen_random_uuid()::text,
  submission_id text not null references public.question_submissions(id) on delete cascade,
  priority integer not null default 50,
  assigned_to text references public.admins(id) on delete set null,
  locked_by text references public.admins(id) on delete set null,
  locked_until timestamptz,
  queue_reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_results (
  id text primary key default gen_random_uuid()::text,
  submission_id text not null references public.question_submissions(id) on delete cascade,
  status text not null,
  score integer not null,
  recommendation text not null,
  reasons jsonb not null default '[]'::jsonb,
  normalized_question text not null,
  normalized_options jsonb not null default '[]'::jsonb,
  explanation text not null,
  duplicate_question_id text,
  provider text not null default 'manual',
  model text,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  actor_admin_user_id text references public.admins(id) on delete set null,
  actor_label text not null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.contributor_reputation (
  contributor_id text primary key,
  reputation_score integer not null default 0,
  trust_level integer not null default 0,
  accepted_count integer not null default 0,
  rejected_count integer not null default 0,
  spam_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.reputation_events (
  id text primary key default gen_random_uuid()::text,
  contributor_id text not null,
  submission_id text references public.question_submissions(id) on delete set null,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.anti_spam_events (
  id text primary key default gen_random_uuid()::text,
  event_type text not null,
  contributor_id text,
  submission_id text references public.question_submissions(id) on delete set null,
  ip_hash text,
  user_agent_hash text,
  email_hash text,
  severity integer not null default 1,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  user_id text references public.users(id) on delete cascade,
  admin_user_id text references public.admins(id) on delete cascade,
  locale text not null default 'he',
  channel text not null default 'in_app',
  type text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_admins_email on public.admins (email);
create index if not exists idx_approved_questions_active on public.approved_questions (is_active, category, difficulty);
create index if not exists idx_question_submissions_created on public.question_submissions (created_at desc);
create index if not exists idx_review_queue_priority on public.review_queue (priority asc, created_at asc);
create index if not exists idx_moderation_results_submission on public.moderation_results (submission_id, created_at desc);
create index if not exists idx_audit_logs_created on public.audit_logs (created_at desc);
create index if not exists idx_anti_spam_identity on public.anti_spam_events (email_hash, ip_hash, created_at desc);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_admin on public.notifications (admin_user_id, created_at desc);

alter table public.users enable row level security;
alter table public.admins enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.question_submissions enable row level security;
alter table public.approved_questions enable row level security;
alter table public.review_queue enable row level security;
alter table public.moderation_results enable row level security;
alter table public.audit_logs enable row level security;
alter table public.contributor_reputation enable row level security;
alter table public.reputation_events enable row level security;
alter table public.anti_spam_events enable row level security;
alter table public.notifications enable row level security;

insert into public.roles (id, slug, name, description, priority)
values
  ('role-super-admin', 'super_admin', 'Super Admin', 'Full platform access.', 1),
  ('role-admin', 'admin', 'Admin', 'Manage content and submissions.', 10),
  ('role-moderator', 'moderator', 'Moderator', 'Review community submissions.', 30)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    priority = excluded.priority,
    updated_at = now();

insert into public.permissions (id, slug, description)
values
  ('permission-admin.users.manage', 'admin.users.manage', 'Manage admin and user records.'),
  ('permission-admin.roles.manage', 'admin.roles.manage', 'Manage roles and permissions.'),
  ('permission-questions.read', 'questions.read', 'Read approved questions.'),
  ('permission-questions.write', 'questions.write', 'Create and edit approved questions.'),
  ('permission-submissions.read', 'submissions.read', 'Read community submissions.'),
  ('permission-submissions.review', 'submissions.review', 'Approve or reject submissions.'),
  ('permission-moderation.read', 'moderation.read', 'Read moderation results.'),
  ('permission-audit.read', 'audit.read', 'Read audit logs.'),
  ('permission-spam.read', 'spam.read', 'Read anti-spam events.'),
  ('permission-spam.manage', 'spam.manage', 'Manage anti-spam actions.'),
  ('permission-notifications.write', 'notifications.write', 'Create notifications.')
on conflict (slug) do update
set description = excluded.description;

insert into public.role_permissions (role_slug, permission_slug)
select 'super_admin', slug from public.permissions
on conflict do nothing;

insert into public.role_permissions (role_slug, permission_slug)
values
  ('admin', 'questions.read'),
  ('admin', 'questions.write'),
  ('admin', 'submissions.read'),
  ('admin', 'submissions.review'),
  ('admin', 'moderation.read'),
  ('admin', 'audit.read'),
  ('admin', 'spam.read'),
  ('moderator', 'questions.read'),
  ('moderator', 'submissions.read'),
  ('moderator', 'submissions.review'),
  ('moderator', 'moderation.read')
on conflict do nothing;
