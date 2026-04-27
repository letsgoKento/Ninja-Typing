create extension if not exists pgcrypto;

create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  player_name text not null check (length(trim(player_name)) between 1 and 20),
  score integer not null check (score >= 0),
  accuracy numeric(5, 2) not null check (accuracy >= 0 and accuracy <= 100),
  max_combo integer not null check (max_combo >= 0),
  miss_count integer not null check (miss_count >= 0),
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard')),
  created_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;

create policy "Anyone can read leaderboard"
  on public.leaderboard
  for select
  using (true);

create policy "Anyone can submit leaderboard scores"
  on public.leaderboard
  for insert
  with check (
    length(trim(player_name)) between 1 and 20
    and score >= 0
    and accuracy >= 0
    and accuracy <= 100
    and max_combo >= 0
    and miss_count >= 0
    and difficulty in ('easy', 'normal', 'hard')
  );

create index if not exists leaderboard_rank_idx
  on public.leaderboard (difficulty, score desc, accuracy desc, max_combo desc, created_at asc);
