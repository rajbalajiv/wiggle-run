-- Run once in the Supabase SQL Editor.
-- Clients never connect directly to this table. Only Vercel server functions use the server-side secret.
create table if not exists public.wiggle_scores (
  attempt_id uuid primary key,
  player_name text not null check (char_length(player_name) between 2 and 32),
  course_id text not null default 'wiggle-v1' check (course_id in ('wiggle-v1','chicane-v1','switchback-v1','hairpin-v1')),
  distance numeric(4,1) not null check (distance >= 0 and distance <= 100),
  seconds numeric(4,1) not null check (seconds >= 0 and seconds <= 91),
  outcome text not null check (outcome in ('FINISHED','OUT OF BOUNDS','TIME LIMIT','TRACKING LOST','INTERRUPTED')),
  created_at timestamptz not null default now(),
  constraint finish_consistency check ((outcome = 'FINISHED' and distance = 100) or (outcome <> 'FINISHED' and distance < 100))
);
alter table public.wiggle_scores enable row level security;
-- No public/anon policies. Clients cannot read/write through a publishable key.
create index if not exists wiggle_scores_ranking on public.wiggle_scores (course_id, distance desc, seconds asc, created_at asc);
