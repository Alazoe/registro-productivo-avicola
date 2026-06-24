-- ══ VENTAS — App de ventas de huevos (cuadre con producción) ════════════
-- Ejecutar UNA SOLA VEZ en el mismo proyecto Supabase (xewujmpycclqjhlmiica).
-- Comparte cuentas y RLS con la app de producción: cada productor ve solo
-- sus ventas, y el cuadre cruza con su producción (tabla registros).

create table if not exists ventas (
  id             uuid        default gen_random_uuid() primary key,
  fecha          date        not null,
  cliente        text,
  bandejas       numeric(10,2) default 0,   -- bandejas de 30 huevos
  sueltos        integer       default 0,   -- huevos sueltos adicionales
  huevos_total   integer       not null default 0,  -- bandejas*30 + sueltos (para el cuadre)
  precio_bandeja numeric(10,0) default 0,   -- CLP por bandeja
  total_clp      numeric(12,0) default 0,   -- monto de la venta
  observaciones  text,
  user_id        uuid        references auth.users not null,
  created_at     timestamptz default now()
);

alter table ventas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='ventas' and policyname='ventas_user') then
    execute 'create policy "ventas_user" on ventas for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

create index if not exists ventas_user_fecha_idx on ventas(user_id, fecha);
