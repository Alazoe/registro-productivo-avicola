-- ══ REGISTRO PRODUCTIVO AVÍCOLA — Supabase Schema ══════════════════════

create table lotes_produccion (
  id            uuid        default gen_random_uuid() primary key,
  nombre        text        not null,
  fecha_nac     date        not null,
  n_aves_inicio integer     default 0,
  linea_genetica text       default 'Hy-line Brown',
  activo        boolean     default true,
  user_id       uuid        references auth.users not null,
  created_at    timestamptz default now()
);

create table registros (
  id            uuid        default gen_random_uuid() primary key,
  lote_id       uuid        references lotes_produccion(id) on delete cascade not null,
  fecha         date        not null,
  semana_vida   integer,
  n_aves        integer,
  mortalidad    integer     default 0,
  kg_alimento   numeric(8,3),
  n_huevos      integer,
  chico         integer     default 0,
  mediano       integer     default 0,
  grande        integer     default 0,
  xl            integer     default 0,
  super_xl      integer     default 0,
  jumbo         integer     default 0,
  sucios        integer     default 0,
  rotos         integer     default 0,
  trizados      integer     default 0,
  sangre        integer     default 0,
  kg_por_ave    numeric(6,3),
  pct_postura   numeric(5,4),
  pct_esperado  numeric(5,4),
  diferencia    numeric(6,4),
  observaciones text,
  user_id       uuid        references auth.users not null,
  created_at    timestamptz default now(),
  unique(lote_id, fecha)
);

alter table lotes_produccion enable row level security;
alter table registros         enable row level security;

create policy "lotes_user"    on lotes_produccion for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "registros_user" on registros        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
