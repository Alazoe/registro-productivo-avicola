-- ══ EQUIPO — Compartir una cuenta entre varios usuarios (Etapa 1) ═══════
-- Ejecutar en el SQL Editor de Supabase (proyecto xewujmpycclqjhlmiica).
-- RETROCOMPATIBLE: sin invitaciones, cada usuario ve solo lo suyo.
-- ROBUSTO: solo modifica las tablas que existan, y se puede correr varias
-- veces sin error (repara estados a medias).
--
-- Idea: el dueño invita correos. Un dato es visible/editable si eres el dueño
-- (user_id = tu id) O tu correo está invitado y activo en esa cuenta. Toda la
-- lógica vive en una función central (tiene_acceso).

-- 1) Tabla de invitaciones ────────────────────────────────────────────────
create table if not exists equipo (
  id             uuid        default gen_random_uuid() primary key,
  dueno_id       uuid        references auth.users not null,
  email_invitado text        not null,
  rol            text        not null default 'editor',
  activo         boolean     not null default true,
  created_at     timestamptz default now(),
  unique (dueno_id, email_invitado)
);

-- 2) Función central de acceso (SECURITY DEFINER: lee equipo sin recursión) ─
create or replace function tiene_acceso(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or exists (select 1 from equipo e
                 where e.dueno_id = owner and e.activo
                   and lower(e.email_invitado) = lower(coalesce(auth.jwt() ->> 'email','')));
$$;
grant execute on function tiene_acceso(uuid) to authenticated;

-- 3) RLS de la tabla equipo ───────────────────────────────────────────────
alter table equipo enable row level security;
drop policy if exists "equipo_acceso" on equipo;
create policy "equipo_acceso" on equipo for all
  using (tiene_acceso(dueno_id)) with check (tiene_acceso(dueno_id));

-- 4) Reescritura de políticas de datos (solo tablas existentes) ────────────
do $$
declare r record;
begin
  for r in select * from (values
    ('ubicaciones','ubicaciones_user','ubicaciones_acceso'),
    ('lotes','lotes_user','lotes_acceso'),
    ('pesajes','pesajes_user','pesajes_acceso'),
    ('registros','registros_user','registros_acceso'),
    ('user_config','user_config_user','user_config_acceso'),
    ('ventas','ventas_user','ventas_acceso'),
    ('pedidos','pedidos_user','pedidos_acceso'),
    ('ajustes_stock','ajustes_user','ajustes_acceso'),
    ('proveedores','proveedores_user','proveedores_acceso'),
    ('alimento_recepciones','alim_recep_user','alim_recep_acceso'),
    ('alimento_ajustes','alim_aj_user','alim_aj_acceso'),
    ('productores','productores_own_write','productores_acceso_write')
  ) as x(tbl, oldp, newp)
  loop
    if to_regclass('public.'||r.tbl) is not null then
      execute format('alter table %I enable row level security', r.tbl);
      execute format('drop policy if exists %I on %I', r.oldp, r.tbl);
      execute format('drop policy if exists %I on %I', r.newp, r.tbl);
      execute format('create policy %I on %I for all using (tiene_acceso(user_id)) with check (tiene_acceso(user_id))', r.newp, r.tbl);
    end if;
  end loop;
end $$;
-- Nota: en productores se conserva la política de lectura pública
-- "productores_select_all" (el dashboard del asesor lee los nombres).

create index if not exists equipo_email_idx on equipo (lower(email_invitado));
create index if not exists equipo_dueno_idx on equipo (dueno_id);
