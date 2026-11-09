-- Placar do Jogo: Angry líderes

alter table public.leaderboard
  add column if not exists angry_best integer not null default 0;

create index if not exists leaderboard_angry_idx on public.leaderboard (angry_best desc);

drop function if exists public.upsert_leaderboard_score(text, text, text, integer);
drop function if exists public.upsert_leaderboard_score(text, text, text, integer, text);

create or replace function public.upsert_leaderboard_score(
  p_player_key text,
  p_player_name text,
  p_game text,
  p_score integer,
  p_avatar text default null
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
  safe_avatar text := nullif(left(trim(coalesce(p_avatar, '')), 24), '');
begin
  if p_player_key is null or length(trim(p_player_key)) < 8 then
    raise exception 'invalid player key';
  end if;
  if safe_name is null or length(safe_name) < 2 then
    raise exception 'invalid player name';
  end if;
  if p_game not in ('quiz', 'trail', 'pack', 'angry') then
    raise exception 'invalid game';
  end if;
  if safe_avatar is not null and safe_avatar !~ '^[a-z0-9_-]+$' then
    raise exception 'invalid avatar';
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
  elsif p_game = 'trail' then
    if safe_score > row.trail_best then
      update public.leaderboard
      set trail_best = safe_score,
          trail_avatar = coalesce(safe_avatar, trail_avatar),
          updated_at = now()
      where player_key = p_player_key
      returning * into row;
    elsif safe_avatar is not null then
      update public.leaderboard
      set trail_avatar = safe_avatar,
          updated_at = now()
      where player_key = p_player_key
      returning * into row;
    end if;
  elsif p_game = 'pack' and safe_score > row.pack_best then
    update public.leaderboard set pack_best = safe_score, updated_at = now()
    where player_key = p_player_key
    returning * into row;
  elsif p_game = 'angry' and safe_score > row.angry_best then
    update public.leaderboard set angry_best = safe_score, updated_at = now()
    where player_key = p_player_key
    returning * into row;
  end if;

  return row;
end;
$$;

grant execute on function public.upsert_leaderboard_score(text, text, text, integer, text) to anon, authenticated;
