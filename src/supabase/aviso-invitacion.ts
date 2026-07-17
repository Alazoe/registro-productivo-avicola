// Edge Function: aviso-invitacion
// Avisa por correo al administrador (AviVet) cuando un productor da acceso a
// otro correo desde 👥 Equipo, para que cree esa cuenta en Supabase Auth.
//
// Desplegar en Supabase Dashboard → Edge Functions → New Function → nombre: aviso-invitacion
// Reutiliza los mismos secrets que la función de alertas:
//   RESEND_API_KEY  → API key de resend.com
//   ALERTA_EMAIL    → correo del administrador que recibe el aviso (ej: andres.lazomv@outlook.com)
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
    // email_invitado: correo al que se le dio acceso
    // dueno_email / dueno_nombre: quién lo invitó (dueño de la cuenta)
    const { email_invitado, dueno_email, dueno_nombre } = await req.json();

    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    const ADMIN_MAIL = Deno.env.get('ALERTA_EMAIL') || 'andres.lazomv@outlook.com';
    const FROM       = Deno.env.get('ALERTA_FROM')  || 'onboarding@resend.dev';

    if (!RESEND_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'RESEND_API_KEY no configurada' }), { headers: CORS });
    }
    if (!email_invitado || !String(email_invitado).includes('@')) {
      return new Response(JSON.stringify({ ok: false, error: 'email_invitado inválido' }), { headers: CORS });
    }

    const quien = dueno_nombre ? `${dueno_nombre} (${dueno_email || 's/correo'})` : (dueno_email || 'un productor');

    const html = `
      <div style="font-family:'DM Sans',system-ui,sans-serif;max-width:520px;margin:0 auto;background:#f5f1e8;padding:8px">
        <div style="background:#1e5a7a;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;border-top:4px solid #b8860b">
          <h2 style="margin:0;font-family:Georgia,serif;font-size:1.25rem;font-weight:600">👥 Nueva solicitud de acceso</h2>
          <p style="margin:6px 0 0;opacity:.9;font-size:.9rem">AviVet · Registro Productivo</p>
        </div>
        <div style="background:#fefefe;border:1px solid #ddd8cc;border-top:none;padding:22px 24px;border-radius:0 0 12px 12px;color:#1c2118">
          <p style="margin:0 0 14px"><b>${quien}</b> dio acceso a este correo en su cuenta:</p>
          <p style="margin:0 0 14px;font-size:1.1rem;font-weight:700;color:#1e5a7a">${email_invitado}</p>
          <p style="margin:0 0 6px;font-weight:600">Para que pueda entrar, crea su cuenta:</p>
          <ol style="margin:0;padding-left:20px;line-height:1.6">
            <li>Supabase → Authentication → Users → <b>Add user</b></li>
            <li>Correo: <b>${email_invitado}</b> + una contraseña, con <b>Auto Confirm User</b> activado</li>
            <li>Avísale su clave. Al entrar verá la cuenta de ${dueno_nombre || 'quien lo invitó'}.</li>
          </ol>
          <p style="margin:22px 0 0;font-size:.78rem;color:#6a7565;border-top:1px solid #ddd8cc;padding-top:14px">
            Registro Productivo Avícola · <a href="https://avivet.cl" style="color:#3d7a42;text-decoration:none">avivet.cl</a>
          </p>
        </div>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    FROM,
        to:      [ADMIN_MAIL],
        subject: `👥 Crear cuenta para ${email_invitado} — AviVet`,
        html,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, data }), { headers: CORS });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { headers: CORS });
  }
});
