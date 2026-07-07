-- Payment and Subscriptions Infrastructure Schema.
-- Establishes support for Stripe, Lemon Squeezy, Apple Pay, Google Pay, and in-app subscriptions or entitlements.

create table if not exists public.user_subscriptions (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  provider text not null,
  provider_subscription_id text not null unique,
  status text not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_entitlements (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  type text not null,
  source text not null,
  status text not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id text primary key default gen_random_uuid()::text,
  user_id text,
  provider text not null,
  provider_order_id text,
  amount numeric(10, 2) not null default 0.00,
  currency text not null default 'USD',
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists user_subscriptions_user_idx on public.user_subscriptions (user_id);
create index if not exists user_entitlements_user_idx on public.user_entitlements (user_id, status);
create index if not exists payment_transactions_user_idx on public.payment_transactions (user_id);
create index if not exists payment_transactions_provider_order_idx on public.payment_transactions (provider, provider_order_id);

-- Enable RLS
alter table public.user_subscriptions enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.payment_transactions enable row level security;
