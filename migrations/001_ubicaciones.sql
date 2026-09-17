-- ══ 001_ubicaciones ══ (orden obligatorio: requiere 000_ledger) ══════════════════════
do $$ begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'Falta la tabla schema_migrations: aplica primero migrations/000_ledger.sql';
  end if;
  if not exists (select 1 from schema_migrations where version = '000_ledger') then
    raise exception 'Aplica primero migrations/000_ledger.sql (las migraciones van en orden)';
  end if;
end $$;

-- ══ MIGRACIÓN: Ubicaciones físicas ══════════════════════════════
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor sobre el proyecto existente.
-- Es seguro ejecutar si ya fue aplicado (usa IF NOT EXISTS).

-- 1. Tabla catálogo de ubicaciones por usuario
create table if not exists ubicaciones (
  id         uuid        default gen_random_uuid() primary key,
  nombre     text        not null,
  user_id    uuid        references auth.users not null,
  created_at timestamptz default now()
);

alter table ubicaciones enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename='ubicaciones' and policyname='ubicaciones_user'
  ) then
    execute 'create policy "ubicaciones_user" on ubicaciones for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

-- 2. Columna FK en lotes (nullable — lotes existentes no se ven afectados)
alter table lotes
  add column if not exists ubicacion_id uuid references ubicaciones(id) on delete set null;

-- ── registro: marca esta migración como aplicada ─────────────────────────
insert into schema_migrations (version) values ('001_ubicaciones') on conflict (version) do nothing;
