-- ══ 002_user_config ══ (orden obligatorio: requiere 001_ubicaciones) ══════════════════════
do $$ begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'Falta la tabla schema_migrations: aplica primero migrations/000_ledger.sql';
  end if;
  if not exists (select 1 from schema_migrations where version = '001_ubicaciones') then
    raise exception 'Aplica primero migrations/001_ubicaciones.sql (las migraciones van en orden)';
  end if;
end $$;

-- ══ MIGRACIÓN: Configuración por usuario ════════════════════════
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor.
-- Almacena preferencias por usuario (etiquetas no vendibles, etc.)

create table if not exists user_config (
  user_id    uuid primary key references auth.users on delete cascade,
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table user_config enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename='user_config' and policyname='user_config_user'
  ) then
    execute 'create policy "user_config_user" on user_config for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

-- ── registro: marca esta migración como aplicada ─────────────────────────
insert into schema_migrations (version) values ('002_user_config') on conflict (version) do nothing;
