# Registro Productivo Avícola

Sistema de registro diario de producción para gallinas ponedoras.  
**Autor:** Andrés Lazo Escobar, Médico Veterinario · [avivet.cl](http://avivet.cl)

---

## 📖 Manual de usuario (para productores)

Guía paso a paso en lenguaje simple para quienes usan la app:

- [`docs/MANUAL.md`](./docs/MANUAL.md) — versión de texto (se lee en GitHub)
- [`docs/manual.html`](./docs/manual.html) — versión con la marca AviVet, lista para imprimir o guardar como PDF. Publicada en http://avivet.cl/registro-productivo-avicola/docs/manual.html

---

## Documentación para Claude Code

Este repositorio incluye un [`CLAUDE.md`](./CLAUDE.md) en la raíz con el stack, la arquitectura y comportamientos no obvios del proyecto. Claude Code lo carga automáticamente al trabajar en el repo, reduciendo el contexto necesario en cada sesión.

---

## Estado actual de la migración

El sistema está en transición de Google Apps Script (GAS) + Google Sheets a una arquitectura centralizada en **Supabase**.

| Etapa | Estado |
|-------|--------|
| Nueva app Supabase (`src/supabase/`) | ✅ Lista |
| Schema + RLS en Supabase | ✅ Activo desde 2026-04-29 |
| Migración historial Avícola GH | ⏳ Pendiente |
| Migración historial Avícola Clarita | ⏳ Pendiente |
| Migración historial Praderas de Ranco | ⏳ Pendiente |
| Migración historial Reinhard | ⏳ Pendiente |
| Productores usando nueva app | ⏳ En proceso |

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
├── index.html            ← App de producción (todos los productores)
└── supabase-schema.sql   ← Tablas y políticas RLS
src/ventas/
├── index.html            ← App de ventas (opcional por productor)
└── ventas-schema.sql     ← Tabla ventas + RLS
```

**URLs:**
- Producción: http://avivet.cl/registro-productivo-avicola/src/supabase/
- Ventas: http://avivet.cl/registro-productivo-avicola/src/ventas/

**Supabase project:** `xewujmpycclqjhlmiica.supabase.co` (mismo proyecto que pesaje-pollitas)

> La app de **ventas** usa el mismo proyecto Supabase y las mismas cuentas que producción. Por eso cuadra los huevos vendidos (tabla `ventas`) contra los producidos (tabla `registros`) en tiempo real, por periodo (mes/anterior/todo). Es opcional: solo la usan los productores que venden.

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `productores` | Nombre legible del plantel por usuario; lectura pública (autenticados) para el dashboard |
| `ubicaciones` | Catálogo de espacios físicos por usuario (Carro 1, Pabellón 2, etc.) |
| `lotes` | Lotes por usuario (nombre, fecha nac, n° aves, línea genética, ubicación opcional) |
| `pesajes` | Pesaje semanal en crianza (semanas 1–19) |
| `registros` | Un registro por día por lote (producción + clasificación + KPIs) |
| `ventas` | Ventas de huevos por usuario (bandejas, huevos, precio, total) — cuadra contra `registros` |
| `user_config` | Preferencias por usuario en JSONB (no vendibles, alertas, correcciones de nombres del asesor) |

Todas las tablas tienen Row Level Security activado: cada usuario ve y modifica solo sus propios datos. **Excepción:** `productores` permite a cualquier usuario autenticado *leer* los nombres (solo el nombre, sin datos productivos), para que el dashboard del asesor identifique a cada productor.

### Funcionalidades de la nueva app

- **Registro diario** — aves, mortalidad, kg alimento, huevos, clasificación por tamaño (Chico → Jumbo) y calidad (sucios, rotos, trizados, sangre)
- **Modo edición** — detecta fechas con registro existente y permite sobreescribir con confirmación
- **Detección de huecos** — avisa qué días faltan en la secuencia del lote
- **Gráficos** — curva de postura vs esperado, acumulado, distribución por tamaño, tabla semanal por semana de vida
- **Importar CSV** — herramienta integrada para migrar historial desde Google Sheets (tab Lotes → Importar)
- **KPIs calculados client-side** — semana de vida, kg/ave, % postura, % esperado por línea genética, diferencia vs curva
- **Alertas por email** — notificación automática vía Resend cuando mortalidad o caída de postura superan el umbral. **Configurables por productor** (tab Lotes → 🔔 Alertas): destino del correo, umbrales propios, activar/desactivar y copia opcional al asesor
- **Ubicaciones físicas** — catálogo de espacios por productor (carros, pabellones, galpones); asignación opcional por lote, cambiable en cualquier momento sin afectar registros
- **Personalización de no vendibles** — cada productor renombra sus 4 categorías de huevos no vendibles (tab Lotes → ⚙️ Personalización)

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
| 2026-06 | Dashboard: agrupación del resumen por 1/4 semanas o mes cerrado, y gráficos de postura bajo demanda (curva por lote y curva combinada de los lotes de un productor) |
| 2026-06 | Dashboard: resumen semanal con tarjetas generales, filtro por productor y KPIs por lote (postura vs estándar, mortalidad semanal y anterior, consumo g/ave, huevos) |
| 2026-06 | KPI de consumo de alimento (g/ave/día, hoy y promedio 7 días) en la pestaña Gráficos |
| 2026-06 | App de ventas (`src/ventas/`): registra ventas en bandejas y cuadra huevos vendidos vs producidos por periodo, mismo Supabase y cuenta |
| 2026-06 | Recuperación de contraseña (¿Olvidaste tu contraseña?) en app y dashboard |
| 2026-06 | Nombres de productor en el dashboard (tabla `productores`): el productor se nombra en su app y el asesor corrige desde el monitor, sin más UUIDs |
| 2026-06 | Alertas por email configurables por productor (destino, umbrales, copia al asesor) |
| 2026-06 | Rediseño visual alineado a marca avivet.cl (Fraunces + DM Sans, paleta crema/verde/dorado) |
| 2026-06 | Selector de lote en tab Gráficos + no vendibles configurables por productor |
| 2026-05 | Ubicaciones físicas por lote (carro, pabellón, galpón) |
| 2026-05 | Curva Dominat agregada + curvas extendidas a semana 150 |
| 2026-05 | CLAUDE.md + URL GitHub Pages configurada |
| 2026-04-29 | Alerta por email activa y verificada (Resend + Supabase Edge Function → andres.lazomv@outlook.com) |
| 2026-04 | Nueva app Supabase + herramienta de importación CSV |
| 2026-04 | Inicio migración GAS → Supabase |
| 2026-04 | Exportar PDF semanal con gráfico y tabla |
| 2026-04 | Dashboard central multi-granja |
| 2025-03 | Versión inicial GAS |
