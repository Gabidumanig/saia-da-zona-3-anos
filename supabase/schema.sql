-- Saia da Zona · 3 Anos
-- Corre isto no SQL Editor do Supabase (pode correr mais do que uma vez).

create table if not exists public.teams (
  id text primary key,
  name text not null,
  score integer not null default 0
);

create table if not exists public.participants (
  id uuid primary key,
  team_id text not null references public.teams(id),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.answers (
  participant_id uuid not null references public.participants(id),
  question_id text not null,
  team_id text not null references public.teams(id),
  is_correct boolean not null default false,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (participant_id, question_id)
);

insert into public.teams (id, name, score) values
  ('bonete', 'Bonete', 0),
  ('marins', 'Marins', 0),
  ('itatiaia', 'Itatiaia', 0),
  ('lopo', 'Lopo', 0)
on conflict (id) do nothing;

create or replace function public.award_team_points(
  p_team_id text,
  p_points integer,
  p_participant_id uuid,
  p_question_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.participants (id, team_id)
  values (p_participant_id, p_team_id)
  on conflict (id) do nothing;

  insert into public.answers (participant_id, question_id, team_id, is_correct, points)
  values (p_participant_id, p_question_id, p_team_id, true, p_points)
  on conflict (participant_id, question_id) do nothing;

  if found then
    update public.teams
    set score = score + p_points
    where id = p_team_id;
  end if;
end;
$$;

grant execute on function public.award_team_points(text, integer, uuid, text) to anon, authenticated;
grant execute on function public.award_team_points(text, integer, uuid, text) to service_role;

-- Realtime no placar (ignora se já estiver na publication)
do $$
begin
  alter publication supabase_realtime add table public.teams;
exception
  when duplicate_object then null;
end $$;

alter table public.teams enable row level security;
alter table public.participants enable row level security;
alter table public.answers enable row level security;

drop policy if exists "teams_read" on public.teams;
drop policy if exists "teams_update" on public.teams;
drop policy if exists "participants_read" on public.participants;
drop policy if exists "participants_insert" on public.participants;
drop policy if exists "participants_update" on public.participants;
drop policy if exists "answers_read" on public.answers;
drop policy if exists "answers_insert" on public.answers;

create policy "teams_read" on public.teams
  for select to anon, authenticated using (true);

create policy "teams_update" on public.teams
  for update to anon, authenticated using (true) with check (true);

create policy "participants_read" on public.participants
  for select to anon, authenticated using (true);

create policy "participants_insert" on public.participants
  for insert to anon, authenticated with check (true);

create policy "participants_update" on public.participants
  for update to anon, authenticated using (true) with check (true);

create policy "answers_read" on public.answers
  for select to anon, authenticated using (true);

create policy "answers_insert" on public.answers
  for insert to anon, authenticated with check (true);

grant usage on schema public to anon, authenticated;
grant select, update on table public.teams to anon, authenticated;
grant select, insert, update on table public.participants to anon, authenticated;
grant select, insert on table public.answers to anon, authenticated;
