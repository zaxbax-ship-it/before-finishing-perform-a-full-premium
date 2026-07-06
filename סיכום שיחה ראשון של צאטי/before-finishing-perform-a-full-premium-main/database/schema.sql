-- Premium Trivia Platform database schema
-- Target: PostgreSQL / Supabase
-- This file is safe to run on a fresh database. Review RLS policies before production.

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  create type app_locale as enum ('he', 'en', 'ar', 'ru', 'am');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type submission_status as enum ('draft', 'submitted', 'needs_review', 'auto_approved', 'approved', 'rejected', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type moderation_provider as enum ('local_rules', 'openai', 'manual', 'import');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type anti_spam_event_type as enum ('rate_limit', 'duplicate', 'toxic_content', 'invalid_payload', 'blocked_identity', 'manual_flag');
exception
  when duplicate_object then null;
end $$;

create table if not exists admin_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email_hash text unique,
  display_name text not null default '',
  locale app_locale not null default 'he',
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_permissions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists admin_role_permissions (
  role_id uuid not null references admin_roles(id) on delete cascade,
  permission_id uuid not null references admin_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email citext unique,
  display_name text not null default '',
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_user_roles (
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  role_id uuid not null references admin_roles(id) on delete restrict,
  granted_by uuid references admin_users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (admin_user_id, role_id)
);

create table if not exists contributors (
  id uuid primary key default gen_random_uuid(),
  email_hash text unique,
  display_name text not null default '',
  preferred_locale app_locale not null default 'he',
  reputation_score integer not null default 0,
  trust_level integer not null default 0,
  accepted_count integer not null default 0,
  rejected_count integer not null default 0,
  spam_count integer not null default 0,
  last_submission_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists approved_questions (
  id uuid primary key default gen_random_uuid(),
  source_submission_id uuid unique,
  legacy_id text unique,
  locale app_locale not null default 'he',
  category text not null,
  difficulty text not null,
  question text not null,
  options jsonb not null,
  correct_index integer not null check (correct_index between 0 and 3),
  correct_answer text,
  explanation text not null default '',
  tags text[] not null default '{}',
  translations jsonb not null default '{}'::jsonb,
  image_url text,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_questions_options_array check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4)
);

create table if not exists community_question_submissions (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid references contributors(id) on delete set null,
  status submission_status not null default 'submitted',
  locale app_locale not null default 'he',
  category text not null,
  difficulty text not null,
  question text not null,
  options jsonb not null,
  correct_index integer not null check (correct_index between 0 and 3),
  explanation text not null default '',
  contributor_name text not null default '',
  contributor_email_hash text,
  ip_hash text,
  user_agent_hash text,
  duplicate_of_question_id uuid references approved_questions(id) on delete set null,
  approved_question_id uuid references approved_questions(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_submission_options_array check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4)
);

alter table approved_questions
  drop constraint if exists approved_questions_source_submission_id_fkey;

alter table approved_questions
  add constraint approved_questions_source_submission_id_fkey
  foreign key (source_submission_id)
  references community_question_submissions(id)
  on delete set null;

create table if not exists review_queue_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references community_question_submissions(id) on delete cascade,
  priority integer not null default 100,
  assigned_to uuid references admin_users(id) on delete set null,
  locked_by uuid references admin_users(id) on delete set null,
  locked_until timestamptz,
  queue_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists moderation_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references community_question_submissions(id) on delete cascade,
  provider moderation_provider not null default 'local_rules',
  model text not null default '',
  status submission_status not null,
  score integer not null check (score between 0 and 100),
  recommendation text not null default '',
  reasons jsonb not null default '[]'::jsonb,
  normalized_question text not null default '',
  normalized_options jsonb not null default '[]'::jsonb,
  generated_explanation text not null default '',
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists contributor_reputation_events (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references contributors(id) on delete cascade,
  submission_id uuid references community_question_submissions(id) on delete set null,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists anti_spam_events (
  id uuid primary key default gen_random_uuid(),
  event_type anti_spam_event_type not null,
  contributor_id uuid references contributors(id) on delete set null,
  submission_id uuid references community_question_submissions(id) on delete set null,
  ip_hash text,
  user_agent_hash text,
  email_hash text,
  severity integer not null default 1 check (severity between 1 and 10),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_admin_user_id uuid references admin_users(id) on delete set null,
  actor_label text not null default 'system',
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  admin_user_id uuid references admin_users(id) on delete cascade,
  locale app_locale not null default 'he',
  channel text not null default 'in_app',
  type text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_submissions_status_created on community_question_submissions(status, created_at desc);
create index if not exists idx_submissions_contributor_created on community_question_submissions(contributor_id, created_at desc);
create index if not exists idx_submissions_locale_category on community_question_submissions(locale, category);
create index if not exists idx_approved_questions_active_category on approved_questions(is_active, category, difficulty);
create index if not exists idx_review_queue_priority on review_queue_items(priority asc, created_at asc);
create index if not exists idx_moderation_submission_created on moderation_results(submission_id, created_at desc);
create index if not exists idx_audit_logs_created on audit_logs(created_at desc);
create index if not exists idx_anti_spam_lookup on anti_spam_events(email_hash, ip_hash, created_at desc);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_notifications_admin_created on notifications(admin_user_id, created_at desc);

insert into admin_roles (slug, name, description, priority) values
  ('super_admin', 'Super Admin', 'Full access to platform settings, users, moderation and content.', 1),
  ('admin', 'Admin', 'Manage questions, submissions and analytics.', 10),
  ('moderator', 'Moderator', 'Review and approve community submissions.', 30)
on conflict (slug) do nothing;

insert into admin_permissions (slug, description) values
  ('admin.users.manage', 'Create and manage admin users.'),
  ('admin.roles.manage', 'Manage roles and permissions.'),
  ('questions.read', 'Read approved questions.'),
  ('questions.write', 'Create, edit and archive approved questions.'),
  ('submissions.read', 'Read community submissions.'),
  ('submissions.review', 'Approve or reject community submissions.'),
  ('moderation.read', 'Read moderation results and review recommendations.'),
  ('audit.read', 'Read audit logs.'),
  ('spam.read', 'Read anti-spam events.'),
  ('spam.manage', 'Manage anti-spam decisions.'),
  ('notifications.write', 'Create and manage notifications.')
on conflict (slug) do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id
from admin_roles r
cross join admin_permissions p
where r.slug = 'super_admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id
from admin_roles r
join admin_permissions p on p.slug in (
  'questions.read',
  'questions.write',
  'submissions.read',
  'submissions.review',
  'moderation.read',
  'audit.read',
  'spam.read'
)
where r.slug = 'admin'
on conflict do nothing;

insert into admin_role_permissions (role_id, permission_id)
select r.id, p.id
from admin_roles r
join admin_permissions p on p.slug in (
  'questions.read',
  'submissions.read',
  'submissions.review',
  'moderation.read'
)
where r.slug = 'moderator'
on conflict do nothing;

-- Supabase RLS can be enabled after auth is connected.
-- alter table admin_users enable row level security;
-- alter table community_question_submissions enable row level security;
-- alter table approved_questions enable row level security;
