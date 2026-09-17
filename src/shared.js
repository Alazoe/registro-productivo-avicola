// ══ shared.js — código común a las apps (producción y módulo de bodega/ventas) ══
// Se carga con <script src="../shared.js"> DESPUÉS de supabase-js y ANTES del
// script propio de cada app. Cada app define su propia mostrarApp().
//
// Contiene: cliente Supabase, sesión (login / logout / recuperación de clave),
// cuenta compartida (resolverOwner + banner) y helpers de fecha / toast.
// Regla: fechas de negocio SIEMPRE en hora local (toLocaleDateString('en-CA')).
// NUNCA toISOString().slice(0,10): es UTC y en Chile desde ~21:00 da el día siguiente.

const SUPABASE_URL = 'https://xewujmpycclqjhlmiica.supabase.co';
const SUPABASE_KEY = 'sb_publishable_v5_FU1w-7P7oeNrW6FYRBQ_cuX-pa9_'; // anon key: pública por diseño (RLS)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser  = null;  // usuario autenticado
let ownerId      = null;  // dueño de la cuenta sobre la que trabajo (yo, o quien me invitó)
let modoRecovery = false; // true mientras se cambia la contraseña desde el enlace de recuperación

// ── Arranque de sesión ─────────────────────────────────────────────────────
window.onload = async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) { currentUser = session.user; mostrarApp(); }
  sb.auth.onAuthStateChange((evento, s) => {
    if (evento === 'PASSWORD_RECOVERY') { modoRecovery = true; mostrarRecovery(); return; }
    if (modoRecovery) return; // no saltar a la app mientras se cambia la clave
    currentUser = s?.user || null;
    if (currentUser) mostrarApp(); else mostrarLogin();
  });
};

function pl() { return document.getElementById('pantalla-login'); }
function pr() { return document.getElementById('pantalla-recovery'); }
function mostrarLogin()    { pl().style.display = 'flex'; pr().style.display = 'none'; document.getElementById('app').style.display = 'none'; }
function mostrarRecovery() { pl().style.display = 'none'; pr().style.display = 'flex'; document.getElementById('app').style.display = 'none'; }

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('btn-login');
  if (!email || !pass) { errEl.textContent = 'Completa correo y contraseña'; errEl.style.display = 'block'; return; }
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Entrando…';
  errEl.style.display = 'none';
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { errEl.textContent = 'Correo o contraseña incorrectos'; errEl.style.display = 'block'; btn.disabled = false; btn.textContent = 'Entrar'; }
}

async function logout() {
  if (!confirm('¿Cerrar sesión?')) return;
  await sb.auth.signOut();
}

async function recuperarPassword() {
  const email = document.getElementById('login-email').value.trim();
  const errEl = document.getElementById('login-error');
  const okEl  = document.getElementById('login-msg');
  errEl.style.display = 'none'; okEl.style.display = 'none';
  if (!email) { errEl.textContent = 'Escribe tu correo arriba y vuelve a tocar el enlace'; errEl.style.display = 'block'; return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) { errEl.textContent = 'No se pudo enviar el correo: ' + error.message; errEl.style.display = 'block'; }
  else { okEl.textContent = '📧 Te enviamos un correo para crear una nueva contraseña. Revisa tu bandeja (y spam).'; okEl.style.display = 'block'; }
}

async function actualizarPassword() {
  const pass  = document.getElementById('rec-pass').value;
  const errEl = document.getElementById('rec-error');
  const btn   = document.getElementById('btn-rec');
  errEl.style.display = 'none';
  if (!pass || pass.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres'; errEl.style.display = 'block'; return; }
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Guardando…';
  const { error } = await sb.auth.updateUser({ password: pass });
  if (error) { errEl.textContent = 'Error: ' + error.message; errEl.style.display = 'block'; btn.disabled = false; btn.textContent = 'Guardar contraseña'; return; }
  modoRecovery = false;
  alert('✅ Contraseña actualizada. Ya puedes usar la app.');
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  if (currentUser) mostrarApp(); else mostrarLogin();
}

// ── Cuenta compartida (equipo) ─────────────────────────────────────────────
// Determina la cuenta a usar: la mía, salvo que esté invitado a otra (activa)
async function resolverOwner() {
  ownerId = currentUser.id;
  try {
    const { data } = await sb.from('equipo').select('dueno_id').eq('activo', true).ilike('email_invitado', currentUser.email);
    const ajena = (data || []).find(r => r.dueno_id !== currentUser.id);
    if (ajena) ownerId = ajena.dueno_id;
  } catch (e) { /* si la tabla no existe aún, trabajo sobre mi propia cuenta */ }
}
// Aviso cuando trabajo en la cuenta de otro (invitado)
async function mostrarBannerCuenta() {
  const el = document.getElementById('banner-cuenta'); if (!el) return;
  if (ownerId === currentUser.id) { el.style.display = 'none'; return; }
  let nombre = '';
  try { const { data } = await sb.from('productores').select('nombre').eq('user_id', ownerId).maybeSingle(); nombre = data?.nombre || ''; } catch (e) {}
  el.innerHTML = `👥 Estás trabajando en la cuenta de <b>${nombre || 'otro productor'}</b> (acceso de invitado)`;
  el.style.display = 'block';
}

// ── Helpers ────────────────────────────────────────────────────────────────
function hoy()        { return new Date().toLocaleDateString('en-CA'); } // YYYY-MM-DD en hora LOCAL
function fmtFecha(f)  { return f.split('-').reverse().join('/'); }       // YYYY-MM-DD → DD/MM/YYYY
function toast(msg, tipo = '', dur = 2600) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg;
  el.className = 'show ' + (['ok', 'err', 'warn'].includes(tipo) ? tipo : '');
  setTimeout(() => { el.className = ''; }, dur);
}
