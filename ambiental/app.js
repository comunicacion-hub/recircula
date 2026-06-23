// ============================================================
// RECIRCULA 360 — app.js
// Core: sesión (Firebase Auth), datos (Firestore), navegación,
//       drawer, modales, helpers
// ============================================================

const DOMAIN   = 'redesconrostro.org';
const HUB_URL  = 'https://comunicacion-hub.github.io/recirculaapp/';

// Mini Apps Script SOLO para crear carpetas de evidencia en Drive.
// 1) Desplegá carpetas.gs como app web ("Cualquier usuario").
// 2) Pegá aquí la URL del despliegue.
// 3) Usá el MISMO valor de TOKEN que pusiste en carpetas.gs.
// Si CARPETAS_URL queda vacío, las entregas se guardan sin carpeta (sin error).
const CARPETAS_URL   = 'https://script.google.com/macros/s/AKfycbx_KLFQCVKPJaN_TAUkCjZDat9dGmwi5UhTJ2xpAWUUtqYztAnRbIdX_ZwCpN38GkcbFg/exec';
const CARPETAS_TOKEN = 'rcr2025';

let SESSION = null;

// Catálogos compartidos. Asociaciones y Materiales no tienen pantalla propia,
// pero los datos se cargan porque los necesitan Entregas y el Dashboard.
let CAT = {
  asociaciones: [],
  compradores:  [],
  materiales:   [],
  entregas:     [],
};

// ============================================================
// HELPERS FIRESTORE (sobre window.fb)
// ============================================================

function fsCol(nombre) { return window.fb.collection(window.fb.db, nombre); }
function fsDoc(nombre, id) { return window.fb.doc(window.fb.db, nombre, id); }

async function fsGetAll(nombre) {
  const snap = await window.fb.getDocs(fsCol(nombre));
  return snap.docs.map(function(d) { return Object.assign({ _docId: d.id }, d.data()); });
}

// Ejecuta una escritura en Firestore. Si está offline, la deja en cola nativa
// de Firestore (persistencia) y no bloquea la UI.
async function fsWrite(opFactory) {
  if (!navigator.onLine) {
    try { opFactory(); } catch (e) { console.warn(e); }
    return { ok: true, offline: true };
  }
  try { await opFactory(); return { ok: true }; }
  catch (e) { console.error(e); return { ok: false, error: e.message }; }
}

// Normaliza nombre de material a clave Firestore (igual que el importador)
// Ej: "Plástico Suave" → "plastico_suave"
function normKey(s) {
  return String(s).toLowerCase()
    .replace(/[áä]/g,'a').replace(/[éë]/g,'e').replace(/[íï]/g,'i')
    .replace(/[óö]/g,'o').replace(/[úü]/g,'u').replace(/ñ/g,'n')
    .replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
}

// ── Traductores Firestore (nuevo) → UI (nombres viejos) ──
function asocFromFS(d) {
  return {
    _docId: d._docId,
    'ID_Asociacion':         d.id_asociacion || '',
    'Nombre':                d.nombre || '',
    'Provincia':             d.provincia || '',
    'Ciudad':                d.ciudad || '',
    'Tipo':                  d.tipo || '',
    'Estado':                d.estado || '',
    'Numero de Recicladores':d.num_recicladores || 0,
    'ID_Carpeta_Drive':      d.id_carpeta_drive || '',
  };
}

function compradorFromFS(d) {
  return {
    _docId: d._docId,
    'ID_Comprador':         d.id_comprador || '',
    'Nombre':               d.nombre || '',
    'Nivel Intermediacion': d.nivel_intermediacion || '',
    'Destino Final':        d.destino_final || '',
    'Provincia':            d.provincia || '',
    'Activo':               d.activo === true,
  };
}

function materialFromFS(d) {
  return {
    _docId: d._docId,
    'Nombre':      d.nombre || '',
    'Priorizable': d.priorizable === true,
    'Activo':      d.activo === true,
  };
}

function entregaFromFS(d) {
  const o = {
    _docId: d._docId,
    'ID_Entrega':           d.id_entrega || '',
    'Fecha':                d.fecha || '',
    'Año':                  d.anio || '',
    'Mes':                  d.mes || '',
    'ID_Asociacion':        d.id_asociacion || '',
    'Provincia':            d.provincia || '',
    'ID_Comprador':         d.id_comprador || '',
    'Nivel Intermediacion': d.nivel_intermediacion || '',
    'Actividad Fuente':     d.actividad_fuente || '',
    'Valor Total':          d.valor_total || 0,
    'ID_Carpeta_Evidencia': d.id_carpeta_evidencia || '',
    'Observaciones':        d.observaciones || '',
  };
  // Columnas de materiales (según catálogo)
  (CAT.materiales || []).forEach(function(m) {
    const k = normKey(m['Nombre']);
    o[m['Nombre'] + ' Kilos']       = d[k + '_kg']     || 0;
    o[m['Nombre'] + ' Precio']      = d[k + '_precio'] || 0;
    o[m['Nombre'] + ' Valor Venta'] = d[k + '_venta']  || 0;
  });
  // Joins (nombre de asociación / comprador)
  const a = (CAT.asociaciones || []).find(function(x) { return x['ID_Asociacion'] === o['ID_Asociacion']; });
  o['_nombreAsociacion']    = a ? a['Nombre'] : '';
  o['_provinciaAsociacion'] = a ? a['Provincia'] : '';
  const c = (CAT.compradores || []).find(function(x) { return x['ID_Comprador'] === o['ID_Comprador']; });
  o['_nombreComprador'] = c ? c['Nombre'] : '';
  o['_nivelComprador']  = c ? c['Nivel Intermediacion'] : '';
  return o;
}

// ── Traductores UI (nombres viejos) → Firestore (nuevo) ──
function entregaToFS(data) {
  const f = {
    id_entrega:           data['ID_Entrega'] || '',
    fecha:                data['Fecha'] || '',
    anio:                 parseFloat(data['Año']) || 0,
    mes:                  data['Mes'] || '',
    id_asociacion:        data['ID_Asociacion'] || '',
    provincia:            data['Provincia'] || '',
    id_comprador:         data['ID_Comprador'] || '',
    nivel_intermediacion: data['Nivel Intermediacion'] || '',
    actividad_fuente:     data['Actividad Fuente'] || '',
    observaciones:        data['Observaciones'] || '',
    valor_total:          parseFloat(data['Valor Total']) || 0,
    id_carpeta_evidencia: data['ID_Carpeta_Evidencia'] || '',
  };
  (CAT.materiales || []).forEach(function(m) {
    const nombre = m['Nombre'];
    const k = normKey(nombre);
    f[k + '_kg']     = parseFloat(data[nombre + ' Kilos'])       || 0;
    f[k + '_precio'] = parseFloat(data[nombre + ' Precio'])      || 0;
    f[k + '_venta']  = parseFloat(data[nombre + ' Valor Venta']) || 0;
  });
  return f;
}

function compradorToFS(data) {
  return {
    id_comprador:         data['ID_Comprador'] || '',
    nombre:               data['Nombre'] || '',
    nivel_intermediacion: data['Nivel Intermediacion'] || '',
    destino_final:        data['Destino Final'] || '',
    provincia:            data['Provincia'] || '',
    activo:               data['Activo'] === true,
  };
}

// ============================================================
// SESIÓN
// ============================================================

// Toma la sesión que dejó el Hub en sessionStorage; si no está,
// la deduce consultando la colección Usuarios por el email autenticado.
async function establecerSesion(user) {
  const s = sessionStorage.getItem('rcr_session');
  if (s) {
    try {
      const parsed = JSON.parse(s);
      if (parsed && parsed.rol) { SESSION = parsed; return true; }
    } catch (e) {}
  }
  try {
    const snap = await window.fb.getDocs(
      window.fb.query(fsCol('Usuarios'), window.fb.where('email', '==', user.email))
    );
    if (snap.empty) return false;
    const u = snap.docs[0].data();
    SESSION = {
      nombre: u.nombre || user.displayName || 'Usuario',
      email:  user.email,
      rol:    u.rol || 'Visualizador',
    };
    sessionStorage.setItem('rcr_session', JSON.stringify(SESSION));
    return true;
  } catch (e) {
    console.error('establecerSesion:', e);
    return false;
  }
}

// "Salir" del módulo: vuelve al Hub SIN cerrar la sesión (se conserva el login)
function cerrarSesion() {
  window.location.href = HUB_URL;
}

// ============================================================
// INICIAR APP
// ============================================================

async function iniciarApp() {
  await cargarCatalogos();
  mostrarApp();
  pintarIconosNav();
  navTo('dashboard');
}

function pintarIconosNav() {
  const map = {
    'nav-dashboard':   'home',
    'nav-entregas':    'recycle',
    'nav-compradores': 'cart',
  };
  Object.entries(map).forEach(function(pair) {
    const el = document.getElementById(pair[0]);
    if (el && !el.innerHTML.trim()) el.innerHTML = icoHTML(pair[1]);
  });
  const dc = document.querySelector('.filter-drawer-head .modal-close');
  if (dc && !dc.innerHTML.trim()) dc.innerHTML = icoHTML('close');
}

// ============================================================
// CARGA DE CATÁLOGOS (Firestore)
// ============================================================

async function cargarCatalogos() {
  try {
    const resultados = await Promise.all([
      fsGetAll('Asoc_Ambiente'),
      fsGetAll('Compradores'),
      fsGetAll('Materiales'),
      fsGetAll('Entregas'),
    ]);
    CAT.asociaciones = resultados[0].map(asocFromFS)
      .sort(function(a, b) { return (a['Nombre'] || '').localeCompare(b['Nombre'] || ''); });
    CAT.compradores = resultados[1].map(compradorFromFS)
      .sort(function(a, b) { return (a['Nombre'] || '').localeCompare(b['Nombre'] || ''); });
    CAT.materiales = resultados[2].map(materialFromFS);
    // Entregas se traducen al final porque dependen de materiales/asociaciones/compradores
    CAT.entregas = resultados[3].map(entregaFromFS);
  } catch (e) {
    console.error('Error cargando catálogos:', e);
    showToast('Error al cargar datos');
  }
}

// ============================================================
// CARPETAS DE EVIDENCIA (Drive, vía mini Apps Script)
// ============================================================

// Llama al mini Apps Script para crear/encontrar la subcarpeta del mes.
async function crearCarpetaMesRemote(payload) {
  if (!CARPETAS_URL) return null;
  const r = await fetch(CARPETAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
    body: JSON.stringify(Object.assign({ token: CARPETAS_TOKEN }, payload)),
    redirect: 'follow',
  });
  return await r.json();
}

// Si la entrega aún no tiene carpeta, la crea (mismo criterio que el backend viejo:
// solo cuando hay asociación + mes + año y no existe carpeta previa).
async function asegurarCarpetaEntrega(data) {
  if (data['ID_Carpeta_Evidencia']) return;            // ya tiene carpeta
  if (!CARPETAS_URL) return;                            // servicio no configurado
  const idAsoc = data['ID_Asociacion'];
  const mes    = data['Mes'];
  const anio   = data['Año'];
  if (!idAsoc || !mes || !anio) return;

  const aso = (CAT.asociaciones || []).find(a => a['ID_Asociacion'] === idAsoc);
  if (!aso) return;

  try {
    const res = await crearCarpetaMesRemote({
      idAsociacion:    idAsoc,
      nombreAsociacion: aso['Nombre'] || idAsoc,
      parentFolderId:  aso['ID_Carpeta_Drive'] || '',
      anio: anio,
      mes:  mes,
    });
    if (res && res.ok && res.folderId) {
      data['ID_Carpeta_Evidencia'] = res.folderId;
      // Si se creó recién la carpeta raíz de la asociación, persistirla en Firestore
      if (res.parentFolderId && res.parentFolderId !== (aso['ID_Carpeta_Drive'] || '')) {
        aso['ID_Carpeta_Drive'] = res.parentFolderId;
        if (aso._docId) {
          fsWrite(() => window.fb.updateDoc(fsDoc('Asoc_Ambiente', aso._docId), { id_carpeta_drive: res.parentFolderId }));
        }
      }
    }
  } catch (e) {
    console.warn('No se pudo crear la carpeta de evidencia:', e);
    // Se continúa sin carpeta (la entrega igual se guarda)
  }
}

// ============================================================
// CRUD ENTREGAS (Firestore)
// ============================================================

async function guardarEntregaFS(docId, data) {
  await asegurarCarpetaEntrega(data);   // crea la carpeta si corresponde
  const f = entregaToFS(data);
  if (docId) {
    const actual = CAT.entregas.find(function(e) { return e._docId === docId; });
    f.id_entrega = data['ID_Entrega'] || (actual ? actual['ID_Entrega'] : '');
    const r = await fsWrite(function() { return window.fb.updateDoc(fsDoc('Entregas', docId), f); });
    if (r.ok) {
      const idx = CAT.entregas.findIndex(function(e) { return e._docId === docId; });
      if (idx >= 0) CAT.entregas[idx] = entregaFromFS(Object.assign({ _docId: docId }, f));
    }
    return r;
  } else {
    f.id_entrega = 'ENT_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const ref = window.fb.doc(fsCol('Entregas'));   // ID autogenerado
    const r = await fsWrite(function() { return window.fb.setDoc(ref, f); });
    if (r.ok) CAT.entregas.push(entregaFromFS(Object.assign({ _docId: ref.id }, f)));
    return r;
  }
}

async function eliminarEntregaFS(docId) {
  const r = await fsWrite(function() { return window.fb.deleteDoc(fsDoc('Entregas', docId)); });
  if (r.ok) CAT.entregas = CAT.entregas.filter(function(e) { return e._docId !== docId; });
  return r;
}

// ============================================================
// CRUD COMPRADORES (Firestore)
// ============================================================

async function guardarCompradorFS(docId, data) {
  const f = compradorToFS(data);
  if (docId) {
    const actual = CAT.compradores.find(function(c) { return c._docId === docId; });
    f.id_comprador = data['ID_Comprador'] || (actual ? actual['ID_Comprador'] : '');
    const r = await fsWrite(function() { return window.fb.updateDoc(fsDoc('Compradores', docId), f); });
    if (r.ok) {
      const idx = CAT.compradores.findIndex(function(c) { return c._docId === docId; });
      if (idx >= 0) CAT.compradores[idx] = compradorFromFS(Object.assign({ _docId: docId }, f));
    }
    return r;
  } else {
    f.id_comprador = 'COM_' + Date.now();
    const ref = window.fb.doc(fsCol('Compradores'));
    const r = await fsWrite(function() { return window.fb.setDoc(ref, f); });
    if (r.ok) {
      CAT.compradores.push(compradorFromFS(Object.assign({ _docId: ref.id }, f)));
      CAT.compradores.sort(function(a, b) { return (a['Nombre'] || '').localeCompare(b['Nombre'] || ''); });
    }
    return r;
  }
}

async function eliminarCompradorFS(docId) {
  const r = await fsWrite(function() { return window.fb.deleteDoc(fsDoc('Compradores', docId)); });
  if (r.ok) CAT.compradores = CAT.compradores.filter(function(c) { return c._docId !== docId; });
  return r;
}

// No-op: la caché ahora la maneja Firestore (persistencia offline)
function invalidarCache() {}

// Carga SheetJS (XLSX) bajo demanda para exportar a Excel
async function cargarSheetJS() {
  if (window.XLSX) return;
  await new Promise(function(resolve, reject) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ============================================================
// NAVEGACIÓN
// ============================================================

let CURRENT_SECTION = null;

function navTo(seccion) {
  CURRENT_SECTION = seccion;
  document.querySelectorAll('.bn-item').forEach(function(el) { el.classList.remove('active'); });
  const navEl = document.getElementById('nav-' + seccion);
  if (navEl) navEl.classList.add('active');

  closeFilterDrawer();
  document.getElementById('main-content').innerHTML = '';

  switch (seccion) {
    case 'dashboard':   if (typeof renderDashboard === 'function')   renderDashboard();   break;
    case 'entregas':    if (typeof renderEntregas === 'function')    renderEntregas();    break;
    case 'compradores': if (typeof renderCompradores === 'function') renderCompradores(); break;
    case 'precios':     if (typeof PRECIOS !== 'undefined')          PRECIOS.init();      break;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// FILTER DRAWER — compartido entre pantallas
// ============================================================

const FILTER_CONFIGS = {};

function registerFilterConfig(scope, cfg) {
  FILTER_CONFIGS[scope] = cfg;
}

let currentFilterScope = null;
let pendingFilters = {};

function openFilterDrawer(scope) {
  const cfg = FILTER_CONFIGS[scope];
  if (!cfg) return;
  currentFilterScope = scope;

  pendingFilters = {};
  cfg.sections.forEach(function(sec) {
    const v = cfg.getValue(sec.key);
    pendingFilters[sec.key] = Array.isArray(v) ? v.slice() : (v ? [v] : []);
  });

  const body = document.getElementById('filter-drawer-body');
  body.innerHTML = cfg.sections.map(function(sec, i) {
    const isOpen = i === 0;
    return '<div class="filter-section ' + (isOpen ? 'open' : '') + '" data-key="' + sec.key + '">' +
      '<button class="filter-section-head" onclick="toggleFilterSection(this)">' +
        '<span>' + sec.title + '</span>' +
        icoHTML('chevDown').replace('<svg', '<svg class="chev"') +
      '</button>' +
      '<div class="filter-section-body">' + renderFilterSection(sec) + '</div>' +
    '</div>';
  }).join('');

  document.getElementById('filter-drawer').classList.add('open');
}

function renderFilterSection(sec) {
  const current = pendingFilters[sec.key];
  const arr = Array.isArray(current) ? current : (current ? [current] : []);
  if (sec.type === 'search') {
    const txt = arr[0] || '';
    return '<input type="text" class="filter-search" placeholder="' + (sec.placeholder || '') + '"' +
      ' value="' + esc(txt) + '"' +
      ' oninput="pendingFilters[\'' + sec.key + '\'] = this.value ? [this.value] : []">';
  }
  if (sec.type === 'options') {
    const opts = sec.options || [];
    if (!opts.length) {
      return '<div style="font-size:13px;color:var(--text-dim);padding:8px 12px">Sin opciones disponibles</div>';
    }
    const allChecked = arr.includes('__ALL__');
    const allOpt = '<label class="filter-opt filter-opt-all">' +
      '<input type="checkbox" value="__ALL__" ' + (allChecked ? 'checked' : '') +
        ' onchange="toggleFilterAll(\'' + sec.key + '\', this.checked)">' +
      '<span><strong>Ver todos</strong></span>' +
    '</label>' +
    '<div style="border-top:1px solid var(--border);margin:4px 12px;"></div>';

    const list = opts.map(function(o) {
      const val = typeof o === 'object' ? o.val : o;
      const lbl = typeof o === 'object' ? o.lbl : o;
      const checked = arr.includes(val) ? 'checked' : '';
      return '<label class="filter-opt">' +
        '<input type="checkbox" value="' + esc(val) + '" ' + checked +
          ' onchange="toggleFilterValue(\'' + sec.key + '\',\'' + jsEsc(val) + '\', this.checked)">' +
        '<span>' + esc(lbl) + '</span>' +
      '</label>';
    }).join('');
    return allOpt + list;
  }
  return '';
}

function toggleFilterAll(key, checked) {
  pendingFilters[key] = checked ? ['__ALL__'] : [];
  const drawer = document.getElementById('filter-drawer-body');
  const section = drawer ? drawer.querySelector('.filter-section[data-key="' + key + '"]') : null;
  if (!section) return;
  const cfg = FILTER_CONFIGS[currentFilterScope];
  const sec = cfg.sections.find(function(s) { return s.key === key; });
  section.querySelector('.filter-section-body').innerHTML = renderFilterSection(sec);
}

function toggleFilterValue(key, val, checked) {
  if (!Array.isArray(pendingFilters[key])) {
    pendingFilters[key] = pendingFilters[key] ? [pendingFilters[key]] : [];
  }
  let arr = pendingFilters[key].filter(function(v) { return v !== '__ALL__'; });
  const idx = arr.indexOf(val);
  if (checked && idx === -1) arr.push(val);
  else if (!checked && idx !== -1) arr.splice(idx, 1);
  pendingFilters[key] = arr;
  const drawer = document.getElementById('filter-drawer-body');
  const section = drawer ? drawer.querySelector('.filter-section[data-key="' + key + '"]') : null;
  if (section) {
    const allCb = section.querySelector('input[value="__ALL__"]');
    if (allCb) allCb.checked = false;
  }
}

function toggleFilterSection(btn) {
  btn.closest('.filter-section').classList.toggle('open');
}

function closeFilterDrawer() {
  document.getElementById('filter-drawer').classList.remove('open');
}

function applyFilters() {
  const cfg = FILTER_CONFIGS[currentFilterScope];
  if (!cfg) return;
  cfg.sections.forEach(function(sec) {
    cfg.setValue(sec.key, pendingFilters[sec.key] || []);
  });
  updateFilterBadge(currentFilterScope);
  if (cfg.apply) cfg.apply();
  closeFilterDrawer();
}

function clearFilters() {
  const cfg = FILTER_CONFIGS[currentFilterScope];
  if (!cfg) return;
  cfg.sections.forEach(function(sec) { pendingFilters[sec.key] = []; });
  const body = document.getElementById('filter-drawer-body');
  const openKeys = new Set();
  body.querySelectorAll('.filter-section.open').forEach(function(s) { openKeys.add(s.dataset.key); });
  body.innerHTML = cfg.sections.map(function(sec) {
    const isOpen = openKeys.has(sec.key);
    return '<div class="filter-section ' + (isOpen ? 'open' : '') + '" data-key="' + sec.key + '">' +
      '<button class="filter-section-head" onclick="toggleFilterSection(this)">' +
        '<span>' + sec.title + '</span>' +
        icoHTML('chevDown').replace('<svg', '<svg class="chev"') +
      '</button>' +
      '<div class="filter-section-body">' + renderFilterSection(sec) + '</div>' +
    '</div>';
  }).join('');
}

function updateFilterBadge(scope) {
  const cfg = FILTER_CONFIGS[scope];
  if (!cfg) return;
  const badge = document.getElementById(cfg.badgeId);
  if (!badge) return;
  const count = cfg.sections.filter(function(sec) {
    const v = cfg.getValue(sec.key);
    if (!Array.isArray(v)) return v && v.toString().trim() !== '' && v !== '__ALL__';
    return v.length > 0 && !v.includes('__ALL__');
  }).length;
  if (count > 0) { badge.textContent = count; badge.style.display = 'inline-flex'; }
  else { badge.style.display = 'none'; }
}

// ¿Una opción pasa el filtro? (array vacío o "__ALL__" = no filtra)
function pasaFiltro(arr, val) {
  if (!Array.isArray(arr) || !arr.length) return true;
  if (arr.includes('__ALL__')) return true;
  return arr.includes(val);
}

// ¿Hay al menos una sección de filtros con algo aplicado (incluso "Ver todos")?
function tieneAlgunFiltroAplicado(filtros) {
  return Object.values(filtros || {}).some(function(v) { return Array.isArray(v) && v.length > 0; });
}

// ============================================================
// UI HELPERS
// ============================================================

function mostrarLoading() {
  const l = document.getElementById('screen-loading'); if (l) l.classList.remove('hidden');
  const a = document.getElementById('screen-app');     if (a) a.classList.add('hidden');
}

function mostrarApp() {
  const l = document.getElementById('screen-loading'); if (l) l.classList.add('hidden');
  const a = document.getElementById('screen-app');     if (a) a.classList.remove('hidden');
}

function showToast(msg, dur) {
  dur = dur || 3500;
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  if (showToast._tid) clearTimeout(showToast._tid);
  showToast._tid = setTimeout(function() { t.classList.remove('show'); }, dur);
}

function abrirModal(html) {
  cerrarModal(true);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id        = 'modal-overlay';
  overlay.innerHTML = html;
  overlay.addEventListener('click', function(e) { if (e.target === overlay) cerrarModal(); });
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.modal-close').forEach(function(el) {
    if (!el.innerHTML.trim()) el.innerHTML = icoHTML('close');
  });
  setTimeout(function() {
    const first = overlay.querySelector('input:not([readonly]):not([type="file"]), select, textarea');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) {} }
  }, 60);
}

function cerrarModal(immediate) {
  const m = document.getElementById('modal-overlay');
  if (!m) return;
  if (immediate) { m.remove(); return; }
  m.classList.add('closing');
  setTimeout(function() { m.remove(); }, 200);
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (document.getElementById('modal-overlay')) cerrarModal();
    else if (document.querySelector('.filter-drawer.open')) closeFilterDrawer();
  }
});

// ============================================================
// FORMATEO
// ============================================================

function fmtNum(n, dec) {
  if (dec === undefined) dec = 2;
  if (n == null || isNaN(n)) return '—';
  return parseFloat(n).toLocaleString('es-EC', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + parseFloat(n).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(f) {
  if (!f) return '—';
  if (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}/.test(f)) {
    const partes = f.substring(0, 10).split('-').map(Number);
    const dt = new Date(partes[0], partes[1] - 1, partes[2]);
    if (!isNaN(dt)) return dt.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const d = new Date(f);
  if (isNaN(d)) return f;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtFechaLarga(f) {
  if (!f) f = new Date();
  const d = typeof f === 'string' ? new Date(f) : f;
  if (isNaN(d)) return '';
  return d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function jsEsc(s) {
  if (s == null) return '';
  return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/\r?\n/g,'\\n');
}

function debounce(fn, ms) {
  if (ms === undefined) ms = 250;
  let t;
  return function() {
    const args = arguments, ctx = this;
    clearTimeout(t);
    t = setTimeout(function() { fn.apply(ctx, args); }, ms);
  };
}

function gradFromName(name) {
  const gradients = [
    'linear-gradient(135deg,#33A8DE,#506CFF)',
    'linear-gradient(135deg,#18AE97,#0BC3FF)',
    'linear-gradient(135deg,#F5AD21,#9FDA60)',
    'linear-gradient(135deg,#F82D72,#FF85FF)',
    'linear-gradient(135deg,#FF751F,#FF376F)',
  ];
  const s = (name || '').trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return gradients[h % gradients.length];
}

function ini(n) {
  return (n || '?').split(' ').slice(0, 2).map(function(w) { return w[0] || ''; }).join('').toUpperCase();
}

function nivelBadge(nivel) {
  const map = {
    'Nivel 1': 'badge-nivel-1', 'Nivel 2': 'badge-nivel-2',
    'Nivel 3': 'badge-nivel-3', 'Transformador': 'badge-transformador',
  };
  return '<span class="badge ' + (map[nivel] || 'badge-blue') + '">' + (nivel || '—') + '</span>';
}

// ============================================================
// INICIO — autenticación + carga
// ============================================================

let APP_INICIADA = false;

window.addEventListener('load', async function() {
  if (!window.fb) {
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;color:#555">No se pudo cargar Firebase. Revisá tu conexión e intentá de nuevo.</div>';
    return;
  }
  await window.fbReady;

  window.fb.onAuthStateChanged(window.fb.auth, async function(user) {
    // Sin sesión válida del dominio → volver al Hub a iniciar sesión
    if (!user || !user.email || !user.email.toLowerCase().endsWith('@' + DOMAIN)) {
      window.location.href = HUB_URL;
      return;
    }
    if (APP_INICIADA) return; // evitar recargas por refresh de token
    const ok = await establecerSesion(user);
    if (!ok) { window.location.href = HUB_URL; return; }
    APP_INICIADA = true;
    mostrarLoading();
    await iniciarApp();
  });
});
