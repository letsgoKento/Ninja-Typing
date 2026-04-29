create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (length(trim(username)) between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  player_name text not null check (length(trim(player_name)) between 1 and 20),
  shoutout text not null default '' check (length(shoutout) <= 80),
  score integer not null check (score >= 0),
  accuracy numeric(5, 2) not null check (accuracy >= 0 and accuracy <= 100),
  max_combo integer not null check (max_combo >= 0),
  miss_count integer not null check (miss_count >= 0),
  cpm integer not null default 0 check (cpm >= 0),
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard')),
  created_at timestamptz not null default now()
);

alter table public.leaderboard
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.leaderboard
  add column if not exists shoutout text not null default '';

alter table public.leaderboard
  add column if not exists cpm integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leaderboard_shoutout_length_check'
      and conrelid = 'public.leaderboard'::regclass
  ) then
    alter table public.leaderboard
      add constraint leaderboard_shoutout_length_check check (length(shoutout) <= 80);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leaderboard_cpm_non_negative_check'
      and conrelid = 'public.leaderboard'::regclass
  ) then
    alter table public.leaderboard
      add constraint leaderboard_cpm_non_negative_check check (cpm >= 0);
  end if;
end $$;

alter table public.profiles enable row level security;
alter table public.leaderboard enable row level security;

drop policy if exists "Anyone can read profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Anyone can read leaderboard" on public.leaderboard;
drop policy if exists "Anyone can submit leaderboard scores" on public.leaderboard;
drop policy if exists "Users can insert own leaderboard score" on public.leaderboard;
drop policy if exists "Users can update own leaderboard score" on public.leaderboard;

create policy "Anyone can read profiles"
  on public.profiles
  for select
  using (true);

create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Anyone can read leaderboard"
  on public.leaderboard
  for select
  using (user_id is not null);

create policy "Users can insert own leaderboard score"
  on public.leaderboard
  for insert
  with check (
    auth.uid() = user_id
    and length(trim(player_name)) between 1 and 20
    and length(shoutout) <= 80
    and score >= 0
    and accuracy >= 0
    and accuracy <= 100
    and max_combo >= 0
    and miss_count >= 0
    and cpm >= 0
    and difficulty in ('easy', 'normal', 'hard')
  );

create policy "Users can update own leaderboard score"
  on public.leaderboard
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and length(trim(player_name)) between 1 and 20
    and length(shoutout) <= 80
    and score >= 0
    and accuracy >= 0
    and accuracy <= 100
    and max_combo >= 0
    and miss_count >= 0
    and cpm >= 0
    and difficulty in ('easy', 'normal', 'hard')
  );

create unique index if not exists leaderboard_user_difficulty_idx
  on public.leaderboard (user_id, difficulty)
  where user_id is not null;

create index if not exists leaderboard_rank_idx
  on public.leaderboard (difficulty, score desc, accuracy desc, max_combo desc, created_at asc);
