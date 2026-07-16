// ============================================================
// DASHBOARD SOCIAL — alianzas.js
// Sección Alianzas: CRUD (ver / editar / eliminar).
// Colección: Alianzas
//  - Asociaciones beneficiarias: multiselección de Asoc_Ambiente.
//  - Provincias: derivadas de las asociaciones elegidas (lista).
//  - N° recicladores beneficiarios: suma de num_recicladores (Asoc_Asociativo).
//  - Etapa: checklist múltiple (Inicial/Intermedia/Final).
//  - Ver ficha: barra de progreso tipo tracking.
//  - Carpeta Drive: Alianzas > Convenio.
// ============================================================

let ALI_FILTROS = { prov: [], etapa: [] };
let ALIANZAS_DATA = [];

const ETAPAS_ALI = ['Inicial', 'Intermedia', 'Final'];

function registerAlianzasFilters() {
  registerFilterConfig('alianzas', {
    badgeId: 'ali-filter-badge',
    sections: [
      { key: 'prov',  title: 'Provincia',  type: 'options', options: _provinciasAli() },
      { key: 'etapa', title: 'Por estado',  type: 'options', options: ETAPAS_ALI },
    ],
    getValue: function (k) { return ALI_FILTROS[k] || []; },
    setValue: function (k, v) { ALI_FILTROS[k] = v; },
    apply: function () { cargarAlianzas(); },
  });
}

function _provinciasAli() {
  const set = new Set();
  CAT.alianzas.forEach(function (a) { (a.provincias || []).forEach(function (p) { if (p) set.add(p); }); });
  // Respaldo: si aún no hay alianzas, ofrecer las provincias del catálogo.
  if (!set.size) CAT.asocAmbiente.forEach(function (a) { if (a.provincia) set.add(a.provincia); });
  return Array.from(set).sort();
}

function renderAlianzas() {
  registerAlianzasFilters();
  const add = puedeEditar();
  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Alianzas</div><div class="page-sub">Públicas/Privadas</div></div>' +
      '<div class="hdr-actions">' +
        '<button class="hdr-circle" onclick="openFilterDrawer(\'alianzas\')" title="Filtros">' +
          icoHTML('filter') + '<span class="filter-badge" id="ali-filter-badge" style="display:none">0</span></button>' +
        '<button class="hdr-circle" onclick="exportarAlianzasExcel()" title="Descargar Excel">' + icoHTML('download') + '</button>' +
        (add ? '<button class="hdr-circle hdr-circle-primary" onclick="abrirFormAlianza()" title="Nueva alianza">' + icoHTML('plus') + '</button>' : '') +
      '</div>' +
    '</div>' +
    '<div id="ali-wrap"></div>';
  cargarAlianzas();
  updateFilterBadge('alianzas');
}

function cargarAlianzas() {
  ALI_PAGINA = 1;
  ALIANZAS_DATA = CAT.alianzas.filter(function (a) {
    return pasaFiltroLista(ALI_FILTROS.prov, a.provincias) && pasaFiltroLista(ALI_FILTROS.etapa, a.etapas);
  }).slice().sort(function (a, b) {
    const pa = (a.provincias && a.provincias[0]) || '', pb = (b.provincias && b.provincias[0]) || '';
    const p = pa.localeCompare(pb);
    if (p !== 0) return p;
    return (a.nombre_convenio || '').localeCompare(b.nombre_convenio || '');
  });
  renderTablaAlianzas();
}

function _etapasMini(etapas) {
  if (!etapas || !etapas.length) return '<span class="badge badge-off">Sin etapa</span>';
  return ETAPAS_ALI.filter(function (e) { return etapas.indexOf(e) !== -1; })
    .map(function (e) { return '<span class="badge ' + _etapaClase(e) + '" style="margin-right:4px">' + e + '</span>'; }).join('');
}
function _etapaClase(e) { return e === 'Inicial' ? 'badge-warn' : e === 'Intermedia' ? 'badge-blue' : 'badge-green'; }

// Info de etapa: cuenta marcadas y última marcada (por orden Inicial<Intermedia<Final)
function _etapaInfo(etapas) {
  etapas = etapas || [];
  let lastIdx = -1, count = 0;
  ETAPAS_ALI.forEach(function (e, i) { if (etapas.indexOf(e) !== -1) { lastIdx = i; count++; } });
  return { count: count, total: ETAPAS_ALI.length, label: lastIdx >= 0 ? ETAPAS_ALI[lastIdx] : 'Sin etapa', lastIdx: lastIdx };
}

// Barra de progreso compacta para la tabla ("● Intermedia" + slider + "2/3")
function _etapaBarraMini(etapas) {
  const info = _etapaInfo(etapas);
  const colorEtapa = info.lastIdx === 0 ? '#F5AD21' : info.lastIdx === 1 ? '#33A8DE' : info.lastIdx === 2 ? '#18AE97' : 'var(--text-dim)';
  const pct = info.total > 1 ? (Math.max(info.lastIdx, 0) / (info.total - 1)) * 100 : 0;
  const dots = ETAPAS_ALI.map(function (e, i) {
    const on = i <= info.lastIdx && info.lastIdx >= 0;
    return '<span class="ali-dot' + (on ? ' on' : '') + '" style="' + (on ? 'background:' + colorEtapa + ';border-color:' + colorEtapa : '') + '"></span>';
  }).join('');
  return '<div class="ali-etapa-barra">' +
    '<div class="ali-etapa-lbl"><span class="ali-etapa-punto" style="background:' + colorEtapa + '"></span>' + esc(info.label) + '</div>' +
    '<div class="ali-etapa-track">' +
      '<div class="ali-etapa-fill" style="width:' + pct + '%;background:' + colorEtapa + '"></div>' + dots +
    '</div>' +
    '<div class="ali-etapa-frac">' + info.count + ' / ' + info.total + '</div>' +
  '</div>';
}

function _statCardAli(icono, color, valor, titulo, sub) {
  return '<div class="ali-stat">' +
    '<span class="ali-stat-ico" style="background:' + _rgbaAli(color, 0.12) + ';color:' + color + '">' + icoHTML(icono) + '</span>' +
    '<div class="ali-stat-txt"><span class="ali-stat-tit">' + esc(titulo) + '</span><b>' + valor + '</b><span class="ali-stat-sub">' + esc(sub) + '</span></div>' +
  '</div>';
}
function _rgbaAli(hex, a) {
  let h = String(hex || '').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  const n = parseInt(h, 16) || 0;
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

let ALI_PAGINA = 1;
const ALI_POR_PAGINA = 8;
function irPaginaAlianzas(p) { ALI_PAGINA = p; renderTablaAlianzas(); }

function renderTablaAlianzas() {
  const wrap = document.getElementById('ali-wrap');
  if (!wrap) return;

  // ── Tarjetas-resumen ──
  const total = ALIANZAS_DATA.length;
  const activas = ALIANZAS_DATA.filter(function (a) { return a.activo !== false; }).length;
  const pctAct = total ? Math.round(activas / total * 100) : 0;
  const benef = ALIANZAS_DATA.reduce(function (acc, a) { return acc + (parseFloat(a.num_recicladores) || 0); }, 0);
  const anio = new Date().getFullYear();
  const stats = '<div class="ali-stats">' +
    _statCardAli('handshake', '#506CFF', total, 'Total alianzas', 'Registradas') +
    _statCardAli('check', '#18AE97', activas, 'Alianzas activas', pctAct + '% del total') +
    _statCardAli('users', '#7B5CFF', fmtNum(benef), 'Beneficiarios', 'Recicladores') +
    _statCardAli('calendar', '#F5AD21', anio, 'Este año', 'Período actual') +
  '</div>';

  if (!ALIANZAS_DATA.length) {
    wrap.innerHTML = stats + '<div class="empty-state">' +
      icoHTML('handshake').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"') +
      '<p>No hay alianzas con estos filtros</p></div>';
    return;
  }

  const edit = puedeEditar();
  const acciones = function (a) {
    const docId = jsEsc(a._docId || '');
    const carpeta = jsEsc(a.id_carpeta_drive || '');
    return (carpeta ? '<button class="icon-btn" onclick="event.stopPropagation();window.open(\'https://drive.google.com/drive/folders/' + carpeta + '\',\'_blank\')" title="Carpeta">' + icoHTML('folder') + '</button>' : '') +
      '<button class="icon-btn" onclick="event.stopPropagation();verAlianza(\'' + docId + '\')" title="Ver">' + icoHTML('view') + '</button>' +
      (edit ? '<button class="icon-btn primary" onclick="event.stopPropagation();editarAlianza(\'' + docId + '\')" title="Editar">' + icoHTML('edit') + '</button>' +
        '<button class="icon-btn del" onclick="event.stopPropagation();confirmarEliminarAlianza(\'' + docId + '\',\'' + carpeta + '\')" title="Eliminar">' + icoHTML('trash') + '</button>' : '');
  };
  const tipoBadge = function (a) {
    const act = a.activo !== false;
    return '<span class="ali-tipo">' + esc(a.tipo || 'Público') + '</span>' +
      '<span class="ali-estado ' + (act ? 'ali-estado-on' : 'ali-estado-off') + '">' + (act ? 'Activo' : 'Inactivo') + '</span>';
  };
  const benefCel = function (a) {
    return '<span class="ali-benef"><span class="ali-benef-ico">' + icoHTML('users') + '</span>' +
      '<span class="ali-benef-txt"><b>' + fmtNum(a.num_recicladores || 0) + '</b><small>recicladores</small></span></span>';
  };

  // ── Paginación ──
  const nPag = Math.max(1, Math.ceil(ALIANZAS_DATA.length / ALI_POR_PAGINA));
  if (ALI_PAGINA > nPag) ALI_PAGINA = nPag;
  const ini = (ALI_PAGINA - 1) * ALI_POR_PAGINA;
  const pagina = ALIANZAS_DATA.slice(ini, ini + ALI_POR_PAGINA);

  // Tabla (desktop)
  const filas = pagina.map(function (a) {
    const docId = jsEsc(a._docId || '');
    return '<tr onclick="verAlianza(\'' + docId + '\')">' +
      '<td><div class="ali-conv-nombre">' + esc(a.nombre_convenio || '—') + '</div>' +
        '<div class="ali-conv-meta">' + tipoBadge(a) + '</div></td>' +
      '<td>' + esc(a.anio || '—') + '</td>' +
      '<td style="min-width:190px">' + _etapaBarraMini(a.etapas) + '</td>' +
      '<td>' + benefCel(a) + '</td>' +
      '<td data-actions-row><div class="td-actions">' + acciones(a) + '</div></td>' +
    '</tr>';
  }).join('');
  const tabla = '<div class="table-wrap ali-desk"><table>' +
    '<thead><tr><th>Convenio</th><th>Año</th><th>Etapa</th><th>Beneficiarios</th><th style="text-align:right">Acciones</th></tr></thead>' +
    '<tbody>' + filas + '</tbody></table></div>';

  // Tarjetas (móvil)
  const cards = pagina.map(function (a) {
    const docId = jsEsc(a._docId || '');
    return '<div class="ali-card" onclick="verAlianza(\'' + docId + '\')">' +
      '<div class="ali-card-top">' +
        '<div class="ali-id"><div class="ali-nombre">' + esc(a.nombre_convenio || '—') + '</div>' +
          '<div class="ali-conv-meta">' + tipoBadge(a) + '</div></div>' +
      '</div>' +
      '<div class="ali-card-mid">' + _etapaBarraMini(a.etapas) + '</div>' +
      '<div class="ali-grid">' +
        '<div class="ali-cell"><span class="ali-mini">Año</span><b>' + esc(a.anio || '—') + '</b></div>' +
        '<div class="ali-cell"><span class="ali-mini">Beneficiarios</span><b>' + fmtNum(a.num_recicladores || 0) + '</b></div>' +
      '</div>' +
      '<div class="ali-foot"><div class="td-actions">' + acciones(a) + '</div></div>' +
    '</div>';
  }).join('');
  const cardsWrap = '<div class="ali-mob">' + cards + '</div>';

  // Pie con paginación
  let pager = '';
  const btnPrev = '<button class="ali-pg-btn"' + (ALI_PAGINA <= 1 ? ' disabled' : ' onclick="irPaginaAlianzas(' + (ALI_PAGINA - 1) + ')"') + '>‹</button>';
  const btnNext = '<button class="ali-pg-btn"' + (ALI_PAGINA >= nPag ? ' disabled' : ' onclick="irPaginaAlianzas(' + (ALI_PAGINA + 1) + ')"') + '>›</button>';
  let nums = '';
  for (let p = 1; p <= nPag; p++) {
    nums += '<button class="ali-pg-num' + (p === ALI_PAGINA ? ' on' : '') + '" onclick="irPaginaAlianzas(' + p + ')">' + p + '</button>';
  }
  pager = '<div class="ali-pager">' +
    '<span class="ali-pager-info">' + ALIANZAS_DATA.length + ' registro' + (ALIANZAS_DATA.length !== 1 ? 's' : '') + '</span>' +
    '<div class="ali-pager-ctrls">' + btnPrev + nums + btnNext + '</div>' +
  '</div>';

  wrap.innerHTML = stats + tabla + cardsWrap + pager;
}

// ── Ver ficha (con barra de progreso tipo tracking) ──
function verAlianza(docId) {
  const a = CAT.alianzas.find(function (x) { return x._docId === docId; });
  if (!a) { showToast('Alianza no encontrada'); return; }
  const nombres = (a.asociaciones || []).map(function (id) { return nombreDeAsociacion(id) || id; });
  const dato = function (lbl, val) {
    return '<div class="rf-row"><span class="rf-lbl">' + esc(lbl) + '</span><span class="rf-val">' + (val ? esc(val) : '—') + '</span></div>';
  };

  abrirModal(
    '<div class="modal modal-lg">' +
      '<div class="modal-head"><div><div class="modal-title">' + esc(a.nombre_convenio || 'Alianza') + '</div>' +
        '<div class="modal-sub">' + (a.provincias && a.provincias.length ? esc(a.provincias.join(' · ')) : '—') + (a.anio ? ' · ' + esc(a.anio) : '') + '</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        _progresoEtapas(a.etapas) +
        '<div class="rf-grid" style="margin-top:20px">' +
          dato('Aliado principal', a.aliado_principal) +
          dato('Aliado secundario', a.aliado_secundario) +
          dato('Tipo', a.tipo || 'Público') +
          dato('Estado', a.activo !== false ? 'Activo' : 'Inactivo') +
          dato('Año', a.anio) +
          dato('N° recicladores beneficiarios', fmtNum(a.num_recicladores)) +
        '</div>' +
        '<div style="margin-top:16px"><div class="form-label" style="margin-bottom:8px">Asociaciones beneficiarias (' + nombres.length + ')</div>' +
          (nombres.length ? '<div class="ali-chips">' + nombres.map(function (n) { return '<span class="ali-chip">' + esc(n) + '</span>'; }).join('') + '</div>' : '<span style="color:var(--text-dim);font-size:13px">—</span>') + '</div>' +
        (a.observaciones ? '<div style="margin-top:16px"><div class="form-label">Observaciones</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">' + esc(a.observaciones) + '</div></div>' : '') +
      '</div>' +
      '<div class="modal-foot">' +
        (a.id_carpeta_drive ? '<a class="btn btn-glass" href="' + urlCarpeta(a.id_carpeta_drive) + '" target="_blank" rel="noopener">Carpeta de Drive ↗</a>' : '') +
        '<button class="btn btn-primary" onclick="cerrarModal()">Cerrar</button>' +
      '</div>' +
    '</div>'
  );
}

// Barra de progreso: Inicial → Intermedia → Final (marca las etapas presentes).
function _progresoEtapas(etapas) {
  etapas = etapas || [];
  let ultimo = -1;
  ETAPAS_ALI.forEach(function (e, i) { if (etapas.indexOf(e) !== -1) ultimo = i; });
  const pasos = ETAPAS_ALI.map(function (e, i) {
    const done = etapas.indexOf(e) !== -1;
    const reached = i <= ultimo;
    return '<div class="trk-step ' + (done ? 'done' : (reached ? 'reached' : '')) + '">' +
      '<div class="trk-dot">' + (done ? icoHTML('check') : (i + 1)) + '</div>' +
      '<div class="trk-lbl">' + e + '</div>' +
    '</div>';
  }).join('<div class="trk-line ' + (ultimo >= 1 ? 'on' : '') + '"></div>');
  // Línea entre paso 2 y 3 depende de si se alcanzó "Final"
  return '<div class="tracker">' + pasos + '</div>';
}

// ── Formulario ──
function editarAlianza(docId) { abrirFormAlianza(docId); }

function abrirFormAlianza(docId) {
  docId = docId || null;
  const a = docId ? CAT.alianzas.find(function (x) { return x._docId === docId; }) : null;
  const sel = a ? (a.asociaciones || []) : [];

  const asocChecks = CAT.asocAmbiente.map(function (x) {
    const on = sel.indexOf(x.id_asociacion) !== -1 ? 'checked' : '';
    return '<label class="ms-opt"><input type="checkbox" value="' + esc(x.id_asociacion) + '" ' + on + ' onchange="recalcAlianza()"><span>' + esc(x.nombre) + '</span></label>';
  }).join('');

  const etapaChecks = ETAPAS_ALI.map(function (e) {
    const on = a && (a.etapas || []).indexOf(e) !== -1 ? 'checked' : '';
    return '<label class="chk-pill"><input type="checkbox" id="ali-etapa-' + e.toLowerCase() + '" ' + on + '><span>' + e + '</span></label>';
  }).join('');

  abrirModal(
    '<div class="modal modal-lg">' +
      '<div class="modal-head"><div><div class="modal-title">' + (a ? 'Editar' : 'Nueva') + ' alianza</div>' +
        '<div class="modal-sub">Convenio público/privado</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-grid-2">' +
          '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Nombre del convenio *</label>' +
            '<input type="text" class="form-input" id="ali-convenio" value="' + esc(a ? a.nombre_convenio : '') + '" placeholder="Ej. Convenio con Municipio de Quito"></div>' +
          '<div class="form-group"><label class="form-label">Aliado principal</label><input type="text" class="form-input" id="ali-principal" value="' + esc(a ? a.aliado_principal : '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Aliado secundario</label><input type="text" class="form-input" id="ali-secundario" value="' + esc(a ? a.aliado_secundario : '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Año</label><input type="number" class="form-input" id="ali-anio" min="2000" max="2100" step="1" value="' + (a ? a.anio : new Date().getFullYear()) + '"></div>' +
          '<div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="ali-tipo">' +
            '<option value="Público"' + (!a || a.tipo !== 'Privado' ? ' selected' : '') + '>Público</option>' +
            '<option value="Privado"' + (a && a.tipo === 'Privado' ? ' selected' : '') + '>Privado</option>' +
          '</select></div>' +
          '<div class="form-group"><label class="form-label">Estado</label><select class="form-select" id="ali-estado">' +
            '<option value="activo"' + (!a || a.activo !== false ? ' selected' : '') + '>Activo</option>' +
            '<option value="inactivo"' + (a && a.activo === false ? ' selected' : '') + '>Inactivo</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="form-label" style="margin:16px 0 8px">Asociaciones beneficiarias</div>' +
        '<div class="ms-box" id="ali-asocs">' + (asocChecks || '<div style="padding:10px;color:var(--text-dim);font-size:13px">No hay asociaciones en el catálogo</div>') + '</div>' +
        '<div class="ali-derivados">' +
          '<div><span class="ali-mini">Provincias</span><div id="ali-provincias" class="ali-deriv-val">—</div></div>' +
          '<div><span class="ali-mini">N° recicladores beneficiarios</span><div id="ali-numrec" class="ali-deriv-val">0</div></div>' +
        '</div>' +
        '<div class="form-label" style="margin:16px 0 8px">Etapa</div>' +
        '<div class="chk-pills">' + etapaChecks + '</div>' +
        '<div class="form-group" style="margin-top:16px"><label class="form-label">Observaciones</label>' +
          '<textarea class="form-textarea" id="ali-obs" placeholder="Notas del convenio…">' + esc(a ? a.observaciones : '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        (puedeEditar() ? '<button class="btn btn-primary" id="ali-save-btn" onclick="guardarAlianza(' + (docId ? '\'' + jsEsc(docId) + '\'' : 'null') + ')">Guardar</button>' : '') +
      '</div>' +
    '</div>'
  );
  recalcAlianza();
}

// Lee las asociaciones marcadas en el form.
function _asocsMarcadas() {
  const box = document.getElementById('ali-asocs');
  if (!box) return [];
  return Array.from(box.querySelectorAll('input:checked')).map(function (i) { return i.value; });
}

// Recalcula provincias (derivadas) y suma de recicladores al cambiar la selección.
function recalcAlianza() {
  const ids = _asocsMarcadas();
  const provs = Array.from(new Set(ids.map(provinciaDeAsociacion).filter(Boolean))).sort();
  const suma = ids.reduce(function (acc, id) { return acc + numRecicladoresDeAsociacion(id); }, 0);
  const pEl = document.getElementById('ali-provincias');
  const nEl = document.getElementById('ali-numrec');
  if (pEl) pEl.innerHTML = provs.length ? provs.map(function (p) { return '<span class="ali-chip">' + esc(p) + '</span>'; }).join('') : '—';
  if (nEl) nEl.textContent = fmtNum(suma);
}

function _etapasMarcadas() {
  return ETAPAS_ALI.filter(function (e) { const el = document.getElementById('ali-etapa-' + e.toLowerCase()); return el && el.checked; });
}

// ── Guardar ──
async function guardarAlianza(docId) {
  const convenio = ((document.getElementById('ali-convenio') || {}).value || '').trim();
  if (!convenio) { showToast('El nombre del convenio es obligatorio'); return; }

  const ids = _asocsMarcadas();
  const provs = Array.from(new Set(ids.map(provinciaDeAsociacion).filter(Boolean))).sort();
  const suma = ids.reduce(function (acc, id) { return acc + numRecicladoresDeAsociacion(id); }, 0);
  const actual = docId ? CAT.alianzas.find(function (x) { return x._docId === docId; }) : null;

  const o = {
    id_alianza:        actual ? actual.id_alianza : nuevoId('ALI'),
    nombre_convenio:   convenio,
    tipo:              ((document.getElementById('ali-tipo') || {}).value) || 'Público',
    activo:            ((document.getElementById('ali-estado') || {}).value) !== 'inactivo',
    aliado_principal:  ((document.getElementById('ali-principal') || {}).value || '').trim(),
    aliado_secundario: ((document.getElementById('ali-secundario') || {}).value || '').trim(),
    asociaciones:      ids,
    provincias:        provs,
    anio:              (document.getElementById('ali-anio') || {}).value || '',
    num_recicladores:  suma,
    etapas:            _etapasMarcadas(),
    observaciones:     ((document.getElementById('ali-obs') || {}).value || '').trim(),
    id_carpeta_drive:  actual ? actual.id_carpeta_drive : '',
  };

  const btn = document.getElementById('ali-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  // Carpeta de Drive: Alianzas > <Convenio>
  if (!o.id_carpeta_drive) {
    const tok = driveToken();
    if (tok) {
      try { o.id_carpeta_drive = await driveBuscarOCrear(convenio, DRIVE_PARENTS.alianzas, tok); }
      catch (e) { console.warn('Drive alianza:', e); showToast('No se pudo crear la carpeta (se guarda igual)'); }
    } else {
      showToast('Sesión de Drive expirada: se guarda sin carpeta');
    }
  }

  const fs = alianzaToFS(o);
  let r;
  if (docId) {
    r = await fsWrite(function () { return window.fb.updateDoc(fsDoc('Alianzas', docId), fs); });
    if (r.ok) { const i = CAT.alianzas.findIndex(function (x) { return x._docId === docId; }); if (i >= 0) CAT.alianzas[i] = alianzaFromFS(Object.assign({ _docId: docId }, fs)); }
  } else {
    const ref = window.fb.doc(fsCol('Alianzas'));
    r = await fsWrite(function () { return window.fb.setDoc(ref, fs); });
    if (r.ok) CAT.alianzas.push(alianzaFromFS(Object.assign({ _docId: ref.id }, fs)));
  }

  if (!r.ok) { showToast('Error al guardar: ' + (r.error || '')); if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; } return; }
  showToast(r.offline ? 'Guardado (se sincronizará) ✓' : 'Guardado ✓');
  cerrarModal();
  cargarAlianzas();
}

// ── Eliminar (registro + papelera de la carpeta del convenio) ──
function confirmarEliminarAlianza(docId, carpetaId) {
  abrirModal(
    '<div class="modal" style="max-width:440px">' +
      '<div class="modal-head"><div class="modal-title">Eliminar alianza</div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body"><p style="color:var(--text-muted);font-size:14px;line-height:1.6">' +
        '¿Seguro que quieres eliminar esta alianza? Se quitará el registro y la carpeta del convenio se enviará a la papelera de Drive.' +
      '</p></div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-danger" onclick="eliminarAlianza(\'' + jsEsc(docId) + '\',\'' + jsEsc(carpetaId) + '\')">Eliminar</button>' +
      '</div>' +
    '</div>'
  );
}

async function eliminarAlianza(docId, carpetaId) {
  if (!docId) { showToast('No se encontró la alianza'); return; }
  if (carpetaId) {
    const tok = driveToken();
    if (tok) { try { await driveEliminarCarpeta(carpetaId, tok); } catch (e) { console.warn('Drive papelera alianza:', e); } }
  }
  const r = await fsWrite(function () { return window.fb.deleteDoc(fsDoc('Alianzas', docId)); });
  if (!r.ok) { showToast('Error al eliminar: ' + (r.error || '')); return; }
  CAT.alianzas = CAT.alianzas.filter(function (x) { return x._docId !== docId; });
  showToast(r.offline ? 'Eliminado (se sincronizará) ✓' : 'Alianza eliminada ✓');
  cerrarModal();
  cargarAlianzas();
}

// ── Exportar Excel ──
async function exportarAlianzasExcel() {
  if (!ALIANZAS_DATA.length) { showToast('No hay datos para exportar.'); return; }
  try {
    await cargarSheetJS();
    if (!window.XLSX) { showToast('No se pudo cargar el exportador'); return; }
    const header = ['Convenio', 'Tipo', 'Estado', 'Aliado Principal', 'Aliado Secundario', 'Provincias', 'Año', 'N° Recicladores', 'Etapas', 'Asociaciones', 'Observaciones', 'URL Carpeta'];
    const filas = ALIANZAS_DATA.map(function (a) {
      const nombres = (a.asociaciones || []).map(function (id) { return nombreDeAsociacion(id) || id; });
      return [a.nombre_convenio, a.tipo || 'Público', a.activo !== false ? 'Activo' : 'Inactivo', a.aliado_principal, a.aliado_secundario, (a.provincias || []).join(', '),
        parseFloat(a.anio) || 0, parseFloat(a.num_recicladores) || 0, (a.etapas || []).join(', '),
        nombres.join(', '), a.observaciones || '', urlCarpeta(a.id_carpeta_drive)];
    });
    const ws = XLSX.utils.aoa_to_sheet([header].concat(filas));
    ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 9 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 7 }, { wch: 14 }, { wch: 22 }, { wch: 36 }, { wch: 30 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alianzas');
    XLSX.writeFile(wb, 'Alianzas_' + new Date().toISOString().substring(0, 10) + '.xlsx');
    showToast('Excel descargado ✓');
  } catch (e) { console.error('export alianzas:', e); showToast('Error al exportar'); }
}

// ── Estilos propios ──
(function () {
  if (document.getElementById('ali-styles')) return;
  const s = document.createElement('style');
  s.id = 'ali-styles';
  s.textContent = `
    /* Multiselección */
    .ms-box { max-height:200px; overflow-y:auto; border:1.5px solid var(--border); border-radius:12px; padding:6px; }
    .ms-opt { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:8px; font-size:14px; color:var(--text); cursor:pointer; }
    .ms-opt:hover { background:var(--surface-hover); }
    .ms-opt input { width:17px; height:17px; accent-color:#506CFF; flex-shrink:0; }

    .ali-derivados { display:flex; gap:12px; margin-top:12px; }
    .ali-derivados > div { flex:1; background:var(--surface-hover); border:1px solid var(--border); border-radius:12px; padding:10px 12px; }
    .ali-deriv-val { font-size:15px; font-weight:700; color:var(--text); margin-top:5px; display:flex; flex-wrap:wrap; gap:5px; }

    /* Pills de etapa (form) */
    .chk-pills { display:flex; gap:8px; flex-wrap:wrap; }
    .chk-pill { position:relative; }
    .chk-pill input { position:absolute; opacity:0; }
    .chk-pill span { display:inline-block; padding:8px 16px; border:1.5px solid var(--border); border-radius:20px; font-size:13px; font-weight:600; color:var(--text-muted); cursor:pointer; transition:.15s; }
    .chk-pill input:checked + span { background-image:var(--grad-b); color:#fff; border-color:transparent; }

    /* Chips */
    .ali-chips { display:flex; flex-wrap:wrap; gap:6px; }
    .ali-chip { display:inline-block; padding:4px 11px; background:var(--surface-hover); border:1px solid var(--border); border-radius:16px; font-size:12px; font-weight:600; color:var(--text); }

    /* Tracker (barra de progreso) */
    .tracker { display:flex; align-items:center; padding:6px 4px; }
    .trk-step { display:flex; flex-direction:column; align-items:center; gap:7px; flex-shrink:0; }
    .trk-dot { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; background:#eef0f4; color:var(--text-dim); border:2px solid #eef0f4; }
    .trk-dot svg { width:18px; height:18px; }
    .trk-lbl { font-size:12px; font-weight:600; color:var(--text-dim); }
    .trk-step.reached .trk-dot { border-color:#506CFF; color:#506CFF; }
    .trk-step.done .trk-dot { background-image:var(--grad-b); color:#fff; border-color:transparent; }
    .trk-step.done .trk-lbl, .trk-step.reached .trk-lbl { color:var(--text); }
    .trk-line { flex:1; height:3px; background:#eef0f4; margin:0 8px; margin-bottom:26px; border-radius:2px; }
    .trk-line.on { background-image:var(--grad-b); }

    /* Tarjetas móviles */
    .ali-mob { display:none; flex-direction:column; gap:12px; }
    .ali-card { background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:16px; cursor:pointer; transition:box-shadow .15s,transform .12s,border-color .15s; }
    .ali-card:hover { box-shadow:0 6px 20px rgba(0,0,0,.08); transform:translateY(-2px); border-color:transparent; }
    .ali-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
    .ali-nombre { font-size:16px; font-weight:700; color:var(--text); line-height:1.3; }
    .ali-card-mid { margin-top:12px; }
    .ali-grid { display:flex; gap:10px; margin-top:12px; padding-top:12px; border-top:1px solid var(--border); }
    .ali-cell { flex:1; display:flex; flex-direction:column; gap:5px; min-width:0; }
    .ali-cell b { font-size:14px; font-weight:700; color:var(--text); }
    .ali-mini { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.5px; }
    .ali-foot { display:flex; justify-content:flex-end; margin-top:14px; }

    /* Tarjetas-resumen */
    .ali-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:18px; }
    .ali-stat { display:flex; align-items:center; gap:12px; background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:15px 16px; }
    .ali-stat-ico { width:44px; height:44px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .ali-stat-ico svg { width:22px; height:22px; }
    .ali-stat-txt { display:flex; flex-direction:column; min-width:0; }
    .ali-stat-tit { font-size:11.5px; color:var(--text-muted); font-weight:600; }
    .ali-stat-txt b { font-size:24px; font-weight:800; color:var(--text); line-height:1.15; }
    .ali-stat-sub { font-size:11px; color:var(--text-dim); }

    /* Convenio: tipo + estado */
    .ali-conv-nombre { font-weight:700; color:var(--text); font-size:14px; }
    .ali-conv-meta { display:flex; align-items:center; gap:8px; margin-top:5px; }
    .ali-tipo { font-size:12px; color:var(--text-muted); }
    .ali-estado { font-size:10.5px; font-weight:700; padding:3px 9px; border-radius:20px; }
    .ali-estado-on { background:rgba(24,174,151,.14); color:#0f9b84; }
    .ali-estado-off { background:rgba(0,0,0,.06); color:var(--text-dim); }

    /* Barra de etapa (tabla) */
    .ali-etapa-barra { display:flex; flex-direction:column; gap:6px; }
    .ali-etapa-lbl { display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:var(--text); }
    .ali-etapa-punto { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .ali-etapa-track { position:relative; height:8px; background:#eef0f4; border-radius:20px; display:flex; align-items:center; justify-content:space-between; padding:0 1px; }
    .ali-etapa-fill { position:absolute; left:0; top:0; bottom:0; border-radius:20px; }
    .ali-dot { position:relative; width:10px; height:10px; border-radius:50%; background:#fff; border:2px solid #d7d7e0; z-index:1; }
    .ali-etapa-frac { font-size:11px; font-weight:600; color:var(--text-muted); }

    /* Beneficiarios (celda) */
    .ali-benef { display:inline-flex; align-items:center; gap:9px; }
    .ali-benef-ico { width:34px; height:34px; border-radius:10px; background:rgba(80,108,255,.1); color:#506CFF; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .ali-benef-ico svg { width:18px; height:18px; }
    .ali-benef-txt { display:flex; flex-direction:column; line-height:1.15; }
    .ali-benef-txt b { font-size:15px; font-weight:800; color:var(--text); }
    .ali-benef-txt small { font-size:11px; color:var(--text-dim); }

    .ali-desk table tbody tr { cursor:pointer; }

    /* Paginación */
    .ali-pager { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:14px; flex-wrap:wrap; }
    .ali-pager-info { font-size:12px; color:var(--text-dim); }
    .ali-pager-ctrls { display:flex; align-items:center; gap:6px; }
    .ali-pg-btn, .ali-pg-num { min-width:32px; height:32px; border:1px solid var(--border); background:var(--surface); border-radius:9px; font-family:inherit; font-size:13px; font-weight:600; color:var(--text-muted); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:.13s; }
    .ali-pg-btn:hover:not(:disabled), .ali-pg-num:hover { background:rgba(80,108,255,.08); color:#506CFF; }
    .ali-pg-btn:disabled { opacity:.4; cursor:default; }
    .ali-pg-num.on { background:#506CFF; color:#fff; border-color:#506CFF; }

    @media (max-width:768px) {
      .ali-desk { display:none; }
      .ali-mob { display:flex; }
      .ali-derivados { flex-direction:column; }
      .ali-stats { grid-template-columns:1fr 1fr; }
      .form-grid-2 { grid-template-columns:1fr 1fr; }
    }
  `;
  document.head.appendChild(s);
})();
