# Registro Productivo Avícola

Sistema de registro diario de producción para gallinas ponedoras.  
**Autor:** Andrés Lazo Escobar, Médico Veterinario · [avivet.cl](http://avivet.cl)

---

## 📖 Manual de usuario (para productores)

Guía paso a paso en lenguaje simple para quienes usan la app:

- [`docs/MANUAL.md`](./docs/MANUAL.md) — versión de texto (se lee en GitHub)
- [`docs/manual.html`](./docs/manual.html) — versión con la marca AviVet, lista para imprimir o guardar como PDF. Publicada en http://avivet.cl/registro-productivo-avicola/docs/manual.html
- [`docs/guia-bodega-pedidos.html`](./docs/guia-bodega-pedidos.html) — guía rápida de los módulos Bodega, Pedidos y Ventas. Publicada en http://avivet.cl/registro-productivo-avicola/docs/guia-bodega-pedidos.html

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
├── supabase-schema.sql   ← Tablas y políticas RLS
└── equipo-schema.sql     ← Cuenta compartida: tabla equipo + función tiene_acceso + RLS por cuenta
src/ventas/
├── index.html                  ← App de ventas, pedidos y bodega (opcional por productor)
├── ventas-schema.sql           ← Tabla ventas + RLS
├── pedidos-bodega-schema.sql   ← Tablas pedidos y ajustes_stock + RLS
├── migration-tamanos-cajas.sql ← Agrega tamaño y cajas de 180 a ventas/pedidos/ajustes
└── alimento-schema.sql         ← Tablas proveedores, alimento_recepciones, alimento_ajustes + RLS
```

**URLs:**
- Producción: http://avivet.cl/registro-productivo-avicola/src/supabase/
- Ventas: http://avivet.cl/registro-productivo-avicola/src/ventas/

**Supabase project:** `xewujmpycclqjhlmiica.supabase.co` (mismo proyecto que pesaje-pollitas)

> **Producción es la base**; bodega/pedidos/ventas son módulos que nacen de ella. La app de producción enlaza a este módulo (nav → 📦 Bodega) y el módulo enlaza de vuelta a producción, con las mismas cuentas y proyecto Supabase. Es opcional: solo la usan los productores que venden. Tiene 3 pestañas, en orden de importancia (abre en Bodega):
> - **📦 Bodega** (principal) — inventario acumulado total: `stock físico = vendibles producidos − vendidos ± ajustes` y `stock libre = físico − pedidos pendientes`. Permite registrar mermas, autoconsumo, regalos, entradas y correcciones (tabla `ajustes_stock`). **Muestra el stock separado por tamaño** (Chico…Jumbo + «Sin especificar») en una tabla Físico/Reservado/Libre; los tamaños producidos salen de las columnas de `registros`. Todo se muestra también convertido a **cajas de 180** (= 6 bandejas).
> - **📋 Pedidos** — reservas de clientes con estado `pendiente`. Al marcar **entregado** se genera la venta automáticamente (el huevo se cuenta una sola vez); mientras está pendiente compromete stock libre.
> - **🌾 Alimento** — stock de alimento concentrado (insumo). `stock = Σ recepciones − consumo (registros.kg_alimento) ± ajustes`. Recepciones con proveedor (alta rápida), N° de lote, precio/kg y N° documento; ingreso en kilos o **sacos de 25 kg** (conversión automática). Muestra kg en bodega, **autonomía en días** (según consumo reciente), costo/kg promedio y alerta de stock bajo. Tablas `proveedores`, `alimento_recepciones`, `alimento_ajustes`.
> - **💰 Ventas** (secundario) — registra ventas por bandejas y cuadra por periodo (mes/anterior/todo) los **huevos vendibles** (`n_huevos − sucios − rotos − trizados − sangre`, tabla `registros`) contra lo vendido (tabla `ventas`).

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `productores` | Nombre legible del plantel por usuario; lectura pública (autenticados) para el dashboard |
| `ubicaciones` | Catálogo de espacios físicos por usuario (Carro 1, Pabellón 2, etc.) |
| `lotes` | Lotes por usuario (nombre, fecha nac, n° aves, línea genética, ubicación opcional) |
| `pesajes` | Pesaje semanal en crianza (semanas 1–19) |
| `registros` | Un registro por día por lote (producción + clasificación + KPIs) |
| `ventas` | Ventas de huevos por usuario (bandejas, huevos, precio, total) — cuadra contra `registros` |
| `pedidos` | Pedidos/reservas de clientes por usuario, con estado (pendiente/entregado/anulado); al entregar enlaza la `ventas.id` generada. Incluye `tamano` y `cajas` |
| `ajustes_stock` | Movimientos de bodega por usuario (merma, autoconsumo, regalo, entrada, ajuste); `huevos` es un delta con signo. Incluye `tamano` |
| `proveedores` | Proveedores de alimento por usuario (nombre, teléfono); alta rápida desde el módulo Alimento |
| `alimento_recepciones` | Compras/entradas de alimento por usuario (fecha, proveedor, lote, kg, sacos, precio/kg, N° documento) |
| `alimento_ajustes` | Mermas/correcciones del stock de alimento por usuario; `kg` es un delta con signo |
| `user_config` | Preferencias por usuario en JSONB (no vendibles, alertas, correcciones de nombres del asesor) |
| `equipo` | Acceso compartido: `dueno_id` → `email_invitado` activo/inactivo. Un correo invitado ve y edita la cuenta del dueño (Etapa 1: rol editor) |

**Cuenta compartida (equipo):** la función `tiene_acceso(owner)` centraliza la regla de acceso: un dato con `user_id = X` es visible/editable si `auth.uid() = X` **o** tu correo está invitado y activo en la cuenta `X`. Todas las tablas de datos usan `tiene_acceso(user_id)` en sus políticas RLS. Es retrocompatible: sin invitaciones, equivale a `user_id = auth.uid()`. Las apps calculan al entrar el `ownerId` (mi cuenta, o la de quien me invitó) y trabajan sobre ella. El dueño gestiona los correos en Producción → Lotes → 👥 Equipo.

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
| 2026-07 | Aviso de invitación: al dar acceso a un correo en 👥 Equipo, una Edge Function (`aviso-invitacion`, Resend) avisa al administrador para que cree la cuenta del invitado |
| 2026-07 | Unidad **docena (12)** agregada en Ventas, Pedidos y ajuste de Bodega (junto a cajas 180, bandejas 30 y sueltos). Los huevos se pueden colocar en cajas, docenas o bandejas. Sin cambios de BD (el total se guarda en huevos, empaque canónico) |
| 2026-07 | Bodega: el **ajuste de stock** se ingresa en **cajas (180) / bandejas (30) / huevos** (antes solo huevos), con su tamaño — para agregar cajas extra, cargar stock inicial o corregir. Muestra el total y el equivalente en cajas |
| 2026-07 | **Cuenta compartida (equipo) — Etapa 1**: el dueño invita correos (Producción → Lotes → 👥 Equipo) que ven y editan la misma información. RLS centralizada en `tiene_acceso(user_id)`; las apps resuelven el `ownerId` al entrar. Retrocompatible. `equipo-schema.sql` |
| 2026-07 | Módulo **🌾 Alimento** en Bodega: stock de alimento = recepciones − consumo diario (registros.kg_alimento) ± ajustes; recepción con proveedor (alta rápida), lote, precio/kg y sacos de 25 kg; autonomía en días, costo/kg y alerta de stock bajo. Tablas `proveedores`, `alimento_recepciones`, `alimento_ajustes` (`alimento-schema.sql`) |
| 2026-07 | Stock por tamaño y cajas de 180: Bodega muestra Físico/Reservado/Libre por tamaño (Chico…Jumbo + Sin especificar); ventas, pedidos y ajustes registran tamaño; se puede ingresar y ver todo en cajas de 180 (= 6 bandejas). Migración `migration-tamanos-cajas.sql` (columnas `tamano`, `cajas`) |
| 2026-07 | Dashboard: indicadores del lote agregan Consumo de alimento (g/ave/día + kg/día) y Costo alim/huevo, calculado con el precio del kg de alimento por productor (guardado por productor en el navegador) |
| 2026-07 | Dashboard: panel "Comparar por semana de vida" — compara postura de lotes marcables (con "Todos"), agrupados por estación de nacimiento (verano/otoño/invierno/primavera, hemisferio sur) o por avícola, normalizando al eje de semana de vida |
| 2026-07 | Navegación entre módulos: la app de Producción enlaza directo a Bodega/Pedidos/Ventas (`../ventas/#tab`) y el módulo abre en la pestaña del enlace (recuerda el módulo en la URL) |
| 2026-07 | App de ventas: pestañas **Pedidos** (reservas de clientes que al entregarse generan la venta) y **Bodega** (inventario acumulado con mermas/autoconsumo/ajustes y stock libre). El cuadre pasa a usar huevos **vendibles** en vez del total clasificado. Tablas `pedidos` y `ajustes_stock` |
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
