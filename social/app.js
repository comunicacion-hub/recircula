// ============================================================
// DASHBOARD SOCIAL — app.js
// Core: sesión (heredada del Hub), datos (Firestore), Drive API,
//       navegación, drawer, modales, helpers.
// Mismo proyecto Firebase (recircula360). Copiar firebase-init.js,
// styles.css e icons.js (versión social) sin cambios.
//
// Secciones: Home · Recicladores · Alianzas · Financiero
// ============================================================

const DOMAIN  = 'redesconrostro.org';
const HUB_URL = 'https://comunicacion-hub.github.io/recirculaapp/';

// Carpetas raíz de Drive (ya creadas). Las subcarpetas se crean automáticamente.
const DRIVE_PARENTS = {
  recicladores: '1eNVLmzcYuvfVY7fFZVTfvhFZbEuZHNqS', // "Recicladores"  (estructura: Recicladores > Asociación > Nombre)
  alianzas:     '1AxMaVMUP3MwkGoVvRhKnE_6Zi1_ui0_U', // "Alianzas"      (estructura: Alianzas > Convenio)
  cajas:        '1mIssgggP4j8Vn9Je71mW22q_3sMPYuj3', // "Caja de ahorro" (estructura: Caja de ahorro > Asociación)
};

let SESSION = null;

// Colecciones en memoria.
let CAT = {
  recicladores: [],   // recicladores  (colección compartida con la app de Fichas)
  asocAmbiente: [],   // Asoc_Ambiente (fuente de desplegables: id, nombre, provincia)
  asociaciones: [],   // Asoc_Asociativo (solo para num_recicladores → suma en Alianzas)
  alianzas:     [],   // Alianzas
  cajas:        [],   // CajasAhorro
};

// ============================================================
// HELPERS FIRESTORE (sobre window.fb)
// ============================================================

function fsCol(nombre) { return window.fb.collection(window.fb.db, nombre); }
function fsDoc(nombre, id) { return window.fb.doc(window.fb.db, nombre, id); }

async function fsGetAll(nombre) {
  const snap = await window.fb.getDocs(fsCol(nombre));
  return snap.docs.map(function (d) { return Object.assign({ _docId: d.id }, d.data()); });
}

// Escritura tolerante a offline (Firestore encola con su persistencia nativa).
async function fsWrite(opFactory) {
  if (!navigator.onLine) {
    try { opFactory(); } catch (e) { console.warn(e); }
    return { ok: true, offline: true };
  }
  try { await opFactory(); return { ok: true }; }
  catch (e) { console.error(e); return { ok: false, error: e.message }; }
}

function byNombre(a, b) { return (a.nombre || '').localeCompare(b.nombre || ''); }

function nuevoId(prefijo) {
  return prefijo + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

// ============================================================
// TRADUCTORES Firestore ⇄ objeto en memoria (claves = campos FS)
// ============================================================

// — recicladores (esquema definido por la app de Fichas; agregamos 'sexo') —
function recicladorFromFS(d) {
  return {
    _docId: d._docId,
    id_asociacion:           d.id_asociacion || '',
    asociacion_nombre:       d.asociacion_nombre || '',
    nombres_apellidos:       d.nombres_apellidos || '',
    sexo:                    d.sexo || '',
    cedula:                  d.cedula || '',
    fecha_nacimiento:        d.fecha_nacimiento || '',
    fecha_afiliacion:        d.fecha_afiliacion || '',
    domicilio:               d.domicilio || '',
    celular:                 d.celular || '',
    cargas_familiares:       d.cargas_familiares || 0,
    ruc:                     d.ruc === true,
    cuenta_bancaria:         d.cuenta_bancaria === true,
    foto_perfil_url:         d.foto_perfil_url || '',
    foto_cedula_anverso_url: d.foto_cedula_anverso_url || '',
    foto_cedula_reverso_url: d.foto_cedula_reverso_url || '',
    carpeta_id:              d.carpeta_id || '',
    creado_por:              d.creado_por || '',
  };
}
function recicladorToFS(o) {
  return {
    id_asociacion:           o.id_asociacion || '',
    asociacion_nombre:       o.asociacion_nombre || '',
    nombres_apellidos:       o.nombres_apellidos || '',
    sexo:                    o.sexo || '',
    cedula:                  o.cedula || '',
    fecha_nacimiento:        o.fecha_nacimiento || '',
    fecha_afiliacion:        o.fecha_afiliacion || '',
    domicilio:               o.domicilio || '',
    celular:                 o.celular || '',
    cargas_familiares:       parseFloat(o.cargas_familiares) || 0,
    ruc:                     !!o.ruc,
    cuenta_bancaria:         !!o.cuenta_bancaria,
    foto_perfil_url:         o.foto_perfil_url || '',
    foto_cedula_anverso_url: o.foto_cedula_anverso_url || '',
    foto_cedula_reverso_url: o.foto_cedula_reverso_url || '',
    carpeta_id:              o.carpeta_id || '',
  };
}

// — Asoc_Ambiente —
function asocAmbienteFromFS(d) {
  return {
    _docId: d._docId,
    id_asociacion: d.id_asociacion || '',
    nombre:        d.nombre || '',
    provincia:     d.provincia || '',
  };
}

// — Asoc_Asociativo (mínimo: solo lo necesario para la suma de recicladores) —
function asociacionMiniFromFS(d) {
  return {
    id_asociacion:    d.id_asociacion || '',
    num_recicladores: d.num_recicladores || 0,
  };
}

// — Alianzas —
function alianzaFromFS(d) {
  return {
    _docId: d._docId,
    id_alianza:        d.id_alianza || '',
    nombre_convenio:   d.nombre_convenio || '',
    aliado_principal:  d.aliado_principal || '',
    aliado_secundario: d.aliado_secundario || '',
    asociaciones:      Array.isArray(d.asociaciones) ? d.asociaciones : [],  // ids de Asoc_Ambiente
    provincias:        Array.isArray(d.provincias) ? d.provincias : [],
    anio:              d.anio || '',
    num_recicladores:  d.num_recicladores || 0,
    etapas:            Array.isArray(d.etapas) ? d.etapas : [],              // ['Inicial','Intermedia','Final']
    observaciones:     d.observaciones || '',
    id_carpeta_drive:  d.id_carpeta_drive || '',
  };
}
function alianzaToFS(o) {
  return {
    id_alianza:        o.id_alianza || '',
    nombre_convenio:   o.nombre_convenio || '',
    aliado_principal:  o.aliado_principal || '',
    aliado_secundario: o.aliado_secundario || '',
    asociaciones:      Array.isArray(o.asociaciones) ? o.asociaciones : [],
    provincias:        Array.isArray(o.provincias) ? o.provincias : [],
    anio:              parseFloat(o.anio) || 0,
    num_recicladores:  parseFloat(o.num_recicladores) || 0,
    etapas:            Array.isArray(o.etapas) ? o.etapas : [],
    observaciones:     o.observaciones || '',
    id_carpeta_drive:  o.id_carpeta_drive || '',
  };
}

// — CajasAhorro —
function cajaFromFS(d) {
  return {
    _docId: d._docId,
    id_asociacion:    d.id_asociacion || '',
    id_caja_ahorro:   d.id_caja_ahorro || '',
    asociacion:       d.asociacion || '',
    provincia:        d.provincia || '',
    anio:             d.anio || '',
    acta_miembros:    d.acta_miembros === true,
    acta_validacion:  d.acta_validacion === true,
    observaciones:    d.observaciones || '',
    id_carpeta_drive: d.id_carpeta_drive || '',
  };
}
function cajaToFS(o) {
  return {
    id_asociacion:    o.id_asociacion || '',
    id_caja_ahorro:   o.id_caja_ahorro || '',
    asociacion:       o.asociacion || '',
    provincia:        o.provincia || '',
    anio:             parseFloat(o.anio) || 0,
    acta_miembros:    !!o.acta_miembros,
    acta_validacion:  !!o.acta_validacion,
    observaciones:    o.observaciones || '',
    id_carpeta_drive: o.id_carpeta_drive || '',
  };
}

// ============================================================
// CRUCES (recicladores no tiene provincia: se resuelve por asociación)
// ============================================================

function provinciaDeAsociacion(idAsoc) {
  const a = CAT.asocAmbiente.find(function (x) { return x.id_asociacion === idAsoc; });
  return a ? (a.provincia || '') : '';
}
function nombreDeAsociacion(idAsoc) {
  const a = CAT.asocAmbiente.find(function (x) { return x.id_asociacion === idAsoc; });
  return a ? (a.nombre || '') : '';
}
function numRecicladoresDeAsociacion(idAsoc) {
  const a = CAT.asociaciones.find(function (x) { return x.id_asociacion === idAsoc; });
  return a ? (parseFloat(a.num_recicladores) || 0) : 0;
}

// Provincia "operativa" de un reciclador (vía su asociación).
function provinciaDeReciclador(r) {
  return provinciaDeAsociacion(r.id_asociacion);
}

// ============================================================
// DRIVE API (REST) — token OAuth heredado del Hub
// Soporta Mi unidad y Unidades compartidas (supportsAllDrives).
// ============================================================

function driveToken() {
  const t = sessionStorage.getItem('rcr_token');
  if (!t) return null;
  const exp = parseInt(sessionStorage.getItem('rcr_token_exp'), 10);
  if (exp && Date.now() > exp) return null;
  return t;
}

function driveDisponible() { return !!driveToken(); }

function urlCarpeta(id) { return id ? ('https://drive.google.com/drive/folders/' + id) : ''; }

// Convierte una URL/ID de Drive a una src embebible (miniatura).
function driveImgSrc(urlOrId, size) {
  if (!urlOrId) return '';
  let id = urlOrId;
  const m = String(urlOrId).match(/[-\w]{25,}/);
  if (m) id = m[0];
  return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + (size || 600);
}

async function driveBuscarCarpeta(nombre, parentId, token) {
  const q = "name='" + String(nombre).replace(/'/g, "\\'") + "' and '" + parentId +
            "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false";
  const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) +
              '&fields=files(id,name)&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true';
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('Drive búsqueda ' + r.status);
  const j = await r.json();
  return (j.files && j.files[0]) ? j.files[0].id : null;
}

async function driveCrearCarpeta(nombre, parentId, token) {
  const url = 'https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true';
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  if (!r.ok) throw new Error('Drive crear ' + r.status);
  const j = await r.json();
  return j.id;
}

async function driveBuscarOCrear(nombre, parentId, token) {
  const found = await driveBuscarCarpeta(nombre, parentId, token);
  return found || await driveCrearCarpeta(nombre, parentId, token);
}

// Sube un archivo (Blob) a una carpeta. Devuelve { id, webViewLink }.
async function driveSubirArchivo(blob, filename, parentId, token) {
  const meta = { name: filename, parents: [parentId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob, filename);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true',
    { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
  if (!r.ok) throw new Error('Drive subida ' + r.status);
  return await r.json();
}

// Envía a la papelera (reversible). 404 = ya no existe.
async function driveEliminarCarpeta(folderId, token) {
  const url = 'https://www.googleapis.com/drive/v3/files/' + folderId + '?fields=id&supportsAllDrives=true';
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
  if (r.status === 404) return true;
  if (!r.ok) throw new Error('Drive papelera ' + r.status);
  return true;
}

// ============================================================
// SESIÓN (heredada del Hub)
// ============================================================

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
    SESSION = { nombre: u.nombre || user.displayName || 'Usuario', email: user.email, rol: u.rol || 'Visualizador' };
    sessionStorage.setItem('rcr_session', JSON.stringify(SESSION));
    return true;
  } catch (e) {
    console.error('establecerSesion:', e);
    return false;
  }
}

// Vuelve al Hub SIN cerrar sesión.
function volverAlHub() { window.location.href = HUB_URL; }

function puedeEditar() { return SESSION && SESSION.rol !== 'Visualizador'; }

// ============================================================
// CARGA DE DATOS
// ============================================================

async function cargarDatos() {
  try {
    const res = await Promise.all([
      fsGetAll('recicladores'),
      fsGetAll('Asoc_Ambiente'),
      fsGetAll('Asoc_Asociativo'),
      fsGetAll('Alianzas'),
      fsGetAll('CajasAhorro'),
    ]);
    CAT.recicladores = res[0].map(recicladorFromFS);
    CAT.asocAmbiente = res[1].map(asocAmbienteFromFS).sort(byNombre);
    CAT.asociaciones = res[2].map(asociacionMiniFromFS);
    CAT.alianzas     = res[3].map(alianzaFromFS);
    CAT.cajas        = res[4].map(cajaFromFS);
    console.log('[Social] datos:', {
      recicladores: CAT.recicladores.length, asocAmbiente: CAT.asocAmbiente.length,
      asociaciones: CAT.asociaciones.length, alianzas: CAT.alianzas.length, cajas: CAT.cajas.length,
      driveToken: driveDisponible() ? 'presente' : 'ausente/expirado',
    });
  } catch (e) {
    console.error('Error cargando datos:', e);
    showToast('Error al cargar datos');
  }
}

// Carga SheetJS bajo demanda para exportar a Excel.
async function cargarSheetJS() {
  if (window.XLSX) return;
  await new Promise(function (resolve, reject) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Carga jsPDF bajo demanda (para la ficha del reciclador en PDF).
async function cargarJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return;
  await new Promise(function (resolve, reject) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ============================================================
// INICIAR APP
// ============================================================

async function iniciarApp() {
  await cargarDatos();
  mostrarApp();
  pintarIconos();
  navTo('home');
}

function pintarIconos() {
  const dc = document.querySelector('.filter-drawer-head .modal-close');
  if (dc && !dc.innerHTML.trim()) dc.innerHTML = icoHTML('close');
}

// ============================================================
// NAVEGACIÓN
// ============================================================

let CURRENT_SECTION = null;

function navTo(seccion) {
  CURRENT_SECTION = seccion;
  document.querySelectorAll('.bn-item').forEach(function (el) { el.classList.remove('active'); });
  const navEl = document.getElementById('nav-' + seccion);
  if (navEl) navEl.classList.add('active');

  closeFilterDrawer();
  document.getElementById('main-content').innerHTML = '';

  switch (seccion) {
    case 'home':         if (typeof renderHome === 'function')         renderHome();         break;
    case 'recicladores': if (typeof renderRecicladores === 'function') renderRecicladores(); break;
    case 'alianzas':     if (typeof renderAlianzas === 'function')     renderAlianzas();     break;
    case 'financiero':   if (typeof renderFinanciero === 'function')   renderFinanciero();   break;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// FILTER DRAWER — compartido entre pantallas
// ============================================================

const FILTER_CONFIGS = {};
function registerFilterConfig(scope, cfg) { FILTER_CONFIGS[scope] = cfg; }

let currentFilterScope = null;
let pendingFilters = {};

function openFilterDrawer(scope) {
  const cfg = FILTER_CONFIGS[scope];
  if (!cfg) return;
  currentFilterScope = scope;

  pendingFilters = {};
  cfg.sections.forEach(function (sec) {
    const v = cfg.getValue(sec.key);
    pendingFilters[sec.key] = Array.isArray(v) ? v.slice() : (v ? [v] : []);
  });

  const body = document.getElementById('filter-drawer-body');
  body.innerHTML = cfg.sections.map(function (sec, i) {
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
  if (sec.type === 'radio') {
    const opts = sec.options || [];
    const sel = arr[0] || sec.def || '';
    return opts.map(function (o) {
      const val = typeof o === 'object' ? o.val : o;
      const lbl = typeof o === 'object' ? o.lbl : o;
      const on = val === sel ? 'checked' : '';
      return '<label class="filter-opt"><input type="radio" name="rad-' + sec.key + '" value="' + esc(val) + '" ' + on +
        ' onchange="toggleFilterRadio(\'' + sec.key + '\',\'' + jsEsc(val) + '\')"><span>' + esc(lbl) + '</span></label>';
    }).join('');
  }
  if (sec.type === 'options') {
    const opts = sec.options || [];
    if (!opts.length) return '<div style="font-size:13px;color:var(--text-dim);padding:8px 12px">Sin opciones disponibles</div>';
    const allChecked = arr.includes('__ALL__');
    const allOpt = '<label class="filter-opt filter-opt-all">' +
      '<input type="checkbox" value="__ALL__" ' + (allChecked ? 'checked' : '') +
        ' onchange="toggleFilterAll(\'' + sec.key + '\', this.checked)">' +
      '<span><strong>Ver todos</strong></span>' +
    '</label><div style="border-top:1px solid var(--border);margin:4px 12px;"></div>';
    const list = opts.map(function (o) {
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
  const body = document.getElementById('filter-drawer-body');
  const section = body ? body.querySelector('.filter-section[data-key="' + key + '"]') : null;
  if (!section) return;
  const cfg = FILTER_CONFIGS[currentFilterScope];
  const sec = cfg.sections.find(function (s) { return s.key === key; });
  section.querySelector('.filter-section-body').innerHTML = renderFilterSection(sec);
}

function toggleFilterValue(key, val, checked) {
  if (!Array.isArray(pendingFilters[key])) pendingFilters[key] = pendingFilters[key] ? [pendingFilters[key]] : [];
  let arr = pendingFilters[key].filter(function (v) { return v !== '__ALL__'; });
  const idx = arr.indexOf(val);
  if (checked && idx === -1) arr.push(val);
  else if (!checked && idx !== -1) arr.splice(idx, 1);
  pendingFilters[key] = arr;
  const body = document.getElementById('filter-drawer-body');
  const section = body ? body.querySelector('.filter-section[data-key="' + key + '"]') : null;
  if (section) { const allCb = section.querySelector('input[value="__ALL__"]'); if (allCb) allCb.checked = false; }
}

function toggleFilterSection(btn) { btn.closest('.filter-section').classList.toggle('open'); }
function toggleFilterRadio(key, val) { pendingFilters[key] = [val]; }
function closeFilterDrawer() { const d = document.getElementById('filter-drawer'); if (d) d.classList.remove('open'); }

function applyFilters() {
  const cfg = FILTER_CONFIGS[currentFilterScope];
  if (!cfg) return;
  cfg.sections.forEach(function (sec) { cfg.setValue(sec.key, pendingFilters[sec.key] || []); });
  updateFilterBadge(currentFilterScope);
  if (cfg.apply) cfg.apply();
  closeFilterDrawer();
}

function clearFilters() {
  const cfg = FILTER_CONFIGS[currentFilterScope];
  if (!cfg) return;
  cfg.sections.forEach(function (sec) { pendingFilters[sec.key] = []; });
  const body = document.getElementById('filter-drawer-body');
  const openKeys = new Set();
  body.querySelectorAll('.filter-section.open').forEach(function (s) { openKeys.add(s.dataset.key); });
  body.innerHTML = cfg.sections.map(function (sec) {
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
  const count = cfg.sections.filter(function (sec) {
    if (sec.noBadge) return false;
    const v = cfg.getValue(sec.key);
    if (!Array.isArray(v)) return v && v.toString().trim() !== '' && v !== '__ALL__';
    return v.length > 0 && !v.includes('__ALL__');
  }).length;
  if (count > 0) { badge.textContent = count; badge.style.display = 'inline-flex'; }
  else { badge.style.display = 'none'; }
}

function pasaFiltro(arr, val) {
  if (!Array.isArray(arr) || !arr.length) return true;
  if (arr.includes('__ALL__')) return true;
  return arr.includes(val);
}

// Igual que pasaFiltro pero el dato es una LISTA (ej. alianza con varias provincias/etapas):
// pasa si alguno de los valores del registro está entre los seleccionados.
function pasaFiltroLista(arr, vals) {
  if (!Array.isArray(arr) || !arr.length) return true;
  if (arr.includes('__ALL__')) return true;
  if (!Array.isArray(vals)) vals = [vals];
  return vals.some(function (v) { return arr.includes(v); });
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
  showToast._tid = setTimeout(function () { t.classList.remove('show'); }, dur);
}

function abrirModal(html) {
  cerrarModal(true);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = html;
  overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrarModal(); });
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.modal-close').forEach(function (el) {
    if (!el.innerHTML.trim()) el.innerHTML = icoHTML('close');
  });
  setTimeout(function () {
    const first = overlay.querySelector('input:not([readonly]):not([type="file"]), select, textarea');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) {} }
  }, 60);
}

function cerrarModal(immediate) {
  const m = document.getElementById('modal-overlay');
  if (!m) return;
  if (immediate) { m.remove(); return; }
  m.classList.add('closing');
  setTimeout(function () { m.remove(); }, 200);
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (document.getElementById('modal-overlay')) cerrarModal();
    else if (document.querySelector('.filter-drawer.open')) closeFilterDrawer();
  }
});

// ============================================================
// FORMATEO
// ============================================================

function fmtNum(n, dec) {
  if (dec === undefined) dec = 0;
  if (n == null || isNaN(n)) return '—';
  return parseFloat(n).toLocaleString('es-EC', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtPct(n, dec) {
  if (dec === undefined) dec = 0;
  if (n == null || isNaN(n)) return '0%';
  return parseFloat(n).toLocaleString('es-EC', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + '%';
}

// Acepta dd/mm/aaaa (formato de la app de Fichas) y aaaa-mm-dd.
function fmtFecha(f) {
  if (!f) return '—';
  if (typeof f === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(f)) {
    const p = f.substring(0, 10).split('/').map(Number);
    const dt = new Date(p[2], p[1] - 1, p[0]);
    if (!isNaN(dt)) return dt.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  if (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}/.test(f)) {
    const p = f.substring(0, 10).split('-').map(Number);
    const dt = new Date(p[0], p[1] - 1, p[2]);
    if (!isNaN(dt)) return dt.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const d = new Date(f);
  return isNaN(d) ? f : d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtFechaLarga(f) {
  if (!f) f = new Date();
  const d = typeof f === 'string' ? new Date(f) : f;
  if (isNaN(d)) return '';
  const s = d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jsEsc(s) {
  if (s == null) return '';
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\r?\n/g, '\\n');
}

function gradFromName(name) {
  const grads = [
    'linear-gradient(135deg,#33A8DE,#506CFF)',
    'linear-gradient(135deg,#18AE97,#0BC3FF)',
    'linear-gradient(135deg,#F5AD21,#9FDA60)',
    'linear-gradient(135deg,#F82D72,#FF85FF)',
    'linear-gradient(135deg,#FF751F,#FF376F)',
  ];
  const s = (name || '').trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return grads[h % grads.length];
}

// ============================================================
// INICIO — autenticación heredada + carga
// ============================================================

let APP_INICIADA = false;

window.addEventListener('load', async function () {
  if (!window.fb) {
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;color:#555">No se pudo cargar Firebase. Revisá tu conexión e intentá de nuevo.</div>';
    return;
  }
  await window.fbReady;

  window.fb.onAuthStateChanged(window.fb.auth, async function (user) {
    if (!user || !user.email || !user.email.toLowerCase().endsWith('@' + DOMAIN)) {
      window.location.href = HUB_URL;
      return;
    }
    if (APP_INICIADA) return;
    const ok = await establecerSesion(user);
    if (!ok) { window.location.href = HUB_URL; return; }
    APP_INICIADA = true;
    mostrarLoading();
    await iniciarApp();
  });
});
