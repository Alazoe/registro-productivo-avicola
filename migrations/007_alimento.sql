-- ══ 007_alimento ══ (orden obligatorio: requiere 006_tamanos_cajas) ══════════════════════
do $$ begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'Falta la tabla schema_migrations: aplica primero migrations/000_ledger.sql';
  end if;
  if not exists (select 1 from schema_migrations where version = '006_tamanos_cajas') then
    raise exception 'Aplica primero migrations/006_tamanos_cajas.sql (las migraciones van en orden)';
  end if;
end $$;

-- ══ ALIMENTO — Stock de alimento concentrado (insumo) ═══════════════════
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (proyecto xewujmpycclqjhlmiica),
-- en el mismo proyecto que producción/ventas. Incremental y seguro.
--
-- Stock de alimento = Σ recepciones.kg − consumo (registros.kg_alimento) ± ajustes.
-- El consumo ya se registra a diario en la app de producción, así que el stock
-- se descuenta solo. Cada productor ve solo lo suyo (RLS por user_id).

-- Proveedores del productor (con alta rápida desde el formulario)
create table if not exists proveedores (
  id         uuid        default gen_random_uuid() primary key,
  nombre     text        not null,
  telefono   text,
  user_id    uuid        references auth.users not null,
  created_at timestamptz default now()
);

-- Recepciones (compras/entradas de alimento)
create table if not exists alimento_recepciones (
  id           uuid          default gen_random_uuid() primary key,
  fecha        date          not null default current_date,
  proveedor_id uuid          references proveedores(id) on delete set null,
  lote         text,                                   -- N° de lote del insumo (trazabilidad)
  kg           numeric(12,2) not null default 0,       -- cantidad en kilos (fuente de verdad)
  sacos        numeric(10,2) default 0,                -- referencia si se ingresó en sacos de 25 kg
  precio_kg    numeric(12,2) default 0,                -- CLP por kilo
  total_clp    numeric(14,0) default 0,                -- kg * precio_kg
  n_documento  text,                                   -- N° factura/guía de compra
  observaciones text,
  user_id      uuid          references auth.users not null,
  created_at   timestamptz   default now()
);

-- Ajustes de stock de alimento (mermas, correcciones de conteo)
create table if not exists alimento_ajustes (
  id         uuid          default gen_random_uuid() primary key,
  fecha      date          not null default current_date,
  tipo       text          not null,        -- merma | entrada | ajuste
  kg         numeric(12,2) not null default 0, -- delta con signo (merma negativo, entrada positivo)
  motivo     text,
  user_id    uuid          references auth.users not null,
  created_at timestamptz   default now()
);

alter table proveedores          enable row level security;
alter table alimento_recepciones enable row level security;
alter table alimento_ajustes     enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='proveedores' and policyname='proveedores_user') then
    execute 'create policy "proveedores_user" on proveedores for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename='alimento_recepciones' and policyname='alim_recep_user') then
    execute 'create policy "alim_recep_user" on alimento_recepciones for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename='alimento_ajustes' and policyname='alim_aj_user') then
    execute 'create policy "alim_aj_user" on alimento_ajustes for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

create index if not exists proveedores_user_idx   on proveedores(user_id);
create index if not exists alim_recep_user_fecha  on alimento_recepciones(user_id, fecha);
create index if not exists alim_aj_user_fecha      on alimento_ajustes(user_id, fecha);

-- ── registro: marca esta migración como aplicada ─────────────────────────
insert into schema_migrations (version) values ('007_alimento') on conflict (version) do nothing;
