-- 009: Enterprise admin suite.
-- Run after database/008_progression_schema.sql.
--
-- Two additive changes for the admin console:
--  1. Editorial lifecycle for approved questions: 'draft' | 'published' |
--     'archived'. Existing rows keep working — a missing status is derived
--     from is_active (active => published, inactive => archived), and the
--     application keeps is_active as the single gameplay-visibility switch.
--  2. Contact tickets: the professional inbox over contact-form messages
--     (status / priority / assignment / notes). Rows are written by trusted
--     server-side API routes using the service role; browsers never write
--     directly.

alter table public.approved_questions
  add column if not exists status text
    check (status in ('draft', 'published', 'archived'));

create table if not exists public.contact_tickets (
  id text primary key default gen_random_uuid()::text,
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee_email text,
  requester_name text not null,
  requester_email text not null,
  subject text not null,
  body text not null,
  notes jsonb not null default '[]'::jsonb,
  source_notification_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_tickets_status_idx
  on public.contact_tickets (status, priority, created_at desc);

alter table public.contact_tickets enable row level security;

drop policy if exists contact_tickets_service_only on public.contact_tickets;
create policy contact_tickets_service_only on public.contact_tickets
  for all using (false) with check (false);
