-- 在 Supabase SQL Editor 中执行。前端可先使用 localStorage，接入登录后再按 household_id 同步。
create extension if not exists pgcrypto;

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default '我的家庭',
  created_at timestamptz not null default now()
);

create table app_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  kind text not null check (kind in ('dish','place','inventory','shopping','term')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index app_records_household_kind_idx on app_records(household_id, kind);
alter table households enable row level security;
alter table app_records enable row level security;

-- 上线前应接入 Supabase Auth，并把 household 成员关系写入独立表后配置 RLS。
-- 不建议为生产环境开放匿名全表读写。
