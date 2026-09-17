-- 000 — Registro de migraciones aplicadas (ledger).
-- Ejecutar UNA VEZ por proyecto, ANTES que cualquier otra migración.
-- Cada migración NNN_*.sql se registra sola aquí al terminar; y cada una
-- comprueba al empezar que la anterior esté registrada (orden obligatorio).
create table if not exists schema_migrations (
  version    text primary key,                 -- nombre del archivo sin .sql, p. ej. '006_tamanos_cajas'
  applied_at timestamptz not null default now()
);
-- Registro interno: la app nunca la toca. RLS activo sin políticas = ningún cliente
-- (anon/authenticated) puede leerla ni escribirla. Las migraciones se corren desde el
-- SQL Editor como rol postgres, al que RLS no restringe, así que siguen funcionando.
alter table schema_migrations enable row level security;
insert into schema_migrations (version) values ('000_ledger') on conflict (version) do nothing;
