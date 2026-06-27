// ============================================================
// DASHBOARD ASOCIATIVO — asociaciones.js
// Ficha asociativa: CRUD + checklist de documentos + carpeta Drive.
// Colección: Asoc_Asociativo
// ============================================================

let ASOC_FILTROS = { prov: [], cat: [] };
let ASOCIACIONES_DATA = [];

const CATEGORIAS_ASOC = ['Líderes de ReCircula', 'En Fortalecimiento', 'En Acompañamiento'];

// ── Filtros (drawer): provincia + categoría (categoría = diagnóstico vigente) ──
function registerAsociacionesFilters() {
  registerFilterConfig('asociaciones', {
    badgeId: 'asoc-filter-badge',
    sections: [
      { key: 'prov', title: 'Provincia', type: 'options', options: _provinciasAsoc() },
      { key: 'cat',  title: 'Categoría', type: 'options', options: CATEGORIAS_ASOC },
    ],
    getValue: function (k) { return ASOC_FILTROS[k] || []; },
    setValue: function (k, v) { ASOC_FILTROS[k] = v; },
    apply: function () { cargarAsociaciones(); },
  });
}

function _provinciasAsoc() {
  return Array.from(new Set(CAT.asociaciones.map(function (a) { return a.provincia; }).filter(Boolean))).sort();
}

// ── Render principal ──
function renderAsociaciones() {
  registerAsociacionesFilters();
  const puedeEditar = SESSION.rol !== 'Visualizador';
  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Asociaciones</div><div class="page-sub">Registro</div></div>' +
      '<div class="hdr-actions">' +
        '<button class="hdr-circle" onclick="openFilterDrawer(\'asociaciones\')" title="Filtros">' +
          icoHTML('filter') + '<span class="filter-badge" id="asoc-filter-badge" style="display:none">0</span></button>' +
        '<button class="hdr-circle" onclick="exportarAsociacionesExcel()" title="Descargar Excel">' + icoHTML('download') + '</button>' +
        (puedeEditar ? '<button class="hdr-circle hdr-circle-primary" onclick="abrirFormAsociacion()" title="Nueva asociación">' + icoHTML('plus') + '</button>' : '') +
      '</div>' +
    '</div>' +
    '<div id="asoc-table-wrap"></div>';
  cargarAsociaciones();
  updateFilterBadge('asociaciones');
}

function cargarAsociaciones() {
  ASOCIACIONES_DATA = CAT.asociaciones.filter(function (a) {
    return pasaFiltro(ASOC_FILTROS.prov, a.provincia) &&
           pasaFiltro(ASOC_FILTROS.cat, categoriaVigente(a.id_asociacion));
  }).slice().sort(function (a, b) {
    const p = (a.provincia || '').localeCompare(b.provincia || '');
    return p !== 0 ? p : (a.nombre || '').localeCompare(b.nombre || '');
  });
  renderTablaAsociaciones();
}

function renderTablaAsociaciones() {
  const wrap = document.getElementById('asoc-table-wrap');
  if (!wrap) return;
  if (!ASOCIACIONES_DATA.length) {
    wrap.innerHTML = '<div class="empty-state">' +
      icoHTML('folder').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"') +
      '<p>No hay asociaciones con estos filtros</p></div>';
    return;
  }
  const puedeEditar = SESSION.rol !== 'Visualizador';
  const acciones = function (a) {
    const docId = jsEsc(a._docId || '');
    const carpeta = jsEsc(a.id_carpeta_drive || '');
    return (carpeta ? '<button class="icon-btn" onclick="window.open(\'https://drive.google.com/drive/folders/' + carpeta + '\',\'_blank\')" title="Carpeta">' + icoHTML('folder') + '</button>' : '') +
      '<button class="icon-btn" onclick="verAsociacion(\'' + docId + '\')" title="Ver">' + icoHTML('view') + '</button>' +
      (puedeEditar ? '<button class="icon-btn primary" onclick="editarAsociacion(\'' + docId + '\')" title="Editar">' + icoHTML('edit') + '</button>' : '');
  };

  // ── Tabla (desktop) ──
  const filas = ASOCIACIONES_DATA.map(function (a) {
    return '<tr>' +
      '<td style="font-weight:600">' + esc(a.nombre || '—') + '</td>' +
      '<td>' + esc(a.provincia || '—') + '</td>' +
      '<td style="text-align:right">' + fmtNum(a.num_recicladores) + '</td>' +
      '<td>' + _docDots(a) + '</td>' +
      '<td data-actions-row><div class="td-actions">' + acciones(a) + '</div></td>' +
    '</tr>';
  }).join('');
  const tabla = '<div class="table-wrap fic-desk"><table>' +
    '<thead><tr><th>Asociación</th><th>Provincia</th><th style="text-align:right">Recicladores</th><th>Documentos</th><th></th></tr></thead>' +
    '<tbody>' + filas + '</tbody></table></div>';

  // ── Tarjetas (móvil) ──
  const cards = ASOCIACIONES_DATA.map(function (a) {
    return '<div class="fic-card">' +
      '<div class="fic-top"><div class="fic-id"><div class="fic-label">Asociación</div>' +
        '<div class="fic-nombre">' + esc(a.nombre || '—') + '</div></div></div>' +
      '<div class="fic-grid">' +
        '<div class="fic-cell"><span class="fic-mini">Provincia</span><b>' + esc(a.provincia || '—') + '</b></div>' +
        '<div class="fic-cell"><span class="fic-mini">Recicladores</span><b>' + fmtNum(a.num_recicladores) + '</b></div>' +
      '</div>' +
      '<div class="fic-docs"><span class="fic-mini">Documentos</span>' + _docDots(a) + '</div>' +
      '<div class="fic-foot"><div class="td-actions">' + acciones(a) + '</div></div>' +
    '</div>';
  }).join('');
  const cardsWrap = '<div class="fic-mob">' + cards + '</div>';

  wrap.innerHTML = tabla + cardsWrap +
    '<div style="font-size:12px;color:var(--text-dim);text-align:right;margin-top:10px">' + ASOCIACIONES_DATA.length + ' registro' + (ASOCIACIONES_DATA.length !== 1 ? 's' : '') + '</div>';
}

// Indicadores compactos del checklist (5 documentos)
function _docDots(a) {
  const items = [
    ['Documento legal', a.doc_legal], ['Estatutos', a.estatutos],
    ['Directiva', a.directiva], ['Acta de compromiso', a.acta_compromiso], ['Ficha del reciclador', a.ficha_reciclador],
  ];
  return '<div class="doc-dots">' + items.map(function (it) {
    return '<span class="doc-dot ' + (it[1] ? 'on' : '') + '" title="' + esc(it[0]) + (it[1] ? ': Sí' : ': No') + '">' + (it[1] ? icoHTML('check') : '') + '</span>';
  }).join('') + '</div>';
}

// ── Ver ficha (solo lectura) ──
function verAsociacion(docId) {
  const a = CAT.asociaciones.find(function (x) { return x._docId === docId; });
  if (!a) { showToast('Ficha no encontrada'); return; }
  const items = [
    ['Documento legal central', a.doc_legal], ['Estatutos', a.estatutos],
    ['Directiva', a.directiva], ['Acta de compromiso', a.acta_compromiso], ['Ficha del reciclador', a.ficha_reciclador],
  ];
  const lista = items.map(function (it) {
    return '<div class="ficha-check"><span>' + esc(it[0]) + '</span>' +
      (it[1] ? '<span class="ficha-si">' + icoHTML('check') + ' Sí</span>' : '<span class="ficha-no">No</span>') + '</div>';
  }).join('');
  abrirModal(
    '<div class="modal">' +
      '<div class="modal-head"><div><div class="modal-title">' + esc(a.nombre) + '</div>' +
        '<div class="modal-sub">' + esc(a.provincia || '—') + ' · ' + categoriaBadge(categoriaVigente(a.id_asociacion)) + '</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-grid-2" style="margin-bottom:16px">' +
          '<div><div class="form-label">N° de recicladores</div><div style="font-size:18px;font-weight:700">' + fmtNum(a.num_recicladores) + '</div></div>' +
          '<div><div class="form-label">Carpeta de Drive</div><div style="font-size:14px">' +
            (a.id_carpeta_drive ? '<a href="' + urlCarpeta(a.id_carpeta_drive) + '" target="_blank" rel="noopener" style="color:#506CFF;font-weight:600">Abrir carpeta ↗</a>' : '—') +
          '</div></div>' +
        '</div>' +
        '<div class="form-label" style="margin-bottom:8px">Checklist de documentos</div>' + lista +
        (a.observaciones ? '<div style="margin-top:14px"><div class="form-label">Observaciones</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">' + esc(a.observaciones) + '</div></div>' : '') +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn-glass" onclick="cerrarModal()">Cerrar</button></div>' +
    '</div>'
  );
}

// ── Formulario ──
function editarAsociacion(docId) { abrirFormAsociacion(docId); }

function abrirFormAsociacion(docId) {
  docId = docId || null;
  const a = docId ? CAT.asociaciones.find(function (x) { return x._docId === docId; }) : null;
  const editing = !!a;

  const asocField = editing
    ? '<input type="text" class="form-input" value="' + esc(a.nombre) + '" readonly>' +
      '<input type="hidden" id="asoc-asoc" value="' + esc(a.id_asociacion) + '">'
    : '<select class="form-select" id="asoc-asoc" onchange="onAsocChangeAsoc(this.value)">' +
        '<option value="">Seleccioná una asociación…</option>' + _asocOptions('') + '</select>';

  abrirModal(
    '<div class="modal">' +
      '<div class="modal-head"><div><div class="modal-title">' + (editing ? 'Editar' : 'Nueva') + ' asociación</div>' +
        '<div class="modal-sub">Ficha asociativa</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-grid-2">' +
          '<div class="form-group"><label class="form-label">Asociación</label>' + asocField + '</div>' +
          '<div class="form-group"><label class="form-label">Provincia</label>' +
            '<input type="text" class="form-input" id="asoc-provincia" readonly value="' + esc(a ? a.provincia : '') + '"></div>' +
          '<div class="form-group"><label class="form-label">N° de recicladores</label>' +
            '<input type="number" class="form-input" id="asoc-recic" min="0" step="1" value="' + (a ? a.num_recicladores : '') + '"></div>' +
        '</div>' +
        '<div class="form-label" style="margin:16px 0 8px">Checklist de documentos (en Drive)</div>' +
        _sino('asoc-legal', 'Documento legal central', a ? a.doc_legal : false) +
        _sino('asoc-estatutos', 'Estatutos', a ? a.estatutos : false) +
        _sino('asoc-directiva', 'Directiva', a ? a.directiva : false) +
        _sino('asoc-acta', 'Acta de compromiso', a ? a.acta_compromiso : false) +
        _sino('asoc-ficha', 'Ficha del reciclador', a ? a.ficha_reciclador : false) +
        '<div class="form-group" style="margin-top:16px"><label class="form-label">Observaciones</label>' +
          '<textarea class="form-textarea" id="asoc-obs" placeholder="Notas adicionales…">' + esc(a ? a.observaciones : '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-primary" id="asoc-save-btn" onclick="guardarAsociacion(' + (docId ? '\'' + jsEsc(docId) + '\'' : 'null') + ')">Guardar</button>' +
      '</div>' +
    '</div>'
  );
}

function _asocOptions(selId) {
  return CAT.asocAmbiente.map(function (a) {
    return '<option value="' + esc(a.id_asociacion) + '"' + (a.id_asociacion === selId ? ' selected' : '') + '>' + esc(a.nombre) + '</option>';
  }).join('');
}

function _sino(id, label, checked) {
  return '<label class="sino-row"><span>' + esc(label) + '</span>' +
    '<span class="sino-switch"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><span class="sino-slider"></span></span></label>';
}

function onAsocChangeAsoc(idAsoc) {
  const amb = CAT.asocAmbiente.find(function (a) { return a.id_asociacion === idAsoc; });
  const prov = document.getElementById('asoc-provincia');
  if (prov) prov.value = amb ? (amb.provincia || '') : '';
}

// ── Guardar ──
async function guardarAsociacion(docId) {
  const idAsoc = (document.getElementById('asoc-asoc') || {}).value || '';
  if (!idAsoc) { showToast('Elegí una asociación'); return; }

  if (!docId) {
    const dup = CAT.asociaciones.find(function (a) { return a.id_asociacion === idAsoc; });
    if (dup) { showToast('Ya existe una ficha para esa asociación'); return; }
  }

  const amb = CAT.asocAmbiente.find(function (a) { return a.id_asociacion === idAsoc; });
  const actual = docId ? CAT.asociaciones.find(function (a) { return a._docId === docId; }) : null;

  const o = {
    id_asociacion:   idAsoc,
    nombre:          amb ? amb.nombre : (actual ? actual.nombre : ''),
    provincia:       amb ? amb.provincia : (actual ? actual.provincia : ((document.getElementById('asoc-provincia') || {}).value || '')),
    num_recicladores:(document.getElementById('asoc-recic') || {}).value || 0,
    doc_legal:       _chk('asoc-legal'),
    estatutos:       _chk('asoc-estatutos'),
    directiva:       _chk('asoc-directiva'),
    acta_compromiso: _chk('asoc-acta'),
    ficha_reciclador:_chk('asoc-ficha'),
    observaciones:   (document.getElementById('asoc-obs') || {}).value || '',
    id_carpeta_drive:(actual && actual.id_carpeta_drive) ? actual.id_carpeta_drive : '',
  };

  const btn = document.getElementById('asoc-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  // Carpeta de Drive (si no tiene y hay token): Documento General > <Asociación>
  if (!o.id_carpeta_drive) {
    const tok = driveToken();
    if (tok) {
      try { o.id_carpeta_drive = await driveBuscarOCrear(o.nombre || idAsoc, DRIVE_PARENTS.asociaciones, tok); }
      catch (e) { console.warn('Drive asociación:', e); showToast('No se pudo crear la carpeta (se guarda igual)'); }
    } else {
      showToast('Sesión de Drive expirada: se guarda sin carpeta');
    }
  }

  const fs = asociacionToFS(o);
  let r;
  if (docId) {
    r = await fsWrite(function () { return window.fb.updateDoc(fsDoc('Asoc_Asociativo', docId), fs); });
    if (r.ok) { const i = CAT.asociaciones.findIndex(function (a) { return a._docId === docId; }); if (i >= 0) CAT.asociaciones[i] = asociacionFromFS(Object.assign({ _docId: docId }, fs)); }
  } else {
    const ref = window.fb.doc(fsCol('Asoc_Asociativo'));
    r = await fsWrite(function () { return window.fb.setDoc(ref, fs); });
    if (r.ok) { CAT.asociaciones.push(asociacionFromFS(Object.assign({ _docId: ref.id }, fs))); CAT.asociaciones.sort(byNombre); }
  }

  if (!r.ok) { showToast('Error al guardar: ' + (r.error || '')); if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; } return; }
  showToast(r.offline ? 'Guardado (se sincronizará) ✓' : 'Guardado ✓');
  cerrarModal();
  cargarAsociaciones();
}

function _chk(id) { const el = document.getElementById(id); return !!(el && el.checked); }

// ── Exportar Excel ──
async function exportarAsociacionesExcel() {
  if (!ASOCIACIONES_DATA.length) { showToast('No hay datos para exportar.'); return; }
  try {
    await cargarSheetJS();
    if (!window.XLSX) { showToast('No se pudo cargar el exportador'); return; }
    const sino = function (b) { return b ? 'Sí' : 'No'; };
    const header = ['Asociación', 'Provincia', 'N° Recicladores', 'Doc. legal central', 'Estatutos', 'Directiva', 'Acta de compromiso', 'Ficha del reciclador', 'Categoría', 'Observaciones', 'URL Carpeta'];
    const filas = ASOCIACIONES_DATA.map(function (a) {
      return [a.nombre, a.provincia, parseFloat(a.num_recicladores) || 0,
        sino(a.doc_legal), sino(a.estatutos), sino(a.directiva), sino(a.acta_compromiso), sino(a.ficha_reciclador),
        categoriaVigente(a.id_asociacion) || '', a.observaciones || '', urlCarpeta(a.id_carpeta_drive)];
    });
    const ws = XLSX.utils.aoa_to_sheet([header].concat(filas));
    ws['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 11 }, { wch: 11 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 30 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asociaciones');
    XLSX.writeFile(wb, 'Asociaciones_' + new Date().toISOString().substring(0, 10) + '.xlsx');
    showToast('Excel descargado ✓');
  } catch (e) { console.error('export asociaciones:', e); showToast('Error al exportar'); }
}

// ── Estilos propios (switch Sí/No + indicadores de documentos + ficha) ──
(function () {
  if (document.getElementById('asoc-styles')) return;
  const s = document.createElement('style');
  s.id = 'asoc-styles';
  s.textContent = `
    .sino-row { display:flex; align-items:center; justify-content:space-between; padding:11px 14px; border:1.5px solid var(--border); border-radius:12px; margin-bottom:10px; font-size:14px; color:var(--text); }
    .sino-switch { position:relative; width:44px; height:24px; flex-shrink:0; }
    .sino-switch input { opacity:0; width:0; height:0; position:absolute; }
    .sino-slider { position:absolute; inset:0; background:#d7d7e0; border-radius:24px; transition:.2s; cursor:pointer; }
    .sino-slider::before { content:""; position:absolute; width:18px; height:18px; left:3px; top:3px; background:#fff; border-radius:50%; transition:.2s; box-shadow:0 1px 2px rgba(0,0,0,.2); }
    .sino-switch input:checked + .sino-slider { background-image:var(--grad-c); }
    .sino-switch input:checked + .sino-slider::before { transform:translateX(20px); }

    .doc-dots { display:inline-flex; gap:5px; }
    .doc-dot { width:18px; height:18px; border-radius:50%; background:#e7e7ef; display:inline-flex; align-items:center; justify-content:center; color:#fff; }
    .doc-dot.on { background-image:var(--grad-c); }
    .doc-dot svg { width:11px; height:11px; }

    .ficha-check { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border); font-size:14px; color:var(--text); }
    .ficha-check:last-child { border-bottom:none; }
    .ficha-si { display:inline-flex; align-items:center; gap:5px; color:#0a9e83; font-weight:600; font-size:13px; }
    .ficha-si svg { width:14px; height:14px; }
    .ficha-no { color:var(--text-dim); font-size:13px; font-weight:600; }

    /* Tarjetas móviles de la ficha asociativa */
    .fic-mob { display:none; flex-direction:column; gap:12px; }
    .fic-card { background:var(--surface); border-radius:20px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.04); }
    .fic-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
    .fic-id { min-width:0; }
    .fic-label { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.7px; }
    .fic-nombre { font-size:16px; font-weight:700; color:var(--text); margin-top:2px; line-height:1.3; }
    .fic-grid { display:flex; gap:10px; margin-top:14px; }
    .fic-cell { flex:1; display:flex; flex-direction:column; gap:5px; align-items:flex-start; min-width:0; }
    .fic-cell b { font-size:15px; font-weight:700; color:var(--text); }
    .fic-mini { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.5px; }
    .fic-docs { display:flex; align-items:center; gap:10px; margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }
    .fic-foot { display:flex; justify-content:flex-end; margin-top:14px; }

    @media (max-width:768px) {
      .fic-desk { display:none; }
      .fic-mob { display:flex; }
    }
  `;
  document.head.appendChild(s);
})();
