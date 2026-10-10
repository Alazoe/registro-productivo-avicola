-- ══ 010_notas_dia ══ (orden obligatorio: requiere 009_stock_resumen) ══════════════
do $$ begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'Falta la tabla schema_migrations: aplica primero migrations/000_ledger.sql';
  end if;
  if not exists (select 1 from schema_migrations where version = '009_stock_resumen') then
    raise exception 'Aplica primero migrations/009_stock_resumen.sql (las migraciones van en orden)';
  end if;
end $$;

-- ══ NOTA GENERAL DEL DÍA ════════════════════════════════════════════════
-- Una nota por cuenta y fecha, para todo el plantel (temporal, corte de luz, visita…).
-- La nota de cada lote sigue en registros.observaciones.
create table if not exists notas_dia (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references auth.users not null,
  fecha      date        not null,
  texto      text        not null default '',
  updated_at timestamptz default now(),
  unique (user_id, fecha)
);

alter table notas_dia enable row level security;
-- Dueño y equipo invitado (misma regla que el resto de las tablas)
drop policy if exists "notas_dia_acceso" on notas_dia;
create policy "notas_dia_acceso" on notas_dia for all
  using (tiene_acceso(user_id)) with check (tiene_acceso(user_id));
-- Lectura del asesor (dashboard), igual que vet_admin_registros / vet_admin_lotes
drop policy if exists "vet_admin_notas_dia" on notas_dia;
create policy "vet_admin_notas_dia" on notas_dia for select
  using (auth.email() = 'alazoemv@gmail.com');

insert into schema_migrations (version) values ('010_notas_dia') on conflict (version) do nothing;
