// ============================================================
// RECIRCULA 360 — entregas.js
// Filtra sobre CAT.entregas (cargado de Firestore). Sin backend.
// ============================================================

let ENTREGAS_DATA    = [];
let ENTREGAS_FILTROS = { anio: [], mes: [], asociacion: [], provincia: [] };
let EVIDENCIAS_LISTA = [];
let ENTREGAS_LOADED  = false;

// ── Edición multi-comprador (grupo) ──
let EDITING_SIBLINGS = [];    // documentos del mismo grupo cargados al abrir el form
let COMPRADOR_IDX    = 0;     // contador de bloques (índice DOM único)

// Estado editable de los Verificables del formulario abierto: { docs: {clave: {id,url,nombre}}, eliminar: [ids de Drive] }.
// Se resetea cada vez que se abre el formulario; "eliminar" se aplica en Drive al guardar.
let ENT_EVIDENCIA_FORM = null;

// ── Navegación de dos niveles ──
let ENT_VISTA = 'asociaciones';   // 'asociaciones' | 'lista'
let ENT_ASOC_SEL = null;          // ID_Asociacion abierta
let ENT_FILTROS_N2 = { material: [], anio: [], mes: [] };

// Opciones de Actividad Fuente — selección múltiple (una entrega puede combinar varias).
const ENT_ACTIVIDADES = ['Recuperación a pie de Vereda / Fuente', 'Recuperación en Relleno', 'Recuperación GIRA', 'Otros'];

// Normaliza 'Actividad Fuente' a array: soporta el string legado de un solo valor.
function _actividadesArray(v) {
  if (Array.isArray(v)) return v;
  return v ? [v] : [];
}

// Casillas de documentos (PDF) de la entrega. key = campo en Documentos; file = nombre en Drive.
const ENT_DOCS = [
  { key: 'verificable1', lbl: 'Verificable 1', file: 'Verificable_1' },
  { key: 'verificable2', lbl: 'Verificable 2', file: 'Verificable_2' },
  { key: 'verificable3', lbl: 'Verificable 3', file: 'Verificable_3' },
  { key: 'verificable4', lbl: 'Verificable 4', file: 'Verificable_4' },
];
function _entDoc(e, key) { return (e && e['Documentos'] && e['Documentos'][key]) ? e['Documentos'][key] : null; }

// Visto para la tabla (verde si el documento existe)
function _docVistoEnt(doc) {
  return (doc && doc.url)
    ? `<span class="ent-visto"><span class="ent-visto-ic">${icoHTML('check')}</span></span>`
    : '<span class="ent-visto-no">—</span>';
}

// Suma de kilos de todos los materiales de una entrega
function _kilosEntrega(e) {
  let kg = 0;
  (CAT.materiales || []).forEach(function (m) { kg += parseFloat(e[m['Nombre'] + ' Kilos'] || 0) || 0; });
  return kg;
}
function _rgbaEnt(hex, a) {
  let h = String(hex || '').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  const n = parseInt(h, 16) || 0;
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function _statCardEnt(icono, color, valor, titulo, sub) {
  return `<div class="ent-stat">
    <span class="ent-stat-ico" style="background:${_rgbaEnt(color, 0.12)};color:${color}">${icoHTML(icono)}</span>
    <div class="ent-stat-tx"><span class="ent-stat-tit">${esc(titulo)}</span><b>${valor}</b><span class="ent-stat-sub">${esc(sub)}</span></div>
  </div>`;
}

// ============================================================
// REGISTRAR DRAWER
// ============================================================

function registerEntregasFilters() {
  const anios = Array.from(new Set((CAT.entregas || []).map(e => String(e['Año'] || '')).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  registerFilterConfig('entregas', {
    badgeId: 'badge-entregas',
    sections: [
      { key: 'material', title: 'Material', type: 'options', options: (CAT.materiales || []).map(m => m['Nombre']), allLabel: 'Todos los materiales' },
      { key: 'anio',     title: 'Años',     type: 'options', options: anios.length ? anios : ['2024', '2025', '2026', '2027'], allLabel: 'Todos los años' },
      { key: 'mes',      title: 'Meses',    type: 'options', options: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'], allLabel: 'Todos los meses' },
    ],
    getValue: (k) => ENT_FILTROS_N2[k] || [],
    setValue: (k, v) => { ENT_FILTROS_N2[k] = v; },
    apply: () => cargarEntregas(),
  });
}

// Total de kilos entregados por una asociación
function _kilosAsoc(idAsoc) {
  return (CAT.entregas || []).filter(e => e['ID_Asociacion'] === idAsoc)
    .reduce((a, e) => a + _kilosEntrega(e), 0);
}

// Paleta fija de MATERIALES para "Pesos" — independiente de la rotación global
// de color y de ENT_PROV_PAL. Único mapa reusable: úsalo en vez de colores
// sueltos repetidos por función. Los 12 últimos (desde Vidrio) no fueron
// confirmados por el usuario; son una elección razonable para completar el
// catálogo dinámico de 16 materiales.
const ENT_MAT_PAL = {
  'PET':            '#506CFF',
  'Plástico Suave': '#FF751F',
  'Plástico Duro':  '#18AE97',
  'Lata Aluminio':  '#F82D72',
  'Vidrio':         '#33A8DE',
  'Cartón':         '#C19A6B',
  'Chatarra':       '#8a8a99',
  'Cobre':          '#B5651D',
  'Papel Archivo':  '#F5AD21',
  'Periódico':      '#B8B8C8',
  'Soplado':        '#0BC3FF',
  'Tetrapak':       '#7B5CFF',
  'Suela':          '#4A4A55',
  'Bronce':         '#CD7F32',
  'Batería':        '#DC2626',
  'Acero':          '#A8AEB8',
};
function _colorMaterialEnt(nombre) { return ENT_MAT_PAL[nombre] || '#8a8a99'; }

// Estilo por provincia (ícono + color) para el Nivel 1
const ENT_PROV_PAL = ['#506CFF', '#18AE97', '#F5AD21', '#F82D72', '#FF751F', '#33A8DE', '#7B5CFF', '#0BC3FF'];
function _provEstiloEnt(prov) {
  const k = String(prov || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return { ico: 'mapPin', color: ENT_PROV_PAL[h % ENT_PROV_PAL.length] };
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

function renderEntregas() {
  registerEntregasFilters();
  ENTREGAS_LOADED = false;
  ENT_VISTA = 'asociaciones';
  ENT_ASOC_SEL = null;
  renderVistaEntregas();
}

function renderVistaEntregas() {
  if (ENT_VISTA === 'lista' && ENT_ASOC_SEL) renderNivelLista();
  else renderNivelAsociaciones();
}

// ── Nivel 1: asociaciones agrupadas por provincia ──
function renderNivelAsociaciones() {
  const add = puedeEditar();
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Pesos</div>
        <div class="page-sub">Registro por asociación</div>
      </div>
      <div class="hdr-actions">
        <button class="hdr-circle" onclick="exportarMatrizEntregas()" title="Descargar toda la matriz">${icoHTML('download')}</button>
      </div>
    </div>
    <div id="ent-n1-wrap"></div>`;

  if (add) mostrarFAB('plus', abrirFormEntrega, 'Nueva entrega');

  const wrap = document.getElementById('ent-n1-wrap');

  // Agrupar asociaciones por provincia
  const grupos = {};
  (CAT.asociaciones || []).forEach(a => {
    const prov = a['Provincia'] || 'Sin provincia';
    (grupos[prov] = grupos[prov] || []).push(a);
  });
  const provs = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'es'));
  if (!provs.length) {
    wrap.innerHTML = `<div class="empty-state">${icoHTML('recycle').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"')}<p>No hay asociaciones</p></div>`;
    return;
  }

  const CHEV = icoHTML('chevRight');
  wrap.innerHTML = '<div class="ent-provs">' + provs.map(prov => {
    const est = _provEstiloEnt(prov);
    const lista = grupos[prov].slice().sort((a, b) => (a['Nombre'] || '').localeCompare(b['Nombre'] || '', 'es'));
    const totalProvTn = lista.reduce((s, a) => s + _kilosAsoc(a['ID_Asociacion']), 0) / 1000;
    const filas = lista.map(a => {
      const kg = _kilosAsoc(a['ID_Asociacion']);
      const vacia = kg <= 0;
      return `<button class="ent-asoc-row${vacia ? ' ent-asoc-vacia' : ''}" onclick="abrirAsociacionEntregas('${jsEsc(a['ID_Asociacion'])}')">
        <span class="ent-asoc-dot" style="background:${est.color}"></span>
        <span class="ent-asoc-nom">${esc(a['Nombre'] || '—')}</span>
        <span class="ent-asoc-chev">${CHEV}</span>
      </button>`;
    }).join('');
    return `<div class="ent-prov-grupo">
      <div class="ent-prov-titulo">
        <span class="ent-prov-ico" style="background:${_rgbaEnt(est.color, 0.14)};color:${est.color}">${icoHTML(est.ico)}</span>
        <div class="ent-prov-tit-tx">
          <span class="ent-prov-nom">${esc(prov)}</span>
          <span class="ent-prov-count">${lista.length} asociaci${lista.length !== 1 ? 'ones' : 'ón'}</span>
        </div>
        <span class="ent-prov-total" style="color:${est.color}">${fmtNum(totalProvTn)}<small>TN</small></span>
      </div>
      <div class="ent-prov-lista">${filas}</div>
    </div>`;
  }).join('') + '</div>';
}

function abrirAsociacionEntregas(idAsoc) {
  ENT_ASOC_SEL = idAsoc;
  ENT_VISTA = 'lista';
  ENT_FILTROS_N2 = { material: [], anio: [], mes: [] };
  renderVistaEntregas();
}
function volverAsociacionesEnt() {
  ENT_VISTA = 'asociaciones';
  ENT_ASOC_SEL = null;
  renderVistaEntregas();
}

// ── Nivel 2: entregas de la asociación abierta ──
function renderNivelLista() {
  const add = puedeEditar();
  const aso = (CAT.asociaciones || []).find(a => a['ID_Asociacion'] === ENT_ASOC_SEL);
  const nombre = aso ? (aso['Nombre'] || '') : '';
  const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Pesos</div>
        <div class="page-sub">${esc(nombre)}</div>
      </div>
      <div class="hdr-actions">
        <button class="hdr-circle" onclick="volverAsociacionesEnt()" title="Volver a asociaciones">${BACK}</button>
        <button class="hdr-circle" onclick="openFilterDrawer('entregas')" title="Filtros">
          ${icoHTML('filter')}<span class="filter-badge" id="badge-entregas" style="display:none;">0</span>
        </button>
        <button class="hdr-circle" onclick="exportarEntregasExcel()" title="Descargar Excel">${icoHTML('download')}</button>
      </div>
    </div>
    <div id="entregas-table-wrap"></div>`;

  if (add) mostrarFAB('plus', abrirFormEntrega, 'Nueva entrega');

  cargarEntregas();
  updateFilterBadge('entregas');
}


// ============================================================
// CARGAR ENTREGAS (filtrado local sobre CAT.entregas)
// ============================================================

// Clave de orden por período operativo (Año + Mes): más reciente arriba.
function _periodoOrden(e) {
  const ORDEN_MES = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  };
  const anio = parseInt(e['Año'], 10) || 0;
  const k = normKey(e['Mes']);            // "abril", "mayo"… o "04" si fuera numérico
  let mes = ORDEN_MES[k] || 0;
  if (!mes && /^\d{1,2}$/.test(k)) {
    const n = parseInt(k, 10);
    if (n >= 1 && n <= 12) mes = n;
  }
  return anio * 100 + mes;
}

async function cargarEntregas() {
  const wrap = document.getElementById('entregas-table-wrap');
  if (!wrap) return;

  const fMat = ENT_FILTROS_N2.material || [];
  const tieneMaterial = (e) => {
    if (!fMat.length) return true;
    return fMat.some(nombre => (parseFloat(e[nombre + ' Kilos'] || 0) || 0) > 0);
  };

  ENTREGAS_DATA = (CAT.entregas || []).filter(e =>
    e['ID_Asociacion'] === ENT_ASOC_SEL &&
    pasaFiltro(ENT_FILTROS_N2.anio, String(e['Año'])) &&
    pasaFiltro(ENT_FILTROS_N2.mes, e['Mes']) &&
    tieneMaterial(e)
  ).sort((a, b) => {
    const dif = _periodoOrden(b) - _periodoOrden(a);
    if (dif !== 0) return dif;
    const fb = String(b['Fecha'] || ''), fa = String(a['Fecha'] || '');
    if (fb !== fa) return fb.localeCompare(fa);
    return String(a['_nombreComprador'] || '').localeCompare(String(b['_nombreComprador'] || ''));
  });

  ENTREGAS_LOADED = true;
  renderTablaEntregas();
}

// ============================================================
// TABLA
// ============================================================

// Agrupa la lista visible por ID_Grupo_Entrega (igual que la ficha de detalle),
// conservando el orden y sumando kilos/valores de TODOS los compradores del grupo.
// Las entregas sin grupo (legado o individuales) quedan cada una en su propia tarjeta.
function _agruparEntregasVista(lista) {
  const vistos = new Set();
  const grupos = [];
  (lista || []).forEach(e => {
    const clave = e['ID_Grupo_Entrega'] || e['_docId'];
    if (vistos.has(clave)) return;
    vistos.add(clave);
    const hermanos = e['ID_Grupo_Entrega']
      ? (CAT.entregas || []).filter(r => r['ID_Grupo_Entrega'] === e['ID_Grupo_Entrega'])
      : [e];
    // Kilos por material, dinámico: solo materiales con kg>0 en el grupo (igual criterio que verEntrega).
    const matsKg = {};
    let total = 0;
    hermanos.forEach(h => {
      (CAT.materiales || []).forEach(m => {
        const nombre = m['Nombre'];
        const kg = parseFloat(h[nombre + ' Kilos'] || 0) || 0;
        if (kg > 0) matsKg[nombre] = (matsKg[nombre] || 0) + kg;
      });
      total += parseFloat(h['Valor Total'] || 0) || 0;
    });
    grupos.push({ rep: e, hermanos: hermanos, matsKg: matsKg, total: total, n: hermanos.length });
  });
  return grupos;
}

// Hermanos (todos los compradores del grupo) a partir del _docId de uno de ellos.
function _hermanosPorDocId(docId) {
  const primaria = (CAT.entregas || []).find(r => r['_docId'] === docId);
  if (!primaria) return [];
  const grp = primaria['ID_Grupo_Entrega'];
  if (!grp) return [primaria];
  return (CAT.entregas || []).filter(r => r['ID_Grupo_Entrega'] === grp);
}

function renderTablaEntregas() {
  const wrap = document.getElementById('entregas-table-wrap');
  if (!wrap) return;

  if (!ENTREGAS_DATA.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        ${icoHTML('recycle').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"')}
        <p>No hay entregas con estos filtros</p>
      </div>`;
    return;
  }

  // Agrupar por entrega (ID_Grupo_Entrega), uniendo compradores como en la ficha
  const grupos = _agruparEntregasVista(ENTREGAS_DATA);

  // Un material por línea: punto de color + nombre + kg (dinámico, en TN, sin barra).
  const matChip = (nombre, kg) => {
    const color = _colorMaterialEnt(nombre);
    return `<span class="ent-mat-chip">
      <span class="ent-mat-dot" style="background:${color}"></span>
      <span class="ent-mat-nom" style="color:${color}">${esc(nombre)}</span>
      <strong>${fmtNum(kg / 1000)} TN</strong>
    </span>`;
  };

  const cards = grupos.map(g => {
    const e       = g.rep;
    const idEnt   = jsEsc(e['ID_Entrega'] || '');
    const docId   = jsEsc(e['_docId'] || '');
    const col     = _mesColor(e['Mes']);
    const nBuyers = g.n > 1
      ? `<span style="display:block;font-size:10.5px;font-weight:600;color:var(--text-dim);margin-top:2px">${g.n} compradores</span>`
      : '';
    const matsNombres = Object.keys(g.matsKg);
    const matsHtml = matsNombres.length
      ? matsNombres.map(n => matChip(n, g.matsKg[n])).join('')
      : '<span style="font-size:12px;color:var(--text-dim)">Sin materiales</span>';

    return `
      <div class="ent-card" onclick="verEntrega('${idEnt}')">
        <div class="ent-c-per">
          <span class="ent-cal" style="background:${_rgbaEnt(col, 0.14)};color:${col}">${icoHTML('calendar')}</span>
          <span class="ent-cal-txt">${esc(e['Mes'] || '')} ${esc(e['Año'] || '')}${nBuyers}</span>
        </div>
        <div class="ent-c-mats">${matsHtml}</div>
        <div class="ent-c-val">${fmtMoney(g.total)}</div>
        <div class="ent-c-acts td-actions" onclick="event.stopPropagation()">
          <button class="icon-btn" onclick="verEntrega('${idEnt}')" title="Ver">${icoHTML('view')}</button>
          ${puedeEditar() ? `
            <button class="icon-btn primary" onclick="editarEntrega('${idEnt}')" title="Editar">${icoHTML('edit')}</button>
            <button class="icon-btn del" onclick="confirmarEliminarEntrega('${docId}')" title="Eliminar">${icoHTML('trash')}</button>
          ` : ''}
        </div>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="ent-cards">${cards}</div>
    <div style="font-size:12px;color:var(--text-dim);text-align:center;margin-top:14px">
      ${grupos.length} entrega${grupos.length !== 1 ? 's' : ''}
    </div>
  `;
}

// Color por mes (para el ícono de período)
function _mesColor(mes) {
  const ORD = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  // Rotación global 33A8DE→18AE97→506CFF aplicada. Colisión: el índice 1 (antes
  // #18AE97) rotaba a #506CFF, ya ocupado por el índice 0 (destino, sin rotar) —
  // se resolvió con #0f9b84 (teal ya presente en compradores.js), distinto de
  // cualquier otro valor de esta misma paleta.
  const pal = ['#506CFF', '#0f9b84', '#F5AD21', '#F82D72', '#FF751F', '#18AE97', '#7B5CFF', '#0BC3FF', '#9FDA60', '#FF376F', '#FF85FF', '#0a9e83'];
  const i = ORD.indexOf(String(mes || '').toLowerCase());
  return pal[(i >= 0 ? i : 0) % pal.length];
}


// ============================================================
// ELIMINAR
// ============================================================

function confirmarEliminarEntrega(docId) {
  const n = _hermanosPorDocId(docId).length;
  const cuerpo = n > 1
    ? `Esta entrega agrupa <b>${n} compradores</b>. Se eliminarán los <b>${n} registros</b> del grupo. Esta acción no se puede deshacer.`
    : `¿Seguro que quieres eliminar esta entrega? Se eliminará la fila del registro. Esta acción no se puede deshacer.`;
  abrirModal(`
    <div class="modal" style="max-width:440px">
      <div class="modal-head">
        <div class="modal-title">Eliminar entrega</div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:14px;line-height:1.6">${cuerpo}</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="eliminarEntrega('${jsEsc(docId)}')">Eliminar</button>
      </div>
    </div>
  `);
}

// Elimina TODOS los compradores del grupo al que pertenece el documento indicado.
async function eliminarEntrega(docId) {
  const hermanos = _hermanosPorDocId(docId);
  if (!hermanos.length) { showToast('No se encontró la entrega'); return; }
  try {
    let ok = true, offline = false;
    for (const h of hermanos) {
      if (!h['_docId']) continue;
      const res = await eliminarEntregaFS(h['_docId']);
      if (!res.ok) { ok = false; showToast('Error al eliminar: ' + (res.error || '')); break; }
      if (res.offline) offline = true;
    }
    if (ok) showToast(offline ? 'Eliminada (se sincronizará) ✓' : 'Entrega eliminada ✓');
    cerrarModal();
    renderVistaEntregas();
  } catch (e) {
    console.error(e);
    showToast('Error al eliminar');
  }
}

// ============================================================
// VER ENTREGA
// ============================================================

function verEntrega(id) {
  const e = ENTREGAS_DATA.find(r => r['ID_Entrega'] === id) || (CAT.entregas || []).find(r => r['ID_Entrega'] === id);
  if (!e) { showToast('Entrega no encontrada'); return; }

  const MATS = ['PET','Plástico Suave','Plástico Duro','Lata Aluminio','Vidrio','Cartón',
    'Chatarra','Cobre','Papel Archivo','Periódico','Soplado','Tetrapak','Suela','Bronce','Batería','Acero'];

  // Hermanos del grupo (si existen) — para mostrar todos los compradores juntos
  const hermanos = _cargarHermanos(id);
  const esGrupo = hermanos.length > 1;

  const renderBloqueDetalle = (ent, mostrarHead) => {
    const filasMat = MATS.filter(m => parseFloat(ent[m+' Kilos']||0) > 0).map(m => {
      const kg     = parseFloat(ent[m+' Kilos']||0);
      const precio = parseFloat(ent[m+' Precio']||0);
      const venta  = parseFloat(ent[m+' Valor Venta']||0) || kg*precio;
      const prio   = ['PET','Plástico Suave','Plástico Duro'].includes(m);
      return `<tr>
        <td style="${prio?'font-weight:600;color:#1c7aa8':''}">${esc(m)}</td>
        <td style="text-align:right">${fmtNum(kg)} kg</td>
        <td style="text-align:right">$${fmtNum(precio,2)}/kg</td>
        <td style="text-align:right;font-weight:600;color:#0a9e83">${fmtMoney(venta)}</td>
      </tr>`;
    }).join('');
    return `
      <div class="cmp-block" style="cursor:default">
        ${mostrarHead ? `
          <div class="cmp-block-head" style="margin-bottom:12px">
            <div>
              <div class="cmp-block-num">Comprador</div>
              <div style="font-size:15px;font-weight:700;color:var(--text);margin-top:2px">${esc(ent['_nombreComprador']||'—')}</div>
            </div>
            <div style="text-align:right">
              <div class="form-label" style="margin-bottom:2px">C.I / RUC</div>
              <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(ent['CI/RUC']||ent['_ciRucComprador']||'—')}</div>
            </div>
          </div>` : ''}
        <div class="materiales-section" style="margin-bottom:0">
          <div class="materiales-section-title">Materiales entregados</div>
          <div class="table-wrap" style="border-radius:14px;box-shadow:none;border:1px solid var(--border)"><table>
            <thead><tr><th>Material</th><th style="text-align:right">Kilos</th><th style="text-align:right">Precio</th><th style="text-align:right">Valor</th></tr></thead>
            <tbody>${filasMat||'<tr><td colspan="4" style="text-align:center;color:var(--text-dim)">Sin materiales</td></tr>'}</tbody>
          </table></div>
        </div>
        <div class="cmp-block-foot">
          <span class="cmp-block-sub-lbl">Subtotal:</span>
          <span class="cmp-block-sub">${fmtMoney(ent['Valor Total'])}</span>
        </div>
      </div>`;
  };

  const totalGrupo = hermanos.reduce((s, r) => s + (parseFloat(r['Valor Total']) || 0), 0);
  const evidenciaMerged = _fusionarDocsEvidencia(hermanos);

  const bloquesHtml = esGrupo
    ? hermanos.map(h => renderBloqueDetalle(h, true)).join('')
    : renderBloqueDetalle(e, false);

  abrirModal(`
    <div class="modal">
      <div class="modal-head">
        <div>
          <div class="modal-title">Detalle de entrega${esGrupo ? ` · ${hermanos.length} compradores` : ''}</div>
          <div class="modal-sub">${esc(e['Mes']||'')} ${esc(e['Año']||'')} · ${esc(e['_nombreAsociacion']||'')}</div>
        </div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">
        <div class="form-grid-2" style="margin-bottom:16px">
          <div><div class="form-label">Fecha</div><div style="font-size:14px">${fmtFecha(e['Fecha'])}</div></div>
          <div><div class="form-label">Provincia</div><div style="font-size:14px">${esc(e['Provincia']||e['_provinciaAsociacion']||'—')}</div></div>
          <div><div class="form-label">Actividad fuente</div><div style="font-size:14px">${esc(_actividadesArray(e['Actividad Fuente']).join(', ') || '—')}</div></div>
          <div><div class="form-label">Valor total ${esGrupo?'(grupo)':''}</div><div style="font-size:18px;font-weight:700;color:#0a9e83">${fmtMoney(esGrupo?totalGrupo:e['Valor Total'])}</div></div>
          ${!esGrupo ? `<div><div class="form-label">Comprador</div><div style="font-size:14px">${esc(e['_nombreComprador']||'—')}</div></div>
          <div><div class="form-label">C.I / RUC</div><div style="font-size:14px">${esc(e['CI/RUC']||e['_ciRucComprador']||'—')}</div></div>` : ''}
          ${e['Voucher'] ? `<div><div class="form-label">N° Voucher / Factura / Otros</div><div style="font-size:14px">${esc(e['Voucher'])}</div></div>` : ''}
        </div>
        ${bloquesHtml}
        ${e['Observaciones'] ? `<div style="margin-top:14px"><div class="form-label">Observaciones</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">${esc(e['Observaciones'])}</div></div>` : ''}
        <div style="margin-top:16px"><div class="form-label" style="margin-bottom:8px">Verificables</div>
          <div class="ent-docs-ver">
            ${ENT_DOCS.map(d => {
              const doc = evidenciaMerged[d.key] || null;
              return doc && doc.url
                ? `<a class="ent-doc-chip" href="${esc(doc.url)}" target="_blank" rel="noopener">${icoHTML('view')} ${esc(d.lbl)}</a>`
                : `<span class="ent-doc-chip ent-doc-chip-off">${icoHTML('view')} ${esc(d.lbl)}</span>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cerrar</button>
      </div>
    </div>
  `);
}

// ============================================================
// FORMULARIO
// ============================================================

function editarEntrega(id) { abrirFormEntrega(id); }

// Cargar los hermanos (documentos que comparten ID_Grupo_Entrega). Si es legado
// sin grupo o entrega individual, el arreglo trae solo el documento primario.
function _cargarHermanos(idEnt) {
  if (!idEnt) return [];
  const primaria = (CAT.entregas || []).find(r => r['ID_Entrega'] === idEnt);
  if (!primaria) return [];
  const grp = primaria['ID_Grupo_Entrega'];
  if (!grp) return [primaria];
  return (CAT.entregas || []).filter(r => r['ID_Grupo_Entrega'] === grp);
}

function _fusionarDocsEvidencia(siblings) {
  const merged = {};
  (siblings || []).forEach(s => {
    const d = s['Documentos'] || {};
    Object.keys(d).forEach(k => { if (d[k] && d[k].url) merged[k] = d[k]; });
  });
  return merged;
}

function _carpetaEvidenciaComun(siblings) {
  for (const s of (siblings || [])) if (s['ID_Carpeta_Evidencia']) return s['ID_Carpeta_Evidencia'];
  return '';
}

// Pinta las casillas de Verificables desde ENT_EVIDENCIA_FORM.docs (estado editable
// de la sesión de edición actual, no directamente de Firestore).
function _renderEntDocs() {
  const cont = document.getElementById('ent-docs-cont');
  if (!cont || !ENT_EVIDENCIA_FORM) return;
  cont.innerHTML = ENT_DOCS.map(d => {
    const f = ENT_EVIDENCIA_FORM.docs[d.key];
    const fila = (f && (f.url || f.id))
      ? `<div class="ent-f-list"><div class="ent-f-row">
          <span class="ent-f-nom">${esc(f.nombre || d.lbl)}</span>
          ${f.url ? `<a class="ent-f-ver" href="${esc(f.url)}" target="_blank" rel="noopener" title="Ver PDF">${icoHTML('view')}</a>` : ''}
          <button type="button" class="ent-f-del" onclick="_entQuitarVerificable('${d.key}')" title="Eliminar archivo">${icoHTML('trash')}</button>
        </div></div>`
      : '';
    return `<div class="ent-doc-item">
      <div class="ent-doc-cab"><span class="ent-doc-lbl">${esc(d.lbl)}</span></div>
      ${fila}
      <label class="ent-doc-add">${icoHTML('cloudUp')}<span>${f ? 'Reemplazar archivo' : 'Subir archivo'}</span>
        <input type="file" accept="application/pdf,.pdf" class="ent-doc-file" id="ent-doc-${d.key}" onchange="_entDocFileSel(this,'${d.key}')">
      </label>
      <div class="ent-doc-pend" id="ent-pend-${d.key}"></div>
    </div>`;
  }).join('');
}

// Muestra el nombre del archivo recién seleccionado (aún no subido a Drive).
function _entDocFileSel(input, key) {
  const cont = document.getElementById('ent-pend-' + key);
  if (!cont) return;
  const f = input.files && input.files[0] ? input.files[0] : null;
  cont.innerHTML = f ? `<div class="ent-f-pend">${icoHTML('check')}<span>${esc(f.name)}</span><small>listo para subir al guardar</small></div>` : '';
}

// Quita el verificable existente del formulario (se envía a la papelera de Drive al guardar).
function _entQuitarVerificable(key) {
  if (!ENT_EVIDENCIA_FORM) return;
  const f = ENT_EVIDENCIA_FORM.docs[key];
  if (f && f.id) ENT_EVIDENCIA_FORM.eliminar.push(f.id);
  delete ENT_EVIDENCIA_FORM.docs[key];
  _renderEntDocs();
}

function abrirFormEntrega(id = null) {
  EVIDENCIAS_LISTA = [];
  COMPRADOR_IDX = 0;
  EDITING_SIBLINGS = _cargarHermanos(id);

  // Primario = el que se abrió; el resto se muestran también como bloques
  const primario = id ? EDITING_SIBLINGS.find(s => s['ID_Entrega'] === id) : null;
  const restoHermanos = EDITING_SIBLINGS.filter(s => s !== primario);

  const todosMats = CAT.materiales.length ? CAT.materiales : [
    { Nombre: 'PET', Priorizable: true },
    { Nombre: 'Plástico Suave', Priorizable: true },
    { Nombre: 'Plástico Duro', Priorizable: true },
    { Nombre: 'Cartón' },
    { Nombre: 'Vidrio' },
    { Nombre: 'Lata Aluminio' },
  ];

  // PDFs y carpeta son compartidos entre todos los hermanos del grupo
  const evidenciaCompartida = _fusionarDocsEvidencia(EDITING_SIBLINGS);
  const carpetaCompartida   = _carpetaEvidenciaComun(EDITING_SIBLINGS);
  ENT_EVIDENCIA_FORM = { docs: Object.assign({}, evidenciaCompartida), eliminar: [] };

  // Bloques iniciales: uno por hermano existente, o uno vacío si es nuevo
  const bloquesIniciales = EDITING_SIBLINGS.length
    ? [primario, ...restoHermanos].filter(Boolean).map(s => _renderBloqueComprador(s, todosMats)).join('')
    : _renderBloqueComprador(null, todosMats);

  abrirModal(`
    <div class="modal" style="max-width:760px">
      <div class="modal-head">
        <div><div class="modal-title">${primario?'Editar entrega':'Nueva entrega'}</div><div class="modal-sub">Registra los kilos y precios por comprador</div></div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">

        <div class="form-grid-3">
          <div class="form-group">
            <label class="form-label">Fecha</label>
            <input type="date" class="form-input" id="ent-fecha" readonly value="${primario?.['Fecha']?String(primario.Fecha).substring(0,10):new Date().toISOString().substring(0,10)}">
          </div>
          <div class="form-group">
            <label class="form-label">Año *</label>
            <select class="form-select" id="ent-anio">
              <option value="">Selecciona...</option>
              ${['2024','2025','2026','2027','2028'].map(a=>`<option value="${a}" ${String(primario?.['Año'])===a?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Mes *</label>
            <select class="form-select" id="ent-mes">
              <option value="">Selecciona...</option>
              ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map(m=>`<option value="${m}" ${primario?.['Mes']===m?'selected':''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Asociación *</label>
            <select class="form-select" id="ent-asociacion" onchange="autocompletarProvincia(this.value);actualizarVisibilidadActaPdf(this.value);actualizarVisibilidadLideres(this.value)">
              <option value="">Selecciona una asociación</option>
              ${CAT.asociaciones.map(a=>`<option value="${esc(a['ID_Asociacion'])}" ${primario?.['ID_Asociacion']===a['ID_Asociacion']?'selected':''}>${esc(a['Nombre'])}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Provincia</label>
            <input type="text" class="form-input" id="ent-provincia" readonly value="${esc(primario?.['Provincia']||primario?.['_provinciaAsociacion']||'')}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Actividad fuente <span style="font-weight:400;text-transform:none;color:var(--text-dim);font-size:10px">— selección múltiple</span></label>
          <div class="ent-actividad-checks" id="ent-actividad-checks">
            ${ENT_ACTIVIDADES.map(a => `<label class="filter-opt">
              <input type="checkbox" value="${esc(a)}" ${_actividadesArray(primario?.['Actividad Fuente']).includes(a) ? 'checked' : ''}>
              <span>${esc(a)}</span>
            </label>`).join('')}
          </div>
        </div>

        <div class="cmp-section">
          <div class="cmp-section-head">
            <div class="cmp-section-title">Compradores y pesos</div>
            ${puedeEditar() ? `<button type="button" class="btn btn-glass btn-sm" onclick="agregarComprador()">＋ Agregar comprador</button>` : ''}
          </div>
          <div id="cmp-container">${bloquesIniciales}</div>
        </div>

        <div class="form-group" id="ent-voucher-wrap" style="display:none;margin-top:4px">
          <label class="form-label">N° Voucher / Factura / Otros <span style="font-weight:400;text-transform:none;color:var(--text-dim);font-size:10px">— si hay varios, sepáralos con comas</span></label>
          <input type="text" class="form-input" id="ent-voucher" placeholder="Ej: 0001, 0002" value="${esc(primario?.['Voucher']||'')}">
        </div>

        <div style="margin-top:14px;display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:12px 16px;background:rgba(24,174,151,0.06);border-radius:12px">
          <span style="font-size:13px;color:var(--text-muted);font-weight:600">VALOR TOTAL:</span>
          <span id="ent-total" style="font-size:22px;font-weight:700;color:#0a9e83">$0,00</span>
        </div>

        <div class="form-group" style="margin-top:14px">
          <label class="form-label">Observaciones</label>
          <textarea class="form-textarea" id="ent-obs" placeholder="Notas adicionales...">${esc(primario?.['Observaciones']||'')}</textarea>
        </div>

        <div id="ent-acta-pdf-wrap" style="display:none;margin-top:16px">
          <button type="button" class="btn btn-glass" style="width:100%;justify-content:center" id="btn-acta-pdf" onclick="descargarActaPDF()">${icoHTML('download')}<span id="btn-acta-pdf-label">Descargar Acta de Validación (PDF)</span></button>
          <div style="font-size:11.5px;color:var(--text-dim);margin-top:6px;text-align:center;line-height:1.5">Descarga el acta, imprímela y fírmala. Luego sube el PDF firmado como Verificable.</div>
        </div>

        <div id="ent-cac-pdf-wrap" style="display:none;margin-top:16px">
          <button type="button" class="btn btn-glass" style="width:100%;justify-content:center" id="btn-cac-pdf" onclick="descargarComprobanteCAC()">${icoHTML('download')}<span id="btn-cac-pdf-label">Descargar Comprobante de Acopio Comunitario (PDF)</span></button>
          <div style="font-size:11.5px;color:var(--text-dim);margin-top:6px;text-align:center;line-height:1.5">Descarga el comprobante, imprímelo y fírmalo. Luego sube el PDF firmado como Verificable.</div>
        </div>

        <div class="form-label" style="margin:16px 0 8px">Verificables (PDF) <span style="font-weight:400;text-transform:none;color:var(--text-dim);font-size:10px">— compartidos entre todos los compradores de esta entrega</span></div>
        <div class="ent-docs" id="ent-docs-cont"></div>

        <input type="hidden" id="ent-carpeta-compartida" value="${esc(carpetaCompartida)}">

      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        ${puedeEditar() ? `<button class="btn btn-primary" id="btn-guardar-entrega" onclick="guardarEntrega('${jsEsc(id||'')}')">${primario?'Actualizar':'Guardar entrega'}</button>` : ''}
      </div>
    </div>
  `);

  if (primario?.['ID_Asociacion']) autocompletarProvincia(primario['ID_Asociacion']);
  actualizarVisibilidadActaPdf(primario?.['ID_Asociacion'] || '');
  actualizarVisibilidadLideres(primario?.['ID_Asociacion'] || '');
  _renderEntDocs();
  // Autocompletar C.I/RUC de cada bloque y calcular subtotales
  document.querySelectorAll('#cmp-container .cmp-block').forEach(bl => {
    const bIdx = bl.getAttribute('data-block-idx');
    const sel = document.getElementById('ent-comprador-' + bIdx);
    if (sel && sel.value) autocompletarCIRUC(bIdx, sel.value);
    recalcularSubtotal(bIdx);
  });
  recalcularTotal();
}

// Render de un bloque de comprador. `existente` puede ser un documento de CAT.entregas
// (para edición) o null (bloque nuevo vacío).
function _renderBloqueComprador(existente, todosMats) {
  const bIdx = String(COMPRADOR_IDX++);
  const idComp = existente ? (existente['ID_Comprador'] || '') : '';
  const ciRuc  = existente ? (existente['CI/RUC'] || '') : '';
  const docId  = existente ? (existente._docId || '') : '';
  const idEnt  = existente ? (existente['ID_Entrega'] || '') : '';
  const nombreExistente = existente ? (existente['_nombreComprador'] || '') : '';

  const priorizables = todosMats.filter(m => m['Priorizable']==='Sí' || m['Priorizable']===true);
  const otros        = todosMats.filter(m => !(m['Priorizable']==='Sí' || m['Priorizable']===true));

  const filaMaterial = (mat) => {
    const n    = mat['Nombre'];
    const prio = mat['Priorizable']==='Sí' || mat['Priorizable']===true;
    const kg   = existente ? (existente[n+' Kilos']||'') : '';
    const prec = existente ? (existente[n+' Precio']||'') : '';
    const vent = existente ? parseFloat(existente[n+' Valor Venta']||0) : 0;
    const mid  = n.replace(/[^a-zA-Z0-9]/g,'_');
    return `
      <div class="material-row${prio?' material-priorizable':''}">
        <div class="material-row-label">${esc(n)}${prio?` <span class="badge badge-cyan" style="font-size:9px;padding:1px 6px">Prio</span>`:''}</div>
        <input type="number" class="form-input" id="mat-kg-${bIdx}-${mid}" placeholder="Kilos" value="${kg}" min="0" step="0.01" oninput="calcularValorMaterial('${bIdx}','${mid}')">
        <input type="number" class="form-input" id="mat-precio-${bIdx}-${mid}" placeholder="$/kg" value="${prec}" min="0" step="0.01" oninput="calcularValorMaterial('${bIdx}','${mid}')">
        <div class="material-valor" id="mat-venta-${bIdx}-${mid}">${vent>0?fmtMoney(vent):'—'}</div>
      </div>`;
  };

  return `
    <div class="cmp-block" data-block-idx="${bIdx}" data-doc-id="${esc(docId)}" data-id-entrega="${esc(idEnt)}">
      <div class="cmp-block-head">
        <div class="cmp-block-num">Comprador</div>
        ${puedeEditar() ? `<button type="button" class="cmp-block-remove" title="Quitar comprador" onclick="quitarComprador('${bIdx}')">✕</button>` : ''}
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Comprador *</label>
          <select class="form-select" id="ent-comprador-${bIdx}" onchange="autocompletarCIRUC('${bIdx}', this.value)">
            <option value="">Selecciona un comprador</option>
            ${CAT.compradores.map(c=>`<option value="${esc(c['ID_Comprador'])}" ${idComp===c['ID_Comprador']?'selected':''}>${esc(c['Nombre'])}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">C.I / RUC <span style="font-weight:400;text-transform:none;color:var(--text-dim);font-size:10px">(auto)</span></label>
          <input type="text" class="form-input" id="ent-ciruc-${bIdx}" readonly value="${esc(ciRuc)}">
        </div>
      </div>
      ${priorizables.length ? `
      <div class="materiales-section">
        <div class="materiales-section-title">Materiales priorizables${nombreExistente?` — ${esc(nombreExistente)}`:''}</div>
        ${priorizables.map(filaMaterial).join('')}
      </div>` : ''}
      ${otros.length ? `
      <div class="materiales-section">
        <div class="materiales-section-title">Otros materiales</div>
        ${otros.map(filaMaterial).join('')}
      </div>` : ''}
      <div class="cmp-block-foot">
        <span class="cmp-block-sub-lbl">Subtotal:</span>
        <span class="cmp-block-sub" id="ent-subtotal-${bIdx}">$0,00</span>
      </div>
    </div>`;
}

function agregarComprador() {
  const cont = document.getElementById('cmp-container');
  if (!cont) return;
  const mats = CAT.materiales.length ? CAT.materiales : [
    { Nombre: 'PET', Priorizable: true },
    { Nombre: 'Plástico Suave', Priorizable: true },
    { Nombre: 'Plástico Duro', Priorizable: true },
    { Nombre: 'Cartón' },
    { Nombre: 'Vidrio' },
    { Nombre: 'Lata Aluminio' },
  ];
  cont.insertAdjacentHTML('beforeend', _renderBloqueComprador(null, mats));
  recalcularTotal();
  // Scroll al nuevo bloque
  const nuevos = cont.querySelectorAll('.cmp-block');
  if (nuevos.length) nuevos[nuevos.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function quitarComprador(bIdx) {
  const bloques = document.querySelectorAll('#cmp-container .cmp-block');
  if (bloques.length <= 1) { showToast('Debe haber al menos un comprador'); return; }
  const bl = document.querySelector(`#cmp-container .cmp-block[data-block-idx="${bIdx}"]`);
  if (bl) { bl.remove(); recalcularTotal(); }
}

function autocompletarProvincia(idAsoc) {
  const inp = document.getElementById('ent-provincia');
  if (!inp) return;
  const a = CAT.asociaciones.find(x => x['ID_Asociacion'] === idAsoc);
  inp.value = a ? (a['Provincia']||'') : '';
}

// El Acta de Validación (PDF) solo aplica a asociaciones en categoría
// "En Acompañamiento" o "En Fortalecimiento" (categoría calculada por el
// módulo Asociativo a partir de su diagnóstico más reciente).
function actualizarVisibilidadActaPdf(idAsoc) {
  const wrap = document.getElementById('ent-acta-pdf-wrap');
  if (!wrap) return;
  const cat = categoriaVigente(idAsoc);
  wrap.style.display = (cat === 'En Acompañamiento' || cat === 'En Fortalecimiento') ? '' : 'none';
}

// El campo N° Voucher/Factura/Otros y el botón del Comprobante de Acopio
// Comunitario (CAC) solo aplican a asociaciones "Líderes de ReCircula" (las
// más formalizadas, que emiten su propio comprobante de venta).
function actualizarVisibilidadLideres(idAsoc) {
  const esLideres = categoriaVigente(idAsoc) === 'Líderes de ReCircula';
  const wrapVoucher = document.getElementById('ent-voucher-wrap');
  if (wrapVoucher) wrapVoucher.style.display = esLideres ? '' : 'none';
  const wrapCac = document.getElementById('ent-cac-pdf-wrap');
  if (wrapCac) wrapCac.style.display = esLideres ? '' : 'none';
}

function autocompletarCIRUC(bIdx, idComp) {
  const inp = document.getElementById('ent-ciruc-' + bIdx);
  if (!inp) return;
  const c = CAT.compradores.find(x => x['ID_Comprador'] === idComp);
  inp.value = c ? (c['CI/RUC'] || '') : '';
}

function calcularValorMaterial(bIdx, mid) {
  const kg = parseFloat(document.getElementById(`mat-kg-${bIdx}-${mid}`)?.value || 0);
  const pr = parseFloat(document.getElementById(`mat-precio-${bIdx}-${mid}`)?.value || 0);
  const v  = kg * pr;
  const vEl = document.getElementById(`mat-venta-${bIdx}-${mid}`);
  if (vEl) vEl.textContent = v > 0 ? fmtMoney(v) : '—';
  recalcularSubtotal(bIdx);
  recalcularTotal();
}

// Valor (kg × precio) de un material leído directamente de sus inputs, sin redondear.
function _ventaMaterialInput(bIdx, mid) {
  const kg = parseFloat(document.getElementById(`mat-kg-${bIdx}-${mid}`)?.value) || 0;
  const pr = parseFloat(document.getElementById(`mat-precio-${bIdx}-${mid}`)?.value) || 0;
  return kg * pr;
}

function recalcularSubtotal(bIdx) {
  let sub = 0;
  document.querySelectorAll(`[id^="mat-kg-${bIdx}-"]`).forEach(inp => {
    const mid = inp.id.split('-').slice(3).join('-');   // mat-kg-{bIdx}-{mid...}
    sub += _ventaMaterialInput(bIdx, mid);
  });
  const el = document.getElementById('ent-subtotal-' + bIdx);
  if (el) el.textContent = fmtMoney(sub);
}

function recalcularTotal() {
  let total = 0;
  document.querySelectorAll('#cmp-container [id^="mat-kg-"]').forEach(inp => {
    const partes = inp.id.split('-');                   // ['mat','kg',bIdx,...mid]
    const bIdx = partes[2];
    const mid  = partes.slice(3).join('-');
    total += _ventaMaterialInput(bIdx, mid);
  });
  const totEl = document.getElementById('ent-total');
  if (totEl) totEl.textContent = fmtMoney(total);
}

// ============================================================
// GUARDAR (Firestore) — multi-comprador
// ============================================================

async function guardarEntrega(idPrimario) {
  const fecha       = document.getElementById('ent-fecha').value;
  const anio        = document.getElementById('ent-anio').value;
  const mes         = document.getElementById('ent-mes').value;
  const idAsoc      = document.getElementById('ent-asociacion').value;
  const provincia   = document.getElementById('ent-provincia').value;
  const actividad   = Array.from(document.querySelectorAll('#ent-actividad-checks input:checked')).map(cb => cb.value);
  const voucher     = document.getElementById('ent-voucher')?.value?.trim() || '';
  const obs         = document.getElementById('ent-obs').value;

  if (!anio || !mes)  { showToast('Año y mes son obligatorios'); return; }
  if (!idAsoc)        { showToast('Selecciona una asociación'); return; }

  // Recolectar bloques del DOM
  const bloques = [];
  document.querySelectorAll('#cmp-container .cmp-block').forEach(bl => {
    const bIdx  = bl.getAttribute('data-block-idx');
    const docId = bl.getAttribute('data-doc-id') || '';
    const idEnt = bl.getAttribute('data-id-entrega') || '';
    const idComp = document.getElementById('ent-comprador-' + bIdx)?.value || '';
    const ciRuc  = document.getElementById('ent-ciruc-' + bIdx)?.value || '';
    const mats = [];
    document.querySelectorAll(`[id^="mat-kg-${bIdx}-"]`).forEach(inp => {
      const partes = inp.id.split('-'); // mat-kg-{bIdx}-{mid...}
      const mid = partes.slice(3).join('-');
      const kg = parseFloat(inp.value || 0);
      const precio = parseFloat(document.getElementById(`mat-precio-${bIdx}-${mid}`)?.value || 0);
      if (kg > 0) {
        const matReal = (CAT.materiales || []).find(m => m['Nombre'].replace(/[^a-zA-Z0-9]/g,'_') === mid);
        const nombreReal = matReal ? matReal['Nombre'] : mid.replace(/_/g,' ');
        mats.push({ nombre: nombreReal, kg: kg, precio: precio, venta: kg * precio });
      }
    });
    bloques.push({ bIdx, docId, idEnt, idComp, ciRuc, mats });
  });

  if (!bloques.length)   { showToast('Debe haber al menos un comprador'); return; }
  for (const b of bloques) {
    if (!b.idComp) { showToast('Todos los bloques deben tener un comprador seleccionado'); return; }
  }

  const btn = document.getElementById('btn-guardar-entrega');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    // ── Identificador del grupo (reusar el existente o generar uno nuevo) ──
    let groupId = '';
    for (const s of EDITING_SIBLINGS) { if (s['ID_Grupo_Entrega']) { groupId = s['ID_Grupo_Entrega']; break; } }
    if (!groupId) groupId = 'GRP_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    // ── Verificables: subir PDFs UNA sola vez, compartir referencias entre hermanos ──
    let carpetaCompartida = document.getElementById('ent-carpeta-compartida')?.value || '';
    const evidenciaMerged = Object.assign({}, (ENT_EVIDENCIA_FORM && ENT_EVIDENCIA_FORM.docs) || {});
    const aEliminar = (ENT_EVIDENCIA_FORM && ENT_EVIDENCIA_FORM.eliminar) || [];

    const nuevos = ENT_DOCS.map(d => {
      const el = document.getElementById('ent-doc-' + d.key);
      const f = el && el.files && el.files[0] ? el.files[0] : null;
      return f ? { key: d.key, file: d.file, archivo: f } : null;
    }).filter(Boolean);

    const noPdf = nuevos.find(n => n.archivo.type !== 'application/pdf' && !/\.pdf$/i.test(n.archivo.name));
    if (noPdf) { showToast('Solo se permiten archivos PDF'); if (btn) { btn.disabled = false; btn.textContent = idPrimario ? 'Actualizar' : 'Guardar entrega'; } return; }

    if (nuevos.length || aEliminar.length) {
      const tok = driveToken();
      if (!tok) {
        showToast('Sesión de Drive expirada: la entrega se guarda sin cambios en los PDFs');
      } else {
        if (nuevos.length) {
          if (!carpetaCompartida) {
            const tmp = { ID_Asociacion: idAsoc, Mes: mes, 'Año': anio, ID_Carpeta_Evidencia: '' };
            await asegurarCarpetaEntrega(tmp);
            carpetaCompartida = tmp['ID_Carpeta_Evidencia'] || '';
          }
          if (!carpetaCompartida) {
            showToast('No se pudo preparar la carpeta: la entrega se guarda sin los PDFs nuevos');
          } else {
            for (let i = 0; i < nuevos.length; i++) {
              const n = nuevos[i];
              if (btn) btn.textContent = `Subiendo ${i + 1}/${nuevos.length}…`;
              try {
                const fname = `${n.file}_${mes}${anio}.pdf`;
                const up = await driveSubirArchivo(n.archivo, fname, carpetaCompartida, tok);
                evidenciaMerged[n.key] = { id: up.id, url: up.webViewLink, nombre: fname };
              } catch (err) { console.warn('Subida verificable:', err); showToast('No se pudo subir ' + n.file); }
            }
          }
        }
        for (const idDrive of aEliminar) {
          try { await driveEliminarCarpeta(idDrive, tok); } catch (err) { console.warn('Papelera verificable:', err); }
        }
      }
    }

    // ── Guardar cada bloque como su propio documento (siblings del grupo) ──
    if (btn) btn.textContent = 'Guardando…';
    const idsProcesados = new Set();
    let ok = true;

    for (const b of bloques) {
      let total = 0;
      const data = {
        ID_Entrega:             b.idEnt || '',
        'ID_Grupo_Entrega':     groupId,
        Fecha:                  fecha,
        'Año':                  anio,
        Mes:                    mes,
        ID_Asociacion:          idAsoc,
        Provincia:              provincia,
        ID_Comprador:           b.idComp,
        'CI/RUC':               b.ciRuc,
        'Actividad Fuente':     actividad,
        Voucher:                voucher,
        Observaciones:          obs,
        'ID_Carpeta_Evidencia': carpetaCompartida,
        'Documentos':           Object.assign({}, evidenciaMerged),
      };
      b.mats.forEach(m => {
        data[m.nombre + ' Kilos']       = m.kg;
        data[m.nombre + ' Precio']      = m.precio;
        data[m.nombre + ' Valor Venta'] = m.venta;
        total += m.venta;
      });
      data['Valor Total'] = total;

      const res = await guardarEntregaFS(b.docId || null, data);
      if (!res.ok) { ok = false; showToast('Error al guardar un bloque: ' + (res.error || '')); }
      if (b.docId) idsProcesados.add(b.docId);
    }

    // ── Eliminar hermanos que ya no están en el formulario ──
    for (const s of EDITING_SIBLINGS) {
      if (s._docId && !idsProcesados.has(s._docId)) {
        try { await eliminarEntregaFS(s._docId); } catch (err) { console.warn('No se pudo eliminar hermano:', err); }
      }
    }

    if (ok) showToast(idPrimario ? 'Entrega actualizada ✓' : 'Entrega creada ✓');
    cerrarModal();
    renderVistaEntregas();
  } catch (e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = idPrimario ? 'Actualizar' : 'Guardar entrega'; }
  }
}

// ============================================================
// ACTA DE VALIDACIÓN (PDF) — solo Acompañamiento / Fortalecimiento
// Se genera desde los datos YA escritos en el formulario (antes de guardar),
// para que la asociación la imprima, la firme y suba el PDF firmado como Verificable.
// ============================================================

const ACTA_NAVY     = [13, 42, 84];
const ACTA_BORDE     = [214, 219, 227];
const ACTA_TOTAL_BG  = [205, 226, 247];
const ACTA_MARGEN    = 70; // ~2.5cm, A4
// Acentos del Comprobante de Acopio Comunitario (Líderes de ReCircula)
const CAC_VERDE_CONSOLIDADO   = [91, 189, 112];  // #5bbd70 — Resumen consolidado
const CAC_CELESTE_COMPROBANTES = [134, 210, 218]; // #86d2da — Comprobantes emitidos

let _ACTA_LOGO_DATAURL = null;
let _ACTA_FONTS_CACHE  = null;

function _arrayBufferABase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Descarga las tipografías Outfit (Regular/Bold) para incrustarlas en el PDF —
// jsPDF solo trae Helvetica/Times/Courier por defecto. Se cachea en memoria.
async function _outfitFontsBase64() {
  if (_ACTA_FONTS_CACHE) return _ACTA_FONTS_CACHE;
  const [rBuf, bBuf] = await Promise.all([
    fetch('assets/fonts/Outfit-Regular.ttf').then(r => r.arrayBuffer()),
    fetch('assets/fonts/Outfit-Bold.ttf').then(r => r.arrayBuffer()),
  ]);
  _ACTA_FONTS_CACHE = { regular: _arrayBufferABase64(rBuf), bold: _arrayBufferABase64(bBuf) };
  return _ACTA_FONTS_CACHE;
}

// Registra Outfit en el documento jsPDF (debe llamarse una vez por doc, antes de dibujar).
function _registrarFuenteActa(doc, fonts) {
  doc.addFileToVFS('Outfit-Regular.ttf', fonts.regular);
  doc.addFont('Outfit-Regular.ttf', 'Outfit', 'normal');
  doc.addFileToVFS('Outfit-Bold.ttf', fonts.bold);
  doc.addFont('Outfit-Bold.ttf', 'Outfit', 'bold');
  doc.setFont('Outfit', 'normal');
}

// Rasteriza el logo (SVG con ícono + texto vectorizado) a PNG en un canvas
// oculto, porque jsPDF no soporta trazos SVG directamente. Se cachea en memoria.
async function _logoActaDataURL() {
  if (_ACTA_LOGO_DATAURL) return _ACTA_LOGO_DATAURL;
  const resp = await fetch('assets/logo-recircula.svg');
  const svgText = await resp.text();
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    const escala = 3; // nitidez para impresión
    const w = (img.naturalWidth || 454.73) * escala;
    const h = (img.naturalHeight || 148.32) * escala;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    _ACTA_LOGO_DATAURL = canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
  return _ACTA_LOGO_DATAURL;
}

function _fechaDDMMYYYY(d) {
  const dt = d || new Date();
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

// Lee del DOM los bloques de comprador ya llenados en el formulario (mismo
// criterio que guardarEntrega: solo materiales con kg > 0), sin escribir nada.
// Compartido por el Acta de Validación y el Comprobante de Acopio Comunitario.
function _recolectarBloquesPDF() {
  const bloques = [];
  document.querySelectorAll('#cmp-container .cmp-block').forEach(bl => {
    const bIdx = bl.getAttribute('data-block-idx');
    const idComp = document.getElementById('ent-comprador-' + bIdx)?.value || '';
    if (!idComp) return;
    const nombreComprador = (CAT.compradores.find(c => c['ID_Comprador'] === idComp) || {})['Nombre'] || '';
    const ciRuc = document.getElementById('ent-ciruc-' + bIdx)?.value || '';
    const mats = [];
    document.querySelectorAll(`[id^="mat-kg-${bIdx}-"]`).forEach(inp => {
      const mid = inp.id.split('-').slice(3).join('-');
      const kg = parseFloat(inp.value || 0) || 0;
      if (kg <= 0) return;
      const precio = parseFloat(document.getElementById(`mat-precio-${bIdx}-${mid}`)?.value || 0) || 0;
      const matReal = (CAT.materiales || []).find(m => m['Nombre'].replace(/[^a-zA-Z0-9]/g, '_') === mid);
      const nombreMat = matReal ? matReal['Nombre'] : mid.replace(/_/g, ' ');
      mats.push({ nombre: nombreMat, kg, precio, venta: kg * precio });
    });
    if (mats.length) bloques.push({ nombreComprador, ciRuc, mats });
  });
  return bloques;
}

// Línea con tramos en negrita/normal, alineada a la derecha en rightX.
function _pdfLineaMixta(doc, runs, rightX, y, size) {
  doc.setFontSize(size);
  let total = 0;
  runs.forEach(r => { doc.setFont('Outfit', r.bold ? 'bold' : 'normal'); total += doc.getTextWidth(r.text); });
  let cx = rightX - total;
  runs.forEach(r => { doc.setFont('Outfit', r.bold ? 'bold' : 'normal'); doc.text(r.text, cx, y); cx += doc.getTextWidth(r.text); });
}

// Líneas envueltas del valor de una celda info, al ancho disponible real de esa celda.
function _pdfLineasCeldaInfo(doc, valor, w, labelW) {
  doc.setFont('Outfit', 'normal'); doc.setFontSize(10);
  const maxW = w - 12 - labelW - 10;
  return doc.splitTextToSize(String(valor == null || valor === '' ? '—' : valor), maxW);
}

// Altura que necesita una celda info según cuántas líneas requiera su valor —
// para que el cuadro sea dinámico y no corte textos largos (ej. nombres de asociación).
function _pdfAlturaCeldaInfo(doc, valor, w, labelW, alturaMin) {
  const lineas = _pdfLineasCeldaInfo(doc, valor, w, labelW);
  return Math.max(alturaMin || 38, 22 + lineas.length * 13);
}

// Celda bordeada "Etiqueta: Valor" (grilla Periodo/Asociación/Fecha/Provincia).
// `h` debe venir ya calculado con _pdfAlturaCeldaInfo (para que ambas celdas de la fila midan igual).
function _pdfCeldaInfo(doc, x, y, w, h, label, valor, labelW) {
  doc.setDrawColor.apply(doc, ACTA_BORDE); doc.setLineWidth(0.75);
  doc.rect(x, y, w, h);
  doc.setFont('Outfit', 'bold'); doc.setFontSize(9.5); doc.setTextColor(50, 52, 58);
  doc.text(label, x + 12, y + h / 2 + 3.5);
  const lineas = _pdfLineasCeldaInfo(doc, valor, w, labelW);
  doc.setFont('Outfit', 'normal'); doc.setFontSize(10); doc.setTextColor(20, 20, 25);
  const lineH = 13;
  let cy = y + h / 2 - ((lineas.length - 1) * lineH) / 2 + 3.5;
  lineas.forEach(linea => { doc.text(linea, x + 12 + labelW, cy); cy += lineH; });
}

// Fila con fondo de color (navy o verde según la plantilla) y texto blanco
// centrado por columna (encabezados de tabla, ej. MATERIAL/PRECIO/KG/VALOR).
function _pdfFilaAcento(doc, x, y, cols, alturaFila, color) {
  doc.setFillColor.apply(doc, color || ACTA_NAVY);
  const anchoTotal = cols.reduce((s, c) => s + c.ancho, 0);
  doc.rect(x, y, anchoTotal, alturaFila, 'F');
  let cx = x;
  cols.forEach(c => {
    doc.setFont('Outfit', c.bold ? 'bold' : 'normal');
    doc.setFontSize(c.tamano || 9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(String(c.texto || ''), cx + c.ancho / 2, y + alturaFila / 2 + 3.5, { align: 'center' });
    cx += c.ancho;
  });
}

// Altura que necesita la fila Comprador/CI-RUC según el texto más largo de sus
// celdas de valor (nombre de comprador, C.I./RUC) — cuadro dinámico, no fijo.
function _pdfAlturaFilaComprador(doc, cols, alturaMin) {
  let maxLineas = 1;
  cols.forEach(c => {
    if (!c.esLabel) {
      doc.setFont('Outfit', 'normal'); doc.setFontSize(10);
      const lineas = doc.splitTextToSize(String(c.texto || '—'), c.ancho - 16);
      if (lineas.length > maxLineas) maxLineas = lineas.length;
    }
  });
  return Math.max(alturaMin || 26, 12 + maxLineas * 13);
}

// Fila "COMPRADOR | nombre | CÉDULA/RUC | valor": las celdas de etiqueta van en
// color de acento (navy o verde) con texto blanco; las celdas de valor (el
// "cuadro de llenado") van en blanco con borde, como un campo de formulario.
// `alturaFila` debe venir ya calculada con _pdfAlturaFilaComprador para que el
// cuadro crezca si el texto es largo.
function _pdfFilaComprador(doc, x, y, cols, alturaFila, color) {
  let cx = x;
  const lineH = 13;
  cols.forEach(c => {
    if (c.esLabel) {
      doc.setFillColor.apply(doc, color || ACTA_NAVY);
      doc.rect(cx, y, c.ancho, alturaFila, 'F');
      doc.setFont('Outfit', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
      doc.text(String(c.texto || ''), cx + c.ancho / 2, y + alturaFila / 2 + 3.5, { align: 'center' });
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(cx, y, c.ancho, alturaFila, 'F');
      doc.setDrawColor.apply(doc, ACTA_BORDE); doc.setLineWidth(0.75);
      doc.rect(cx, y, c.ancho, alturaFila);
      doc.setFont('Outfit', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 32, 38);
      const lineas = doc.splitTextToSize(String(c.texto || '—'), c.ancho - 16);
      let cy = y + alturaFila / 2 - ((lineas.length - 1) * lineH) / 2 + 3.5;
      lineas.forEach(linea => { doc.text(linea, cx + c.ancho / 2, cy, { align: 'center' }); cy += lineH; });
    }
    cx += c.ancho;
  });
}

// Fila de datos con texto centrado por columna y línea divisoria inferior.
function _pdfFilaDatos(doc, x, y, cols, alturaFila) {
  doc.setDrawColor.apply(doc, ACTA_BORDE); doc.setLineWidth(0.6);
  doc.line(x, y + alturaFila, x + cols.reduce((s, c) => s + c.ancho, 0), y + alturaFila);
  let cx = x;
  cols.forEach(c => {
    doc.setFont('Outfit', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 32, 38);
    doc.text(String(c.texto || ''), cx + c.ancho / 2, y + alturaFila / 2 + 3.5, { align: 'center' });
    cx += c.ancho;
  });
}

// Fila "N° VOUCHER / FACTURA / OTROS": celda de etiqueta en color de acento,
// y los números repartidos en columnas iguales a su derecha (sin borde, texto simple).
// `labelLineas` es un array de líneas ya partidas (no depende de splitTextToSize/\n).
function _pdfFilaVouchers(doc, x, y, contentW, labelLineas, valores, color, alturaFila) {
  const labelW = contentW * 0.24;
  doc.setFillColor.apply(doc, color);
  doc.rect(x, y, labelW, alturaFila, 'F');
  doc.setFont('Outfit', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
  let cyL = y + alturaFila / 2 - ((labelLineas.length - 1) * 12) / 2 + 3.5;
  labelLineas.forEach(l => { doc.text(l, x + labelW / 2, cyL, { align: 'center' }); cyL += 12; });

  const restoW = contentW - labelW;
  const lista = (valores && valores.length) ? valores : ['—'];
  const colW = restoW / lista.length;
  doc.setFont('Outfit', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 32, 38);
  lista.forEach((v, i) => {
    doc.text(v, x + labelW + colW * i + colW / 2, y + alturaFila / 2 + 3.5, { align: 'center' });
  });
}

// Altura necesaria para la fila de vouchers, según cuántas líneas tenga la etiqueta.
function _pdfAlturaFilaVouchers(labelLineas, alturaMin) {
  return Math.max(alturaMin || 30, 12 + labelLineas.length * 12);
}

// Grilla Periodo/Asociación/Fecha de emisión/Provincia — compartida por el Acta
// de Validación y el Comprobante de Acopio Comunitario. Devuelve el nuevo y.
function _dibujarInfoGridActa(doc, M, y, contentW, cab) {
  const halfW = contentW / 2;

  const alturaPeriodo = Math.max(
    _pdfAlturaCeldaInfo(doc, `${cab.mes} ${cab.anio}`, halfW, 108, 38),
    _pdfAlturaCeldaInfo(doc, cab.asociacion, halfW, 68, 38)
  );
  _pdfCeldaInfo(doc, M, y, halfW, alturaPeriodo, 'Periodo (mes/año):', `${cab.mes} ${cab.anio}`, 108);
  _pdfCeldaInfo(doc, M + halfW, y, halfW, alturaPeriodo, 'Asociación:', cab.asociacion, 68);
  y += alturaPeriodo;

  const alturaFecha = Math.max(
    _pdfAlturaCeldaInfo(doc, _fechaDDMMYYYY(new Date()), halfW, 108, 38),
    _pdfAlturaCeldaInfo(doc, cab.provincia, halfW, 68, 38)
  );
  _pdfCeldaInfo(doc, M, y, halfW, alturaFecha, 'Fecha de emisión:', _fechaDDMMYYYY(new Date()), 108);
  _pdfCeldaInfo(doc, M + halfW, y, halfW, alturaFecha, 'Provincia:', cab.provincia, 68);
  return y + alturaFecha + 28;
}

// Tabla "Resumen de consolidado" de un comprador (Comprador/CI-RUC + materiales + total).
// Devuelve el nuevo y. Lanza salto de página si el bloque no cabe en lo que queda.
function _dibujarTablaConsolidado(doc, M, y, H, contentW, colW, b, colorAcento) {
  const colsComprador = [
    { texto: 'COMPRADOR', ancho: contentW * 0.18, esLabel: true },
    { texto: b.nombreComprador || '—', ancho: contentW * 0.42 },
    { texto: 'CÉDULA/RUC', ancho: contentW * 0.18, esLabel: true },
    { texto: b.ciRuc || '—', ancho: contentW * 0.22 },
  ];
  const alturaComprador = _pdfAlturaFilaComprador(doc, colsComprador, 26);
  const altoEstimado = alturaComprador + 24 + (b.mats.length) * 24 + 28 + 26;
  if (y + altoEstimado > H - M) { doc.addPage(); y = M; }

  _pdfFilaComprador(doc, M, y, colsComprador, alturaComprador, colorAcento);
  y += alturaComprador;

  _pdfFilaAcento(doc, M, y, [
    { texto: 'MATERIAL', ancho: colW[0], bold: true },
    { texto: 'PRECIO POR KG', ancho: colW[1], bold: true },
    { texto: 'KG TOTALES', ancho: colW[2], bold: true },
    { texto: 'VALOR TOTAL (USD)', ancho: colW[3], bold: true },
  ], 24, colorAcento);
  y += 24;

  let sumKg = 0, sumValor = 0;
  b.mats.forEach(m => {
    sumKg += m.kg; sumValor += m.venta;
    _pdfFilaDatos(doc, M, y, [
      { texto: m.nombre, ancho: colW[0] },
      { texto: '$' + fmtNum(m.precio, 2), ancho: colW[1] },
      { texto: fmtNum(m.kg), ancho: colW[2] },
      { texto: fmtMoney(m.venta), ancho: colW[3] },
    ], 24);
    y += 24;
  });

  doc.setFillColor.apply(doc, ACTA_TOTAL_BG);
  doc.rect(M, y, contentW, 28, 'F');
  doc.setFont('Outfit', 'bold'); doc.setFontSize(10.5); doc.setTextColor(20, 20, 25);
  doc.text('TOTAL:', M + colW[0] + colW[1] - 12, y + 18, { align: 'right' });
  doc.text(fmtNum(sumKg), M + colW[0] + colW[1] + colW[2] / 2, y + 18, { align: 'center' });
  doc.text(fmtMoney(sumValor), M + colW[0] + colW[1] + colW[2] + colW[3] / 2, y + 18, { align: 'center' });
  return y + 28 + 26;
}

function _construirActaPDF(doc, logoDataUrl, cab, bloques) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = ACTA_MARGEN;
  const contentW = W - M * 2;
  let y = M;

  if (logoDataUrl) {
    const logoW = 118, logoH = logoW * (148.32 / 454.73);
    try { doc.addImage(logoDataUrl, 'PNG', M, y, logoW, logoH); } catch (e) {}
  }
  doc.setTextColor.apply(doc, ACTA_NAVY);
  _pdfLineaMixta(doc, [{ text: 'Acta de Validación', bold: true }, { text: ' de ', bold: false }, { text: 'Recuperación', bold: true }], W - M, y + 20, 15);
  _pdfLineaMixta(doc, [{ text: 'y ', bold: false }, { text: 'Comercialización de Material', bold: true }], W - M, y + 40, 15);
  y += 66;

  y = _dibujarInfoGridActa(doc, M, y, contentW, cab);

  // "Resumen de consolidado" se imprime UNA sola vez; cada comprador solo agrega su propia tabla debajo.
  doc.setFont('Outfit', 'bold'); doc.setFontSize(13); doc.setTextColor.apply(doc, ACTA_NAVY);
  doc.text('Resumen de consolidado', M, y); y += 20;

  const colW = [contentW * 0.30, contentW * 0.22, contentW * 0.22, contentW * 0.26];
  bloques.forEach(b => {
    y = _dibujarTablaConsolidado(doc, M, y, H, contentW, colW, b, ACTA_NAVY);
  });
}

function _construirComprobanteCAC(doc, logoDataUrl, cab, bloques, vouchers) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = ACTA_MARGEN;
  const contentW = W - M * 2;
  let y = M;

  if (logoDataUrl) {
    const logoW = 118, logoH = logoW * (148.32 / 454.73);
    try { doc.addImage(logoDataUrl, 'PNG', M, y, logoW, logoH); } catch (e) {}
  }
  doc.setTextColor.apply(doc, ACTA_NAVY);
  _pdfLineaMixta(doc, [{ text: 'Comprobante', bold: true }, { text: ' de', bold: false }], W - M, y + 20, 15);
  _pdfLineaMixta(doc, [{ text: 'Acopio Comunitario (CAC)', bold: true }], W - M, y + 40, 15);
  y += 66;

  y = _dibujarInfoGridActa(doc, M, y, contentW, cab);

  doc.setFont('Outfit', 'bold'); doc.setFontSize(13); doc.setTextColor.apply(doc, CAC_VERDE_CONSOLIDADO);
  doc.text('RESUMEN CONSOLIDADO', M, y); y += 20;

  const colW = [contentW * 0.30, contentW * 0.22, contentW * 0.22, contentW * 0.26];
  bloques.forEach(b => {
    y = _dibujarTablaConsolidado(doc, M, y, H, contentW, colW, b, CAC_VERDE_CONSOLIDADO);
  });

  // Comprobantes emitidos (N° Voucher/Factura/Otros) — exclusivo de este comprobante.
  const labelVoucherLineas = ['N° VOUCHER /', 'FACTURA / OTROS'];
  const alturaVoucher = _pdfAlturaFilaVouchers(labelVoucherLineas, 30);
  if (y + 20 + alturaVoucher > H - M) { doc.addPage(); y = M; }

  doc.setFont('Outfit', 'bold'); doc.setFontSize(13); doc.setTextColor.apply(doc, CAC_CELESTE_COMPROBANTES);
  doc.text('COMPROBANTES EMITIDOS', M, y); y += 20;
  _pdfFilaVouchers(doc, M, y, contentW, labelVoucherLineas, vouchers, CAC_CELESTE_COMPROBANTES, alturaVoucher);
}

async function descargarActaPDF() {
  const idAsoc    = document.getElementById('ent-asociacion')?.value || '';
  const asoc      = CAT.asociaciones.find(a => a['ID_Asociacion'] === idAsoc);
  const anio      = document.getElementById('ent-anio')?.value || '';
  const mes       = document.getElementById('ent-mes')?.value || '';
  const provincia = document.getElementById('ent-provincia')?.value || '';

  if (!asoc)          { showToast('Selecciona una asociación'); return; }
  if (!anio || !mes)  { showToast('Año y mes son obligatorios'); return; }
  const bloques = _recolectarBloquesPDF();
  if (!bloques.length) { showToast('Agrega al menos un comprador con materiales antes de descargar el acta'); return; }

  const btn = document.getElementById('btn-acta-pdf');
  const lbl = document.getElementById('btn-acta-pdf-label');
  if (btn) btn.disabled = true;
  if (lbl) lbl.textContent = 'Generando PDF…';

  try {
    await cargarJsPDF();
    const [logo, fonts] = await Promise.all([
      _logoActaDataURL().catch(() => null),
      _outfitFontsBase64(),
    ]);
    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    _registrarFuenteActa(doc, fonts);
    _construirActaPDF(doc, logo, {
      asociacion: asoc['Nombre'] || '',
      provincia: provincia || asoc['Provincia'] || '',
      mes, anio,
    }, bloques);
    const nomArch = (asoc['Nombre'] || 'Acta').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    doc.save(`Acta_${nomArch}_${mes}${anio}.pdf`);
  } catch (e) {
    console.error(e);
    showToast('Error al generar el PDF');
  } finally {
    if (btn) btn.disabled = false;
    if (lbl) lbl.textContent = 'Descargar Acta de Validación (PDF)';
  }
}

// Comprobante de Acopio Comunitario (CAC) — exclusivo de asociaciones "Líderes de ReCircula".
async function descargarComprobanteCAC() {
  const idAsoc    = document.getElementById('ent-asociacion')?.value || '';
  const asoc      = CAT.asociaciones.find(a => a['ID_Asociacion'] === idAsoc);
  const anio      = document.getElementById('ent-anio')?.value || '';
  const mes       = document.getElementById('ent-mes')?.value || '';
  const provincia = document.getElementById('ent-provincia')?.value || '';

  if (!asoc)          { showToast('Selecciona una asociación'); return; }
  if (!anio || !mes)  { showToast('Año y mes son obligatorios'); return; }
  const bloques = _recolectarBloquesPDF();
  if (!bloques.length) { showToast('Agrega al menos un comprador con materiales antes de descargar el comprobante'); return; }

  const vouchers = (document.getElementById('ent-voucher')?.value || '')
    .split(',').map(v => v.trim()).filter(Boolean);

  const btn = document.getElementById('btn-cac-pdf');
  const lbl = document.getElementById('btn-cac-pdf-label');
  if (btn) btn.disabled = true;
  if (lbl) lbl.textContent = 'Generando PDF…';

  try {
    await cargarJsPDF();
    const [logo, fonts] = await Promise.all([
      _logoActaDataURL().catch(() => null),
      _outfitFontsBase64(),
    ]);
    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    _registrarFuenteActa(doc, fonts);
    _construirComprobanteCAC(doc, logo, {
      asociacion: asoc['Nombre'] || '',
      provincia: provincia || asoc['Provincia'] || '',
      mes, anio,
    }, bloques, vouchers);
    const nomArch = (asoc['Nombre'] || 'Comprobante').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    doc.save(`Comprobante_CAC_${nomArch}_${mes}${anio}.pdf`);
  } catch (e) {
    console.error(e);
    showToast('Error al generar el PDF');
  } finally {
    if (btn) btn.disabled = false;
    if (lbl) lbl.textContent = 'Descargar Comprobante de Acopio Comunitario (PDF)';
  }
}

// ============================================================
// EXPORTAR A EXCEL (respeta los filtros aplicados)
// ============================================================

async function exportarEntregasExcel(dataset) {
  const datos = dataset || ENTREGAS_DATA;
  if (!datos || !datos.length) {
    showToast('No hay datos para exportar.');
    return;
  }
  try {
    await cargarSheetJS();

    const mats = (CAT.materiales || []);

    const header = ['Fecha','Año','Mes','Asociación','Provincia','Comprador','C.I / RUC','Actividad fuente'];
    mats.forEach(m => { header.push(m['Nombre'] + ' Kilos', m['Nombre'] + ' Precio', m['Nombre'] + ' Valor'); });
    header.push('Valor Total','N° Voucher / Factura / Otros','Observaciones');

    const filas = datos.map(e => {
      const r = [
        e['Fecha'] || '',
        e['Año'] || '',
        e['Mes'] || '',
        e['_nombreAsociacion'] || '',
        e['Provincia'] || e['_provinciaAsociacion'] || '',
        e['_nombreComprador'] || '',
        e['CI/RUC'] || e['_ciRucComprador'] || '',
        _actividadesArray(e['Actividad Fuente']).join(', '),
      ];
      mats.forEach(m => {
        const n = m['Nombre'];
        r.push(
          parseFloat(e[n + ' Kilos'])       || 0,
          parseFloat(e[n + ' Precio'])      || 0,
          parseFloat(e[n + ' Valor Venta']) || 0
        );
      });
      r.push(parseFloat(e['Valor Total']) || 0, e['Voucher'] || '', e['Observaciones'] || '');
      return r;
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...filas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Entregas');
    const fecha = new Date().toISOString().substring(0, 10);
    XLSX.writeFile(wb, `Entregas_${fecha}.xlsx`);
    showToast(`${datos.length} entrega${datos.length !== 1 ? 's' : ''} exportada${datos.length !== 1 ? 's' : ''} ✓`);
  } catch (e) {
    console.error(e);
    showToast('Error al exportar el Excel');
  }
}

// Descargar TODA la matriz (Nivel 1)
function exportarMatrizEntregas() {
  const todas = (CAT.entregas || []).slice().sort((a, b) => _periodoOrden(b) - _periodoOrden(a));
  if (!todas.length) { showToast('No hay entregas para exportar.'); return; }
  exportarEntregasExcel(todas);
}

// ── Estilos propios de Entregas (tarjetas-resumen, verificables) ──
(function () {
  if (document.getElementById('entregas-styles')) return;
  const s = document.createElement('style');
  s.id = 'entregas-styles';
  s.textContent = `
    /* Tarjetas-fila de entregas */
    .ent-cards { display:flex; flex-direction:column; gap:14px; }
    .ent-card { display:flex; align-items:center; gap:20px; background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:16px 20px; cursor:pointer; transition:box-shadow .15s,transform .12s,border-color .15s; }
    .ent-card:hover { box-shadow:0 6px 20px rgba(0,0,0,.08); transform:translateY(-2px); border-color:transparent; }

    .ent-c-per { display:flex; align-items:center; gap:11px; width:150px; flex-shrink:0; }
    .ent-cal { width:40px; height:40px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .ent-cal svg { width:20px; height:20px; }
    .ent-cal-txt { font-size:13px; font-weight:700; color:var(--text); line-height:1.3; }

    .ent-c-mats { display:flex; flex-wrap:wrap; align-items:center; gap:8px 16px; flex:1; min-width:0; }
    .ent-mat-chip { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; white-space:nowrap; }
    .ent-mat-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .ent-mat-nom { font-size:10.5px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; }
    .ent-mat-chip strong { font-size:13px; font-weight:800; color:var(--text); }

    .ent-c-val { width:100px; flex-shrink:0; text-align:right; font-size:15px; font-weight:800; color:#0a9e83; }
    .ent-c-acts { flex-shrink:0; display:flex; gap:6px; }

    /* ── Nivel 1: provincias (grid de tarjetas) + asociaciones ── */
    .ent-provs { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; align-items:start; }
    .ent-prov-grupo { background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:16px 18px; }
    .ent-prov-titulo { display:flex; align-items:flex-start; gap:10px; margin-bottom:14px; }
    .ent-prov-ico { width:36px; height:36px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .ent-prov-ico svg { width:19px; height:19px; }
    .ent-prov-tit-tx { display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; }
    .ent-prov-nom { font-size:14.5px; font-weight:800; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ent-prov-count { font-size:11px; font-weight:600; color:var(--text-dim); }
    .ent-prov-total { font-size:15px; font-weight:800; white-space:nowrap; flex-shrink:0; }
    .ent-prov-total small { font-size:10px; font-weight:700; opacity:.7; margin-left:2px; text-transform:uppercase; }
    .ent-prov-lista { display:flex; flex-direction:column; gap:8px; }

    .ent-asoc-row { display:flex; align-items:center; gap:11px; width:100%; text-align:left; background:transparent; border:1px solid var(--border); border-radius:12px; padding:10px 13px; cursor:pointer; font-family:inherit; transition:background .15s,border-color .15s; }
    .ent-asoc-row:hover { background:var(--surface-hover); border-color:transparent; }
    .ent-asoc-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
    .ent-asoc-nom { flex:1; min-width:0; font-size:13.5px; font-weight:700; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ent-asoc-chev { color:var(--text-dim); display:flex; flex-shrink:0; }
    .ent-asoc-chev svg { width:17px; height:17px; }
    .ent-asoc-vacia { opacity:.6; }

    /* Verificables: visto (disponible) */
    .ent-visto { display:inline-flex; align-items:center; gap:6px; }
    .ent-visto-ic { width:22px; height:22px; border-radius:50%; background:#506CFF; color:#fff; display:inline-flex; align-items:center; justify-content:center; }
    .ent-visto-ic svg { width:13px; height:13px; }
    .ent-visto-no { color:var(--text-dim); font-weight:600; }

    /* Sección multi-comprador en el formulario */
    .cmp-section { margin-top:14px; margin-bottom:6px; }
    .cmp-section-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
    .cmp-section-title { font-size:12px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.7px; }
    .btn.btn-sm { padding:6px 12px; font-size:12px; }
    .cmp-block { position:relative; background:rgba(80,108,255,0.03); border:1px solid rgba(80,108,255,0.15); border-radius:14px; padding:14px 16px; margin-bottom:12px; }
    .cmp-block-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .cmp-block-num { font-size:11px; font-weight:700; color:#506CFF; text-transform:uppercase; letter-spacing:0.6px; }
    .cmp-block-remove { background:transparent; border:1px solid var(--border); width:26px; height:26px; border-radius:8px; color:var(--text-dim); cursor:pointer; font-size:14px; line-height:1; display:flex; align-items:center; justify-content:center; font-family:inherit; transition:all .15s; }
    .cmp-block-remove:hover { background:#fde5ea; color:#d9345f; border-color:#d9345f; }
    .cmp-block-foot { display:flex; justify-content:flex-end; align-items:center; gap:8px; padding-top:8px; margin-top:6px; border-top:1px dashed var(--border); }
    .cmp-block-sub-lbl { font-size:11.5px; color:var(--text-muted); font-weight:600; }
    .cmp-block-sub { font-size:15px; font-weight:700; color:#0a9e83; }

    /* Verificables: casillas en el formulario (mismo patrón que la ficha de Asociaciones) */
    .ent-docs { display:flex; flex-direction:column; gap:10px; }
    .ent-doc-item { border:1px solid var(--border); border-radius:12px; padding:12px 14px; }
    .ent-doc-cab { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
    .ent-doc-lbl { font-size:13px; font-weight:700; color:var(--text); }

    .ent-f-list { display:flex; flex-direction:column; gap:7px; margin-bottom:10px; }
    .ent-f-row { display:flex; align-items:center; gap:8px; background:rgba(0,0,0,.03); border-radius:9px; padding:8px 10px; }
    .ent-f-nom { flex:1; min-width:0; font-size:12.5px; color:var(--text); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ent-f-ver, .ent-f-del { width:28px; height:28px; border-radius:8px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; border:none; cursor:pointer; }
    .ent-f-ver { background:rgba(80,108,255,.1); color:#506CFF; text-decoration:none; }
    .ent-f-ver:hover { background:rgba(80,108,255,.2); }
    .ent-f-ver svg { width:14px; height:14px; }
    .ent-f-del { background:rgba(201,26,68,.09); color:#c91a44; }
    .ent-f-del:hover { background:rgba(201,26,68,.18); }
    .ent-f-del svg { width:14px; height:14px; }

    .ent-doc-add { display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600; color:#506CFF; cursor:pointer; padding:9px 12px; border:1.5px dashed var(--border); border-radius:10px; }
    .ent-doc-add:hover { border-color:#506CFF; background:rgba(80,108,255,.04); }
    .ent-doc-add svg { width:16px; height:16px; }
    .ent-doc-add input[type=file] { display:none; }

    .ent-doc-pend { margin-top:8px; display:flex; flex-direction:column; gap:6px; }
    .ent-f-pend { display:flex; align-items:center; gap:7px; background:rgba(24,174,151,.08); border:1px solid rgba(24,174,151,.25); border-radius:9px; padding:8px 10px; font-size:12px; color:#0a9e83; }
    .ent-f-pend svg { width:14px; height:14px; flex-shrink:0; }
    .ent-f-pend span { font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ent-f-pend small { margin-left:auto; font-size:10.5px; color:var(--text-dim); white-space:nowrap; flex-shrink:0; }

    /* Verificables: chips en la ficha de detalle */
    .ent-docs-ver { display:flex; flex-wrap:wrap; gap:8px; }
    .ent-doc-chip { display:inline-flex; align-items:center; gap:6px; padding:7px 12px; border:1px solid var(--border); border-radius:10px; font-size:12.5px; font-weight:600; color:#506CFF; text-decoration:none; background:rgba(80,108,255,.06); }
    .ent-doc-chip svg { width:15px; height:15px; }
    .ent-doc-chip:hover { background:rgba(80,108,255,.14); }
    .ent-doc-chip-off { color:var(--text-dim); background:transparent; cursor:default; }

    @media (max-width:820px) {
      .ent-card { flex-wrap:wrap; gap:12px 16px; }
      .ent-c-per { width:auto; order:1; }
      .ent-c-val { order:2; margin-left:auto; }
      .ent-c-mats { width:100%; order:4; gap:14px; }
      .ent-c-acts { width:100%; order:5; justify-content:flex-end; border-top:1px solid var(--border); padding-top:12px; }
    }
  `;
  document.head.appendChild(s);
})();
