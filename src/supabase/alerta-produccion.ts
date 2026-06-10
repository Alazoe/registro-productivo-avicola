// Edge Function: alerta-produccion
// Desplegar en Supabase Dashboard → Edge Functions → New Function → nombre: alerta-produccion
// Secrets necesarios (Project Settings → Edge Functions → Secrets):
//   RESEND_API_KEY  → tu API key de resend.com (cuenta gratuita)
//   ALERTA_EMAIL    → correo del asesor para recibir copia (ej: andres.lazomv@outlook.com)
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
    // `to`: email del productor (opcional). `copiaAsesor`: enviar copia al ALERTA_EMAIL.
    const { lote, fecha, alertas, to, copiaAsesor } = await req.json();

    const RESEND_KEY  = Deno.env.get('RESEND_API_KEY');
    const ASESOR_MAIL = Deno.env.get('ALERTA_EMAIL') || 'alazoemv@gmail.com';
    const FROM        = Deno.env.get('ALERTA_FROM')  || 'onboarding@resend.dev';

    if (!RESEND_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'RESEND_API_KEY no configurada' }), { headers: CORS });
    }

    // Destinatarios: productor (si viene) + asesor (si copiaAsesor o si no hay productor).
    const destinatarios = new Set<string>();
    if (to && typeof to === 'string' && to.includes('@')) destinatarios.add(to);
    if (copiaAsesor || destinatarios.size === 0) destinatarios.add(ASESOR_MAIL);

    const fechaFmt = fecha.split('-').reverse().join('/');
    const items    = alertas.map((a: string) => `<li style="margin:7px 0">${a}</li>`).join('');

    const html = `
      <div style="font-family:'DM Sans',system-ui,sans-serif;max-width:520px;margin:0 auto;background:#f5f1e8;padding:8px">
        <div style="background:#2a5430;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;border-top:4px solid #b8860b">
          <h2 style="margin:0;font-family:Georgia,serif;font-size:1.25rem;font-weight:600">⚠️ Alerta productiva</h2>
          <p style="margin:6px 0 0;opacity:.9;font-size:.9rem">${lote} · ${fechaFmt}</p>
        </div>
        <div style="background:#fefefe;border:1px solid #ddd8cc;border-top:none;padding:22px 24px;border-radius:0 0 12px 12px">
          <p style="margin:0 0 12px;font-weight:600;color:#1c2118">Se detectaron las siguientes alertas:</p>
          <ul style="margin:0;padding-left:20px;color:#1c2118;line-height:1.5">${items}</ul>
          <p style="margin:22px 0 0;font-size:.78rem;color:#6a7565;border-top:1px solid #ddd8cc;padding-top:14px">
            Registro Productivo Avícola · <a href="https://avivet.cl" style="color:#3d7a42;text-decoration:none">avivet.cl</a>
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
        to:      [...destinatarios],
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
