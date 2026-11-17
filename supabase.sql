-- ============================================================================
-- FOREVER WORLD — Esquema de base de datos en Supabase
-- Ejecuta este archivo completo en el SQL Editor de tu proyecto Supabase.
-- Es idempotente: puedes volver a ejecutarlo sin romper datos existentes.
-- ============================================================================

-- 1. Tabla principal del estado del mundo (una fila por mundo / sala)
create table if not exists public.fw_worlds (
  id text primary key,
  state jsonb not null,
  updated_at bigint not null,
  updated_by text not null default '',
  rev bigint not null default 1,
  created_at timestamptz not null default now()
);

-- 2. Historial de puntos de restauración en la nube (snapshots)
create table if not exists public.fw_snapshots (
  id bigserial primary key,
  world_id text not null references public.fw_worlds(id) on delete cascade,
  state jsonb not null,
  label text not null default '',
  saved_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists fw_snapshots_world_idx
  on public.fw_snapshots (world_id, created_at desc);

-- 3. Seguridad (RLS)
-- Nota: Forever World es una app estática en GitHub Pages para un grupo de amigos
-- sin registro obligatorio, por lo que permite lectura/escritura con la anon key.
-- Si más adelante deseas restringir el acceso, agrega Supabase Auth y ajusta estas políticas.
alter table public.fw_worlds enable row level security;
alter table public.fw_snapshots enable row level security;

drop policy if exists "fw_worlds_select_all" on public.fw_worlds;
create policy "fw_worlds_select_all"
  on public.fw_worlds for select
  to anon, authenticated
  using (true);

drop policy if exists "fw_worlds_insert_all" on public.fw_worlds;
create policy "fw_worlds_insert_all"
  on public.fw_worlds for insert
  to anon, authenticated
  with check (true);

drop policy if exists "fw_worlds_update_all" on public.fw_worlds;
create policy "fw_worlds_update_all"
  on public.fw_worlds for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "fw_snapshots_select_all" on public.fw_snapshots;
create policy "fw_snapshots_select_all"
  on public.fw_snapshots for select
  to anon, authenticated
  using (true);

drop policy if exists "fw_snapshots_insert_all" on public.fw_snapshots;
create policy "fw_snapshots_insert_all"
  on public.fw_snapshots for insert
  to anon, authenticated
  with check (true);

drop policy if exists "fw_snapshots_delete_all" on public.fw_snapshots;
create policy "fw_snapshots_delete_all"
  on public.fw_snapshots for delete
  to anon, authenticated
  using (true);

-- 4. Función RPC para guardado atómico con control de versión (evita pisar cambios)
create or replace function public.fw_save_world(
  p_id text,
  p_state jsonb,
  p_updated_at bigint,
  p_updated_by text default '',
  p_expected_rev bigint default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_row public.fw_worlds%rowtype;
begin
  select * into v_row
  from public.fw_worlds
  where id = p_id
  for update;

  if not found then
    insert into public.fw_worlds (id, state, updated_at, updated_by, rev)
    values (p_id, p_state, p_updated_at, coalesce(p_updated_by, ''), 1)
    returning * into v_row;

    return jsonb_build_object(
      'ok', true,
      'rev', v_row.rev,
      'updated_at', v_row.updated_at,
      'updated_by', v_row.updated_by
    );
  end if;

  if not p_force and p_expected_rev is not null and v_row.rev <> p_expected_rev then
    return jsonb_build_object(
      'ok', false,
      'reason', 'conflict',
      'rev', v_row.rev,
      'updated_at', v_row.updated_at,
      'updated_by', v_row.updated_by,
      'state', v_row.state
    );
  end if;

  update public.fw_worlds
  set
    state = p_state,
    updated_at = p_updated_at,
    updated_by = coalesce(p_updated_by, ''),
    rev = v_row.rev + 1
  where id = p_id
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'rev', v_row.rev,
    'updated_at', v_row.updated_at,
    'updated_by', v_row.updated_by
  );
end;
$$;

grant execute on function public.fw_save_world(text, jsonb, bigint, text, bigint, boolean) to anon, authenticated;

-- 5. Habilitar Realtime para sincronización en vivo entre navegadores
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fw_worlds'
  ) then
    alter publication supabase_realtime add table public.fw_worlds;
  end if;
end $$;
