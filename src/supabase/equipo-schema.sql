-- ══ EQUIPO — Compartir una cuenta entre varios usuarios (Etapa 1) ═══════
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (proyecto xewujmpycclqjhlmiica).
-- Es RETROCOMPATIBLE: mientras no exista ninguna invitación, cada usuario sigue
-- viendo solo lo suyo (tiene_acceso(user_id) equivale a user_id = auth.uid()).
--
-- Idea: el dueño de una cuenta invita correos. Un dato es visible/editable si
-- eres el dueño (user_id = tu id) O tu correo está invitado y activo en esa
-- cuenta. Toda la lógica vive en UNA función central (tiene_acceso) para poder
-- auditarla en un solo lugar.

-- 1) Tabla de invitaciones ────────────────────────────────────────────────
create table if not exists equipo (
  id             uuid        default gen_random_uuid() primary key,
  dueno_id       uuid        references auth.users not null,   -- cuenta compartida
  email_invitado text        not null,                          -- correo con acceso
  rol            text        not null default 'editor',         -- editor (Etapa 1)
  activo         boolean     not null default true,
  created_at     timestamptz default now(),
  unique (dueno_id, email_invitado)
);

-- 2) Función central de acceso ────────────────────────────────────────────
-- SECURITY DEFINER: lee 'equipo' sin pasar por RLS (evita recursión).
create or replace function tiene_acceso(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select owner = auth.uid()
      or exists (
        select 1 from equipo e
        where e.dueno_id = owner
          and e.activo
          and lower(e.email_invitado) = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
$$;
grant execute on function tiene_acceso(uuid) to authenticated;

-- 3) RLS de la tabla equipo ───────────────────────────────────────────────
alter table equipo enable row level security;
-- El dueño y los miembros activos de la cuenta pueden gestionar el equipo.
drop policy if exists "equipo_acceso" on equipo;
create policy "equipo_acceso" on equipo for all
  using (tiene_acceso(dueno_id)) with check (tiene_acceso(dueno_id));

-- 4) Reescritura de políticas de las tablas de datos ─────────────────────
-- Cada tabla pasa de "auth.uid() = user_id" a "tiene_acceso(user_id)".
do $$
declare t text;
begin
  foreach t in array array[
    'ubicaciones','lotes','pesajes','registros','user_config',
    'ventas','pedidos','ajustes_stock',
    'proveedores','alimento_recepciones','alimento_ajustes'
  ] loop
    -- borra cualquier política previa "<tabla>_user" o equivalente conocida
    execute format('drop policy if exists %I on %I', t||'_user', t);
  end loop;
end $$;

-- Nombres de política previos que no siguen el patrón "<tabla>_user":
drop policy if exists "user_config_user" on user_config;
drop policy if exists "ajustes_user"     on ajustes_stock;
drop policy if exists "alim_recep_user"  on alimento_recepciones;
drop policy if exists "alim_aj_user"     on alimento_ajustes;

drop policy if exists "ubicaciones_acceso"  on ubicaciones;
drop policy if exists "lotes_acceso"         on lotes;
drop policy if exists "pesajes_acceso"       on pesajes;
drop policy if exists "registros_acceso"     on registros;
drop policy if exists "user_config_acceso"   on user_config;
drop policy if exists "ventas_acceso"        on ventas;
drop policy if exists "pedidos_acceso"       on pedidos;
drop policy if exists "ajustes_acceso"       on ajustes_stock;
drop policy if exists "proveedores_acceso"   on proveedores;
drop policy if exists "alim_recep_acceso"    on alimento_recepciones;
drop policy if exists "alim_aj_acceso"       on alimento_ajustes;

create policy "ubicaciones_acceso"  on ubicaciones          for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
create policy "lotes_acceso"        on lotes                for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
create policy "pesajes_acceso"      on pesajes              for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
create policy "registros_acceso"    on registros            for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
create policy "user_config_acceso"  on user_config          for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
create policy "ventas_acceso"       on ventas               for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
create policy "pedidos_acceso"      on pedidos              for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
create policy "ajustes_acceso"      on ajustes_stock        for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
create policy "proveedores_acceso"  on proveedores          for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
create policy "alim_recep_acceso"   on alimento_recepciones for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
create policy "alim_aj_acceso"      on alimento_ajustes     for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));

-- productores: la lectura pública para el dashboard se mantiene; la escritura
-- pasa a permitir también a los miembros de la cuenta.
drop policy if exists "productores_own_write"    on productores;
drop policy if exists "productores_acceso_write" on productores;
create policy "productores_acceso_write" on productores for all
  using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
-- (la política de lectura "productores_select_all" para autenticados se conserva)

create index if not exists equipo_email_idx on equipo (lower(email_invitado));
create index if not exists equipo_dueno_idx on equipo (dueno_id);
