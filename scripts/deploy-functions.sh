#!/usr/bin/env bash
# Despliega las Edge Functions DESDE EL REPO (opcional; la alternativa es pegar
# supabase/functions/<nombre>/index.ts en el Dashboard → Edge Functions).
# Requisitos (una vez):  instalar Supabase CLI  →  supabase login
#   https://supabase.com/docs/guides/cli
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT_REF="xewujmpycclqjhlmiica"
for fn in alerta-produccion aviso-invitacion; do
  echo "→ desplegando $fn"
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done
echo "✓ Listo. Los secrets (RESEND_API_KEY, ALERTA_EMAIL, ALERTA_FROM) se mantienen en el proyecto."
