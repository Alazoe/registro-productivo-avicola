# Registro Productivo Avícola

## Stack
- **Frontend:** vanilla JS + HTML en un único archivo por app — sin frameworks, sin bundler, sin npm
- **Backend:** Supabase — PostgreSQL + Row Level Security + Edge Functions (Deno/TypeScript)
- **Email:** Resend API vía Edge Function `alerta-produccion`
- **Deploy:** GitHub Pages desde rama `main` → `avivet.cl/registro-productivo-avicola/`

## Estructura
```
src/supabase/          ← app nueva: una URL, todos los productores, auth real
src/avicolas/<nombre>/ ← apps GAS heredadas: una URL por productor (en mantención)
dashboard.html         ← dashboard multi-granja GAS (obsoleto al terminar migración)
```

## Reglas IMPORTANTES
- NUNCA agregar frameworks, librerías npm ni bundlers. La app es vanilla JS por decisión de diseño.
- Los KPIs se calculan siempre client-side en `index.html`. No hay API intermediaria.
- Las Edge Functions se escriben en TypeScript Deno y se despliegan desde Supabase Dashboard, no desde el repo.
- NUNCA incluir la `SUPABASE_KEY` (anon key) como secreto — es pública por diseño de Supabase RLS.

## No obvio
- `verificarAlertas()` es fire-and-forget: se llama sin `await` en `guardarRegistro`. Si falla, queda en `console.warn` sin interrumpir el flujo.
- RLS en Supabase garantiza aislamiento: cada usuario ve y modifica solo sus propios `lotes_produccion` y `registros`.
- El remitente de email (`ALERTA_FROM`) debe ser un dominio verificado en Resend. `onboarding@resend.dev` solo funciona en modo test de Resend.
- GitHub Pages sirve la raíz del repo públicamente — no incluir archivos con credenciales reales.

## Secrets en Supabase (Edge Functions → Secrets)
- `RESEND_API_KEY` — clave API de resend.com
- `ALERTA_EMAIL` — destino de alertas (`alazoemv@gmail.com`)
- `ALERTA_FROM` — remitente verificado en Resend (`alertas@avivet.cl`)

## Líneas genéticas disponibles
Hy-line Brown, Lohmann Brown, Bovans Brown, ISA Brown — curvas de postura hardcodeadas en `index.html`.
