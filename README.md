# Registro Productivo Avícola

Sistema de registro diario de producción para gallinas ponedoras.  
**Autor:** Andrés Lazo Escobar, Médico Veterinario · [avivet.cl](http://avivet.cl)

---

## Estado actual de la migración

El sistema está en transición de Google Apps Script (GAS) + Google Sheets a una arquitectura centralizada en **Supabase**.

| Etapa | Estado |
|-------|--------|
| Nueva app Supabase (`src/supabase/`) | ✅ Lista |
| Schema + RLS en Supabase | ⏳ Pendiente deploy |
| Migración historial Avícola GH | ⏳ Pendiente |
| Migración historial Avícola Clarita | ⏳ Pendiente |
| Migración historial Praderas de Ranco | ⏳ Pendiente |
| Migración historial Reinhard | ⏳ Pendiente |
| Productores usando nueva app | ⏳ Pendiente |

---

## Por qué migramos

| Problema actual (GAS) | Solución nueva (Supabase) |
|-----------------------|--------------------------|
| Un Sheet y una URL por productor → deploy manual de 15–20 min | Una URL para todos, crear productor = 2 min en Supabase Auth |
| Sin autenticación real (URL pública con `?productor=X`) | Login email/contraseña con Row Level Security |
| Cada productor ve solo su propio Sheet pero no hay restricción técnica | RLS garantiza aislamiento a nivel de base de datos |
| Escalar requiere copiar y configurar archivos | Nuevo productor = crear usuario, no tocar código |
| Datos históricos atrapados en Sheets individuales | Todo en PostgreSQL, consultable centralmente |

---

## Nueva arquitectura (`src/supabase/`)

```
src/supabase/
├── index.html            ← App única para todos los productores
└── supabase-schema.sql   ← Tablas y políticas RLS
```

**URL:** pendiente de configurar en GitHub Pages  
**Supabase project:** `xewujmpycclqjhlmiica.supabase.co` (mismo proyecto que pesaje-pollitas)

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `lotes_produccion` | Lotes por usuario (nombre, fecha nac, n° aves, línea genética) |
| `registros` | Un registro por día por lote (producción + clasificación + KPIs) |

Ambas tablas tienen Row Level Security activado: cada usuario ve y modifica solo sus propios datos.

### Funcionalidades de la nueva app

- **Registro diario** — aves, mortalidad, kg alimento, huevos, clasificación por tamaño (Chico → Jumbo) y calidad (sucios, rotos, trizados, sangre)
- **Modo edición** — detecta fechas con registro existente y permite sobreescribir con confirmación
- **Detección de huecos** — avisa qué días faltan en la secuencia del lote
- **Gráficos** — curva de postura vs esperado, acumulado, distribución por tamaño, tabla semanal por semana de vida
- **Importar CSV** — herramienta integrada para migrar historial desde Google Sheets (tab Lotes → Importar)
- **KPIs calculados client-side** — semana de vida, kg/ave, % postura, % esperado por línea genética, diferencia vs curva

### Cómo activar Supabase (una sola vez)

1. **SQL Editor de Supabase** → pegar y ejecutar `supabase-schema.sql`
2. **Authentication → Users → Add user** → email + contraseña por productor
3. El productor entra a la URL de la app, crea sus lotes e importa su historial

### Cómo migrar el historial de un productor

1. Abrir su Google Sheet → ir a la pestaña del lote
2. Archivo → Descargar → Valores separados por coma (.csv)
3. En la nueva app: tab **Lotes** → seleccionar lote destino → subir CSV
4. Repetir por cada pestaña de lote

---

## Arquitectura anterior (GAS) — referencia

Las carpetas `src/avicolas/` se mantienen como archivo histórico. Cada una tiene:

```
src/avicolas/<nombre>/
├── code.gs      ← Backend GAS (doGet, guardarDatos, getDashboard…)
├── index.html   ← App móvil con gráficos y exportar PDF
└── NOTAS.md     ← URL del Sheet, URL web app, contacto del productor
```

### Productores en GAS (activos al momento de la migración)

| Productor | Carpeta | Línea genética |
|-----------|---------|----------------|
| Avícola GH | `src/avicolas/avicola-gh/` | ver Sheet |
| Avícola Clarita | `src/avicolas/avicola-clarita/` | ver Sheet |
| Praderas de Ranco | `src/avicolas/praderas-de-ranco/` | ver Sheet |
| Reinhard | `src/avicolas/reinhard/` | ver Sheet |
| Roberto Santelices | `src/avicolas/roberto-santelices/` | ver Sheet |
| Vicente Abogabir | `src/avicolas/Vicente-Abogabir/` | ver Sheet |
| Copihue Real | `src/avicolas/Copihue real/` | ver Sheet |

### Cómo actualizar un productor en GAS (mientras no se migra)

1. Google Sheet → Extensiones → Apps Script
2. Actualizar `Código.gs` y/o `index.html`
3. Implementar → Gestionar implementaciones → editar → Nueva versión → Implementar

---

## Dashboard central (GAS)

`dashboard.html` en la raíz del repo consulta el endpoint `?action=getDashboard` de cada granja GAS y muestra KPIs en tiempo real. Este dashboard quedará obsoleto una vez que todos los productores estén en Supabase — se reemplazará por una vista centralizada que lea directo de PostgreSQL.

---

## Registro de cambios

| Fecha | Cambio |
|-------|--------|
| 2026-04 | Nueva app Supabase + herramienta de importación CSV |
| 2026-04 | Inicio migración GAS → Supabase |
| 2026-04 | Exportar PDF semanal con gráfico y tabla |
| 2026-04 | Dashboard central multi-granja |
| 2025-03 | Versión inicial GAS |
