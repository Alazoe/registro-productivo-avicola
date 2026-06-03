-- ══ MIGRACIÓN: Configuración por usuario ════════════════════════
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor.
-- Almacena preferencias por usuario (etiquetas no vendibles, etc.)

create table if not exists user_config (
  user_id    uuid primary key references auth.users on delete cascade,
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table user_config enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename='user_config' and policyname='user_config_user'
  ) then
    execute 'create policy "user_config_user" on user_config for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;
