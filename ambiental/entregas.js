// ============================================================
// RECIRCULA 360 — entregas.js
// Filtra sobre CAT.entregas (cargado de Firestore). Sin backend.
// ============================================================

let ENTREGAS_DATA    = [];
let ENTREGAS_FILTROS = { anio: [], mes: [], asociacion: [], provincia: [] };
let EVIDENCIAS_LISTA = [];
let ENTREGAS_LOADED  = false;

// ── Navegación de dos niveles ──
let ENT_VISTA = 'asociaciones';   // 'asociaciones' | 'lista'
let ENT_ASOC_SEL = null;          // ID_Asociacion abierta
let ENT_FILTROS_N2 = { material: [], anio: [], mes: [] };

// Casillas de documentos (PDF) de la entrega. key = campo en Documentos; file = nombre en Drive.
const ENT_DOCS = [
  { key: 'verificable1', lbl: 'Verificable 1', file: 'Verificable_1' },
  { key: 'verificable2', lbl: 'Verificable 2', file: 'Verificable_2' },
  { key: 'verificable3', lbl: 'Verificable 3', file: 'Verificable_3' },
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
        <div class="page-title">Entregas</div>
        <div class="page-sub">Registro por asociación</div>
      </div>
      <div class="hdr-actions">
        <button class="hdr-circle" onclick="exportarMatrizEntregas()" title="Descargar toda la matriz">${icoHTML('download')}</button>
        ${add ? `<button class="hdr-circle hdr-circle-primary" onclick="abrirFormEntrega()" title="Nueva entrega">${icoHTML('plus')}</button>` : ''}
      </div>
    </div>
    <div id="ent-n1-wrap"></div>`;

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
    const filas = lista.map(a => {
      const kg = _kilosAsoc(a['ID_Asociacion']);
      const vacia = kg <= 0;
      const pill = vacia
        ? '<span class="ent-asoc-pill ent-asoc-pill-0">0 kg</span>'
        : `<span class="ent-asoc-pill" style="background:${_rgbaEnt(est.color, 0.13)};color:${est.color}">${fmtNum(kg)} kg</span>`;
      return `<button class="ent-asoc-row${vacia ? ' ent-asoc-vacia' : ''}" onclick="abrirAsociacionEntregas('${jsEsc(a['ID_Asociacion'])}')">
        <span class="ent-asoc-ico" style="background:${_rgbaEnt(est.color, 0.12)};color:${est.color}">${icoHTML('users')}</span>
        <span class="ent-asoc-nom">${esc(a['Nombre'] || '—')}</span>
        <span class="ent-asoc-right">${pill}<span class="ent-asoc-chev">${CHEV}</span></span>
      </button>`;
    }).join('');
    return `<div class="ent-prov-grupo">
      <div class="ent-prov-titulo">
        <span class="ent-prov-ico" style="background:${_rgbaEnt(est.color, 0.14)};color:${est.color}">${icoHTML(est.ico)}</span>
        <span class="ent-prov-nom">${esc(prov)}</span>
        <span class="ent-prov-count">${lista.length} asociaci${lista.length !== 1 ? 'ones' : 'ón'}</span>
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
        <div class="ent-title-row">
          <button class="ent-back" onclick="volverAsociacionesEnt()" title="Volver a asociaciones">${BACK}</button>
          <div>
            <div class="page-title">Entregas</div>
            <div class="page-sub">${esc(nombre)}</div>
          </div>
        </div>
      </div>
      <div class="hdr-actions">
        <button class="hdr-circle" onclick="openFilterDrawer('entregas')" title="Filtros">
          ${icoHTML('filter')}<span class="filter-badge" id="badge-entregas" style="display:none;">0</span>
        </button>
        <button class="hdr-circle" onclick="exportarEntregasExcel()" title="Descargar Excel">${icoHTML('download')}</button>
        ${add ? `<button class="hdr-circle hdr-circle-primary" onclick="abrirFormEntrega()" title="Nueva entrega">${icoHTML('plus')}</button>` : ''}
      </div>
    </div>
    <div id="entregas-table-wrap"></div>`;

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

  // Máximo de kilos (entre PET/Suave/Duro de todas las entregas) para escalar las barras
  let maxKg = 0;
  ENTREGAS_DATA.forEach(e => {
    ['PET Kilos', 'Plástico Suave Kilos', 'Plástico Duro Kilos'].forEach(k => {
      const v = parseFloat(e[k] || 0) || 0; if (v > maxKg) maxKg = v;
    });
  });
  const barra = (kg, color) => {
    const pct = maxKg > 0 ? Math.max((kg / maxKg) * 100, kg > 0 ? 4 : 0) : 0;
    return `<div class="ent-bar"><div class="ent-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
  };
  const mat = (lbl, kg, color) => `
    <div class="ent-mat">
      <div class="ent-mat-lbl">${lbl}</div>
      <div class="ent-mat-kg">${fmtNum(kg)} kg</div>
      ${barra(kg, color)}
    </div>`;

  const cards = ENTREGAS_DATA.map(e => {
    const petKg   = parseFloat(e['PET Kilos'] || 0);
    const suaveKg = parseFloat(e['Plástico Suave Kilos'] || 0);
    const duroKg  = parseFloat(e['Plástico Duro Kilos'] || 0);
    const total   = parseFloat(e['Valor Total'] || 0);
    const idEnt   = jsEsc(e['ID_Entrega'] || '');
    const docId   = jsEsc(e['_docId'] || '');
    const idCarpeta = jsEsc(e['ID_Carpeta_Evidencia'] || '');
    const col     = _mesColor(e['Mes']);

    return `
      <div class="ent-card" onclick="verEntrega('${idEnt}')">
        <div class="ent-c-per">
          <span class="ent-cal" style="background:${_rgbaEnt(col, 0.14)};color:${col}">${icoHTML('calendar')}</span>
          <span class="ent-cal-txt">${esc(e['Mes'] || '')} ${esc(e['Año'] || '')}</span>
        </div>
        <div class="ent-c-mats">
          ${mat('PET', petKg, '#506CFF')}
          ${mat('SUAVE', suaveKg, '#18AE97')}
          ${mat('DURO', duroKg, '#F5AD21')}
        </div>
        <div class="ent-c-val">${fmtMoney(total)}</div>
        <div class="ent-c-acts td-actions" onclick="event.stopPropagation()">
          <button class="icon-btn" onclick="verEntrega('${idEnt}')" title="Ver">${icoHTML('view')}</button>
          ${puedeEditar() ? `
            <button class="icon-btn primary" onclick="editarEntrega('${idEnt}')" title="Editar">${icoHTML('edit')}</button>
            <button class="icon-btn del" onclick="confirmarEliminarEntrega('${docId}','${idCarpeta}')" title="Eliminar">${icoHTML('trash')}</button>
          ` : ''}
        </div>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="ent-cards">${cards}</div>
    <div style="font-size:12px;color:var(--text-dim);text-align:center;margin-top:14px">
      ${ENTREGAS_DATA.length} registro${ENTREGAS_DATA.length !== 1 ? 's' : ''}
    </div>
  `;
}

// Color por mes (para el ícono de período)
function _mesColor(mes) {
  const ORD = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const pal = ['#506CFF', '#18AE97', '#F5AD21', '#F82D72', '#FF751F', '#33A8DE', '#7B5CFF', '#0BC3FF', '#9FDA60', '#FF376F', '#FF85FF', '#0a9e83'];
  const i = ORD.indexOf(String(mes || '').toLowerCase());
  return pal[(i >= 0 ? i : 0) % pal.length];
}


// ============================================================
// ELIMINAR
// ============================================================

function confirmarEliminarEntrega(docId, folderId) {
  abrirModal(`
    <div class="modal" style="max-width:440px">
      <div class="modal-head">
        <div class="modal-title">Eliminar entrega</div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:14px;line-height:1.6">
          ¿Seguro que quieres eliminar esta entrega?
          Se eliminará la fila del registro. Esta acción no se puede deshacer.
        </p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="eliminarEntrega('${jsEsc(docId)}')">Eliminar</button>
      </div>
    </div>
  `);
}

async function eliminarEntrega(docId) {
  if (!docId) { showToast('No se encontró la entrega'); return; }
  try {
    const res = await eliminarEntregaFS(docId);
    if (!res.ok) { showToast('Error al eliminar: ' + (res.error || '')); return; }
    showToast(res.offline ? 'Eliminada (se sincronizará) ✓' : 'Entrega eliminada ✓');
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
  const e = ENTREGAS_DATA.find(r => r['ID_Entrega'] === id);
  if (!e) { showToast('Entrega no encontrada'); return; }

  const MATS = ['PET','Plástico Suave','Plástico Duro','Lata Aluminio','Vidrio','Cartón',
    'Chatarra','Cobre','Papel Archivo','Periódico','Soplado','Tetrapak','Suela','Bronce','Batería','Acero'];

  const filasMat = MATS.filter(m => parseFloat(e[m+' Kilos']||0) > 0).map(m => {
    const kg     = parseFloat(e[m+' Kilos']||0);
    const precio = parseFloat(e[m+' Precio']||0);
    const venta  = parseFloat(e[m+' Valor Venta']||0) || kg*precio;
    const prio   = ['PET','Plástico Suave','Plástico Duro'].includes(m);
    return `<tr>
      <td style="${prio?'font-weight:600;color:#1c7aa8':''}">${esc(m)}</td>
      <td style="text-align:right">${fmtNum(kg)} kg</td>
      <td style="text-align:right">$${fmtNum(precio,2)}/kg</td>
      <td style="text-align:right;font-weight:600;color:#0a9e83">${fmtMoney(venta)}</td>
    </tr>`;
  }).join('');

  abrirModal(`
    <div class="modal">
      <div class="modal-head">
        <div>
          <div class="modal-title">Detalle de entrega</div>
          <div class="modal-sub">${esc(e['Mes']||'')} ${esc(e['Año']||'')} · ${esc(e['_nombreAsociacion']||'')}</div>
        </div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">
        <div class="form-grid-2" style="margin-bottom:16px">
          <div><div class="form-label">Fecha</div><div style="font-size:14px">${fmtFecha(e['Fecha'])}</div></div>
          <div><div class="form-label">Provincia</div><div style="font-size:14px">${esc(e['Provincia']||e['_provinciaAsociacion']||'—')}</div></div>
          <div><div class="form-label">Comprador</div><div style="font-size:14px">${esc(e['_nombreComprador']||'—')}</div></div>
          <div><div class="form-label">Nivel</div><div>${nivelBadge(e['Nivel Intermediacion'])}</div></div>
          <div><div class="form-label">Actividad fuente</div><div style="font-size:14px">${esc(e['Actividad Fuente']||'—')}</div></div>
          <div><div class="form-label">Valor total</div><div style="font-size:18px;font-weight:700;color:#0a9e83">${fmtMoney(e['Valor Total'])}</div></div>
        </div>
        <div class="materiales-section">
          <div class="materiales-section-title">Materiales entregados</div>
          <div class="table-wrap" style="border-radius:14px;box-shadow:none;border:1px solid var(--border)"><table>
            <thead><tr><th>Material</th><th style="text-align:right">Kilos</th><th style="text-align:right">Precio</th><th style="text-align:right">Valor</th></tr></thead>
            <tbody>${filasMat||'<tr><td colspan="4" style="text-align:center;color:var(--text-dim)">Sin materiales</td></tr>'}</tbody>
          </table></div>
        </div>
        ${e['Observaciones'] ? `<div style="margin-top:14px"><div class="form-label">Observaciones</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">${esc(e['Observaciones'])}</div></div>` : ''}
        <div style="margin-top:16px"><div class="form-label" style="margin-bottom:8px">Verificables</div>
          <div class="ent-docs-ver">
            ${ENT_DOCS.map(d => {
              const doc = _entDoc(e, d.key);
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

function abrirFormEntrega(id = null) {
  const e = id ? ENTREGAS_DATA.find(r => r['ID_Entrega'] === id) : null;
  EVIDENCIAS_LISTA = [];

  const todosMats = CAT.materiales.length ? CAT.materiales : [
    { Nombre: 'PET', Priorizable: true },
    { Nombre: 'Plástico Suave', Priorizable: true },
    { Nombre: 'Plástico Duro', Priorizable: true },
    { Nombre: 'Cartón' },
    { Nombre: 'Vidrio' },
    { Nombre: 'Lata Aluminio' },
  ];
  const priorizables = todosMats.filter(m => m['Priorizable']==='Sí' || m['Priorizable']===true);
  const otros = todosMats.filter(m => !(m['Priorizable']==='Sí' || m['Priorizable']===true));

  const filaMaterial = (mat) => {
    const n    = mat['Nombre'];
    const prio = mat['Priorizable']==='Sí' || mat['Priorizable']===true;
    const kg   = e ? (e[n+' Kilos']||'') : '';
    const prec = e ? (e[n+' Precio']||'') : '';
    const vent = e ? parseFloat(e[n+' Valor Venta']||0) : 0;
    const mid  = n.replace(/[^a-zA-Z0-9]/g,'_');
    return `
      <div class="material-row${prio?' material-priorizable':''}">
        <div class="material-row-label">${esc(n)}${prio?` <span class="badge badge-cyan" style="font-size:9px;padding:1px 6px">Prio</span>`:''}</div>
        <input type="number" class="form-input" id="mat-kg-${mid}" placeholder="Kilos" value="${kg}" min="0" step="0.01" oninput="calcularValorMaterial('${mid}')">
        <input type="number" class="form-input" id="mat-precio-${mid}" placeholder="$/kg" value="${prec}" min="0" step="0.01" oninput="calcularValorMaterial('${mid}')">
        <div class="material-valor" id="mat-venta-${mid}">${vent>0?fmtMoney(vent):'—'}</div>
      </div>`;
  };

  abrirModal(`
    <div class="modal" style="max-width:720px">
      <div class="modal-head">
        <div><div class="modal-title">${e?'Editar entrega':'Nueva entrega'}</div><div class="modal-sub">Registra los kilos y precios por material</div></div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">

        <div class="form-grid-3">
          <div class="form-group">
            <label class="form-label">Fecha</label>
            <input type="date" class="form-input" id="ent-fecha" readonly value="${e?.['Fecha']?String(e.Fecha).substring(0,10):new Date().toISOString().substring(0,10)}">
          </div>
          <div class="form-group">
            <label class="form-label">Año *</label>
            <select class="form-select" id="ent-anio">
              <option value="">Selecciona...</option>
              ${['2024','2025','2026','2027','2028'].map(a=>`<option value="${a}" ${String(e?.['Año'])===a?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Mes *</label>
            <select class="form-select" id="ent-mes">
              <option value="">Selecciona...</option>
              ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map(m=>`<option value="${m}" ${e?.['Mes']===m?'selected':''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Asociación *</label>
            <select class="form-select" id="ent-asociacion" onchange="autocompletarProvincia(this.value)">
              <option value="">Selecciona una asociación</option>
              ${CAT.asociaciones.map(a=>`<option value="${esc(a['ID_Asociacion'])}" ${e?.['ID_Asociacion']===a['ID_Asociacion']?'selected':''}>${esc(a['Nombre'])}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Provincia</label>
            <input type="text" class="form-input" id="ent-provincia" readonly value="${esc(e?.['Provincia']||e?.['_provinciaAsociacion']||'')}">
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Comprador *</label>
            <select class="form-select" id="ent-comprador" onchange="autocompletarNivel(this.value)">
              <option value="">Selecciona un comprador</option>
              ${CAT.compradores.map(c=>`<option value="${esc(c['ID_Comprador'])}" data-nivel="${esc(c['Nivel']||c['Nivel Intermediacion']||'')}" ${e?.['ID_Comprador']===c['ID_Comprador']?'selected':''}>${esc(c['Nombre'])}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nivel intermediación <span style="font-weight:400;text-transform:none;color:var(--text-dim);font-size:10px">(auto)</span></label>
            <input type="text" class="form-input" id="ent-nivel" readonly value="${esc(e?.['Nivel Intermediacion']||'')}">
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Actividad fuente</label>
            <select class="form-select" id="ent-actividad">
              <option value="">Selecciona...</option>
              ${['Recuperación a pie de Vereda / Fuente','Recuperación en Relleno','Recuperación GIRA','Otros'].map(a=>`<option value="${a}" ${e?.['Actividad Fuente']===a?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
        </div>

        ${priorizables.length ? `
        <div class="materiales-section">
          <div class="materiales-section-title">Materiales priorizables</div>
          ${priorizables.map(filaMaterial).join('')}
        </div>` : ''}

        ${otros.length ? `
        <div class="materiales-section">
          <div class="materiales-section-title">Otros materiales</div>
          ${otros.map(filaMaterial).join('')}
        </div>` : ''}

        <div style="margin-top:14px;display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:12px 16px;background:rgba(24,174,151,0.06);border-radius:12px">
          <span style="font-size:13px;color:var(--text-muted);font-weight:600">VALOR TOTAL:</span>
          <span id="ent-total" style="font-size:22px;font-weight:700;color:#0a9e83">${e?fmtMoney(e['Valor Total']):'$0,00'}</span>
        </div>

        <div class="form-group" style="margin-top:14px">
          <label class="form-label">Observaciones</label>
          <textarea class="form-textarea" id="ent-obs" placeholder="Notas adicionales...">${esc(e?.['Observaciones']||'')}</textarea>
        </div>

        <div class="form-label" style="margin:16px 0 8px">Verificables (PDF)</div>
        <div class="ent-docs">
          ${ENT_DOCS.map(d => {
            const doc = _entDoc(e || {}, d.key);
            const ver = (doc && doc.url)
              ? `<button type="button" class="ent-doc-ver" onclick="window.open('${jsEsc(doc.url)}','_blank')">${icoHTML('view')} Ver PDF</button>`
              : '<span class="ent-doc-sin">Sin archivo</span>';
            return `<div class="ent-doc-item">
              <div class="ent-doc-cab"><span class="ent-doc-lbl">${esc(d.lbl)}</span>${ver}</div>
              <input type="file" accept="application/pdf,.pdf" class="form-input ent-doc-file" id="ent-doc-${d.key}">
            </div>`;
          }).join('')}
        </div>

      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        ${puedeEditar() ? `<button class="btn btn-primary" id="btn-guardar-entrega" onclick="guardarEntrega('${jsEsc(id||'')}')">${e?'Actualizar':'Guardar entrega'}</button>` : ''}
      </div>
    </div>
  `);

  if (e?.['ID_Asociacion']) autocompletarProvincia(e['ID_Asociacion']);
  if (e?.['ID_Comprador'])  autocompletarNivel(e['ID_Comprador']);
  if (e) recalcularTotal();
}

function autocompletarProvincia(idAsoc) {
  const inp = document.getElementById('ent-provincia');
  if (!inp) return;
  const a = CAT.asociaciones.find(x => x['ID_Asociacion'] === idAsoc);
  inp.value = a ? (a['Provincia']||'') : '';
}

function autocompletarNivel(idComp) {
  const inp = document.getElementById('ent-nivel');
  if (!inp) return;
  const c = CAT.compradores.find(x => x['ID_Comprador'] === idComp);
  inp.value = c ? (c['Nivel'] || c['Nivel Intermediacion'] || '') : '';
}

function calcularValorMaterial(mid) {
  const kg = parseFloat(document.getElementById('mat-kg-'+mid)?.value || 0);
  const pr = parseFloat(document.getElementById('mat-precio-'+mid)?.value || 0);
  const v  = kg * pr;
  const vEl = document.getElementById('mat-venta-'+mid);
  if (vEl) vEl.textContent = v > 0 ? fmtMoney(v) : '—';
  recalcularTotal();
}

function recalcularTotal() {
  let total = 0;
  document.querySelectorAll('[id^="mat-venta-"]').forEach(el => {
    const t = el.textContent.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');
    const n = parseFloat(t);
    if (!isNaN(n)) total += n;
  });
  const totEl = document.getElementById('ent-total');
  if (totEl) totEl.textContent = fmtMoney(total);
}

// ============================================================
// GUARDAR (Firestore)
// ============================================================

async function guardarEntrega(id) {
  const fecha       = document.getElementById('ent-fecha').value;
  const anio        = document.getElementById('ent-anio').value;
  const mes         = document.getElementById('ent-mes').value;
  const idAsoc      = document.getElementById('ent-asociacion').value;
  const provincia   = document.getElementById('ent-provincia').value;
  const idComp      = document.getElementById('ent-comprador').value;
  const nivel       = document.getElementById('ent-nivel').value;
  const actividad   = document.getElementById('ent-actividad').value;
  const obs         = document.getElementById('ent-obs').value;

  if (!anio || !mes) { showToast('Año y mes son obligatorios'); return; }
  if (!idAsoc) { showToast('Selecciona una asociación'); return; }
  if (!idComp) { showToast('Selecciona un comprador'); return; }

  // Mantener la carpeta de evidencia existente si es edición
  const actual = id ? (CAT.entregas.find(r => r['ID_Entrega'] === id) || {}) : {};

  const data = {
    ID_Entrega: id || '',
    Fecha: fecha, 'Año': anio, Mes: mes,
    ID_Asociacion: idAsoc, Provincia: provincia,
    ID_Comprador: idComp, 'Nivel Intermediacion': nivel,
    'Actividad Fuente': actividad,
    Observaciones: obs,
    'ID_Carpeta_Evidencia': actual['ID_Carpeta_Evidencia'] || '',
    'Documentos': Object.assign({}, actual['Documentos'] || {}),
  };

  let total = 0;
  document.querySelectorAll('[id^="mat-kg-"]').forEach(inp => {
    const mid = inp.id.replace('mat-kg-','');
    const kg = parseFloat(inp.value || 0);
    const precio = parseFloat(document.getElementById('mat-precio-'+mid)?.value || 0);
    const venta = kg * precio;
    if (kg > 0) {
      const matReal = (CAT.materiales || []).find(m => m['Nombre'].replace(/[^a-zA-Z0-9]/g,'_') === mid);
      const realName = matReal ? matReal['Nombre'] : mid.replace(/_/g,' ');
      data[realName + ' Kilos']       = kg;
      data[realName + ' Precio']      = precio;
      data[realName + ' Valor Venta'] = venta;
      total += venta;
    }
  });
  data['Valor Total'] = total;

  const btn = document.getElementById('btn-guardar-entrega');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    // ── Verificables: subir los PDFs seleccionados a la carpeta de la entrega ──
    const nuevos = ENT_DOCS.map(d => {
      const el = document.getElementById('ent-doc-' + d.key);
      const f = el && el.files && el.files[0] ? el.files[0] : null;
      return f ? { key: d.key, file: d.file, archivo: f } : null;
    }).filter(Boolean);

    const noPdf = nuevos.find(n => n.archivo.type !== 'application/pdf' && !/\.pdf$/i.test(n.archivo.name));
    if (noPdf) { showToast('Solo se permiten archivos PDF'); if (btn) { btn.disabled = false; btn.textContent = id ? 'Actualizar' : 'Guardar entrega'; } return; }

    if (nuevos.length) {
      const tok = driveToken();
      if (!tok) {
        showToast('Sesión de Drive expirada: la entrega se guarda sin los PDFs');
      } else {
        // Asegurar la carpeta de la entrega (la crea vía Apps Script si no existe)
        await asegurarCarpetaEntrega(data);
        if (!data['ID_Carpeta_Evidencia']) {
          showToast('No se pudo preparar la carpeta: la entrega se guarda sin los PDFs');
        } else {
          // Sufijo para distinguir archivos dentro de la carpeta compartida del mes
          const comp = (CAT.compradores || []).find(c => c['ID_Comprador'] === idComp);
          const suf = String((comp && comp['Nombre']) || 'entrega').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 24);
          for (let i = 0; i < nuevos.length; i++) {
            const n = nuevos[i];
            if (btn) btn.textContent = `Subiendo ${i + 1}/${nuevos.length}…`;
            try {
              const fname = `${n.file}_${suf}_${mes}${anio}.pdf`;
              const up = await driveSubirArchivo(n.archivo, fname, data['ID_Carpeta_Evidencia'], tok);
              data['Documentos'][n.key] = { id: up.id, url: up.webViewLink, nombre: fname };
            } catch (err) { console.warn('Subida verificable:', err); showToast('No se pudo subir ' + n.file); }
          }
        }
      }
    }

    const docId = id ? (actual._docId || null) : null;
    const res = await guardarEntregaFS(docId, data);
    if (!res.ok) { showToast('Error: ' + (res.error || 'desconocido')); return; }
    showToast(res.offline ? 'Guardada (se sincronizará) ✓' : (id ? 'Entrega actualizada ✓' : 'Entrega creada ✓'));
    cerrarModal();
    renderVistaEntregas();
  } catch (e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = id ? 'Actualizar' : 'Guardar entrega'; }
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

    const header = ['Fecha','Año','Mes','Asociación','Provincia','Comprador','Nivel','Actividad fuente'];
    mats.forEach(m => { header.push(m['Nombre'] + ' Kilos', m['Nombre'] + ' Precio', m['Nombre'] + ' Valor'); });
    header.push('Valor Total','Observaciones');

    const filas = datos.map(e => {
      const r = [
        e['Fecha'] || '',
        e['Año'] || '',
        e['Mes'] || '',
        e['_nombreAsociacion'] || '',
        e['Provincia'] || e['_provinciaAsociacion'] || '',
        e['_nombreComprador'] || '',
        e['_nivelComprador'] || e['Nivel Intermediacion'] || '',
        e['Actividad Fuente'] || '',
      ];
      mats.forEach(m => {
        const n = m['Nombre'];
        r.push(
          parseFloat(e[n + ' Kilos'])       || 0,
          parseFloat(e[n + ' Precio'])      || 0,
          parseFloat(e[n + ' Valor Venta']) || 0
        );
      });
      r.push(parseFloat(e['Valor Total']) || 0, e['Observaciones'] || '');
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

    .ent-c-mats { display:flex; gap:22px; flex:1; min-width:0; }
    .ent-mat { flex:1; min-width:0; }
    .ent-mat-lbl { font-size:10.5px; font-weight:700; color:var(--text-dim); letter-spacing:.5px; }
    .ent-mat-kg { font-size:13px; font-weight:700; color:var(--text); margin:3px 0 7px; }
    .ent-bar { height:6px; background:#eef0f4; border-radius:20px; overflow:hidden; }
    .ent-bar-fill { height:100%; border-radius:20px; transition:width .5s ease; }

    .ent-c-val { width:100px; flex-shrink:0; text-align:right; font-size:15px; font-weight:800; color:#0a9e83; }
    .ent-c-acts { flex-shrink:0; display:flex; gap:6px; }

    /* ── Nivel 1: provincias + asociaciones ── */
    .ent-provs { display:flex; flex-direction:column; gap:22px; }
    .ent-prov-titulo { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
    .ent-prov-ico { width:36px; height:36px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .ent-prov-ico svg { width:19px; height:19px; }
    .ent-prov-nom { font-size:15px; font-weight:800; color:var(--text); }
    .ent-prov-count { font-size:11.5px; font-weight:600; color:var(--text-dim); background:rgba(0,0,0,.04); padding:3px 10px; border-radius:20px; }
    .ent-prov-lista { display:flex; flex-direction:column; gap:10px; }

    .ent-asoc-row { display:flex; align-items:center; gap:14px; width:100%; text-align:left; background:var(--surface); border:1px solid var(--border); border-radius:15px; padding:14px 18px; cursor:pointer; font-family:inherit; transition:box-shadow .15s,transform .12s,border-color .15s; }
    .ent-asoc-row:hover { box-shadow:0 6px 18px rgba(0,0,0,.08); transform:translateY(-2px); border-color:transparent; }
    .ent-asoc-ico { width:40px; height:40px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .ent-asoc-ico svg { width:20px; height:20px; }
    .ent-asoc-nom { flex:1; min-width:0; font-size:14px; font-weight:700; color:var(--text); }
    .ent-asoc-right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
    .ent-asoc-pill { font-size:12.5px; font-weight:700; padding:5px 12px; border-radius:20px; white-space:nowrap; }
    .ent-asoc-pill-0 { color:var(--text-dim); background:rgba(0,0,0,.05); }
    .ent-asoc-chev { color:var(--text-dim); display:flex; }
    .ent-asoc-chev svg { width:18px; height:18px; }
    .ent-asoc-vacia { opacity:.6; }

    /* Título con botón volver (Nivel 2) */
    .ent-title-row { display:flex; align-items:center; gap:12px; }
    .ent-back { width:38px; height:38px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:var(--surface); border:1px solid var(--border); color:var(--text); cursor:pointer; transition:background .15s; }
    .ent-back:hover { background:var(--surface-hover); }
    .ent-back svg { width:19px; height:19px; }

    /* Verificables: visto (disponible) */
    .ent-visto { display:inline-flex; align-items:center; gap:6px; }
    .ent-visto-ic { width:22px; height:22px; border-radius:50%; background:#18AE97; color:#fff; display:inline-flex; align-items:center; justify-content:center; }
    .ent-visto-ic svg { width:13px; height:13px; }
    .ent-visto-no { color:var(--text-dim); font-weight:600; }

    /* Verificables: casillas en el formulario */
    .ent-docs { display:flex; flex-direction:column; gap:10px; }
    .ent-doc-item { border:1px solid var(--border); border-radius:12px; padding:12px 14px; }
    .ent-doc-cab { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
    .ent-doc-lbl { font-size:13px; font-weight:600; color:var(--text); }
    .ent-doc-ver { display:inline-flex; align-items:center; gap:5px; background:rgba(80,108,255,.1); color:#506CFF; border:none; font-family:inherit; font-size:11px; font-weight:700; padding:5px 10px; border-radius:8px; cursor:pointer; }
    .ent-doc-ver svg { width:14px; height:14px; }
    .ent-doc-ver:hover { background:rgba(80,108,255,.18); }
    .ent-doc-sin { font-size:11.5px; color:var(--text-dim); }
    .ent-doc-file { font-size:12px; }

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
