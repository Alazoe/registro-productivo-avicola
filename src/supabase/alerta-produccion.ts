// Edge Function: alerta-produccion
// Desplegar en Supabase Dashboard → Edge Functions → New Function → nombre: alerta-produccion
// Secrets necesarios (Project Settings → Edge Functions → Secrets):
//   RESEND_API_KEY  → tu API key de resend.com (cuenta gratuita)
//   ALERTA_EMAIL    → destino de alertas (ej: alazoemv@gmail.com)
//   ALERTA_FROM     → remitente verificado (ej: alertas@avivet.cl)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { lote, fecha, alertas } = await req.json();

    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    const TO         = Deno.env.get('ALERTA_EMAIL') || 'alazoemv@gmail.com';
    const FROM       = Deno.env.get('ALERTA_FROM')  || 'onboarding@resend.dev';

    if (!RESEND_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'RESEND_API_KEY no configurada' }), { headers: CORS });
    }

    const fechaFmt = fecha.split('-').reverse().join('/');
    const items    = alertas.map((a: string) => `<li style="margin:6px 0">${a}</li>`).join('');

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
        <div style="background:#c62828;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0">
          <h2 style="margin:0;font-size:1.2rem">⚠️ Alerta productiva — ${lote}</h2>
          <p style="margin:4px 0 0;opacity:.85;font-size:.88rem">${fechaFmt}</p>
        </div>
        <div style="background:#fff;border:1px solid #eee;border-top:none;padding:20px 24px;border-radius:0 0 10px 10px">
          <p style="margin:0 0 12px;font-weight:600;color:#37474f">Se detectaron las siguientes alertas:</p>
          <ul style="margin:0;padding-left:20px;color:#37474f">${items}</ul>
          <p style="margin:20px 0 0;font-size:.78rem;color:#90a4ae">
            Registro Productivo Avícola · <a href="https://avivet.cl" style="color:#2e7d32">avivet.cl</a>
          </p>
        </div>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM,
        to:      TO,
        subject: `⚠️ Alerta ${lote} — ${fechaFmt}`,
        html,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, data }), { headers: CORS });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { headers: CORS });
  }
});
