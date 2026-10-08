// ─── CONFIG ──────────────────────────────────────────────────
const SUPABASE_URL = 'https://aaaxtibbolugbqvlqumn.supabase.co';
const SUPABASE_KEY = 'sb_publishable__hiCAH5WhMnrYWuqVR7-bA_g8e09RoI';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── STATE ───────────────────────────────────────────────────
let currentUser  = null;
let currentPage  = 'dashboard';
let charts       = {};
let authMode     = 'login';
let modalContext = { type: null, id: null };
let merTab       = 'Supermercado';

// ─── CATEGORY CONFIG ─────────────────────────────────────────
const CATS = {
  'Arriendo':        { icon: '🏠', color: 'var(--blue)'   },
  'Alimentación':    { icon: '🍽️', color: 'var(--green)'  },
  'Transporte':      { icon: '🚗', color: 'var(--yellow)' },
  'Salud':           { icon: '🏥', color: 'var(--red)'    },
  'Entretenimiento': { icon: '🎮', color: 'var(--purple)' },
  'Ropa':            { icon: '👗', color: 'var(--pink)'   },
  'Servicios':       { icon: '💡', color: 'var(--teal)'   },
  'Deudas':          { icon: '📉', color: 'var(--red)'    },
  'Educación':       { icon: '📚', color: 'var(--blue)'   },
  'Ahorro':          { icon: '🐷', color: 'var(--green)'  },
  'Otros':           { icon: '📦', color: 'var(--fg2)'    },
};

const catColor = c => CATS[c]?.color || 'var(--fg2)';
const catIcon  = c => CATS[c]?.icon  || '📦';
const CATS_LIST = Object.keys(CATS);

// ─── MEDIO DE PAGO CONFIG ─────────────────────────────────────
const PAGO_BADGE = {
  'Efectivo':        'badge-green',
  'Débito':          'badge-blue',
  'Tarjeta crédito': 'badge-purple',
};

function pagoBadge(p) {
  const cls = PAGO_BADGE[p] || 'badge-gray';
  const icon = p === 'Tarjeta crédito' ? '💳 ' : p === 'Débito' ? '🏧 ' : '💵 ';
  return `<span class="badge ${cls}">${icon}${p || 'Efectivo'}</span>`;
}

// ─── HELPERS ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const cop = n =>
  n == null ? '—' : '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });

function toast(msg, ok = true) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'show ' + (ok ? 'ok' : 'err');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => (t.className = ''), 3000);
}

function destroyChart(id) {
  if (charts[id]) {
    try { charts[id].destroy(); } catch (e) {}
    delete charts[id];
  }
}

const COLOR_MAP = {
  teal: '#00d4aa', pink: '#e040fb', green: '#4caf7d',
  yellow: '#ffb74d', red: '#f06292', blue: '#5c9fff',
  purple: '#9c6fff', 'fg2': '#9299ad',
};

function varToHex(varName) {
  const key = varName.replace('var(--', '').replace(')', '');
  return COLOR_MAP[key] || '#9299ad';
}

// Refresca iconos Lucide tras cada render
function initIcons() {
  if (window.lucide) lucide.createIcons();
}

// ─── AUTH ─────────────────────────────────────────────────────
function switchAuthTab(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach((t, i) =>
    t.classList.toggle('active', (i === 0 && mode === 'login') || (i === 1 && mode === 'register'))
  );
  $('auth-pass2-group').style.display = mode === 'register' ? '' : 'none';
  $('auth-btn').textContent = mode === 'login' ? 'Entrar' : 'Crear cuenta';
  $('auth-err').textContent = '';
}

async function doAuth() {
  const email = $('auth-email').value.trim();
  const pass  = $('auth-pass').value;
  const pass2 = $('auth-pass2').value;
  $('auth-err').textContent = '';

  if (!email || !pass) { $('auth-err').textContent = 'Completa todos los campos'; return; }
  if (authMode === 'register' && pass !== pass2) { $('auth-err').textContent = 'Las contraseñas no coinciden'; return; }

  $('auth-btn').disabled    = true;
  $('auth-btn').textContent = 'Cargando...';

  const { error } = authMode === 'login'
    ? await sb.auth.signInWithPassword({ email, password: pass })
    : await sb.auth.signUp({ email, password: pass });

  if (error) {
    $('auth-err').textContent = error.message;
    $('auth-btn').disabled    = false;
    switchAuthTab(authMode);
  }
}

async function doLogout() {
  await sb.auth.signOut();
}

sb.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    currentUser = session.user;
    showApp();
  } else {
    currentUser = null;
    showAuth();
  }
});

function showAuth() {
  $('auth-page').style.display = 'flex';
  $('app').style.display       = 'none';
  initIcons();
}

function showApp() {
  $('auth-page').style.display = 'none';
  $('app').style.display       = 'flex';
  const email = currentUser.email;
  $('user-email-label').textContent = email;
  $('user-avatar').textContent      = email[0].toUpperCase();
  initIcons();
  navigate('dashboard');
}

// ─── SIDEBAR ─────────────────────────────────────────────────
function toggleSidebar() {
  $('app').classList.toggle('sidebar-collapsed');
}

// ─── ROUTING ─────────────────────────────────────────────────
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  );
  Object.keys(charts).forEach(k => destroyChart(k));
  renderPage(page);
}

function renderPage(page) {
  $('page-content').innerHTML = '<div class="spinner"></div>';
  if (page.startsWith('cat:')) { renderCatDetail(page.slice(4)); return; }
  const fn = { dashboard: renderDashboard, ingresos: renderIngresos, gastos: renderGastos, mercado: renderMercado, deudas: renderDeudas, apps: renderApps }[page];
  if (fn) fn();
}

// ─── DB HELPERS ──────────────────────────────────────────────
async function dbGet(table) {
  const { data, error } = await sb.from(table).select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function dbInsert(table, obj) {
  const { error } = await sb.from(table).insert({ ...obj, user_id: currentUser.id });
  if (error) throw error;
}

async function dbUpdate(table, id, obj) {
  const { error } = await sb.from(table).update(obj).eq('id', id).eq('user_id', currentUser.id);
  if (error) throw error;
}

async function dbDelete(table, id) {
  const { error } = await sb.from(table).delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) throw error;
}

// ─── KPI CARD ────────────────────────────────────────────────
function kpiCard(label, color, val, sub) {
  return `<div class="card">
    <div class="card-accent" style="background:${color}"></div>
    <div class="card-glow"   style="background:${color}"></div>
    <div class="kpi-label">${label}</div>
    <div class="kpi-val"   style="color:${color}">${typeof val === 'number' ? cop(val) : val}</div>
    <div class="kpi-sub">${sub}</div>
  </div>`;
}

// ─── BADGE HELPERS ────────────────────────────────────────────
function estadoBadge(e) {
  const map = { pagado: 'badge-green', pendiente: 'badge-yellow', vencido: 'badge-red', activa: 'badge-green', pausada: 'badge-gray', pagada: 'badge-blue', cancelada: 'badge-red', prueba: 'badge-yellow' };
  return `<span class="badge ${map[e] || 'badge-gray'}">${e || '—'}</span>`;
}
function prioBadge(p) {
  const map = { alta: 'badge-red', media: 'badge-yellow', baja: 'badge-blue' };
  return `<span class="badge ${map[p] || 'badge-gray'}">${p || '—'}</span>`;
}

// ─── GASTO REAL (incluye comisión TC) ────────────────────────
function gastoRealTotal(g) {
  const base = +g.real || 0;
  if (g.medio_pago === 'Tarjeta crédito' && +g.comision > 0) {
    return base + base * (+g.comision / 100);
  }
  return base;
}

// ─── DASHBOARD ───────────────────────────────────────────────
async function renderDashboard() {
  const [ingresos, gastos, deudas, apps] = await Promise.all([
    dbGet('ingresos'), dbGet('gastos'), dbGet('deudas'), dbGet('apps'),
  ]);

  const ingTotal  = ingresos.reduce((s, i) => s + (+i.monto  || 0), 0);
  const gasPrev   = gastos.reduce((s, g)   => s + (+g.prev   || 0), 0);
  const gasReal   = gastos.reduce((s, g)   => s + gastoRealTotal(g), 0);
  const balance   = ingTotal - gasReal;
  const deuTotal  = deudas.filter(d => d.estado === 'activa').reduce((s, d) => s + (+d.cuota || 0), 0);
  const appsTotal = apps.filter(a => a.estado === 'activa').reduce((s, a)   => s + (+a.monto || 0), 0);
  const pct       = ingTotal > 0 ? Math.round(gasReal / ingTotal * 100) : 0;

  // TC spend
  const tcGastos = gastos.filter(g => g.medio_pago === 'Tarjeta crédito');
  const tcTotal  = tcGastos.reduce((s, g) => s + gastoRealTotal(g), 0);

  const catMap = {};
  gastos.forEach(g => {
    const c = g.cat || 'Otros';
    catMap[c] = (catMap[c] || 0) + gastoRealTotal(g);
  });
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  const days       = Array.from({ length: 31 }, (_, i) => i + 1);
  const cumulative = days.map(d => Math.round((gasReal / 31) * d));

  $('page-content').innerHTML = `
  <div class="page-header">
    <div>
      <div class="page-title">Dashboard</div>
      <div class="page-sub">Octubre 2026</div>
    </div>
  </div>
  <div class="kpi-grid">
    ${kpiCard('Ingresos',        'var(--teal)',   ingTotal,  'Mes actual')}
    ${kpiCard('Gastos Reales',   'var(--red)',    gasReal,   `${pct}% del ingreso`)}
    ${kpiCard('Balance',         'var(--green)',  balance,   'Ingreso − Gastos')}
    ${kpiCard('Presupuestado',   'var(--blue)',   gasPrev,   'Planeado')}
    ${kpiCard('Deudas (cuotas)','var(--yellow)', deuTotal,  'Este mes')}
    ${kpiCard('TC próximo mes',  'var(--purple)', tcTotal,   `${tcGastos.length} gasto${tcGastos.length !== 1 ? 's' : ''} con tarjeta`)}
  </div>

  <div class="charts-grid">
    <div class="card" style="grid-column:1/-1">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--teal),var(--blue))"></div>
      <div class="chart-title">Gasto acumulado — Octubre</div>
      <div class="chart-wrap" style="height:200px"><canvas id="c-area"></canvas></div>
    </div>
    <div class="card">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--pink)"></div>
      <div class="chart-title">Gasto por categoría</div>
      <div class="chart-wrap" style="height:220px"><canvas id="c-donut"></canvas></div>
    </div>
    <div class="card">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--blue)"></div>
      <div class="chart-title">Previsto vs Real</div>
      <div class="chart-wrap" style="height:220px"><canvas id="c-bar"></canvas></div>
    </div>
  </div>

  <div class="card">
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--purple)"></div>
    <div class="chart-title" style="margin-bottom:16px">Categorías <span style="color:var(--fg2);font-weight:400;font-size:12px">— clic para ver detalle</span></div>
    ${catEntries.length === 0
      ? '<div class="empty-state"><div class="icon">📊</div><p>Sin gastos registrados</p></div>'
      : catEntries.map(([cat, total]) => {
          const p = gasReal > 0 ? Math.round(total / gasReal * 100) : 0;
          return `<div style="margin-bottom:14px;cursor:pointer" onclick="navigate('cat:${cat}')">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span>${catIcon(cat)} <strong>${cat}</strong></span>
              <span style="font-variant-numeric:tabular-nums">${cop(total)} <span style="color:var(--fg2)">(${p}%)</span></span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${Math.min(p,100)}%;background:${catColor(cat)}"></div>
            </div>
          </div>`;
        }).join('')
    }
  </div>`;

  // ── Area chart ──
  destroyChart('c-area');
  charts['c-area'] = new Chart($('c-area'), {
    type: 'line',
    data: { labels: days, datasets: [{ data: cumulative, borderColor: 'rgba(0,212,170,1)', backgroundColor: 'rgba(0,212,170,0.12)', fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHitRadius: 10 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => cop(ctx.raw) } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9299ad', font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9299ad', font: { size: 11 }, callback: v => '$' + (v / 1000).toFixed(0) + 'k' } },
      },
    },
  });

  // ── Donut ──
  destroyChart('c-donut');
  charts['c-donut'] = new Chart($('c-donut'), {
    type: 'doughnut',
    data: { labels: catEntries.map(([c]) => c), datasets: [{ data: catEntries.map(([, v]) => v), backgroundColor: catEntries.map(([c]) => varToHex(catColor(c))), borderWidth: 0, hoverOffset: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { position: 'right', labels: { color: '#9299ad', font: { size: 11 }, boxWidth: 10, padding: 12 } }, tooltip: { callbacks: { label: ctx => cop(ctx.raw) } } },
    },
  });

  // ── Bar ──
  const topCats = catEntries.slice(0, 6);
  const prevMap = {};
  gastos.forEach(g => { const c = g.cat || 'Otros'; prevMap[c] = (prevMap[c] || 0) + (+g.prev || 0); });
  destroyChart('c-bar');
  charts['c-bar'] = new Chart($('c-bar'), {
    type: 'bar',
    data: {
      labels: topCats.map(([c]) => c),
      datasets: [
        { label: 'Previsto', data: topCats.map(([c]) => prevMap[c] || 0), backgroundColor: 'rgba(92,159,255,0.6)',  borderRadius: 4 },
        { label: 'Real',     data: topCats.map(([, v]) => v),             backgroundColor: 'rgba(240,98,146,0.6)', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9299ad', font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => cop(ctx.raw) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9299ad', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9299ad', font: { size: 11 }, callback: v => '$' + (v / 1000).toFixed(0) + 'k' } },
      },
    },
  });

  initIcons();
}

// ─── CATEGORY DETAIL ─────────────────────────────────────────
async function renderCatDetail(cat) {
  const gastos = await dbGet('gastos');
  const items  = gastos.filter(g => (g.cat || 'Otros') === cat);
  const total     = items.reduce((s, g) => s + gastoRealTotal(g), 0);
  const totalPrev = items.reduce((s, g) => s + (+g.prev || 0), 0);
  const paid = items.filter(g => g.estado === 'pagado').length;

  $('page-content').innerHTML = `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="btn btn-ghost btn-sm" onclick="navigate('gastos')">← Volver</button>
      <div>
        <div class="page-title">${catIcon(cat)} ${cat}</div>
        <div class="page-sub">${items.length} gasto${items.length !== 1 ? 's' : ''} · ${cop(total)} real / ${cop(totalPrev)} previsto</div>
      </div>
    </div>
    <button class="btn btn-teal btn-sm" onclick="openModal('gasto')">+ Agregar</button>
  </div>
  <div class="kpi-grid" style="margin-bottom:20px">
    ${kpiCard('Total Real',    'var(--red)',   total,     'Esta categoría')}
    ${kpiCard('Presupuestado', 'var(--blue)',  totalPrev, 'Planeado')}
    ${kpiCard('Diferencia',    total > totalPrev ? 'var(--red)' : 'var(--green)', totalPrev - total, total > totalPrev ? 'Por encima' : 'Dentro del presupuesto')}
    ${kpiCard('Pagados',       'var(--green)', paid,      `de ${items.length} gastos`)}
  </div>
  <div class="card">
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${catColor(cat)}"></div>
    ${items.length === 0
      ? '<div class="empty-state"><div class="icon">🎉</div><p>Sin gastos en esta categoría</p></div>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Descripción</th><th>Previsto</th><th>Base</th><th>Comisión</th><th>Total</th><th>Pago</th><th>Estado</th><th>Fecha cobro</th><th></th></tr></thead>
          <tbody>
            ${items.map(g => {
              const base  = +g.real || 0;
              const com   = g.medio_pago === 'Tarjeta crédito' && +g.comision > 0 ? base * (+g.comision / 100) : 0;
              const total = base + com;
              return `<tr>
                <td><div style="font-weight:500">${g.descripcion}</div>${g.nota ? `<div style="font-size:11px;color:var(--fg2)">${g.nota}</div>` : ''}</td>
                <td style="font-variant-numeric:tabular-nums">${cop(g.prev)}</td>
                <td style="font-variant-numeric:tabular-nums">${cop(base)}</td>
                <td style="color:var(--yellow);font-size:12px">${com > 0 ? cop(com) + ` (${g.comision}%)` : '—'}</td>
                <td style="font-variant-numeric:tabular-nums;font-weight:600;color:${com > 0 ? 'var(--yellow)' : 'var(--fg)'}">${cop(total)}</td>
                <td>${pagoBadge(g.medio_pago || 'Efectivo')}</td>
                <td>${estadoBadge(g.estado)}</td>
                <td style="color:var(--fg2);font-size:12px">${g.fecha_cobro || g.fecha || ''}</td>
                <td><div style="display:flex;gap:6px">
                  <button class="btn btn-ghost btn-sm" onclick="openModal('gasto','${g.id}')">✏️</button>
                  <button class="btn btn-danger btn-sm" onclick="delRecord('gastos','${g.id}','cat:${cat}')">🗑️</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>`
    }
  </div>`;
  initIcons();
}

// ─── INGRESOS ────────────────────────────────────────────────
async function renderIngresos() {
  const data  = await dbGet('ingresos');
  const total = data.reduce((s, i) => s + (+i.monto || 0), 0);

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><div class="page-title">Ingresos</div><div class="page-sub">${cop(total)} total</div></div>
    <button class="btn btn-teal" onclick="openModal('ingreso')">+ Agregar</button>
  </div>
  <div class="card">
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--teal)"></div>
    ${data.length === 0
      ? '<div class="empty-state"><div class="icon">💵</div><p>Sin ingresos registrados</p></div>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Descripción</th><th>Categoría</th><th>Monto</th><th>Fecha</th><th>Nota</th><th></th></tr></thead>
          <tbody>
            ${data.map(i => `<tr>
              <td style="font-weight:500">${i.descripcion}</td>
              <td>${i.cat || '—'}</td>
              <td style="color:var(--teal);font-weight:600;font-variant-numeric:tabular-nums">${cop(i.monto)}</td>
              <td style="color:var(--fg2)">${i.fecha || ''}</td>
              <td style="color:var(--fg2);font-size:12px">${i.nota || ''}</td>
              <td><div style="display:flex;gap:6px">
                <button class="btn btn-ghost btn-sm"  onclick="openModal('ingreso','${i.id}')">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="delRecord('ingresos','${i.id}','ingresos')">🗑️</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table></div>`
    }
  </div>`;
  initIcons();
}

// ─── GASTOS ──────────────────────────────────────────────────
async function renderGastos() {
  const data = await dbGet('gastos');
  const catMap = {};
  data.forEach(g => { const c = g.cat || 'Otros'; if (!catMap[c]) catMap[c] = []; catMap[c].push(g); });

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><div class="page-title">Gastos</div><div class="page-sub">${data.length} registros</div></div>
    <button class="btn btn-teal" onclick="openModal('gasto')">+ Agregar</button>
  </div>
  <div class="card">
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--red)"></div>
    ${data.length === 0
      ? '<div class="empty-state"><div class="icon">💳</div><p>Sin gastos registrados</p></div>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Descripción</th><th>Categoría</th><th>Previsto</th><th>Real</th><th>Pago</th><th>Estado</th><th>Prio</th><th></th></tr></thead>
          <tbody>
            ${Object.entries(catMap).map(([cat, items]) => {
              const catTotal = items.reduce((s, g) => s + gastoRealTotal(g), 0);
              return `
              <tr class="cat-row" onclick="navigate('cat:${cat}')">
                <td colspan="4" style="color:${catColor(cat)}">
                  ${catIcon(cat)} ${cat}
                  <span style="font-size:11px;color:var(--fg2);margin-left:8px">↗ ver detalle</span>
                </td>
                <td colspan="4" style="text-align:right;color:${catColor(cat)};font-variant-numeric:tabular-nums">${cop(catTotal)}</td>
              </tr>
              ${items.map(g => {
                const total = gastoRealTotal(g);
                const hasComision = g.medio_pago === 'Tarjeta crédito' && +g.comision > 0;
                return `<tr>
                  <td style="padding-left:24px">${g.descripcion}</td>
                  <td style="font-size:12px;color:var(--fg2)">${g.cat}</td>
                  <td style="font-variant-numeric:tabular-nums">${cop(g.prev)}</td>
                  <td style="font-weight:600;font-variant-numeric:tabular-nums;color:${hasComision ? 'var(--yellow)' : 'var(--fg)'}">
                    ${cop(total)}${hasComision ? ` <span style="font-size:10px;color:var(--fg2)">+${g.comision}%</span>` : ''}
                  </td>
                  <td>${pagoBadge(g.medio_pago || 'Efectivo')}</td>
                  <td>${estadoBadge(g.estado)}</td>
                  <td>${prioBadge(g.prio)}</td>
                  <td><div style="display:flex;gap:6px">
                    <button class="btn btn-ghost btn-sm" onclick="openModal('gasto','${g.id}');event.stopPropagation()">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="delRecord('gastos','${g.id}','gastos');event.stopPropagation()">🗑️</button>
                  </div></td>
                </tr>`;
              }).join('')}`;
            }).join('')}
          </tbody>
        </table></div>`
    }
  </div>`;
  initIcons();
}

// ─── MERCADO ─────────────────────────────────────────────────
async function renderMercado() {
  const data       = await dbGet('mercado');
  const SECS       = ['Supermercado', 'Proteínas', 'Huevos y Lácteos', 'Aseo'];
  const items      = data.filter(m => m.sec === merTab);

  // Total usando price_real si existe, si no price_est, si no price
  const itemTotal = m => {
    const p = +m.price_real || +m.price_est || +m.price || 0;
    return p * (+m.qty || 1);
  };
  const tabTotal   = items.reduce((s, m) => s + itemTotal(m), 0);
  const grandTotal = data.reduce((s, m)  => s + itemTotal(m), 0);

  // Diferencia estimado vs real para la tab actual
  const diffEst  = items.reduce((s, m) => s + (+m.price_est || +m.price || 0) * (+m.qty || 1), 0);
  const diffReal = items.reduce((s, m) => s + (+m.price_real || 0) * (+m.qty || 1), 0);
  const showDiff = items.some(m => +m.price_real > 0);

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><div class="page-title">Mercado</div><div class="page-sub">Total: ${cop(grandTotal)}</div></div>
    <button class="btn btn-teal" onclick="openModal('mercado')">+ Agregar</button>
  </div>
  <div class="tabs">
    ${SECS.map(s => `<button class="tab-btn ${s === merTab ? 'active' : ''}" onclick="merTab='${s}';navigate('mercado')">${s}</button>`).join('')}
  </div>
  ${showDiff ? `
  <div class="mercado-diff-bar">
    <div>
      <span class="diff-label">Estimado</span>
      <span class="diff-val" style="color:var(--blue)">${cop(diffEst)}</span>
    </div>
    <div>
      <span class="diff-label">Pagado</span>
      <span class="diff-val" style="color:${diffReal > diffEst ? 'var(--red)' : 'var(--green)'}">${cop(diffReal)}</span>
    </div>
    <div>
      <span class="diff-label">Diferencia</span>
      <span class="diff-val" style="color:${diffReal > diffEst ? 'var(--red)' : 'var(--green)'}">
        ${diffReal > diffEst ? '+' : ''}${cop(diffReal - diffEst)}
      </span>
    </div>
  </div>` : ''}
  <div class="card">
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--green)"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <span style="font-weight:600">${merTab}</span>
      <span style="color:var(--green);font-weight:700;font-variant-numeric:tabular-nums">${cop(tabTotal)}</span>
    </div>
    ${items.length === 0
      ? '<div class="empty-state"><div class="icon">🛒</div><p>Sin productos en esta sección</p></div>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Producto</th><th>Cant.</th><th>Und.</th><th>P. Estimado</th><th>P. Pagado</th><th>Diferencia</th><th>Total</th><th></th></tr></thead>
          <tbody>
            ${items.map(m => {
              const est   = +m.price_est || +m.price || 0;
              const real  = +m.price_real || 0;
              const qty   = +m.qty || 1;
              const diff  = real > 0 ? real - est : null;
              const total = (real > 0 ? real : est) * qty;
              return `<tr>
                <td style="font-weight:500">${m.prod}</td>
                <td>${m.qty}</td>
                <td style="color:var(--fg2)">${m.und}</td>
                <td style="font-variant-numeric:tabular-nums;color:var(--blue)">${cop(est)}</td>
                <td style="font-variant-numeric:tabular-nums;color:${real > 0 ? (real > est ? 'var(--red)' : 'var(--green)') : 'var(--fg2)'}">
                  ${real > 0 ? cop(real) : '<span style="color:var(--fg3)">—</span>'}
                </td>
                <td style="font-size:12px;font-variant-numeric:tabular-nums;color:${diff === null ? 'var(--fg3)' : diff > 0 ? 'var(--red)' : 'var(--green)'}">
                  ${diff === null ? '—' : (diff > 0 ? '+' : '') + cop(diff)}
                </td>
                <td style="font-weight:600;color:var(--green);font-variant-numeric:tabular-nums">${cop(total)}</td>
                <td><div style="display:flex;gap:6px">
                  <button class="btn btn-ghost btn-sm"  onclick="openModal('mercado','${m.id}')">✏️</button>
                  <button class="btn btn-danger btn-sm" onclick="delRecord('mercado','${m.id}','mercado')">🗑️</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>`
    }
  </div>`;
  initIcons();
}

// ─── DEUDAS ──────────────────────────────────────────────────
async function renderDeudas() {
  const data        = await dbGet('deudas');
  const totalCuotas = data.filter(d => d.estado === 'activa').reduce((s, d) => s + (+d.cuota || 0), 0);

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><div class="page-title">Deudas</div><div class="page-sub">Cuotas activas: ${cop(totalCuotas)}/mes</div></div>
    <button class="btn btn-teal" onclick="openModal('deuda')">+ Agregar</button>
  </div>
  <div class="card">
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--yellow)"></div>
    ${data.length === 0
      ? '<div class="empty-state"><div class="icon">🎉</div><p>Sin deudas registradas</p></div>'
      : `<div style="display:flex;flex-direction:column;gap:16px">
          ${data.map(d => {
            const pct = +d.total > 0 ? Math.round(+d.pagado / +d.total * 100) : 0;
            return `<div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-weight:600">${d.nombre}</span>
                  ${estadoBadge(d.estado)}
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <span style="font-size:12px;color:var(--fg2)">${cop(d.pagado)} / ${cop(d.total)}</span>
                  <button class="btn btn-ghost btn-sm"  onclick="openModal('deuda','${d.id}')">✏️</button>
                  <button class="btn btn-danger btn-sm" onclick="delRecord('deudas','${d.id}','deudas')">🗑️</button>
                </div>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${pct}%;background:var(--yellow)"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--fg2);margin-top:4px">
                <span>Cuota: ${cop(d.cuota)}/mes</span>
                <span>${pct}% pagado · Venc: ${d.venc || '—'}</span>
              </div>
            </div>`;
          }).join('')}
        </div>`
    }
  </div>`;
  initIcons();
}

// ─── APPS ────────────────────────────────────────────────────
async function renderApps() {
  const data    = await dbGet('apps');
  const monthly = data.filter(a => a.estado === 'activa')
    .reduce((s, a) => s + (+a.monto || 0) * (a.ciclo === 'anual' ? 1 / 12 : 1), 0);

  $('page-content').innerHTML = `
  <div class="page-header">
    <div><div class="page-title">Suscripciones</div><div class="page-sub">~${cop(Math.round(monthly))}/mes en activas</div></div>
    <button class="btn btn-teal" onclick="openModal('app')">+ Agregar</button>
  </div>
  <div class="card">
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--purple)"></div>
    ${data.length === 0
      ? '<div class="empty-state"><div class="icon">📱</div><p>Sin suscripciones</p></div>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>App</th><th>Monto</th><th>Ciclo</th><th>Categoría</th><th>Estado</th><th>Nota</th><th></th></tr></thead>
          <tbody>
            ${data.map(a => `<tr>
              <td style="font-weight:600">${a.nombre}</td>
              <td style="color:var(--purple);font-variant-numeric:tabular-nums">${cop(a.monto)}</td>
              <td><span class="badge badge-blue">${a.ciclo || 'mensual'}</span></td>
              <td style="font-size:12px;color:var(--fg2)">${a.cat || '—'}</td>
              <td>${estadoBadge(a.estado)}</td>
              <td style="font-size:12px;color:var(--fg2)">${a.nota || ''}</td>
              <td><div style="display:flex;gap:6px">
                <button class="btn btn-ghost btn-sm"  onclick="openModal('app','${a.id}')">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="delRecord('apps','${a.id}','apps')">🗑️</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table></div>`
    }
  </div>`;
  initIcons();
}

// ─── MODAL FORMS CONFIG ───────────────────────────────────────
const FORMS = {
  ingreso: {
    table: 'ingresos', title: 'Ingreso',
    fields: [
      { name: 'descripcion', label: 'Descripción', type: 'text',   required: true },
      { name: 'cat',         label: 'Categoría',   type: 'select', opts: ['Trabajo','Freelance','Arriendo','Inversión','Bono','Extra','Otro'] },
      { name: 'monto',       label: 'Monto',        type: 'number', required: true },
      { name: 'fecha',       label: 'Fecha',        type: 'date' },
      { name: 'nota',        label: 'Nota',         type: 'text' },
    ],
  },
  gasto: {
    table: 'gastos', title: 'Gasto',
    fields: [
      { name: 'descripcion', label: 'Descripción',  type: 'text',   required: true },
      { name: 'cat',         label: 'Categoría',    type: 'select', opts: CATS_LIST },
      { name: 'prev',        label: 'Previsto',     type: 'number' },
      { name: 'real',        label: 'Real (base)',  type: 'number' },
      { name: 'medio_pago',  label: 'Medio de pago',type: 'select', opts: ['Efectivo','Débito','Tarjeta crédito'] },
      { name: 'comision',    label: 'Comisión TC (%)', type: 'number', hint: 'Solo aplica si pagaste con tarjeta de crédito (ej: 3.5)' },
      { name: 'fecha_cobro', label: 'Fecha de cobro TC', type: 'date', hint: 'Fecha en que se cargará a la tarjeta' },
      { name: 'estado',      label: 'Estado',       type: 'select', opts: ['pendiente','pagado','vencido'] },
      { name: 'prio',        label: 'Prioridad',    type: 'select', opts: ['alta','media','baja'] },
      { name: 'fecha',       label: 'Fecha',        type: 'date' },
      { name: 'nota',        label: 'Nota',         type: 'text' },
    ],
  },
  mercado: {
    table: 'mercado', title: 'Producto',
    fields: [
      { name: 'sec',        label: 'Sección',         type: 'select', opts: ['Supermercado','Proteínas','Huevos y Lácteos','Aseo'] },
      { name: 'prod',       label: 'Producto',        type: 'text',   required: true },
      { name: 'qty',        label: 'Cantidad',        type: 'number' },
      { name: 'und',        label: 'Unidad',          type: 'select', opts: ['und','kg','g','L','ml','paq','caja'] },
      { name: 'price_est',  label: 'Precio estimado', type: 'number', hint: 'Lo que crees que costará' },
      { name: 'price_real', label: 'Precio pagado',   type: 'number', hint: 'Lo que realmente costó (llenar después)' },
    ],
  },
  deuda: {
    table: 'deudas', title: 'Deuda',
    fields: [
      { name: 'nombre', label: 'Nombre',      type: 'text',   required: true },
      { name: 'total',  label: 'Total',       type: 'number' },
      { name: 'cuota',  label: 'Cuota/mes',   type: 'number' },
      { name: 'pagado', label: 'Ya pagado',   type: 'number' },
      { name: 'venc',   label: 'Vencimiento', type: 'date' },
      { name: 'estado', label: 'Estado',      type: 'select', opts: ['activa','pausada','pagada'] },
    ],
  },
  app: {
    table: 'apps', title: 'Suscripción',
    fields: [
      { name: 'nombre', label: 'Nombre',    type: 'text',   required: true },
      { name: 'monto',  label: 'Monto',     type: 'number' },
      { name: 'ciclo',  label: 'Ciclo',     type: 'select', opts: ['mensual','anual'] },
      { name: 'cat',    label: 'Categoría', type: 'select', opts: ['Streaming','Música','Software','Trabajo','Nube','Gaming','Otro'] },
      { name: 'estado', label: 'Estado',    type: 'select', opts: ['activa','cancelada','prueba'] },
      { name: 'nota',   label: 'Nota',      type: 'text' },
    ],
  },
};

// ─── MODAL ───────────────────────────────────────────────────
async function openModal(type, id = null) {
  modalContext = { type, id };
  const form = FORMS[type];
  $('modal-title').textContent = (id ? 'Editar' : 'Nuevo') + ' ' + form.title;

  let existing = null;
  if (id) {
    const all = await dbGet(form.table);
    existing  = all.find(r => r.id === id);
  }

  const fieldStyle = 'width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--fg);font-size:14px;font-family:inherit;outline:none;';

  $('modal-body').innerHTML = form.fields.map(f => {
    const val = existing ? (existing[f.name] ?? '') : '';
    const inp = f.type === 'select'
      ? `<select name="${f.name}" style="${fieldStyle}">${f.opts.map(o => `<option value="${o}" ${o == val ? 'selected' : ''}>${o}</option>`).join('')}</select>`
      : `<input type="${f.type}" name="${f.name}" value="${val}" placeholder="${f.label}" ${f.required ? 'required' : ''} style="${fieldStyle}">`;
    const hint = f.hint ? `<div style="font-size:11px;color:var(--fg3);margin-top:4px">${f.hint}</div>` : '';
    return `<div class="form-group"><label>${f.label}</label>${inp}${hint}</div>`;
  }).join('');

  $('modal-overlay').classList.add('open');
  initIcons();
}

function closeModal(e) {
  if (e && e.target !== $('modal-overlay')) return;
  $('modal-overlay').classList.remove('open');
}

async function saveModal() {
  const { type, id } = modalContext;
  const form   = FORMS[type];
  const inputs = $('modal-body').querySelectorAll('input, select');
  const obj    = {};
  inputs.forEach(inp => { obj[inp.name] = inp.value; });

  // Si no es TC, limpiar comisión y fecha_cobro
  if (type === 'gasto' && obj.medio_pago !== 'Tarjeta crédito') {
    obj.comision    = 0;
    obj.fecha_cobro = null;
  }

  $('modal-save').disabled    = true;
  $('modal-save').textContent = 'Guardando...';
  try {
    if (id) { await dbUpdate(form.table, id, obj); toast('Actualizado ✓'); }
    else    { await dbInsert(form.table, obj);      toast('Guardado ✓'); }
    $('modal-overlay').classList.remove('open');
    navigate(currentPage);
  } catch (e) {
    toast(e.message, false);
  } finally {
    $('modal-save').disabled    = false;
    $('modal-save').textContent = 'Guardar';
  }
}

async function delRecord(table, id, returnPage) {
  if (!confirm('¿Eliminar este registro?')) return;
  try {
    await dbDelete(table, id);
    toast('Eliminado');
    navigate(returnPage);
  } catch (e) {
    toast(e.message, false);
  }
}

// ─── KEYBOARD ────────────────────────────────────────────────
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ─── INIT ────────────────────────────────────────────────────
sb.auth.getSession().then(({ data: { session } }) => {
  if (!session) showAuth();
});
