-- ══ 009_stock_resumen ══ (orden obligatorio: requiere 008_equipo) ══════════════════════
do $$ begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'Falta la tabla schema_migrations: aplica primero migrations/000_ledger.sql';
  end if;
  if not exists (select 1 from schema_migrations where version = '008_equipo') then
    raise exception 'Aplica primero migrations/008_equipo.sql (las migraciones van en orden)';
  end if;
end $$;

-- ══ stock_resumen — agregados de bodega, cuadre y alimento en UNA petición ═══
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (proyecto xewujmpycclqjhlmiica).
-- Aditivo y re-ejecutable: crea/reemplaza una función, no toca datos ni políticas.
--
-- Por qué: el módulo de bodega descargaba TODO el historial de registros 3 veces
-- (y ventas 2) por cada acción para sumar en el navegador. Ahora Postgres suma y
-- devuelve un JSON pequeño. SECURITY INVOKER: corre como el usuario que llama, así
-- las políticas RLS (tiene_acceso) aplican exactamente igual que antes.
--
-- Parámetros: p_owner = cuenta (ownerId); p_desde/p_hasta = periodo del cuadre
-- (null = todo); p_hoy = fecha local del cliente (ventana de consumo de 14 días).

create or replace function stock_resumen(
  p_owner uuid,
  p_desde date default null,
  p_hasta date default null,
  p_hoy   date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with r as (
  select fecha, kg_alimento,
         coalesce(chico,0) chico, coalesce(mediano,0) mediano, coalesce(grande,0) grande,
         coalesce(xl,0) xl, coalesce(super_xl,0) super_xl, coalesce(jumbo,0) jumbo,
         greatest(0, coalesce(n_huevos,0) - coalesce(sucios,0) - coalesce(rotos,0)
                     - coalesce(trizados,0) - coalesce(sangre,0)) as vendible
  from registros where user_id = p_owner
),
h as (
  select
    coalesce(sum(vendible),0)                                         as vendible_total,
    coalesce(sum(chico),0) as p_chico, coalesce(sum(mediano),0) as p_mediano,
    coalesce(sum(grande),0) as p_grande, coalesce(sum(xl),0) as p_xl,
    coalesce(sum(super_xl),0) as p_super_xl, coalesce(sum(jumbo),0) as p_jumbo,
    -- lo producido que no se clasificó por tamaño ese día
    coalesce(sum(greatest(0, vendible - (chico+mediano+grande+xl+super_xl+jumbo))),0) as p_mixto,
    coalesce(sum(case when p_desde is null or fecha between p_desde and p_hasta then vendible end),0) as vendible_periodo,
    coalesce(sum(kg_alimento),0)                                      as consumo_kg,
    coalesce(sum(case when fecha >= p_hoy - 13 then kg_alimento end),0) as cons14_kg,
    count(distinct case when fecha >= p_hoy - 13 then fecha end)     as cons14_dias
  from r
),
v as (
  select coalesce(nullif(tamano,''),'mixto') as t,
         sum(coalesce(huevos_total,0)) as s,
         sum(case when p_desde is null or fecha between p_desde and p_hasta then coalesce(huevos_total,0) else 0 end) as sp,
         sum(case when p_desde is null or fecha between p_desde and p_hasta then coalesce(total_clp,0)    else 0 end) as ip
  from ventas where user_id = p_owner group by 1
),
a as (
  select coalesce(nullif(tamano,''),'mixto') as t, sum(coalesce(huevos,0)) as s
  from ajustes_stock where user_id = p_owner group by 1
),
p as (
  select coalesce(nullif(tamano,''),'mixto') as t, sum(coalesce(huevos_total,0)) as s
  from pedidos where user_id = p_owner and estado = 'pendiente' group by 1
),
al as (
  select coalesce(sum(kg),0)                                            as entradas,
         coalesce(sum(case when precio_kg > 0 then kg end),0)           as kg_con_precio,
         coalesce(sum(case when precio_kg > 0 then kg * precio_kg end),0) as gasto
  from alimento_recepciones where user_id = p_owner
),
aa as (
  select coalesce(sum(kg),0) as ajuste from alimento_ajustes where user_id = p_owner
)
select jsonb_build_object(
  'huevos', jsonb_build_object(
    'vendible_total', h.vendible_total,
    'producido', jsonb_build_object(
      'chico', h.p_chico, 'mediano', h.p_mediano, 'grande', h.p_grande,
      'xl', h.p_xl, 'super_xl', h.p_super_xl, 'jumbo', h.p_jumbo, 'mixto', h.p_mixto),
    'vendido',      coalesce((select jsonb_object_agg(t, s) from v), '{}'::jsonb),
    'ajuste',       coalesce((select jsonb_object_agg(t, s) from a), '{}'::jsonb),
    'comprometido', coalesce((select jsonb_object_agg(t, s) from p), '{}'::jsonb)
  ),
  'periodo', jsonb_build_object(
    'vendible', h.vendible_periodo,
    'vendido',  coalesce((select sum(sp) from v), 0),
    'ingreso',  coalesce((select sum(ip) from v), 0)
  ),
  'alimento', jsonb_build_object(
    'entradas', al.entradas, 'consumo', h.consumo_kg, 'ajuste', aa.ajuste,
    'cons14_kg', h.cons14_kg, 'cons14_dias', h.cons14_dias,
    'kg_con_precio', al.kg_con_precio, 'gasto', al.gasto
  )
)
from h, al, aa;
$$;

grant execute on function stock_resumen(uuid, date, date, date) to authenticated;

-- ── registro: marca esta migración como aplicada ─────────────────────────
insert into schema_migrations (version) values ('009_stock_resumen') on conflict (version) do nothing;
