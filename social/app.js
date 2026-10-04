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
// Dominios externos con acceso de solo lectura (mismos que el Hub): Tesalia (CBC) y personal
const DOMINIOS_VISUALIZADOR = ['cbc.co', 'carlosandres.es'];
function _esVisualizadorExterno(email) {
  const e = (email || '').toLowerCase();
  return DOMINIOS_VISUALIZADOR.some(function (d) { return e.endsWith('@' + d); });
}
function _dominioPermitido(email) {
  const e = (email || '').toLowerCase();
  return e.endsWith('@' + DOMAIN) || _esVisualizadorExterno(email);
}
const HUB_URL = 'https://recircula.redesconrostro.org';
const MODULO_ACTUAL = 'social';   // último segmento de su url en la colección Modulos

// Carpetas raíz de Drive (ya creadas). Las subcarpetas se crean automáticamente.
const DRIVE_PARENTS = {
  recicladores: '1eNVLmzcYuvfVY7fFZVTfvhFZbEuZHNqS', // "Recicladores"  (estructura: Recicladores > Asociación > Nombre)
  alianzas:     '1AxMaVMUP3MwkGoVvRhKnE_6Zi1_ui0_U', // "Alianzas"      (estructura: Alianzas > Convenio)
  cajas:        '1mIssgggP4j8Vn9Je71mW22q_3sMPYuj3', // "Caja de ahorro" (estructura: Caja de ahorro > Asociación)
  hitos:        '1uSa8ZZi4ULOxqUWDr2INFtDQiCxVA1RL', // "Hitos"         (estructura: Hitos > Nombre del hito)
};

let SESSION = null;

// Colecciones en memoria.
let CAT = {
  recicladores: [],   // recicladores  (colección compartida con la app de Fichas)
  asocAmbiente: [],   // Asoc_Ambiente (fuente de desplegables: id, nombre, provincia)
  asociaciones: [],   // Asoc_Asociativo (solo para num_recicladores → suma en Alianzas)
  alianzas:     [],   // Alianzas
  cajas:        [],   // CajasAhorro
  hitos:        [],   // Hitos
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
    certificacion_secap:     d.certificacion_secap === true,
    foto_perfil_url:         d.foto_perfil_url || '',
    foto_cedula_anverso_url: d.foto_cedula_anverso_url || '',
    foto_cedula_reverso_url: d.foto_cedula_reverso_url || '',
    foto_perfil_id:          d.foto_perfil_id || '',
    foto_cedula_anverso_id:  d.foto_cedula_anverso_id || '',
    foto_cedula_reverso_id:  d.foto_cedula_reverso_id || '',
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
    certificacion_secap:     !!o.certificacion_secap,
    foto_perfil_url:         o.foto_perfil_url || '',
    foto_cedula_anverso_url: o.foto_cedula_anverso_url || '',
    foto_cedula_reverso_url: o.foto_cedula_reverso_url || '',
    foto_perfil_id:          o.foto_perfil_id || '',
    foto_cedula_anverso_id:  o.foto_cedula_anverso_id || '',
    foto_cedula_reverso_id:  o.foto_cedula_reverso_id || '',
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
    tipo:              d.tipo || 'Público',
    activo:            d.activo !== false,
    aliado_principal:  d.aliado_principal || '',
    aliado_secundario: d.aliado_secundario || '',
    asociaciones:      Array.isArray(d.asociaciones) ? d.asociaciones : [],  // ids de Asoc_Ambiente
    provincias:        Array.isArray(d.provincias) ? d.provincias : [],
    anio:              d.anio || '',
    num_recicladores:  d.num_recicladores || 0,
    etapas:            Array.isArray(d.etapas) ? d.etapas : [],              // ['Inicial','Intermedia','Final']
    documentos:        (d.documentos && typeof d.documentos === 'object') ? d.documentos : {},
    observaciones:     d.observaciones || '',
    id_carpeta_drive:  d.id_carpeta_drive || '',
  };
}
function alianzaToFS(o) {
  return {
    id_alianza:        o.id_alianza || '',
    nombre_convenio:   o.nombre_convenio || '',
    tipo:              o.tipo || 'Público',
    activo:            o.activo !== false,
    aliado_principal:  o.aliado_principal || '',
    aliado_secundario: o.aliado_secundario || '',
    asociaciones:      Array.isArray(o.asociaciones) ? o.asociaciones : [],
    provincias:        Array.isArray(o.provincias) ? o.provincias : [],
    anio:              parseFloat(o.anio) || 0,
    num_recicladores:  parseFloat(o.num_recicladores) || 0,
    etapas:            Array.isArray(o.etapas) ? o.etapas : [],
    documentos:        (o.documentos && typeof o.documentos === 'object') ? o.documentos : {},
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
    activa:           d.activa !== false,
    fecha_creacion:   d.fecha_creacion || '',
    num_inscritos:    d.num_inscritos || 0,
    documentos:       (d.documentos && typeof d.documentos === 'object') ? d.documentos : {},
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
    activa:           o.activa !== false,
    fecha_creacion:   o.fecha_creacion || '',
    num_inscritos:    parseFloat(o.num_inscritos) || 0,
    documentos:       (o.documentos && typeof o.documentos === 'object') ? o.documentos : {},
    observaciones:    o.observaciones || '',
    id_carpeta_drive: o.id_carpeta_drive || '',
  };
}

function hitoFromFS(d) {
  return {
    _docId: d._docId,
    id_hito:          d.id_hito || '',
    nombre:           d.nombre || '',
    tipos:            Array.isArray(d.tipos) ? d.tipos : [],          // opción múltiple
    provincias:       Array.isArray(d.provincias) ? d.provincias : [],// opción múltiple
    fecha:            d.fecha || '',
    anio:             d.anio || '',
    mes:              d.mes || '',
    num_asistentes:   d.num_asistentes || 0,
    actores:          Array.isArray(d.actores) ? d.actores : [],      // opción múltiple
    resumen:          d.resumen || '',
    asociaciones:     Array.isArray(d.asociaciones) ? d.asociaciones : [], // ids beneficiadas
    impacto:          d.impacto || '',
    documentos:       (d.documentos && typeof d.documentos === 'object') ? d.documentos : {},
    id_carpeta_drive: d.id_carpeta_drive || '',
  };
}

function hitoToFS(o) {
  return {
    id_hito:          o.id_hito || '',
    nombre:           o.nombre || '',
    tipos:            Array.isArray(o.tipos) ? o.tipos : [],
    provincias:       Array.isArray(o.provincias) ? o.provincias : [],
    fecha:            o.fecha || '',
    anio:             parseFloat(o.anio) || 0,
    mes:              o.mes || '',
    num_asistentes:   parseFloat(o.num_asistentes) || 0,
    actores:          Array.isArray(o.actores) ? o.actores : [],
    resumen:          o.resumen || '',
    asociaciones:     Array.isArray(o.asociaciones) ? o.asociaciones : [],
    impacto:          o.impacto || '',
    documentos:       (o.documentos && typeof o.documentos === 'object') ? o.documentos : {},
    id_carpeta_drive: o.id_carpeta_drive || '',
  };
}

// ============================================================
// CRUCES (recicladores no tiene provincia: se resuelve por asociación)
// ============================================================

// Resuelve una asociación de Asoc_Ambiente aceptando tanto el doc.id de
// Firestore como el campo id_asociacion (los recicladores del formulario
// externo guardan el doc.id; el resto del dashboard usa id_asociacion).
function _buscarAsoc(idOrDoc) {
  if (!idOrDoc) return null;
  return CAT.asocAmbiente.find(function (x) { return x._docId === idOrDoc || x.id_asociacion === idOrDoc; }) || null;
}

function provinciaDeAsociacion(idAsoc) {
  const a = _buscarAsoc(idAsoc);
  return a ? (a.provincia || '') : '';
}
function nombreDeAsociacion(idAsoc) {
  const a = _buscarAsoc(idAsoc);
  return a ? (a.nombre || '') : '';
}
function numRecicladoresDeAsociacion(idAsoc) {
  const a = CAT.asociaciones.find(function (x) { return x.id_asociacion === idAsoc; });
  return a ? (parseFloat(a.num_recicladores) || 0) : 0;
}

// Provincia "operativa" de un reciclador (vía su asociación).
// Respaldo por nombre si el id no resuelve.
function provinciaDeReciclador(r) {
  let a = _buscarAsoc(r.id_asociacion);
  if (!a && r.asociacion_nombre) {
    a = CAT.asocAmbiente.find(function (x) { return (x.nombre || '').trim() === (r.asociacion_nombre || '').trim(); });
  }
  return a ? (a.provincia || '') : '';
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
    if (snap.empty) {
      // Visualizador externo (Tesalia/personal): acceso de solo lectura automático, como el Hub
      if (_esVisualizadorExterno(user.email)) {
        SESSION = { nombre: user.displayName || 'Visualizador', email: (user.email || '').toLowerCase(), rol: 'Visualizador', externo: true };
        sessionStorage.setItem('rcr_session', JSON.stringify(SESSION));
        return true;
      }
      return false;
    }
    const u = snap.docs[0].data();
    SESSION = { nombre: u.nombre || user.displayName || 'Usuario', email: user.email, rol: u.rol || 'Visualizador',
                modulos: Array.isArray(u.modulos) ? u.modulos : [] };
    sessionStorage.setItem('rcr_session', JSON.stringify(SESSION));
    return true;
  } catch (e) {
    // Si falla la lectura pero es visualizador externo, permitir igual (solo lectura)
    if (_esVisualizadorExterno(user.email)) {
      SESSION = { nombre: user.displayName || 'Visualizador', email: (user.email || '').toLowerCase(), rol: 'Visualizador', externo: true };
      sessionStorage.setItem('rcr_session', JSON.stringify(SESSION));
      return true;
    }
    console.error('establecerSesion:', e);
    return false;
  }
}

// ── Períodos visibles (se eligen en recircula / configuraciones) ──
// Firestore: Configuracion/periodos → { ocultos: { '2026': [1, 2, 3, 4] } }
// Un registro con año + mes se oculta si ese mes está oculto; uno que solo
// tiene año, si el año entero está oculto. Lo oculto no aparece en ninguna
// parte (tarjetas, gráficos, totales, tablas ni exportaciones).
// Bloque idéntico en ambiental, asociativo y social.
const PERIODOS_DEFECTO = { '2026': [1, 2, 3, 4] };   // hasta que se guarde desde configuraciones
let PERIODOS_OCULTOS = PERIODOS_DEFECTO;

function _mesANumero(mes) {
  const m = String(mes || '').trim().toLowerCase();
  const nombres = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const idx = nombres.indexOf(m);
  if (idx >= 0) return idx + 1;
  const n = parseInt(m, 10);               // por si viniera numérico ("04")
  return (!isNaN(n) && n >= 1 && n <= 12) ? n : 0;
}

async function cargarPeriodosOcultos() {
  try {
    const docs = await fsGetAll('Configuracion');
    const d = docs.find(function(x) { return x._docId === 'periodos'; });
    if (d && d.ocultos && typeof d.ocultos === 'object') PERIODOS_OCULTOS = d.ocultos;
  } catch (e) { console.warn('cargarPeriodosOcultos:', e); }
}

// mes: número 1-12, nombre ("Abril") o vacío si el registro solo tiene año
function periodoOculto(anio, mes) {
  const meses = PERIODOS_OCULTOS[String(parseInt(anio, 10))];
  if (!Array.isArray(meses) || !meses.length) return false;
  const m = _mesANumero(mes);
  return m ? meses.map(Number).indexOf(m) >= 0 : meses.length >= 12;
}

// fecha "AAAA-MM-DD"
function fechaOculta(fecha) {
  const p = String(fecha || '').substring(0, 10).split('-');
  return p.length >= 2 && !!p[0] && periodoOculto(p[0], p[1]);
}

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
      fsGetAll('Hitos'),
      cargarPeriodosOcultos(),
    ]);
    CAT.recicladores = res[0].map(recicladorFromFS);
    CAT.asocAmbiente = res[1].map(asocAmbienteFromFS).sort(byNombre);
    CAT.asociaciones = res[2].map(asociacionMiniFromFS);
    // Se quitan los períodos ocultos en configuraciones (ver periodoOculto).
    // Recicladores y asociaciones son registros, no datos de un período: no se filtran.
    CAT.alianzas     = res[3].map(alianzaFromFS).filter(function (a) { return !periodoOculto(a.anio); });
    CAT.cajas        = res[4].map(cajaFromFS).filter(function (c) { return !periodoOculto(c.anio); });
    CAT.hitos        = res[5].map(hitoFromFS).filter(function (h) {
      if (h.anio && h.mes) return !periodoOculto(h.anio, h.mes);
      return h.fecha ? !fechaOculta(h.fecha) : !periodoOculto(h.anio);
    });
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
  initModSwitch();
  const pModulos = cargarModulosNav();   // en paralelo con la carga de datos
  await cargarDatos();
  await pModulos;
  if (MODULO_BLOQUEADO) { salirDeModuloBloqueado(); return; }
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
    case 'hitos':        if (typeof renderHitos === 'function')        renderHitos();        break;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// SELECTOR DE MÓDULOS — "recircula / social ⌄" en la topbar
// La lista sale de la colección Modulos: primero la caché que deja el
// inicio de sesión (mismo dominio) y, si no está, directo de Firestore.
// Cada usuario ve solo sus dashboards; el Admin además ve
// "configuraciones". Bloque idéntico en ambiental, asociativo, social
// y configuraciones (solo cambia MODULO_ACTUAL).
// ============================================================

const CONFIG_URL = HUB_URL + '/configuraciones/';
let MODULOS_NAV = [];        // [{ id, slug, url }] módulos activos que el usuario puede ver
let MODULO_BLOQUEADO = false; // el usuario no tiene asignado el dashboard en el que está
let _esAdminNav = false;

function _slugModulo(url) {
  try {
    const path = new URL(url, location.href).pathname
      .replace(/\/index\.html?$/i, '').replace(/\/+$/, '');
    return (path.split('/').pop() || '').toLowerCase();
  } catch (e) { return ''; }
}

function _leerJSON(storage, key) {
  try { return JSON.parse(storage.getItem(key) || 'null'); } catch (e) { return null; }
}

async function cargarModulosNav() {
  let todos = null;
  const cache = _leerJSON(localStorage, 'rcr_hub_data');
  if (cache && Array.isArray(cache.modulos) && cache.modulos.length) todos = cache.modulos;
  if (!todos) {
    try { todos = await fsGetAll('Modulos'); }
    catch (e) { console.warn('cargarModulosNav:', e); todos = []; }
  }

  // Permisos: la sesión del inicio de sesión trae rol + modulos
  const ses = SESSION || _leerJSON(sessionStorage, 'rcr_session') || {};
  const permitidos = Array.isArray(ses.modulos) ? ses.modulos : [];
  _esAdminNav = ses.rol === 'Admin';
  const verTodos = _esAdminNav || ses.externo;

  MODULOS_NAV = todos
    .filter(function(m) {
      const activo = m.activo === true || m.activo === 'TRUE' || m.activo === 'true';
      if (!activo || !m.url || !String(m.url).trim()) return false;
      return verTodos || permitidos.indexOf(m.id_modulo) >= 0;
    })
    .map(function(m) { return { id: m.id_modulo || '', slug: _slugModulo(m.url), url: String(m.url).trim() }; })
    .filter(function(m) { return m.slug; })
    .sort(function(a, b) { return String(a.id).localeCompare(String(b.id)); });

  // Si este dashboard existe en Modulos pero el usuario no lo tiene asignado → bloqueado
  const existe = todos.some(function(m) { return m.url && _slugModulo(String(m.url).trim()) === MODULO_ACTUAL; });
  MODULO_BLOQUEADO = !_esAdminNav && existe && !MODULOS_NAV.some(function(m) { return m.slug === MODULO_ACTUAL; });

  document.querySelectorAll('.mod-switch').forEach(_pintarModSwitch);
}

// Lleva al usuario a un dashboard que sí tenga asignado (o al inicio de sesión)
function salirDeModuloBloqueado() {
  const destino = MODULOS_NAV.find(function(m) { return m.slug !== MODULO_ACTUAL; });
  window.location.replace(destino ? destino.url : HUB_URL);
}

function _opcionesMenu() {
  const ops = MODULOS_NAV.slice();
  if (_esAdminNav) ops.push({ id: '', slug: 'configuraciones', url: CONFIG_URL, sep: true });
  return ops;
}

function _hayOtrosModulos() {
  return _opcionesMenu().some(function(m) { return m.slug !== MODULO_ACTUAL; });
}

function _pintarModSwitch(btn) {
  const multi = _hayOtrosModulos();
  btn.classList.toggle('solo', !multi);
  btn.disabled = !multi;
  btn.setAttribute('aria-expanded', 'false');
}

// Cada sección pinta su propia .page-header; aquí se le inserta el selector
// (reemplaza al breadcrumb que antes ponía el CSS con ::before/::after).
function _injectModSwitch() {
  document.querySelectorAll('#main-content > .page-header:not(.has-switch)').forEach(function(h) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mod-switch';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.innerHTML =
      '<span class="mod-switch-brand">recircula</span>' +
      '<span class="mod-switch-sec">&nbsp;/ ' + esc(MODULO_ACTUAL) + '</span>' +
      '<span class="mod-switch-chev">' + icoHTML('chevDown') + '</span>';
    btn.addEventListener('click', function(e) { e.stopPropagation(); toggleModMenu(btn); });
    _pintarModSwitch(btn);
    h.insertBefore(btn, h.firstChild);
    h.classList.add('has-switch');
  });
}

function initModSwitch() {
  const main = document.getElementById('main-content');
  if (main) new MutationObserver(_injectModSwitch).observe(main, { childList: true });

  const menu = document.createElement('div');
  menu.className = 'mod-menu';
  menu.id = 'mod-menu';
  menu.setAttribute('role', 'menu');
  document.body.appendChild(menu);
}

let _modMenuBtn = null;

function toggleModMenu(btn) {
  const menu = document.getElementById('mod-menu');
  if (!menu) return;
  if (menu.classList.contains('open') && _modMenuBtn === btn) { closeModMenu(); return; }
  if (!_hayOtrosModulos()) return;

  menu.innerHTML = _opcionesMenu().map(function(m) {
    const actual = m.slug === MODULO_ACTUAL;
    return (m.sep ? '<div class="mod-menu-sep"></div>' : '') +
      '<a class="mod-menu-item' + (actual ? ' current' : '') + '" role="menuitem"' +
      (actual ? ' aria-current="page"' : ' href="' + esc(m.url) + '"') + '>' +
        '<span><b>recircula</b> / ' + esc(m.slug) + '</span>' +
        (actual ? '<span class="mod-menu-check">' + icoHTML('check') + '</span>' : '') +
      '</a>';
  }).join('');
  const cur = menu.querySelector('.current');
  if (cur) cur.addEventListener('click', closeModMenu);

  // Anclado bajo el botón (absoluto en el documento → acompaña al scroll)
  const r = btn.getBoundingClientRect();
  menu.style.top  = (r.bottom + window.scrollY + 10) + 'px';
  menu.style.left = Math.max(16, r.left + window.scrollX - 10) + 'px';

  _modMenuBtn = btn;
  btn.setAttribute('aria-expanded', 'true');
  btn.classList.add('open');
  menu.classList.add('open');
}

function closeModMenu() {
  const menu = document.getElementById('mod-menu');
  if (menu) menu.classList.remove('open');
  if (_modMenuBtn) {
    _modMenuBtn.setAttribute('aria-expanded', 'false');
    _modMenuBtn.classList.remove('open');
  }
  _modMenuBtn = null;
}

document.addEventListener('click', function(e) {
  const menu = document.getElementById('mod-menu');
  if (menu && menu.classList.contains('open') && !menu.contains(e.target)) closeModMenu();
});
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModMenu(); });
window.addEventListener('resize', closeModMenu);

// Cerrar sesión: cierra Firebase, limpia lo guardado y vuelve al inicio de sesión
async function cerrarSesion() {
  try { await window.fb.signOut(window.fb.auth); } catch (e) { console.warn('signOut:', e); }
  try {
    sessionStorage.clear();
    localStorage.removeItem('rcr_hub_data');
    localStorage.removeItem('rcr_hub_cache_time');
  } catch (e) {}
  window.location.href = HUB_URL;
}

// ============================================================
// FILTER DRAWER — compartido entre pantallas
// ============================================================

const FILTER_CONFIGS = {};
function registerFilterConfig(scope, cfg) { FILTER_CONFIGS[scope] = cfg; }

let currentFilterScope = null;
let pendingFilters = {};
let _filterDrawerBtn = null;   // botón que abrió el popover (para anclarlo y no auto-cerrarlo)

function openFilterDrawer(scope, btn) {
  const cfg = FILTER_CONFIGS[scope];
  if (!cfg) return;
  currentFilterScope = scope;
  _filterDrawerBtn = btn || null;

  pendingFilters = {};
  cfg.sections.forEach(function (sec) {
    const v = cfg.getValue(sec.key);
    pendingFilters[sec.key] = Array.isArray(v) ? v.slice() : (v ? [v] : []);
  });

  document.getElementById('filter-drawer-body').innerHTML = _buildFilterBody(cfg);
  _refreshFilterCount();
  document.getElementById('filter-drawer').classList.add('open');
  if (_filterDrawerBtn) _posicionarFilterDrawer(_filterDrawerBtn);
}

// Cuerpo del popover: un grupo por sección con chips (o buscador).
function _buildFilterBody(cfg) {
  return cfg.sections.map(function (sec) {
    return '<div class="filter-group" data-key="' + sec.key + '">' +
      '<div class="filter-group-lbl">' + esc(sec.title) + '</div>' +
      renderFilterSection(sec) +
    '</div>';
  }).join('');
}

function _refreshFilterCount() {
  const cfg = FILTER_CONFIGS[currentFilterScope]; if (!cfg) return;
  let n = 0;
  cfg.sections.forEach(function (sec) {
    if (sec.noBadge) return;
    const v = pendingFilters[sec.key];
    const arr = Array.isArray(v) ? v : (v ? [v] : []);
    if (arr.filter(function (x) { return x && x !== '__ALL__'; }).length) n++;
  });
  const c = document.getElementById('filter-drawer-count');
  if (c) { c.textContent = n; c.style.display = n > 0 ? 'inline-flex' : 'none'; }
}

// Ancla el popover bajo el botón que lo abrió, con la colita apuntándolo.
function _posicionarFilterDrawer(btn) {
  const drawer = document.getElementById('filter-drawer');
  const surface = document.getElementById('filter-drawer-surface');
  const tail = document.getElementById('filter-drawer-tail');
  if (!drawer || !surface || !tail) return;
  const margin = 16;
  const r = btn.getBoundingClientRect();
  const surfaceW = Math.min(360, window.innerWidth - margin * 2);
  let left = Math.max(margin, Math.min(r.right - surfaceW, window.innerWidth - surfaceW - margin));
  let top = Math.min(r.bottom + 12, window.innerHeight - margin - 120);
  drawer.style.left = left + 'px';
  drawer.style.top = top + 'px';
  let tailLeft = Math.max(14, Math.min(r.left + r.width / 2 - left - 7, surfaceW - 28));
  tail.style.left = tailLeft + 'px';
}

window.addEventListener('scroll', function () {
  const drawer = document.getElementById('filter-drawer');
  if (drawer && drawer.classList.contains('open') && _filterDrawerBtn) _posicionarFilterDrawer(_filterDrawerBtn);
}, true);

document.addEventListener('click', function (e) {
  const drawer = document.getElementById('filter-drawer');
  if (!drawer || !drawer.classList.contains('open')) return;
  if (drawer.contains(e.target)) return;
  if (_filterDrawerBtn && (e.target === _filterDrawerBtn || _filterDrawerBtn.contains(e.target))) return;
  closeFilterDrawer();
});

// ── Helpers del filtro tipo buscador (searchselect) ──
function _filterNorm(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function _searchSelOpts(sec) {
  return (sec.options || []).map(function (o) {
    return (typeof o === 'object') ? { val: o.val, lbl: o.lbl } : { val: o, lbl: o };
  });
}
// Chips a mostrar: sin texto → solo los seleccionados; con texto → coincidencias
// (más los seleccionados, para poder desmarcarlos), limitadas.
function _renderSearchSelChips(sec, query) {
  const opts = _searchSelOpts(sec);
  const cur = pendingFilters[sec.key];
  const sel = Array.isArray(cur) ? cur : (cur ? [cur] : []);
  const q = _filterNorm(query);
  let list;
  if (!q) {
    list = opts.filter(function (o) { return sel.indexOf(o.val) !== -1; });
    if (!list.length) return '<div class="filter-empty">Escribí para buscar una asociación…</div>';
  } else {
    const match = opts.filter(function (o) { return _filterNorm(o.lbl).indexOf(q) !== -1; });
    const selFuera = opts.filter(function (o) { return sel.indexOf(o.val) !== -1 && match.indexOf(o) === -1; });
    list = selFuera.concat(match).slice(0, 24);
    if (!list.length) return '<div class="filter-empty">Sin resultados</div>';
  }
  return list.map(function (o) {
    const on = sel.indexOf(o.val) !== -1 ? ' on' : '';
    return '<button type="button" class="filter-chip' + on + '" data-val="' + esc(o.val) + '"' +
      ' onclick="toggleFilterChip(\'' + jsEsc(sec.key) + '\',\'' + jsEsc(o.val) + '\', this)">' + esc(o.lbl) + '</button>';
  }).join('');
}
function _filterSearchSel(key, query) {
  const cfg = FILTER_CONFIGS[currentFilterScope]; if (!cfg) return;
  const sec = cfg.sections.find(function (s) { return s.key === key; });
  const cont = document.getElementById('filter-selres-' + key);
  if (sec && cont) cont.innerHTML = _renderSearchSelChips(sec, query);
}

function renderFilterSection(sec) {
  const current = pendingFilters[sec.key];
  const arr = Array.isArray(current) ? current : (current ? [current] : []);
  if (sec.type === 'search') {
    const txt = arr[0] || '';
    return '<div class="filter-search-box">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input type="text" class="filter-search" placeholder="' + esc(sec.placeholder || '') + '"' +
      ' value="' + esc(txt) + '"' +
      ' oninput="pendingFilters[\'' + sec.key + '\'] = this.value ? [this.value] : []; _refreshFilterCount();">' +
    '</div>';
  }
  if (sec.type === 'radio') {
    const opts = sec.options || [];
    const sel = arr[0] || sec.def || '';
    return '<div class="filter-chips">' + opts.map(function (o) {
      const val = typeof o === 'object' ? o.val : o;
      const lbl = typeof o === 'object' ? o.lbl : o;
      const on = val === sel ? ' on' : '';
      return '<button type="button" class="filter-chip' + on + '" data-val="' + esc(val) + '"' +
        ' onclick="toggleFilterRadioChip(\'' + jsEsc(sec.key) + '\',\'' + jsEsc(val) + '\', this)">' + esc(lbl) + '</button>';
    }).join('') + '</div>';
  }
  // 'searchselect' → buscador que muestra solo las coincidencias como chips
  // (no vuelca la lista completa). Guarda ids seleccionados como cualquier chip.
  if (sec.type === 'searchselect') {
    return '<div class="filter-searchsel">' +
      '<div class="filter-search-box">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        '<input type="text" class="filter-search" placeholder="' + esc(sec.placeholder || 'Buscar…') + '"' +
        ' oninput="_filterSearchSel(\'' + jsEsc(sec.key) + '\', this.value)">' +
      '</div>' +
      '<div class="filter-chips filter-selres" id="filter-selres-' + sec.key + '">' + _renderSearchSelChips(sec, '') + '</div>' +
    '</div>';
  }

  // 'options' → chips multi-select; sin ninguno activo = todos.
  const opts = sec.options || [];
  if (!opts.length) return '<div class="filter-empty">Sin opciones disponibles</div>';
  return '<div class="filter-chips">' + opts.map(function (o) {
    const val = typeof o === 'object' ? o.val : o;
    const lbl = typeof o === 'object' ? o.lbl : o;
    const on = arr.includes(val) ? ' on' : '';
    return '<button type="button" class="filter-chip' + on + '" data-val="' + esc(val) + '"' +
      ' onclick="toggleFilterChip(\'' + jsEsc(sec.key) + '\',\'' + jsEsc(val) + '\', this)">' + esc(lbl) + '</button>';
  }).join('') + '</div>';
}

function toggleFilterChip(key, val, el) {
  if (!Array.isArray(pendingFilters[key])) pendingFilters[key] = pendingFilters[key] ? [pendingFilters[key]] : [];
  let arr = pendingFilters[key].filter(function (v) { return v !== '__ALL__'; });
  const i = arr.indexOf(val);
  if (i === -1) arr.push(val); else arr.splice(i, 1);
  pendingFilters[key] = arr;
  if (el) el.classList.toggle('on');
  _refreshFilterCount();
}

// Chip de selección única (reemplaza los radios): activa uno y apaga los hermanos.
function toggleFilterRadioChip(key, val, el) {
  pendingFilters[key] = [val];
  if (el && el.parentElement) el.parentElement.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.toggle('on', c === el); });
  _refreshFilterCount();
}

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
  document.getElementById('filter-drawer-body').innerHTML = _buildFilterBody(cfg);
  _refreshFilterCount();
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
  // Sin círculo naranja: el botón mismo se tiñe de índigo discreto.
  badge.style.display = 'none';
  const btn = badge.closest('.hdr-circle');
  if (btn) btn.classList.toggle('has-filters', count > 0);
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
    if (!user || !user.email || !_dominioPermitido(user.email)) {
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
