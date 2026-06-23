-- 在 Supabase SQL Editor 中执行。
-- 当前版本采用“家庭共享同步”模式：所有设备共享 slug = 'family-default' 的一份数据。
-- 适合个人/家庭小工具快速上线；如果后续要公开给陌生用户使用，应改为 Supabase Auth + household_members + 严格 RLS。

create extension if not exists pgcrypto;

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default '我的家庭',
  slug text,
  created_at timestamptz not null default now()
);

alter table households add column if not exists slug text;

update households
set slug = 'family-default'
where slug is null;

alter table households
  alter column slug set default 'family-default';

create unique index if not exists households_slug_idx on households(slug);

create table if not exists app_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'app_records_kind_check'
      and conrelid = 'app_records'::regclass
  ) then
    alter table app_records drop constraint app_records_kind_check;
  end if;
end $$;

alter table app_records
  add constraint app_records_kind_check
  check (kind in ('state','dish','place','inventory','shopping','term'));

create index if not exists app_records_household_kind_idx on app_records(household_id, kind);
create index if not exists app_records_updated_at_idx on app_records(updated_at desc);

alter table households enable row level security;
alter table app_records enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on households to anon, authenticated;
grant select, insert, update, delete on app_records to anon, authenticated;

drop policy if exists "family households are readable" on households;
drop policy if exists "family households can be created" on households;
drop policy if exists "family households can be updated" on households;
drop policy if exists "family records are readable" on app_records;
drop policy if exists "family records can be created" on app_records;
drop policy if exists "family records can be updated" on app_records;
drop policy if exists "family records can be deleted" on app_records;

create policy "family households are readable"
on households for select
to anon, authenticated
using (slug = 'family-default');

create policy "family households can be created"
on households for insert
to anon, authenticated
with check (slug = 'family-default');

create policy "family households can be updated"
on households for update
to anon, authenticated
using (slug = 'family-default')
with check (slug = 'family-default');

create policy "family records are readable"
on app_records for select
to anon, authenticated
using (
  exists (
    select 1
    from households
    where households.id = app_records.household_id
      and households.slug = 'family-default'
  )
);

create policy "family records can be created"
on app_records for insert
to anon, authenticated
with check (
  exists (
    select 1
    from households
    where households.id = app_records.household_id
      and households.slug = 'family-default'
  )
);

create policy "family records can be updated"
on app_records for update
to anon, authenticated
using (
  exists (
    select 1
    from households
    where households.id = app_records.household_id
      and households.slug = 'family-default'
  )
)
with check (
  exists (
    select 1
    from households
    where households.id = app_records.household_id
      and households.slug = 'family-default'
  )
);

create policy "family records can be deleted"
on app_records for delete
to anon, authenticated
using (
  exists (
    select 1
    from households
    where households.id = app_records.household_id
      and households.slug = 'family-default'
  )
);
