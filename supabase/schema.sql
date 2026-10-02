-- Klopt accounts: run this once in the Supabase SQL editor (Database > SQL editor > New query).
-- Everything is protected by row level security: a student only ever sees their own records,
-- what was sent to them by name, and the groups they are a member of.

-- Profiles: a public username so classmates can send you things by name.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles: signed-in users can look up names" on public.profiles;
create policy "profiles: signed-in users can look up names" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles: make your own" on public.profiles;
create policy "profiles: make your own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles: change your own" on public.profiles;
create policy "profiles: change your own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Sync: one row per list, card, review or quiz, as JSON. The app validates everything it pulls.
create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('deck', 'card', 'review', 'quiz')),
  id text not null check (char_length(id) <= 64),
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id),
  check (deleted or data is not null),
  check (octet_length(coalesce(data::text, '')) <= 600000)
);
create index if not exists records_pull on public.records (user_id, updated_at);
alter table public.records enable row level security;
drop policy if exists "records: only your own" on public.records;
create policy "records: only your own" on public.records for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The server sets the time of every change, so devices with a wrong clock can't win every conflict.
create or replace function public.touch_record() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records for each row execute function public.touch_record();

-- Sent by name: a share file (the same format as a shared link) from one student to another.
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null default auth.uid() references auth.users on delete cascade,
  to_user uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('deck', 'quiz', 'folder')),
  title text not null check (char_length(title) between 1 and 120),
  payload jsonb not null check (octet_length(payload::text) <= 5000000),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index if not exists shares_inbox on public.shares (to_user, created_at desc);
alter table public.shares enable row level security;
drop policy if exists "shares: send as yourself" on public.shares;
create policy "shares: send as yourself" on public.shares for insert to authenticated with check (from_user = auth.uid());
drop policy if exists "shares: see what you sent or got" on public.shares;
create policy "shares: see what you sent or got" on public.shares for select to authenticated using (to_user = auth.uid() or from_user = auth.uid());
drop policy if exists "shares: clear your inbox" on public.shares;
create policy "shares: clear your inbox" on public.shares for delete to authenticated using (to_user = auth.uid() or from_user = auth.uid());

-- Groups (klassen): join with a code; members see each other's names and the shared items.
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create table if not exists public.group_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  added_by uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('deck', 'quiz', 'folder')),
  title text not null check (char_length(title) between 1 and 120),
  payload jsonb not null check (octet_length(payload::text) <= 5000000),
  created_at timestamptz not null default now()
);
create index if not exists group_items_by_group on public.group_items (group_id, created_at desc);

-- Membership check that policies can use without recursing into group_members' own policy.
create or replace function public.is_member(g uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = g and user_id = auth.uid());
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_items enable row level security;
drop policy if exists "groups: members see their groups" on public.groups;
create policy "groups: members see their groups" on public.groups for select to authenticated using (public.is_member(id));
drop policy if exists "groups: owner renames or removes" on public.groups;
create policy "groups: owner renames or removes" on public.groups for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "groups: owner deletes" on public.groups;
create policy "groups: owner deletes" on public.groups for delete to authenticated using (owner = auth.uid());
drop policy if exists "members: see fellow members" on public.group_members;
create policy "members: see fellow members" on public.group_members for select to authenticated using (public.is_member(group_id));
drop policy if exists "members: leave, or owner removes" on public.group_members;
create policy "members: leave, or owner removes" on public.group_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.groups g where g.id = group_id and g.owner = auth.uid()));
drop policy if exists "items: members see them" on public.group_items;
create policy "items: members see them" on public.group_items for select to authenticated using (public.is_member(group_id));
drop policy if exists "items: members add as themselves" on public.group_items;
create policy "items: members add as themselves" on public.group_items for insert to authenticated with check (added_by = auth.uid() and public.is_member(group_id));
drop policy if exists "items: adder or owner removes" on public.group_items;
create policy "items: adder or owner removes" on public.group_items for delete to authenticated
  using (added_by = auth.uid() or exists (select 1 from public.groups g where g.id = group_id and g.owner = auth.uid()));

-- Make a group (you become its first member) and get its join code.
create or replace function public.create_group(group_name text) returns public.groups language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  c text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when c ~ '^[A-Z0-9]{6}$' and not exists (select 1 from public.groups where code = c);
  end loop;
  insert into public.groups (name, code, owner) values (group_name, c, auth.uid()) returning * into g;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end $$;

-- Join with a code. Unknown codes give nothing back, so codes can't be guessed one by one cheaply.
create or replace function public.join_group(join_code text) returns public.groups language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.groups where code = upper(trim(join_code));
  if not found then return null; end if;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid()) on conflict do nothing;
  return g;
end $$;

-- Delete your account and everything in it (records, profile, sent shares, memberships).
create or replace function public.delete_me() returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.create_group(text), public.join_group(text), public.delete_me() from public, anon;
grant execute on function public.create_group(text), public.join_group(text), public.delete_me(), public.is_member(uuid) to authenticated;

-- Weekly ranking in groups, opt-in: a row only exists for students who chose to take part.
-- Only the totals for a week are shared (answers, right answers, days practised), never what was practised.
create table if not exists public.weekly_stats (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  week date not null check (extract(isodow from week) = 1),
  answers integer not null default 0 check (answers between 0 and 100000),
  correct integer not null default 0 check (correct between 0 and answers),
  days integer not null default 0 check (days between 0 and 7),
  updated_at timestamptz not null default now(),
  primary key (user_id, week)
);
create or replace function public.shares_a_group(other uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members a join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;
alter table public.weekly_stats enable row level security;
drop policy if exists "weekly: your own, and classmates in a group with you" on public.weekly_stats;
create policy "weekly: your own, and classmates in a group with you" on public.weekly_stats for select to authenticated
  using (user_id = auth.uid() or public.shares_a_group(user_id));
drop policy if exists "weekly: write your own" on public.weekly_stats;
create policy "weekly: write your own" on public.weekly_stats for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "weekly: update your own" on public.weekly_stats;
create policy "weekly: update your own" on public.weekly_stats for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "weekly: stop taking part" on public.weekly_stats;
create policy "weekly: stop taking part" on public.weekly_stats for delete to authenticated using (user_id = auth.uid());
revoke all on function public.shares_a_group(uuid) from public, anon;
grant execute on function public.shares_a_group(uuid) to authenticated;

-- "Slim herkennen" (a photo read by AI through the Edge Function recognize-terms): pages per account
-- per day, so one account cannot run up the bill. Only the Edge Function (service role) touches it.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  pages integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- Counts one page; false when the account already used its pages for today.
create or replace function public.use_ai(uid uuid, max_per_day integer) returns boolean language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  insert into public.ai_usage (user_id, day, pages) values (uid, current_date, 1)
  on conflict (user_id, day) do update set pages = ai_usage.pages + 1 where ai_usage.pages < max_per_day
  returning pages into n;
  return n is not null;
end $$;
revoke all on function public.use_ai(uuid, integer) from public, anon, authenticated;
grant execute on function public.use_ai(uuid, integer) to service_role;
