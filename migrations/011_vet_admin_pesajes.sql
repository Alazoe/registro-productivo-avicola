-- ══ 011_vet_admin_pesajes ══ (orden obligatorio: requiere 010_notas_dia) ══════════════
do $$ begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'Falta la tabla schema_migrations: aplica primero migrations/000_ledger.sql';
  end if;
  if not exists (select 1 from schema_migrations where version = '010_notas_dia') then
    raise exception 'Aplica primero migrations/010_notas_dia.sql (las migraciones van en orden)';
  end if;
end $$;

-- ══ LECTURA DE PESAJES PARA EL ASESOR ═══════════════════════════════════
-- El pesaje se integró a la app de producción y el dashboard muestra los pesajes de cada lote.
-- Misma regla que vet_admin_registros / vet_admin_lotes: solo lectura, solo la cuenta del asesor.
drop policy if exists "vet_admin_pesajes" on pesajes;
create policy "vet_admin_pesajes" on pesajes for select
  using (auth.email() = 'alazoemv@gmail.com');

insert into schema_migrations (version) values ('011_vet_admin_pesajes') on conflict (version) do nothing;
