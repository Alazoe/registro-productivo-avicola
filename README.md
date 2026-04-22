# Registro Productivo Avícola

Sistema de registro diario de producción para gallinas ponedoras, desarrollado en Google Apps Script con interfaz web optimizada para móvil.

**Autor:** Andrés Lazo Escobar, Médico Veterinario · [avivet.cl](http://avivet.cl)

---

## Dashboard central

Visualiza todas las granjas en tiempo real:

**[avivet.cl/registro-productivo-avicola/dashboard.html](http://avivet.cl/registro-productivo-avicola/dashboard.html)**

Muestra por granja: % postura vs curva esperada, mortalidad, clasificación de huevos, días sin registro y curva de los últimos 28 días.

---

## Granjas activas

| Granja | Carpeta | getDashboard | PDF semanal |
|--------|---------|:---:|:---:|
| Avícola GH | `src/avicolas/avicola-gh/` | ✓ | ✓ |
| Avícola Clarita | `src/avicolas/avicola-clarita/` | ✓ | ✓ |
| Roberto Santelices | `src/avicolas/roberto-santelices/` | ✓ | ✓ |
| Vicente Abogabir | `src/avicolas/Vicente-Abogabir/` | ✓ | ✓ |
| Praderas de Ranco | `src/avicolas/praderas-de-ranco/` | — | ✓ |
| Copihue Real | `src/avicolas/Copihue real/` | — | ✓ |

Para agregar una granja al dashboard central, añadir su entrada al array `GRANJAS` en `dashboard.html`:

```js
{ id: "nombre-id", nombre: "Nombre Granja",
  webAppUrl: "https://script.google.com/macros/s/TU_URL/exec",
  color: "#58a6ff", unidad: "Lote", tieneClasificacion: true }
```

---

## Estructura del repositorio

```
registro-productivo-avicola/
├── dashboard.html               ← Monitor central (todas las granjas)
├── src/
│   ├── Code.gs                  ← Código base compartido
│   ├── index.html               ← Interfaz base compartida
│   └── avicolas/
│       ├── avicola-gh/
│       │   ├── code.gs          ← Backend GAS (doGet, getDashboard, guardarDatos…)
│       │   └── index.html       ← App móvil + gráficos + exportar PDF
│       ├── avicola-clarita/
│       │   ├── code.gs
│       │   └── index.html
│       └── …                    ← Una carpeta por granja
├── assets/img/                  ← Logos
└── docs/
    └── como-publicar.md         ← Guía de deploy
```

---

## Cómo desplegar cambios a una granja

1. Abre el Google Sheet de la granja → **Extensiones → Apps Script**
2. Pega el contenido actualizado de `code.gs` en el editor (archivo `Código.gs`)
3. Pega el contenido actualizado de `index.html` en el archivo `index.html` del editor
4. Guarda (Cmd+S)
5. **Implementar → Gestionar implementaciones → editar → Nueva versión → Implementar**

> Sin el nuevo deploy, los usuarios siguen viendo la versión anterior.

---

## Funcionalidades principales

### App por granja (index.html)
- Registro diario: aves, mortalidad, huevos, kg alimento
- Clasificación por tamaño (Chico → Jumbo) y calidad (sucios, rotos, trizados, sangre)
- Validación de postura máxima (105%)
- Detección de días faltantes
- Modo edición para corregir registros anteriores
- Gráficos: curva de postura vs esperado, acumulados, distribución por tamaño
- **Exportar PDF semanal**: reporte con KPIs, gráfico y tabla por semana de vida

### Dashboard central (dashboard.html)
- Carga en paralelo el endpoint `?action=getDashboard` de cada granja
- Sidebar con lista de granjas y alertas de días pendientes
- KPIs: % postura, diferencia vs curva, mortalidad, conversión g alimento/huevo
- Gráfico SVG de postura últimos 28 días
- Clasificación del último día con distribución por tamaño

### Backend GAS (code.gs) — funciones principales
| Función | Descripción |
|---------|-------------|
| `doGet(e)` | Sirve la app o enruta `?action=getDashboard` |
| `getDashboard()` | Retorna JSON con KPIs de todos los lotes activos |
| `guardarDatos(datos)` | Guarda o sobreescribe un registro diario |
| `obtenerDatosFecha(hoja, ts)` | Consulta si existe registro para una fecha |
| `obtenerDatosGraficos(hoja)` | Retorna todos los registros para gráficos y PDF |
| `obtenerLotesActivos()` | Lee hoja CONFIGURACIÓN y retorna lotes activos |
| `detectarDiasFaltantes(hoja)` | Detecta huecos en la secuencia de fechas |
| `ordenarPorFecha(hoja)` | Ordena registros cronológicamente |
| `sincronizarConFirebase(datos)` | Sync con Firestore (inventario huevos) |

---

## Registro de cambios

| Fecha | Cambio |
|-------|--------|
| 2026-04 | Exportar PDF semanal con gráfico y tabla por semana de vida |
| 2026-04 | getDashboard añadido a avicola-clarita para dashboard central |
| 2025-04 | Dashboard central con múltiples granjas |
| 2025-04 | KPIs en gráficos, campo observaciones |
| 2025-04 | Línea genética Hy-line Brown Jaula |
| 2025-03 | Versión inicial |
