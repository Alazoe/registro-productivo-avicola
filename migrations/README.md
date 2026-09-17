# Migraciones de base de datos (Supabase)

Todas las migraciones viven aquí, **numeradas en el orden en que deben aplicarse**. Se corren copiando y pegando cada archivo en **Supabase → SQL Editor → Run**, una por una y en orden.

Cada migración:
- **Es idempotente**: se puede volver a correr sin romper nada (`if not exists`, `or replace`, políticas guardadas).
- **Empieza con una guarda**: si la anterior no está registrada, aborta con un mensaje claro. Así no se puede saltar ninguna (lo que pasó con `tamano`).
- **Termina registrándose sola** en la tabla `schema_migrations`. La base de datos es la fuente de verdad de qué se aplicó.

## Ledger

| N | Archivo | Qué hace | Producción |
|---|---------|----------|------------|
| 000 | `000_ledger.sql` | Crea la tabla `schema_migrations` (registro) | ⏳ pendiente — ver "Proyecto existente" |
| 001 | `001_ubicaciones.sql` | Tabla `ubicaciones` + `lotes.ubicacion_id` | ✅ 2026-05 |
| 002 | `002_user_config.sql` | Tabla `user_config` (preferencias JSONB) | ✅ 2026-06 |
| 003 | `003_productores.sql` | Tabla `productores` (nombre por cuenta, lectura pública) | ✅ 2026-06 |
| 004 | `004_ventas.sql` | Tabla `ventas` | ✅ 2026-07 |
| 005 | `005_pedidos_bodega.sql` | Tablas `pedidos` y `ajustes_stock` | ✅ 2026-07 |
| 006 | `006_tamanos_cajas.sql` | Columnas `tamano` y `cajas` en ventas/pedidos/ajustes | ✅ 2026-09 (se había saltado; aplicada al activar 009) |
| 007 | `007_alimento.sql` | Tablas `proveedores`, `alimento_recepciones`, `alimento_ajustes` | ✅ 2026-07 |
| 008 | `008_equipo.sql` | Cuenta compartida: tabla `equipo`, función `tiene_acceso`, RLS por cuenta | ✅ 2026-07 |
| 009 | `009_stock_resumen.sql` | Función `stock_resumen()` (agregados de bodega en 1 petición) | ✅ 2026-09 |

Para ver qué tiene aplicado un proyecto, en el SQL Editor:

```sql
select version, applied_at from schema_migrations order by version;
```

## Proyecto existente (producción): activar el ledger una vez

Producción ya tiene 001–009 aplicadas (se corrieron antes de existir el registro). Para dejar el ledger al día **sin volver a correr nada**, pegar esto una vez:

```sql
create table if not exists schema_migrations (
  version text primary key, applied_at timestamptz not null default now()
);
alter table schema_migrations enable row level security; -- la app nunca la toca; el SQL Editor (postgres) sí puede
insert into schema_migrations (version) values
  ('000_ledger'), ('001_ubicaciones'), ('002_user_config'), ('003_productores'),
  ('004_ventas'), ('005_pedidos_bodega'), ('006_tamanos_cajas'), ('007_alimento'),
  ('008_equipo'), ('009_stock_resumen')
on conflict (version) do nothing;
```

Desde ahí, cada migración nueva (010, 011…) se aplica normalmente y se registra sola.

## Instalación nueva (proyecto vacío)

1. `src/supabase/supabase-schema.sql` — esquema base. ⚠️ **Tiene `DROP TABLE`**: solo en un proyecto vacío, nunca en producción. Por eso no está numerado.
2. `000_ledger.sql`, luego `001` → `009` en orden.

## Cómo agregar una migración nueva

1. Crea `migrations/NNN_nombre.sql` con el **siguiente número** (sin huecos). Nombre en minúsculas y guiones bajos.
2. Copia la **guarda** de cualquier migración anterior al inicio, cambiando la versión requerida por la inmediatamente anterior.
3. Escribe el cambio de forma **idempotente** (`create table if not exists`, `alter table … add column if not exists`, `create or replace function`, políticas con `drop policy if exists` + `create policy`).
4. Termina con el **registro**: `insert into schema_migrations (version) values ('NNN_nombre') on conflict (version) do nothing;`
5. Agrega la fila a la tabla de arriba. El CI (`scripts/validar-apps.py`) comprueba numeración, guarda, auto-registro y que esté listada aquí.
6. Pega el archivo en Supabase → Run → marca ✅ con la fecha.
