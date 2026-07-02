// ============================================================
// DASHBOARD SOCIAL — financiero.js
// Sección Financiero (Cajas de Ahorro): CRUD (ver/editar/eliminar).
// Colección: CajasAhorro
//  - Único por Asociación + Año.
//  - Actas (miembros/validación): checklist Sí/No.
//  - Carpeta Drive: Caja de ahorro > Asociación (se crea con el 1er registro;
//    NO se elimina al borrar el registro, por ser la carpeta de la asociación).
// ============================================================

let FIN_FILTROS = { prov: [], asoc: [] };
let CAJAS_DATA = [];

function registerFinancieroFilters() {
  registerFilterConfig('financiero', {
    badgeId: 'fin-filter-badge',
    sections: [
      { key: 'prov', title: 'Provincia',  type: 'options', options: _provinciasFin() },
      { key: 'asoc', title: 'Asociación', type: 'options', options: CAT.asocAmbiente.map(function (a) { return { val: a.id_asociacion, lbl: a.nombre }; }) },
    ],
    getValue: function (k) { return FIN_FILTROS[k] || []; },
    setValue: function (k, v) { FIN_FILTROS[k] = v; },
    apply: function () { cargarCajas(); },
  });
}

function _provinciasFin() {
  const set = new Set();
  CAT.cajas.forEach(function (c) { if (c.provincia) set.add(c.provincia); });
  if (!set.size) CAT.asocAmbiente.forEach(function (a) { if (a.provincia) set.add(a.provincia); });
  return Array.from(set).sort();
}

function renderFinanciero() {
  registerFinancieroFilters();
  const add = puedeEditar();
  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Financiero</div><div class="page-sub">Cajas de Ahorro</div></div>' +
      '<div class="hdr-actions">' +
        '<button class="hdr-circle" onclick="openFilterDrawer(\'financiero\')" title="Filtros">' +
          icoHTML('filter') + '<span class="filter-badge" id="fin-filter-badge" style="display:none">0</span></button>' +
        '<button class="hdr-circle" onclick="exportarCajasExcel()" title="Descargar Excel">' + icoHTML('download') + '</button>' +
        (add ? '<button class="hdr-circle hdr-circle-primary" onclick="abrirFormCaja()" title="Nueva caja de ahorro">' + icoHTML('plus') + '</button>' : '') +
      '</div>' +
    '</div>' +
    '<div id="fin-wrap"></div>';
  cargarCajas();
  updateFilterBadge('financiero');
}

function cargarCajas() {
  CAJAS_DATA = CAT.cajas.filter(function (c) {
    return pasaFiltro(FIN_FILTROS.prov, c.provincia) && pasaFiltro(FIN_FILTROS.asoc, c.id_asociacion);
  }).slice().sort(function (a, b) {
    const p = (a.provincia || '').localeCompare(b.provincia || '');
    if (p !== 0) return p;
    const n = (a.asociacion || '').localeCompare(b.asociacion || '');
    if (n !== 0) return n;
    return (parseFloat(b.anio) || 0) - (parseFloat(a.anio) || 0);
  });
  renderTablaCajas();
}

function _acta(b) {
  return b ? '<span style="color:#0a9e83;font-weight:600">✓ Sí</span>' : '<span style="color:var(--text-dim)">No</span>';
}

function renderTablaCajas() {
  const wrap = document.getElementById('fin-wrap');
  if (!wrap) return;
  if (!CAJAS_DATA.length) {
    wrap.innerHTML = '<div class="empty-state">' +
      icoHTML('wallet').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"') +
      '<p>No hay cajas de ahorro con estos filtros</p></div>';
    return;
  }
  const edit = puedeEditar();
  const acciones = function (c) {
    const docId = jsEsc(c._docId || '');
    const carpeta = jsEsc(c.id_carpeta_drive || '');
    return (carpeta ? '<button class="icon-btn" onclick="window.open(\'https://drive.google.com/drive/folders/' + carpeta + '\',\'_blank\')" title="Carpeta">' + icoHTML('folder') + '</button>' : '') +
      '<button class="icon-btn" onclick="verCaja(\'' + docId + '\')" title="Ver">' + icoHTML('view') + '</button>' +
      (edit ? '<button class="icon-btn primary" onclick="editarCaja(\'' + docId + '\')" title="Editar">' + icoHTML('edit') + '</button>' +
        '<button class="icon-btn del" onclick="confirmarEliminarCaja(\'' + docId + '\')" title="Eliminar">' + icoHTML('trash') + '</button>' : '');
  };

  // Tabla (desktop)
  const filas = CAJAS_DATA.map(function (c) {
    return '<tr>' +
      '<td style="font-weight:600">' + esc(c.asociacion || '—') + '</td>' +
      '<td>' + esc(c.provincia || '—') + '</td>' +
      '<td>' + esc(c.anio || '—') + '</td>' +
      '<td>' + _acta(c.acta_miembros) + '</td>' +
      '<td>' + _acta(c.acta_validacion) + '</td>' +
      '<td data-actions-row><div class="td-actions">' + acciones(c) + '</div></td>' +
    '</tr>';
  }).join('');
  const tabla = '<div class="table-wrap fin-desk"><table>' +
    '<thead><tr><th>Asociación</th><th>Provincia</th><th>Año</th><th>Acta de miembros</th><th>Acta de validación</th><th></th></tr></thead>' +
    '<tbody>' + filas + '</tbody></table></div>';

  // Tarjetas (móvil)
  const cards = CAJAS_DATA.map(function (c) {
    return '<div class="fin-card">' +
      '<div class="fin-top"><div class="fin-id"><div class="fin-label">Asociación</div>' +
        '<div class="fin-nombre">' + esc(c.asociacion || '—') + '</div></div>' +
        '<span class="badge badge-blue">' + esc(c.anio || '—') + '</span></div>' +
      '<div class="fin-grid">' +
        '<div class="fin-cell"><span class="fin-mini">Provincia</span><b>' + esc(c.provincia || '—') + '</b></div>' +
        '<div class="fin-cell"><span class="fin-mini">Acta miembros</span><b>' + _acta(c.acta_miembros) + '</b></div>' +
        '<div class="fin-cell"><span class="fin-mini">Acta validación</span><b>' + _acta(c.acta_validacion) + '</b></div>' +
      '</div>' +
      '<div class="fin-foot"><div class="td-actions">' + acciones(c) + '</div></div>' +
    '</div>';
  }).join('');
  const cardsWrap = '<div class="fin-mob">' + cards + '</div>';

  wrap.innerHTML = tabla + cardsWrap +
    '<div style="font-size:12px;color:var(--text-dim);text-align:right;margin-top:10px">' + CAJAS_DATA.length + ' registro' + (CAJAS_DATA.length !== 1 ? 's' : '') + '</div>';
}

// ── Ver ficha ──
function verCaja(docId) {
  const c = CAT.cajas.find(function (x) { return x._docId === docId; });
  if (!c) { showToast('Caja no encontrada'); return; }
  const dato = function (lbl, val) {
    return '<div class="rf-row"><span class="rf-lbl">' + esc(lbl) + '</span><span class="rf-val">' + (val ? esc(val) : '—') + '</span></div>';
  };
  const sino = function (b) { return b ? 'Sí' : 'No'; };
  abrirModal(
    '<div class="modal">' +
      '<div class="modal-head"><div><div class="modal-title">' + esc(c.asociacion || 'Caja de ahorro') + '</div>' +
        '<div class="modal-sub">' + esc(c.provincia || '—') + ' · ' + esc(c.anio || '') + '</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="rf-grid">' +
          dato('Año', c.anio) +
          dato('Provincia', c.provincia) +
          dato('Acta de miembros', sino(c.acta_miembros)) +
          dato('Acta de validación', sino(c.acta_validacion)) +
        '</div>' +
        (c.observaciones ? '<div style="margin-top:14px"><div class="form-label">Observaciones</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">' + esc(c.observaciones) + '</div></div>' : '') +
      '</div>' +
      '<div class="modal-foot">' +
        (c.id_carpeta_drive ? '<a class="btn btn-glass" href="' + urlCarpeta(c.id_carpeta_drive) + '" target="_blank" rel="noopener">Carpeta de Drive ↗</a>' : '') +
        '<button class="btn btn-primary" onclick="cerrarModal()">Cerrar</button>' +
      '</div>' +
    '</div>'
  );
}

// ── Formulario ──
function editarCaja(docId) { abrirFormCaja(docId); }

function abrirFormCaja(docId) {
  docId = docId || null;
  const c = docId ? CAT.cajas.find(function (x) { return x._docId === docId; }) : null;
  const editing = !!c;

  const asocField = editing
    ? '<input type="text" class="form-input" value="' + esc(c.asociacion) + '" readonly>' +
      '<input type="hidden" id="caja-asoc" value="' + esc(c.id_asociacion) + '">'
    : '<select class="form-select" id="caja-asoc" onchange="onAsocChangeCaja(this.value)">' +
        '<option value="">Seleccioná una asociación…</option>' +
        CAT.asocAmbiente.map(function (a) { return '<option value="' + esc(a.id_asociacion) + '">' + esc(a.nombre) + '</option>'; }).join('') +
      '</select>';

  abrirModal(
    '<div class="modal">' +
      '<div class="modal-head"><div><div class="modal-title">' + (editing ? 'Editar' : 'Nueva') + ' caja de ahorro</div>' +
        '<div class="modal-sub">Registro financiero</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-grid-2">' +
          '<div class="form-group"><label class="form-label">Asociación</label>' + asocField + '</div>' +
          '<div class="form-group"><label class="form-label">Provincia</label><input type="text" class="form-input" id="caja-provincia" readonly value="' + esc(c ? c.provincia : '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Año</label><input type="number" class="form-input" id="caja-anio" min="2000" max="2100" step="1" value="' + (c ? c.anio : new Date().getFullYear()) + '"></div>' +
        '</div>' +
        '<div class="form-label" style="margin:16px 0 8px">Documentos (en Drive)</div>' +
        _sinoFin('caja-miembros', 'Acta de miembros', c ? c.acta_miembros : false) +
        _sinoFin('caja-validacion', 'Acta de validación', c ? c.acta_validacion : false) +
        '<div class="form-group" style="margin-top:14px"><label class="form-label">Observaciones</label>' +
          '<textarea class="form-textarea" id="caja-obs" placeholder="Notas…">' + esc(c ? c.observaciones : '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        (puedeEditar() ? '<button class="btn btn-primary" id="caja-save-btn" onclick="guardarCaja(' + (docId ? '\'' + jsEsc(docId) + '\'' : 'null') + ')">Guardar</button>' : '') +
      '</div>' +
    '</div>'
  );
}

function _sinoFin(id, label, checked) {
  return '<label class="sino-row" style="margin-bottom:10px"><span>' + esc(label) + '</span>' +
    '<span class="sino-switch"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><span class="sino-slider"></span></span></label>';
}

function onAsocChangeCaja(idAsoc) {
  const prov = document.getElementById('caja-provincia');
  if (prov) prov.value = provinciaDeAsociacion(idAsoc) || '';
}

// ── Guardar ──
async function guardarCaja(docId) {
  const idAsoc = (document.getElementById('caja-asoc') || {}).value || '';
  if (!idAsoc) { showToast('Elegí una asociación'); return; }
  const anio = (document.getElementById('caja-anio') || {}).value || '';
  if (!anio) { showToast('Indicá el año'); return; }

  // Único por asociación + año
  const dup = CAT.cajas.find(function (c) {
    return c.id_asociacion === idAsoc && String(c.anio) === String(anio) && c._docId !== docId;
  });
  if (dup) { showToast('Ya existe una caja de ahorro para esa asociación y año'); return; }

  const actual = docId ? CAT.cajas.find(function (x) { return x._docId === docId; }) : null;
  const asocNombre = nombreDeAsociacion(idAsoc) || (actual ? actual.asociacion : '');

  const o = {
    id_asociacion:    idAsoc,
    id_caja_ahorro:   actual ? actual.id_caja_ahorro : nuevoId('CAJA'),
    asociacion:       asocNombre,
    provincia:        provinciaDeAsociacion(idAsoc) || (actual ? actual.provincia : ''),
    anio:             anio,
    acta_miembros:    !!(document.getElementById('caja-miembros') || {}).checked,
    acta_validacion:  !!(document.getElementById('caja-validacion') || {}).checked,
    observaciones:    ((document.getElementById('caja-obs') || {}).value || '').trim(),
    id_carpeta_drive: actual ? actual.id_carpeta_drive : '',
  };

  const btn = document.getElementById('caja-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  // Carpeta de Drive: Caja de ahorro > <Asociación> (compartida por asociación)
  if (!o.id_carpeta_drive) {
    const tok = driveToken();
    if (tok) {
      try { o.id_carpeta_drive = await driveBuscarOCrear(asocNombre || idAsoc, DRIVE_PARENTS.cajas, tok); }
      catch (e) { console.warn('Drive caja:', e); showToast('No se pudo crear la carpeta (se guarda igual)'); }
    } else {
      showToast('Sesión de Drive expirada: se guarda sin carpeta');
    }
  }

  const fs = cajaToFS(o);
  let r;
  if (docId) {
    r = await fsWrite(function () { return window.fb.updateDoc(fsDoc('CajasAhorro', docId), fs); });
    if (r.ok) { const i = CAT.cajas.findIndex(function (x) { return x._docId === docId; }); if (i >= 0) CAT.cajas[i] = cajaFromFS(Object.assign({ _docId: docId }, fs)); }
  } else {
    const ref = window.fb.doc(fsCol('CajasAhorro'));
    r = await fsWrite(function () { return window.fb.setDoc(ref, fs); });
    if (r.ok) CAT.cajas.push(cajaFromFS(Object.assign({ _docId: ref.id }, fs)));
  }

  if (!r.ok) { showToast('Error al guardar: ' + (r.error || '')); if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; } return; }
  showToast(r.offline ? 'Guardado (se sincronizará) ✓' : 'Guardado ✓');
  cerrarModal();
  cargarCajas();
}

// ── Eliminar (solo el registro; la carpeta de la asociación se conserva) ──
function confirmarEliminarCaja(docId) {
  abrirModal(
    '<div class="modal" style="max-width:440px">' +
      '<div class="modal-head"><div class="modal-title">Eliminar caja de ahorro</div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body"><p style="color:var(--text-muted);font-size:14px;line-height:1.6">' +
        '¿Seguro que quieres eliminar este registro? La carpeta de la asociación en Drive se conserva.' +
      '</p></div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-danger" onclick="eliminarCaja(\'' + jsEsc(docId) + '\')">Eliminar</button>' +
      '</div>' +
    '</div>'
  );
}

async function eliminarCaja(docId) {
  if (!docId) { showToast('No se encontró el registro'); return; }
  const r = await fsWrite(function () { return window.fb.deleteDoc(fsDoc('CajasAhorro', docId)); });
  if (!r.ok) { showToast('Error al eliminar: ' + (r.error || '')); return; }
  CAT.cajas = CAT.cajas.filter(function (x) { return x._docId !== docId; });
  showToast(r.offline ? 'Eliminado (se sincronizará) ✓' : 'Caja eliminada ✓');
  cerrarModal();
  cargarCajas();
}

// ── Exportar Excel ──
async function exportarCajasExcel() {
  if (!CAJAS_DATA.length) { showToast('No hay datos para exportar.'); return; }
  try {
    await cargarSheetJS();
    if (!window.XLSX) { showToast('No se pudo cargar el exportador'); return; }
    const sino = function (b) { return b ? 'Sí' : 'No'; };
    const header = ['Asociación', 'Provincia', 'Año', 'Acta de Miembros', 'Acta de Validación', 'Observaciones', 'URL Carpeta'];
    const filas = CAJAS_DATA.map(function (c) {
      return [c.asociacion, c.provincia, parseFloat(c.anio) || 0, sino(c.acta_miembros), sino(c.acta_validacion), c.observaciones || '', urlCarpeta(c.id_carpeta_drive)];
    });
    const ws = XLSX.utils.aoa_to_sheet([header].concat(filas));
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 7 }, { wch: 16 }, { wch: 18 }, { wch: 30 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cajas de Ahorro');
    XLSX.writeFile(wb, 'CajasAhorro_' + new Date().toISOString().substring(0, 10) + '.xlsx');
    showToast('Excel descargado ✓');
  } catch (e) { console.error('export cajas:', e); showToast('Error al exportar'); }
}

// ── Estilos propios ──
(function () {
  if (document.getElementById('fin-styles')) return;
  const s = document.createElement('style');
  s.id = 'fin-styles';
  s.textContent = `
    /* Switch Sí/No (por si financiero carga sin recicladores.js) */
    .sino-row { display:flex; align-items:center; justify-content:space-between; padding:11px 14px; border:1.5px solid var(--border); border-radius:12px; font-size:14px; color:var(--text); }
    .sino-switch { position:relative; width:44px; height:24px; flex-shrink:0; }
    .sino-switch input { opacity:0; width:0; height:0; position:absolute; }
    .sino-slider { position:absolute; inset:0; background:#d7d7e0; border-radius:24px; transition:.2s; cursor:pointer; }
    .sino-slider::before { content:""; position:absolute; width:18px; height:18px; left:3px; top:3px; background:#fff; border-radius:50%; transition:.2s; box-shadow:0 1px 2px rgba(0,0,0,.2); }
    .sino-switch input:checked + .sino-slider { background-image:var(--grad-c); }
    .sino-switch input:checked + .sino-slider::before { transform:translateX(20px); }

    /* Tarjetas móviles */
    .fin-mob { display:none; flex-direction:column; gap:12px; }
    .fin-card { background:var(--surface); border-radius:20px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.04); }
    .fin-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
    .fin-label { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.7px; }
    .fin-nombre { font-size:16px; font-weight:700; color:var(--text); margin-top:2px; line-height:1.3; }
    .fin-grid { display:flex; gap:10px; margin-top:12px; padding-top:12px; border-top:1px solid var(--border); }
    .fin-cell { flex:1; display:flex; flex-direction:column; gap:5px; min-width:0; }
    .fin-cell b { font-size:13px; font-weight:700; color:var(--text); }
    .fin-mini { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.5px; }
    .fin-foot { display:flex; justify-content:flex-end; margin-top:14px; }

    @media (max-width:768px) {
      .fin-desk { display:none; }
      .fin-mob { display:flex; }
    }
  `;
  document.head.appendChild(s);
})();
