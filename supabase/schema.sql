-- ============================================================================
-- Lune de Sang — Schéma Supabase (Phase 3 : Multijoueur Temps Réel)
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Table des salons (rooms)
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_user_id text not null,
  narrator_mode text not null default 'auto' check (narrator_mode in ('auto', 'human')),
  phase text not null default 'LOBBY' check (
    phase in (
      'LOBBY',
      'ROLE_REVEAL',
      'NIGHT_CUPIDON',
      'NIGHT_SEER',
      'NIGHT_WEREWOLVES',
      'NIGHT_WITCH',
      'DAY_ANNOUNCEMENT',
      'DAY_VOTE',
      'HUNTER_SHOT',
      'VICTORY'
    )
  ),
  turn_number integer not null default 1,
  role_composition jsonb not null default '{}'::jsonb,
  game_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_code_idx on public.rooms (code);

-- 2. Table des joueurs dans un salon (room_players)
create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id text not null,
  pseudo text not null,
  avatar_data text,
  is_owner boolean not null default false,
  role text,
  is_alive boolean not null default true,
  has_voted boolean not null default false,
  target_id text,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists room_players_room_id_idx on public.room_players (room_id);

-- Trigger automatique pour updated_at sur rooms
create or replace function public.touch_rooms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rooms_updated_at on public.rooms;
create trigger trg_rooms_updated_at
  before update on public.rooms
  for each row
  execute function public.touch_rooms_updated_at();

-- ============================================================================
-- 3. Row Level Security (RLS)
-- Compatible avec signInAnonymously() et le mode fallback UUID local.
-- ============================================================================
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;

-- Politiques pour public.rooms
drop policy if exists "rooms_select_all" on public.rooms;
create policy "rooms_select_all"
  on public.rooms for select
  to anon, authenticated
  using (true);

drop policy if exists "rooms_insert_all" on public.rooms;
create policy "rooms_insert_all"
  on public.rooms for insert
  to anon, authenticated
  with check (char_length(code) = 4);

drop policy if exists "rooms_update_all" on public.rooms;
create policy "rooms_update_all"
  on public.rooms for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "rooms_delete_host" on public.rooms;
create policy "rooms_delete_host"
  on public.rooms for delete
  to anon, authenticated
  using (
    host_user_id = coalesce(auth.uid()::text, host_user_id)
  );

-- Politiques pour public.room_players
drop policy if exists "room_players_select_all" on public.room_players;
create policy "room_players_select_all"
  on public.room_players for select
  to anon, authenticated
  using (true);

drop policy if exists "room_players_insert_all" on public.room_players;
create policy "room_players_insert_all"
  on public.room_players for insert
  to anon, authenticated
  with check (char_length(trim(pseudo)) > 0);

drop policy if exists "room_players_update_all" on public.room_players;
create policy "room_players_update_all"
  on public.room_players for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "room_players_delete_all" on public.room_players;
create policy "room_players_delete_all"
  on public.room_players for delete
  to anon, authenticated
  using (true);

-- ============================================================================
-- 4. Activation de Supabase Realtime sur rooms & room_players
-- ============================================================================
alter table public.rooms replica identity full;
alter table public.room_players replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_players'
  ) then
    alter publication supabase_realtime add table public.room_players;
  end if;
end $$;
