-- ══ 005_pedidos_bodega ══ (orden obligatorio: requiere 004_ventas) ══════════════════════
do $$ begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'Falta la tabla schema_migrations: aplica primero migrations/000_ledger.sql';
  end if;
  if not exists (select 1 from schema_migrations where version = '004_ventas') then
    raise exception 'Aplica primero migrations/004_ventas.sql (las migraciones van en orden)';
  end if;
end $$;

-- ══ PEDIDOS Y BODEGA — extensión de la app de Ventas ════════════════════
-- Ejecutar UNA SOLA VEZ en el mismo proyecto Supabase (xewujmpycclqjhlmiica),
-- DESPUÉS de ventas-schema.sql (la tabla pedidos referencia a ventas).
-- Comparte cuentas y RLS: cada productor ve solo lo suyo.

-- ── PEDIDOS ─────────────────────────────────────────────────────────────
-- Un pedido nace 'pendiente' (reserva de un cliente). Al entregarse se marca
-- 'entregado' y se genera la venta correspondiente (venta_id), de modo que el
-- huevo se cuenta UNA sola vez: mientras está pendiente compromete stock libre,
-- y al entregar pasa a ser venta real.
create table if not exists pedidos (
  id             uuid          default gen_random_uuid() primary key,
  fecha_pedido   date          not null default current_date,
  fecha_entrega  date,                                   -- comprometida / real
  cliente        text,
  bandejas       numeric(10,2) default 0,                -- bandejas de 30 huevos
  sueltos        integer       default 0,                -- huevos sueltos adicionales
  huevos_total   integer       not null default 0,       -- bandejas*30 + sueltos
  precio_bandeja numeric(10,0) default 0,                -- CLP por bandeja
  total_clp      numeric(12,0) default 0,                -- monto del pedido
  estado         text          not null default 'pendiente', -- pendiente | entregado | anulado
  venta_id       uuid          references ventas(id) on delete set null,
  observaciones  text,
  user_id        uuid          references auth.users not null,
  created_at     timestamptz   default now()
);

-- ── AJUSTES DE STOCK (movimientos de bodega) ────────────────────────────
-- Movimientos que NO son ni producción ni venta: mermas en bodega, autoconsumo,
-- regalos, o correcciones de inventario. 'huevos' es un delta con signo:
--   salidas (merma/autoconsumo/regalo)  → negativo (resta del stock)
--   entradas / correcciones al alza     → positivo (suma al stock)
create table if not exists ajustes_stock (
  id            uuid        default gen_random_uuid() primary key,
  fecha         date        not null default current_date,
  tipo          text        not null,          -- merma | autoconsumo | regalo | entrada | ajuste
  huevos        integer     not null default 0,-- delta con signo (ver arriba)
  motivo        text,
  user_id       uuid        references auth.users not null,
  created_at    timestamptz default now()
);

alter table pedidos       enable row level security;
alter table ajustes_stock enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='pedidos' and policyname='pedidos_user') then
    execute 'create policy "pedidos_user" on pedidos for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename='ajustes_stock' and policyname='ajustes_user') then
    execute 'create policy "ajustes_user" on ajustes_stock for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

create index if not exists pedidos_user_estado_idx on pedidos(user_id, estado);
create index if not exists ajustes_user_fecha_idx  on ajustes_stock(user_id, fecha);

-- ── registro: marca esta migración como aplicada ─────────────────────────
insert into schema_migrations (version) values ('005_pedidos_bodega') on conflict (version) do nothing;
