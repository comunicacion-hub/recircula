// ============================================================
// DASHBOARD ASOCIATIVO — diagnosticos.js
// Diagnósticos: CRUD + cálculos automáticos (valoración, módulo débil,
// categoría) + carpeta Drive (Diagnósticos > Asociación).
// Colección: Diagnosticos
// ============================================================

let DIAG_FILTROS = { prov: [], cat: [], orden: ['cat'] };
let DIAGNOSTICOS_DATA = [];

const CATEGORIAS_DIAG = ['Líderes de ReCircula', 'En Fortalecimiento', 'En Acompañamiento'];
const TIPOS_DIAG = ['Inicial', 'Cierre'];

function registerDiagnosticosFilters() {
  registerFilterConfig('diagnosticos', {
    badgeId: 'diag-filter-badge',
    sections: [
      { key: 'prov', title: 'Provincia', type: 'options', options: _provinciasDiag() },
      { key: 'cat',  title: 'Categoría', type: 'options', options: CATEGORIAS_DIAG },
      { key: 'orden', title: 'Ordenar por valoración', type: 'radio', noBadge: true, def: 'cat',
        options: [
          { val: 'cat',  lbl: 'Por categoría (predeterminado)' },
          { val: 'desc', lbl: 'Mayor valoración a menor' },
          { val: 'asc',  lbl: 'Menor valoración a mayor' },
        ] },
    ],
    getValue: function (k) { return DIAG_FILTROS[k] || []; },
    setValue: function (k, v) { DIAG_FILTROS[k] = v; },
    apply: function () { cargarDiagnosticos(); },
  });
}

function _provinciasDiag() {
  return Array.from(new Set(CAT.diagnosticos.map(function (d) { return d.provincia; }).filter(Boolean))).sort();
}

function renderDiagnosticos() {
  registerDiagnosticosFilters();
  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Diagnósticos</div><div class="page-sub">Asociativos</div></div>' +
      '<div class="hdr-actions">' +
        '<button class="hdr-circle" onclick="openFilterDrawer(\'diagnosticos\')" title="Filtros">' +
          icoHTML('filter') + '<span class="filter-badge" id="diag-filter-badge" style="display:none">0</span></button>' +
        '<button class="hdr-circle" onclick="exportarDiagnosticosExcel()" title="Descargar Excel">' + icoHTML('download') + '</button>' +
        (puedeEditar() ? '<button class="hdr-circle hdr-circle-primary" onclick="abrirFormDiagnostico()" title="Nuevo diagnóstico">' + icoHTML('plus') + '</button>' : '') +
      '</div>' +
    '</div>' +
    '<div id="diag-table-wrap"></div>';
  cargarDiagnosticos();
  updateFilterBadge('diagnosticos');
}

// Rango de categoría para ordenar (Líderes primero → Acompañamiento último)
function _catRank(d) {
  const c = categoriaDesdePuntaje(parseFloat(d.valoracion_total));
  return c === 'Líderes de ReCircula' ? 0 : c === 'En Fortalecimiento' ? 1 : 2;
}

function cargarDiagnosticos() {
  const orden = (DIAG_FILTROS.orden && DIAG_FILTROS.orden[0]) || 'cat';
  DIAGNOSTICOS_DATA = CAT.diagnosticos.filter(function (d) {
    return pasaFiltro(DIAG_FILTROS.prov, d.provincia) &&
           pasaFiltro(DIAG_FILTROS.cat, categoriaDesdePuntaje(parseFloat(d.valoracion_total)));
  }).slice().sort(function (a, b) {
    const va = parseFloat(a.valoracion_total) || 0, vb = parseFloat(b.valoracion_total) || 0;
    if (orden === 'asc')  return va - vb;
    if (orden === 'desc') return vb - va;
    // Predeterminado: por categoría (Líderes → Acompañamiento), luego mayor valoración
    const ra = _catRank(a), rb = _catRank(b);
    if (ra !== rb) return ra - rb;
    return vb - va;
  });
  renderTablaDiagnosticos();
}

function renderTablaDiagnosticos() {
  const wrap = document.getElementById('diag-table-wrap');
  if (!wrap) return;
  if (!DIAGNOSTICOS_DATA.length) {
    wrap.innerHTML = '<div class="empty-state">' +
      icoHTML('check').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"') +
      '<p>No hay diagnósticos con estos filtros</p></div>';
    return;
  }
  const pct = function (v) { return (v == null || isNaN(v)) ? '—' : fmtNum(v, 1) + '%'; };
  const cat = function (d) { return categoriaDesdePuntaje(parseFloat(d.valoracion_total)); };

  const acciones = function (d) {
    const docId = jsEsc(d._docId || '');
    const carpeta = jsEsc(d.id_carpeta_drive || '');
    return (carpeta ? '<button class="icon-btn" onclick="window.open(\'https://drive.google.com/drive/folders/' + carpeta + '\',\'_blank\')" title="Carpeta">' + icoHTML('folder') + '</button>' : '') +
      '<button class="icon-btn" onclick="verDiagnostico(\'' + docId + '\')" title="Ver">' + icoHTML('view') + '</button>' +
      (puedeEditar() ? '<button class="icon-btn primary" onclick="editarDiagnostico(\'' + docId + '\')" title="Editar">' + icoHTML('edit') + '</button>' : '');
  };

  // ── Tabla (desktop) ──
  const filas = DIAGNOSTICOS_DATA.map(function (d) {
    return '<tr>' +
      '<td style="font-weight:600">' + esc(d.nombre || '—') + '</td>' +
      '<td>' + esc(d.anio || '—') + '</td>' +
      '<td>' + _tipoBadge(d.tipo) + '</td>' +
      '<td style="text-align:right">' + pct(d.p_organizacional) + '</td>' +
      '<td style="text-align:right">' + pct(d.p_productivo) + '</td>' +
      '<td style="text-align:right">' + pct(d.p_empresarial) + '</td>' +
      '<td style="text-align:right">' + pct(d.p_ambiental) + '</td>' +
      '<td style="text-align:right">' + pct(d.p_financiero) + '</td>' +
      '<td style="text-align:right;font-weight:700;color:#0a9e83">' + pct(d.valoracion_total) + '</td>' +
      '<td>' + esc(d.modulo_debil || '—') + '</td>' +
      '<td>' + categoriaBadge(cat(d)) + '</td>' +
      '<td data-actions-row><div class="td-actions">' + acciones(d) + '</div></td>' +
    '</tr>';
  }).join('');
  const tabla = '<div class="table-wrap diag-tabla-desktop"><table>' +
    '<thead><tr><th>Asociación</th><th>Año</th><th>Tipo</th>' +
      '<th style="text-align:right">Organiz.</th><th style="text-align:right">Product.</th><th style="text-align:right">Empres.</th>' +
      '<th style="text-align:right">Ambien.</th><th style="text-align:right">Financ.</th>' +
      '<th style="text-align:right">Valoración</th><th>Módulo débil</th><th>Categoría</th><th></th></tr></thead>' +
    '<tbody>' + filas + '</tbody></table></div>';

  // ── Tarjetas (móvil) ──
  const cards = DIAGNOSTICOS_DATA.map(function (d) {
    return '<div class="diag-card">' +
      '<div class="diag-card-top">' +
        '<div class="diag-card-id"><div class="diag-card-label">Asociación</div><div class="diag-card-nombre">' + esc(d.nombre || '—') + '</div></div>' +
        categoriaBadge(cat(d)) +
      '</div>' +
      '<div class="diag-card-grid">' +
        '<div class="diag-cell"><span class="diag-mini">Año</span><b>' + esc(d.anio || '—') + '</b></div>' +
        '<div class="diag-cell"><span class="diag-mini">Tipo</span>' + _tipoBadge(d.tipo) + '</div>' +
        '<div class="diag-cell"><span class="diag-mini">Valoración</span><b class="diag-val">' + pct(d.valoracion_total) + '</b></div>' +
      '</div>' +
      '<div class="diag-card-foot"><div class="td-actions">' + acciones(d) + '</div></div>' +
    '</div>';
  }).join('');
  const cardsWrap = '<div class="diag-cards-mobile">' + cards + '</div>';

  wrap.innerHTML = tabla + cardsWrap +
    '<div style="font-size:12px;color:var(--text-dim);text-align:right;margin-top:10px">' + DIAGNOSTICOS_DATA.length + ' registro' + (DIAGNOSTICOS_DATA.length !== 1 ? 's' : '') + '</div>';
}

function _tipoBadge(t) {
  return '<span class="badge ' + (t === 'Cierre' ? 'badge-blue' : 'badge-off') + '">' + esc(t || '—') + '</span>';
}

// ── Ver ficha ──
function verDiagnostico(docId) {
  const d = CAT.diagnosticos.find(function (x) { return x._docId === docId; });
  if (!d) { showToast('Diagnóstico no encontrado'); return; }
  const pct = function (v) { return (v == null || isNaN(v)) ? '—' : fmtNum(v, 1) + '%'; };
  const fila = function (lbl, v) {
    return '<tr><td>' + esc(lbl) + '</td><td style="text-align:right;font-weight:600">' + pct(v) + '</td></tr>';
  };
  abrirModal(
    '<div class="modal">' +
      '<div class="modal-head"><div><div class="modal-title">' + esc(d.nombre || 'Diagnóstico') + '</div>' +
        '<div class="modal-sub">' + esc(d.provincia || '—') + ' · ' + esc(d.anio || '') + ' · ' + esc(d.tipo || '') + '</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-grid-2" style="margin-bottom:16px">' +
          '<div><div class="form-label">Valoración total</div><div style="font-size:22px;font-weight:800;color:#0a9e83">' + pct(d.valoracion_total) + '</div></div>' +
          '<div><div class="form-label">Categoría</div><div style="margin-top:4px">' + categoriaBadge(d.categoria) + '</div></div>' +
          '<div><div class="form-label">Módulo más débil</div><div style="font-size:14px;font-weight:600">' + esc(d.modulo_debil || '—') + '</div></div>' +
          '<div><div class="form-label">Carpeta de Drive</div><div style="font-size:14px">' +
            (d.id_carpeta_drive ? '<a href="' + urlCarpeta(d.id_carpeta_drive) + '" target="_blank" rel="noopener" style="color:#506CFF;font-weight:600">Abrir carpeta ↗</a>' : '—') + '</div></div>' +
        '</div>' +
        '<div class="table-wrap" style="border-radius:14px;box-shadow:none;border:1px solid var(--border)"><table>' +
          '<thead><tr><th>Módulo</th><th style="text-align:right">%</th></tr></thead><tbody>' +
            fila('Organizacional', d.p_organizacional) + fila('Productivo', d.p_productivo) + fila('Empresarial', d.p_empresarial) +
            fila('Ambiental', d.p_ambiental) + fila('Financiero', d.p_financiero) +
          '</tbody></table></div>' +
        (d.observaciones ? '<div style="margin-top:14px"><div class="form-label">Observaciones</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">' + esc(d.observaciones) + '</div></div>' : '') +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn-glass" onclick="cerrarModal()">Cerrar</button></div>' +
    '</div>'
  );
}

// ── Formulario ──
function editarDiagnostico(docId) { abrirFormDiagnostico(docId); }

function abrirFormDiagnostico(docId) {
  docId = docId || null;
  const d = docId ? CAT.diagnosticos.find(function (x) { return x._docId === docId; }) : null;
  const editing = !!d;

  const asocField = editing
    ? '<input type="text" class="form-input" value="' + esc(d.nombre) + '" readonly>' +
      '<input type="hidden" id="diag-asoc" value="' + esc(d.id_asociacion) + '">'
    : '<select class="form-select" id="diag-asoc" onchange="onAsocChangeDiag(this.value)">' +
        '<option value="">Seleccioná una asociación…</option>' + _asocOptions('') + '</select>';

  const tipoOpts = TIPOS_DIAG.map(function (t) {
    return '<option value="' + t + '"' + (d && d.tipo === t ? ' selected' : '') + '>' + t + '</option>';
  }).join('');

  const numInput = function (id, val) {
    return '<input type="number" class="form-input" id="' + id + '" min="0" max="100" step="0.1" value="' + (d ? val : '') + '" oninput="recalcDiagnostico()">';
  };

  abrirModal(
    '<div class="modal">' +
      '<div class="modal-head"><div><div class="modal-title">' + (editing ? 'Editar' : 'Nuevo') + ' diagnóstico</div>' +
        '<div class="modal-sub">Diagnóstico asociativo</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-grid-2">' +
          '<div class="form-group"><label class="form-label">Asociación</label>' + asocField + '</div>' +
          '<div class="form-group"><label class="form-label">Provincia</label><input type="text" class="form-input" id="diag-provincia" readonly value="' + esc(d ? d.provincia : '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Año</label><input type="number" class="form-input" id="diag-anio" min="2000" max="2100" step="1" value="' + (d ? d.anio : new Date().getFullYear()) + '"></div>' +
          '<div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="diag-tipo">' + tipoOpts + '</select></div>' +
        '</div>' +
        '<div class="form-label" style="margin:16px 0 8px">Puntajes por módulo (0–100)</div>' +
        '<div class="form-grid-2">' +
          '<div class="form-group"><label class="form-label">Organizacional</label>' + numInput('diag-org', d ? d.p_organizacional : '') + '</div>' +
          '<div class="form-group"><label class="form-label">Productivo</label>' + numInput('diag-prod', d ? d.p_productivo : '') + '</div>' +
          '<div class="form-group"><label class="form-label">Empresarial</label>' + numInput('diag-emp', d ? d.p_empresarial : '') + '</div>' +
          '<div class="form-group"><label class="form-label">Ambiental</label>' + numInput('diag-amb', d ? d.p_ambiental : '') + '</div>' +
          '<div class="form-group"><label class="form-label">Financiero</label>' + numInput('diag-fin', d ? d.p_financiero : '') + '</div>' +
        '</div>' +
        '<div class="diag-calc" id="diag-calc">' + _calcResumenHTML(d) + '</div>' +
        '<div class="form-group" style="margin-top:14px"><label class="form-label">Observaciones</label>' +
          '<textarea class="form-textarea" id="diag-obs" placeholder="Notas adicionales…">' + esc(d ? d.observaciones : '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        (puedeEditar() ? '<button class="btn btn-primary" id="diag-save-btn" onclick="guardarDiagnostico(' + (docId ? '\'' + jsEsc(docId) + '\'' : 'null') + ')">Guardar</button>' : '') +
      '</div>' +
    '</div>'
  );
}

function onAsocChangeDiag(idAsoc) {
  const amb = CAT.asocAmbiente.find(function (a) { return a.id_asociacion === idAsoc; });
  const prov = document.getElementById('diag-provincia');
  if (prov) prov.value = amb ? (amb.provincia || '') : '';
}

// Lee los 5 puntajes del form y devuelve el cálculo.
function _calcDesdeForm() {
  return calcDiagnostico({
    organizacional: (document.getElementById('diag-org') || {}).value,
    productivo:     (document.getElementById('diag-prod') || {}).value,
    empresarial:    (document.getElementById('diag-emp') || {}).value,
    ambiental:      (document.getElementById('diag-amb') || {}).value,
    financiero:     (document.getElementById('diag-fin') || {}).value,
  });
}

function _calcResumenHTML(d) {
  const c = d
    ? { total: d.valoracion_total, debil: d.modulo_debil, categoria: d.categoria }
    : { total: 0, debil: '—', categoria: 'En Acompañamiento' };
  return '<div class="diag-calc-item"><span>Valoración total</span><b id="diag-total">' + fmtNum(c.total, 1) + '%</b></div>' +
         '<div class="diag-calc-item"><span>Módulo más débil</span><b id="diag-debil">' + esc(c.debil || '—') + '</b></div>' +
         '<div class="diag-calc-item"><span>Categoría</span><span id="diag-categoria">' + categoriaBadge(c.categoria) + '</span></div>';
}

// Recalcula y refresca los displays automáticos al escribir.
function recalcDiagnostico() {
  const c = _calcDesdeForm();
  const t = document.getElementById('diag-total'); if (t) t.textContent = fmtNum(c.total, 1) + '%';
  const w = document.getElementById('diag-debil'); if (w) w.textContent = c.debil || '—';
  const k = document.getElementById('diag-categoria'); if (k) k.innerHTML = categoriaBadge(c.categoria);
}

// ── Guardar ──
async function guardarDiagnostico(docId) {
  const idAsoc = (document.getElementById('diag-asoc') || {}).value || '';
  if (!idAsoc) { showToast('Elegí una asociación'); return; }
  const anio = (document.getElementById('diag-anio') || {}).value || '';
  if (!anio) { showToast('Indicá el año'); return; }
  const tipo = (document.getElementById('diag-tipo') || {}).value || '';
  if (!tipo) { showToast('Elegí el tipo (Inicial/Cierre)'); return; }

  const amb = CAT.asocAmbiente.find(function (a) { return a.id_asociacion === idAsoc; });
  const actual = docId ? CAT.diagnosticos.find(function (x) { return x._docId === docId; }) : null;

  const o = {
    id_diagnostico:  actual ? actual.id_diagnostico : nuevoId('DIAG'),
    id_asociacion:   idAsoc,
    nombre:          amb ? amb.nombre : (actual ? actual.nombre : ''),
    provincia:       amb ? amb.provincia : (actual ? actual.provincia : ((document.getElementById('diag-provincia') || {}).value || '')),
    anio:            anio,
    tipo:            tipo,
    p_organizacional:(document.getElementById('diag-org') || {}).value || 0,
    p_productivo:    (document.getElementById('diag-prod') || {}).value || 0,
    p_empresarial:   (document.getElementById('diag-emp') || {}).value || 0,
    p_ambiental:     (document.getElementById('diag-amb') || {}).value || 0,
    p_financiero:    (document.getElementById('diag-fin') || {}).value || 0,
    observaciones:   (document.getElementById('diag-obs') || {}).value || '',
    id_carpeta_drive:(actual && actual.id_carpeta_drive) ? actual.id_carpeta_drive : '',
  };

  const btn = document.getElementById('diag-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  // Carpeta de Drive: Diagnósticos > <Asociación> (compartida por asociación)
  if (!o.id_carpeta_drive) {
    const tok = driveToken();
    if (tok) {
      try { o.id_carpeta_drive = await driveBuscarOCrear(o.nombre || idAsoc, DRIVE_PARENTS.diagnosticos, tok); }
      catch (e) { console.warn('Drive diagnóstico:', e); showToast('No se pudo crear la carpeta (se guarda igual)'); }
    } else {
      showToast('Sesión de Drive expirada: se guarda sin carpeta');
    }
  }

  const fs = diagnosticoToFS(o); // calcula valoración/módulo débil/categoría
  let r;
  if (docId) {
    r = await fsWrite(function () { return window.fb.updateDoc(fsDoc('Diagnosticos', docId), fs); });
    if (r.ok) { const i = CAT.diagnosticos.findIndex(function (x) { return x._docId === docId; }); if (i >= 0) CAT.diagnosticos[i] = diagnosticoFromFS(Object.assign({ _docId: docId }, fs)); }
  } else {
    const ref = window.fb.doc(fsCol('Diagnosticos'));
    r = await fsWrite(function () { return window.fb.setDoc(ref, fs); });
    if (r.ok) CAT.diagnosticos.push(diagnosticoFromFS(Object.assign({ _docId: ref.id }, fs)));
  }

  if (!r.ok) { showToast('Error al guardar: ' + (r.error || '')); if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; } return; }
  showToast(r.offline ? 'Guardado (se sincronizará) ✓' : 'Guardado ✓');
  cerrarModal();
  cargarDiagnosticos();
}

// ── Exportar Excel ──
async function exportarDiagnosticosExcel() {
  if (!DIAGNOSTICOS_DATA.length) { showToast('No hay datos para exportar.'); return; }
  try {
    await cargarSheetJS();
    if (!window.XLSX) { showToast('No se pudo cargar el exportador'); return; }
    const num = function (v) { return parseFloat(v) || 0; };
    const header = ['Asociación', 'Provincia', 'Año', 'Tipo', 'Organizacional', 'Productivo', 'Empresarial', 'Ambiental', 'Financiero', 'Valoración Total', 'Módulo Débil', 'Categoría', 'Observaciones', 'URL Carpeta'];
    const filas = DIAGNOSTICOS_DATA.map(function (d) {
      return [d.nombre, d.provincia, num(d.anio), d.tipo, num(d.p_organizacional), num(d.p_productivo), num(d.p_empresarial), num(d.p_ambiental), num(d.p_financiero),
        num(d.valoracion_total), d.modulo_debil || '', d.categoria || '', d.observaciones || '', urlCarpeta(d.id_carpeta_drive)];
    });
    const ws = XLSX.utils.aoa_to_sheet([header].concat(filas));
    ws['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 7 }, { wch: 9 }, { wch: 13 }, { wch: 11 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 15 }, { wch: 16 }, { wch: 20 }, { wch: 30 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Diagnósticos');
    XLSX.writeFile(wb, 'Diagnosticos_' + new Date().toISOString().substring(0, 10) + '.xlsx');
    showToast('Excel descargado ✓');
  } catch (e) { console.error('export diagnósticos:', e); showToast('Error al exportar'); }
}

// ── Estilos propios (resumen de cálculo en el form) ──
(function () {
  if (document.getElementById('diag-styles')) return;
  const s = document.createElement('style');
  s.id = 'diag-styles';
  s.textContent = `
    .diag-calc { background:var(--surface-hover); border:1px solid var(--border); border-radius:14px; padding:6px 16px; margin-top:8px; }
    .diag-calc-item { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border); font-size:14px; color:var(--text-muted); }
    .diag-calc-item:last-child { border-bottom:none; }
    .diag-calc-item b { font-size:16px; font-weight:800; color:var(--text); }

    /* Tarjetas móviles */
    .diag-cards-mobile { display:none; flex-direction:column; gap:12px; }
    .diag-card { background:var(--surface); border-radius:20px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.04); }
    .diag-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
    .diag-card-id { min-width:0; }
    .diag-card-label { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.7px; }
    .diag-card-nombre { font-size:16px; font-weight:700; color:var(--text); margin-top:2px; line-height:1.3; }
    .diag-card-grid { display:flex; gap:10px; margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }
    .diag-cell { flex:1; display:flex; flex-direction:column; gap:5px; align-items:flex-start; min-width:0; }
    .diag-cell b { font-size:15px; font-weight:700; color:var(--text); }
    .diag-cell .diag-val { color:#0a9e83; font-weight:800; }
    .diag-mini { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.5px; }
    .diag-card-foot { display:flex; justify-content:flex-end; margin-top:14px; }

    @media (max-width:768px) {
      .diag-tabla-desktop { display:none; }
      .diag-cards-mobile { display:flex; }
    }
  `;
  document.head.appendChild(s);
})();
