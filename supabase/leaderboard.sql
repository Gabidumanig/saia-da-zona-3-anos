-- Ranking individual Níver SZ 3.0
-- Corre no SQL Editor do Supabase.

create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  player_key text not null unique,
  quiz_best integer not null default 0,
  trail_best integer not null default 0,
  pack_best integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_quiz_idx on public.leaderboard (quiz_best desc);
create index if not exists leaderboard_trail_idx on public.leaderboard (trail_best desc);
create index if not exists leaderboard_pack_idx on public.leaderboard (pack_best desc);

alter table public.leaderboard enable row level security;

drop policy if exists "leaderboard_read" on public.leaderboard;
drop policy if exists "leaderboard_insert" on public.leaderboard;
drop policy if exists "leaderboard_update" on public.leaderboard;

create policy "leaderboard_read" on public.leaderboard
  for select to anon, authenticated using (true);

create policy "leaderboard_insert" on public.leaderboard
  for insert to anon, authenticated with check (true);

create policy "leaderboard_update" on public.leaderboard
  for update to anon, authenticated using (true) with check (true);

grant select, insert, update on table public.leaderboard to anon, authenticated;

create or replace function public.upsert_leaderboard_score(
  p_player_key text,
  p_player_name text,
  p_game text,
  p_score integer
)
returns public.leaderboard
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.leaderboard;
  safe_name text := left(trim(p_player_name), 24);
  safe_score integer := greatest(coalesce(p_score, 0), 0);
begin
  if p_player_key is null or length(trim(p_player_key)) < 8 then
    raise exception 'invalid player key';
  end if;
  if safe_name is null or length(safe_name) < 2 then
    raise exception 'invalid player name';
  end if;
  if p_game not in ('quiz', 'trail', 'pack') then
    raise exception 'invalid game';
  end if;

  insert into public.leaderboard (player_key, player_name)
  values (p_player_key, safe_name)
  on conflict (player_key) do update
    set player_name = excluded.player_name,
        updated_at = now()
  returning * into row;

  if p_game = 'quiz' and safe_score > row.quiz_best then
    update public.leaderboard set quiz_best = safe_score, updated_at = now()
    where player_key = p_player_key
    returning * into row;
  elsif p_game = 'trail' and safe_score > row.trail_best then
    update public.leaderboard set trail_best = safe_score, updated_at = now()
    where player_key = p_player_key
    returning * into row;
  elsif p_game = 'pack' and safe_score > row.pack_best then
    update public.leaderboard set pack_best = safe_score, updated_at = now()
    where player_key = p_player_key
    returning * into row;
  end if;

  return row;
end;
$$;

grant execute on function public.upsert_leaderboard_score(text, text, text, integer) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.leaderboard;
exception
  when duplicate_object then null;
end $$;
