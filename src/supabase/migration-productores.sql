-- ══ MIGRACIÓN: Nombres de productor ═════════════════════════════
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor.
-- Da una fuente de verdad para el nombre legible de cada productor,
-- para que el dashboard no muestre fragmentos del user_id (UUID).

create table if not exists productores (
  user_id    uuid primary key references auth.users on delete cascade,
  nombre     text not null,
  updated_at timestamptz default now()
);

alter table productores enable row level security;

-- Lectura: cualquier usuario autenticado puede ver todos los nombres
-- (necesario para que el dashboard del asesor los muestre). Solo expone
-- el nombre del plantel, ningún dato productivo.
do $$
begin
  if not exists (select 1 from pg_policies where tablename='productores' and policyname='productores_select_all') then
    execute 'create policy "productores_select_all" on productores for select to authenticated using (true)';
  end if;
  -- Escritura: cada productor edita únicamente su propio nombre.
  if not exists (select 1 from pg_policies where tablename='productores' and policyname='productores_own_write') then
    execute 'create policy "productores_own_write" on productores for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;
