create extension if not exists pgcrypto;

create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  content text not null check (char_length(content) between 1 and 2000),
  color text not null default 'rgba(254, 240, 138, 0.9)' check (char_length(color) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memo_credentials (
  memo_id uuid primary key references public.memos(id) on delete cascade,
  password_hash text not null
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memos_set_updated_at on public.memos;
create trigger memos_set_updated_at
before update on public.memos
for each row
execute function public.set_updated_at();

create or replace function public.create_memo_with_credentials(
  p_title text,
  p_content text,
  p_password_hash text,
  p_color text default 'rgba(254, 240, 138, 0.9)'
)
returns public.memos
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_memo public.memos;
begin
  if char_length(p_title) < 1 or char_length(p_title) > 80 then
    raise exception 'Invalid title length';
  end if;

  if char_length(p_content) < 1 or char_length(p_content) > 2000 then
    raise exception 'Invalid content length';
  end if;

  if char_length(p_password_hash) < 50 then
    raise exception 'Invalid password hash';
  end if;

  insert into public.memos (title, content, color, position, created_at, updated_at)
  values (
    p_title,
    p_content,
    coalesce(nullif(p_color, ''), 'rgba(254, 240, 138, 0.9)'),
    0,
    now(),
    now()
  )
  returning * into inserted_memo;

  insert into public.memo_credentials (memo_id, password_hash)
  values (inserted_memo.id, p_password_hash);

  return inserted_memo;
end;
$$;

revoke all on function public.create_memo_with_credentials(text, text, text, text)
from public, anon, authenticated;
grant execute on function public.create_memo_with_credentials(text, text, text, text)
to service_role;

alter table public.memos enable row level security;
alter table public.memo_credentials enable row level security;

revoke all on schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select on public.memos to anon, authenticated;
grant select on public.memo_credentials to service_role;
grant all on public.memos to service_role;
grant all on public.memo_credentials to service_role;

drop policy if exists "Public memos are readable" on public.memos;
create policy "Public memos are readable"
on public.memos
for select
to anon, authenticated
using (true);

drop policy if exists "Public memos deny writes" on public.memos;
create policy "Public memos deny writes"
on public.memos
for insert
to anon, authenticated
with check (false);

drop policy if exists "Public memos deny updates" on public.memos;
create policy "Public memos deny updates"
on public.memos
for update
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Public memos deny deletes" on public.memos;
create policy "Public memos deny deletes"
on public.memos
for delete
to anon, authenticated
using (false);

drop policy if exists "Private memo credentials deny all" on public.memo_credentials;
create policy "Private memo credentials deny all"
on public.memo_credentials
for all
to anon, authenticated
using (false)
with check (false);

create index if not exists memos_created_at_idx
on public.memos (created_at desc);

create index if not exists memos_position_idx
on public.memos (position asc, created_at desc);
