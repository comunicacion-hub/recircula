// ============================================================
// DASHBOARD ASOCIATIVO — asociaciones.js
// Ficha asociativa: CRUD + checklist de documentos + carpeta Drive.
// Colección: Asoc_Asociativo
// ============================================================

let ASOC_FILTROS = { prov: [], cat: [] };
let ASOCIACIONES_DATA = [];

const CATEGORIAS_ASOC = ['Líderes de ReCircula', 'En Fortalecimiento', 'En Acompañamiento'];

// Documentos (PDF) que se suben desde la ficha. Subir un PDF = documento presente.
const ASOC_DOCS = [
  { key: 'resolucion',    lbl: 'Resolución',                file: 'Resolucion' },
  { key: 'estatutos',     lbl: 'Reglamento/Estatuto',       file: 'Reglamento_Estatuto' },
  { key: 'directiva',     lbl: 'Directiva',                 file: 'Directiva' },
  { key: 'acta',          lbl: 'Acta de compromiso',        file: 'Acta_compromiso' },
  { key: 'plan_cap',      lbl: 'Plan de capacitación',      file: 'Plan_capacitacion' },
  { key: 'resultado_cap', lbl: 'Resultado de capacitación', file: 'Resultado_capacitacion' },
];
const ASOC_DOCS_TOTAL = ASOC_DOCS.length;
function _asocDoc(a, key) { return (a && a.documentos && a.documentos[key]) ? a.documentos[key] : null; }
function _asocDocsCount(a) { return ASOC_DOCS.filter(function (d) { return _asocDoc(a, d.key); }).length; }

// Color por categoría (para badge y barra)
const ASOC_CAT_COLOR = {
  'Líderes de ReCircula': '#18AE97',
  'En Fortalecimiento':   '#506CFF',
  'En Acompañamiento':    '#F5AD21',
};
function _asocRgba(hex, a) {
  let h = String(hex || '').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  const n = parseInt(h, 16) || 0;
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function _asocColorCat(cat) { return ASOC_CAT_COLOR[cat] || '#F82D72'; } // Pendiente → rosa
// Badge de categoría para las tarjetas (Pendiente si no tiene diagnóstico)
function _asocCatBadge(cat) {
  const texto = cat || 'Pendiente';
  const col = _asocColorCat(cat);
  return '<span class="asoc-cat-badge" style="color:' + col + ';background:' + _asocRgba(col, 0.12) + '">' +
    '<span class="asoc-cat-dot" style="background:' + col + '"></span>' + esc(texto) + '</span>';
}

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
  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Asociaciones</div><div class="page-sub">Registro</div></div>' +
      '<div class="hdr-actions">' +
        '<button class="hdr-circle" onclick="openFilterDrawer(\'asociaciones\')" title="Filtros">' +
          icoHTML('filter') + '<span class="filter-badge" id="asoc-filter-badge" style="display:none">0</span></button>' +
        '<button class="hdr-circle" onclick="exportarAsociacionesExcel()" title="Descargar Excel">' + icoHTML('download') + '</button>' +
        (puedeEditar() ? '<button class="hdr-circle hdr-circle-primary" onclick="abrirFormAsociacion()" title="Nueva asociación">' + icoHTML('plus') + '</button>' : '') +
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

// Paleta y color por provincia (encabezado de grupo)
const ASOC_PROV_PAL = ['#506CFF', '#18AE97', '#F5AD21', '#F82D72', '#FF751F', '#33A8DE', '#7B5CFF', '#0BC3FF'];
function _provColorAsoc(prov) {
  const k = String(prov || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return ASOC_PROV_PAL[h % ASOC_PROV_PAL.length];
}
// 6 puntos de documentos (verde=subido, gris=falta)
function _docChecks(a) {
  return '<div class="asoc-dots">' + ASOC_DOCS.map(function (d) {
    const on = !!_asocDoc(a, d.key);
    return '<span class="asoc-dot' + (on ? ' on' : '') + '" title="' + esc(d.lbl) + (on ? ': subido' : ': falta') + '">' + (on ? icoHTML('check') : '') + '</span>';
  }).join('') + '</div>';
}
// Completitud: % + color por umbral
function _completitud(a) {
  const pct = Math.round(_asocDocsCount(a) / ASOC_DOCS_TOTAL * 100);
  const color = pct >= 80 ? '#18AE97' : pct >= 40 ? '#F5AD21' : pct > 0 ? '#e5484d' : '#d7d7e0';
  return { pct: pct, color: color };
}

function renderTablaAsociaciones() {
  const wrap = document.getElementById('asoc-table-wrap');
  if (!wrap) return;
  if (!ASOCIACIONES_DATA.length) {
    wrap.innerHTML = '<div class="empty-state">' +
      icoHTML('users').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"') +
      '<p>No hay asociaciones con estos filtros</p></div>';
    return;
  }

  const edit = puedeEditar();

  // Agrupar por provincia
  const grupos = {};
  ASOCIACIONES_DATA.forEach(function (a) {
    const p = a.provincia || 'Sin provincia';
    (grupos[p] = grupos[p] || []).push(a);
  });
  const provs = Object.keys(grupos).sort(function (a, b) { return a.localeCompare(b, 'es'); });

  const acciones = function (a) {
    const docId = jsEsc(a._docId || '');
    return '<button class="icon-btn" onclick="verAsociacion(\'' + docId + '\')" title="Ver">' + icoHTML('view') + '</button>' +
      (edit ? '<button class="icon-btn primary" onclick="editarAsociacion(\'' + docId + '\')" title="Editar">' + icoHTML('edit') + '</button>' +
        '<button class="icon-btn del" onclick="confirmarEliminarAsociacion(\'' + docId + '\')" title="Eliminar">' + icoHTML('trash') + '</button>' : '');
  };
  const filaAsoc = function (a) {
    const cat = categoriaVigente(a.id_asociacion);
    const acol = _asocColorCat(cat);
    const comp = _completitud(a);
    return '<tr class="asoc-fila" style="--acc:' + acol + '">' +
      '<td><div class="asoc-nom-cell">' +
        '<span class="asoc-avatar" style="background:' + _asocRgba(acol, 0.12) + ';color:' + acol + '">' + icoHTML('users') + '</span>' +
        '<span class="asoc-nom-tx">' + esc(a.nombre || '—') + '</span></div></td>' +
      '<td><span class="asoc-recs"><span class="asoc-recs-ico">' + icoHTML('users') + '</span><b>' + fmtNum(a.num_recicladores) + '</b></span></td>' +
      '<td>' + _docChecks(a) + '</td>' +
      '<td><div class="asoc-comp"><div class="asoc-comp-val">' + comp.pct + '%</div>' +
        '<div class="asoc-comp-bar"><div class="asoc-comp-fill" style="width:' + comp.pct + '%;background:' + comp.color + '"></div></div></div></td>' +
      '<td style="text-align:right"><div class="td-actions asoc-acts">' + acciones(a) + '</div></td>' +
    '</tr>';
  };

  const cuerpo = provs.map(function (prov) {
    const col = _provColorAsoc(prov);
    const lista = grupos[prov].slice().sort(function (a, b) { return (a.nombre || '').localeCompare(b.nombre || '', 'es'); });
    const cab = '<tr class="asoc-prov-row"><td colspan="5">' +
      '<div class="asoc-prov-cab">' +
        '<span class="asoc-prov-ico" style="background:' + _asocRgba(col, 0.14) + ';color:' + col + '">' + icoHTML('mapPin') + '</span>' +
        '<span class="asoc-prov-nom">' + esc(prov) + '</span>' +
        '<span class="asoc-prov-count">' + lista.length + ' asociaci' + (lista.length !== 1 ? 'ones' : 'ón') + '</span>' +
      '</div></td></tr>';
    return cab + lista.map(filaAsoc).join('');
  }).join('');

  wrap.innerHTML = '<div class="table-wrap asoc-tabla"><table>' +
    '<thead><tr>' +
      '<th>Asociación</th><th>Recicladores</th><th>Documentos</th><th>Completitud</th>' +
      '<th style="text-align:right">Acciones</th>' +
    '</tr></thead>' +
    '<tbody>' + cuerpo + '</tbody></table></div>' +
    '<div style="font-size:12px;color:var(--text-dim);text-align:center;margin-top:14px">' + ASOCIACIONES_DATA.length + ' registro' + (ASOCIACIONES_DATA.length !== 1 ? 's' : '') + '</div>';
}

// ── Ver ficha (solo lectura) ──
function verAsociacion(docId) {
  const a = CAT.asociaciones.find(function (x) { return x._docId === docId; });
  if (!a) { showToast('Ficha no encontrada'); return; }
  const cnt = _asocDocsCount(a);
  const chips = ASOC_DOCS.map(function (d) {
    const doc = _asocDoc(a, d.key);
    return doc && doc.url
      ? '<a class="asoc-doc-chip" href="' + esc(doc.url) + '" target="_blank" rel="noopener">' + icoHTML('view') + ' ' + esc(d.lbl) + '</a>'
      : '<span class="asoc-doc-chip asoc-doc-chip-off">' + icoHTML('close') + ' ' + esc(d.lbl) + '</span>';
  }).join('');
  abrirModal(
    '<div class="modal">' +
      '<div class="modal-head"><div><div class="modal-title">' + esc(a.nombre) + '</div>' +
        '<div class="modal-sub">' + esc(a.provincia || '—') + ' · ' + categoriaBadge(categoriaVigente(a.id_asociacion)) + '</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-grid-2" style="margin-bottom:16px">' +
          '<div><div class="form-label">N° de recicladores</div><div style="font-size:18px;font-weight:700">' + fmtNum(a.num_recicladores) + '</div></div>' +
          '<div><div class="form-label">Documentación</div><div style="font-size:18px;font-weight:700">' + cnt + '/' + ASOC_DOCS_TOTAL + '</div></div>' +
        '</div>' +
        '<div class="form-label" style="margin-bottom:8px">Documentos</div>' +
        '<div class="asoc-docs-ver">' + chips + '</div>' +
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
        '<div class="form-label" style="margin:16px 0 8px">Documentos (PDF)</div>' +
        '<div class="asoc-docs">' +
          ASOC_DOCS.map(function (d) {
            const doc = _asocDoc(a || {}, d.key);
            const ver = (doc && doc.url)
              ? '<button type="button" class="asoc-doc-vermini" onclick="window.open(\'' + jsEsc(doc.url) + '\',\'_blank\')">' + icoHTML('view') + ' Ver PDF</button>'
              : '<span class="asoc-doc-sin">Sin archivo</span>';
            return '<div class="asoc-doc-item">' +
              '<div class="asoc-doc-cab"><span class="asoc-doc-lbl">' + esc(d.lbl) + '</span>' + ver + '</div>' +
              '<input type="file" accept="application/pdf,.pdf" class="form-input asoc-doc-file" id="asoc-doc-' + d.key + '">' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="form-group" style="margin-top:16px"><label class="form-label">Observaciones</label>' +
          '<textarea class="form-textarea" id="asoc-obs" placeholder="Notas adicionales…">' + esc(a ? a.observaciones : '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        (puedeEditar() ? '<button class="btn btn-primary" id="asoc-save-btn" onclick="guardarAsociacion(' + (docId ? '\'' + jsEsc(docId) + '\'' : 'null') + ')">Guardar</button>' : '') +
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
    documentos:      Object.assign({}, (actual && actual.documentos) ? actual.documentos : {}),
    observaciones:   (document.getElementById('asoc-obs') || {}).value || '',
    id_carpeta_drive:(actual && actual.id_carpeta_drive) ? actual.id_carpeta_drive : '',
  };

  const btn = document.getElementById('asoc-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  // Carpeta de Drive (si no tiene y hay token): Documento General > <Asociación>
  const tok = driveToken();
  if (!o.id_carpeta_drive) {
    if (tok) {
      try { o.id_carpeta_drive = await driveBuscarOCrear(o.nombre || idAsoc, DRIVE_PARENTS.asociaciones, tok); }
      catch (e) { console.warn('Drive asociación:', e); showToast('No se pudo crear la carpeta (se guarda igual)'); }
    } else {
      showToast('Sesión de Drive expirada: se guarda sin carpeta');
    }
  }

  // Subir los PDFs seleccionados → cada uno marca su documento como presente
  const nuevos = ASOC_DOCS.map(function (d) {
    const el = document.getElementById('asoc-doc-' + d.key);
    const f = el && el.files && el.files[0] ? el.files[0] : null;
    return f ? { key: d.key, file: d.file, archivo: f } : null;
  }).filter(Boolean);

  const noPdf = nuevos.find(function (n) { return n.archivo.type !== 'application/pdf' && !/\.pdf$/i.test(n.archivo.name); });
  if (noPdf) { showToast('Solo se permiten archivos PDF'); if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; } return; }

  if (nuevos.length) {
    if (!tok) {
      showToast('Sesión de Drive expirada: no se subieron los PDFs');
    } else if (!o.id_carpeta_drive) {
      showToast('Sin carpeta: no se subieron los PDFs');
    } else {
      for (let i = 0; i < nuevos.length; i++) {
        const n = nuevos[i];
        if (btn) btn.textContent = 'Subiendo ' + (i + 1) + '/' + nuevos.length + '…';
        try {
          const fname = n.file + '.pdf';
          const up = await driveSubirArchivo(n.archivo, fname, o.id_carpeta_drive, tok);
          o.documentos[n.key] = { id: up.id, url: up.webViewLink, nombre: fname };
        } catch (e) { console.warn('Subida documento:', e); showToast('No se pudo subir ' + n.file); }
      }
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

// ── Eliminar ──
function confirmarEliminarAsociacion(docId) {
  const a = CAT.asociaciones.find(function (x) { return x._docId === docId; });
  if (!a) return;
  abrirModal(
    '<div class="modal" style="max-width:440px">' +
      '<div class="modal-head"><div class="modal-title">Eliminar asociación</div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body"><p style="color:var(--text-muted);font-size:14px;line-height:1.6">' +
        '¿Seguro que quieres eliminar la ficha de <strong>' + esc(a.nombre) + '</strong>? Se quitará el registro y su carpeta se enviará a la papelera de Drive.' +
      '</p></div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-danger" onclick="eliminarAsociacion(\'' + jsEsc(docId) + '\',\'' + jsEsc(a.id_carpeta_drive || '') + '\')">Eliminar</button>' +
      '</div>' +
    '</div>'
  );
}

async function eliminarAsociacion(docId, carpetaId) {
  if (!docId) { showToast('No se encontró la ficha'); return; }
  if (carpetaId) {
    const tok = driveToken();
    if (tok) { try { await driveEliminarCarpeta(carpetaId, tok); } catch (e) { console.warn('Drive papelera asociación:', e); } }
  }
  const r = await fsWrite(function () { return window.fb.deleteDoc(fsDoc('Asoc_Asociativo', docId)); });
  if (!r.ok) { showToast('Error al eliminar: ' + (r.error || '')); return; }
  CAT.asociaciones = CAT.asociaciones.filter(function (x) { return x._docId !== docId; });
  showToast(r.offline ? 'Eliminada (se sincronizará) ✓' : 'Asociación eliminada ✓');
  cerrarModal();
  cargarAsociaciones();
}

// ── Exportar Excel ──
async function exportarAsociacionesExcel() {
  if (!ASOCIACIONES_DATA.length) { showToast('No hay datos para exportar.'); return; }
  try {
    await cargarSheetJS();
    if (!window.XLSX) { showToast('No se pudo cargar el exportador'); return; }
    const sino = function (a, key) { return _asocDoc(a, key) ? 'Sí' : 'No'; };
    const header = ['Asociación', 'Provincia', 'N° Recicladores'].concat(ASOC_DOCS.map(function (d) { return d.lbl; })).concat(['Documentos', 'Categoría', 'Observaciones']);
    const filas = ASOCIACIONES_DATA.map(function (a) {
      return [a.nombre, a.provincia, parseFloat(a.num_recicladores) || 0]
        .concat(ASOC_DOCS.map(function (d) { return sino(a, d.key); }))
        .concat([_asocDocsCount(a) + '/' + ASOC_DOCS_TOTAL, categoriaVigente(a.id_asociacion) || '', a.observaciones || '']);
    });
    const ws = XLSX.utils.aoa_to_sheet([header].concat(filas));
    ws['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 11 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 11 }, { wch: 18 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asociaciones');
    XLSX.writeFile(wb, 'Asociaciones_' + new Date().toISOString().substring(0, 10) + '.xlsx');
    showToast('Excel descargado ✓');
  } catch (e) { console.error('export asociaciones:', e); showToast('Error al exportar'); }
}

// ── Estilos propios (grid de tarjetas + documentos PDF + ficha) ──
(function () {
  if (document.getElementById('asoc-styles')) return;
  const s = document.createElement('style');
  s.id = 'asoc-styles';
  s.textContent = `
    /* Tabla fortalecida agrupada por provincia */
    .asoc-tabla table { border-collapse:separate; border-spacing:0; }
    .asoc-tabla thead th { font-size:11px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:var(--text-dim); padding:10px 16px; }

    .asoc-prov-row td { padding:18px 8px 8px; }
    .asoc-prov-cab { display:flex; align-items:center; gap:10px; }
    .asoc-prov-ico { width:32px; height:32px; border-radius:9px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .asoc-prov-ico svg { width:16px; height:16px; }
    .asoc-prov-nom { font-size:14px; font-weight:800; color:var(--text); }
    .asoc-prov-count { font-size:11px; font-weight:600; color:var(--text-dim); background:rgba(0,0,0,.04); padding:3px 10px; border-radius:20px; }

    .asoc-fila td { background:var(--surface); border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:13px 16px; vertical-align:middle; }
    .asoc-fila td:first-child { border-left:3px solid var(--acc); border-top-left-radius:12px; border-bottom-left-radius:12px; }
    .asoc-fila td:last-child { border-top-right-radius:12px; border-bottom-right-radius:12px; }
    .asoc-fila:hover td { background:rgba(80,108,255,.03); }

    .asoc-nom-cell { display:flex; align-items:center; gap:12px; }
    .asoc-avatar { width:40px; height:40px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .asoc-avatar svg { width:19px; height:19px; }
    .asoc-nom-tx { font-weight:700; color:var(--text); font-size:14px; line-height:1.3; }

    .asoc-recs { display:inline-flex; align-items:center; gap:8px; }
    .asoc-recs-ico { color:#7B5CFF; display:flex; }
    .asoc-recs-ico svg { width:17px; height:17px; }
    .asoc-recs b { font-size:15px; font-weight:800; color:var(--text); }

    .asoc-dots { display:inline-flex; gap:6px; }
    .asoc-dot { width:20px; height:20px; border-radius:50%; background:#e7e7ef; display:inline-flex; align-items:center; justify-content:center; color:#fff; }
    .asoc-dot.on { background:#18AE97; }
    .asoc-dot svg { width:12px; height:12px; }

    .asoc-comp { min-width:110px; }
    .asoc-comp-val { font-size:14px; font-weight:800; color:var(--text); }
    .asoc-comp-bar { height:6px; background:#eef0f4; border-radius:20px; overflow:hidden; margin-top:6px; }
    .asoc-comp-fill { height:100%; border-radius:20px; transition:width .5s ease; }

    .asoc-acts { justify-content:flex-end; }

    /* Casillas de PDF en el formulario */
    .asoc-docs { display:flex; flex-direction:column; gap:10px; }
    .asoc-doc-item { border:1px solid var(--border); border-radius:12px; padding:12px 14px; }
    .asoc-doc-cab { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
    .asoc-doc-lbl { font-size:13px; font-weight:600; color:var(--text); }
    .asoc-doc-vermini { display:inline-flex; align-items:center; gap:5px; background:rgba(80,108,255,.1); color:#506CFF; border:none; font-family:inherit; font-size:11px; font-weight:700; padding:5px 10px; border-radius:8px; cursor:pointer; }
    .asoc-doc-vermini svg { width:14px; height:14px; }
    .asoc-doc-vermini:hover { background:rgba(80,108,255,.18); }
    .asoc-doc-sin { font-size:11.5px; color:var(--text-dim); }
    .asoc-doc-file { font-size:12px; }

    /* Chips de documentos en la ficha de detalle */
    .asoc-docs-ver { display:flex; flex-direction:column; gap:8px; }
    .asoc-doc-chip { display:inline-flex; align-items:center; gap:8px; padding:9px 13px; border:1px solid var(--border); border-radius:11px; font-size:13px; font-weight:600; color:#0a9e83; text-decoration:none; background:rgba(24,174,151,.06); }
    .asoc-doc-chip svg { width:15px; height:15px; }
    .asoc-doc-chip:hover { background:rgba(24,174,151,.14); }
    .asoc-doc-chip-off { color:var(--text-dim); background:transparent; }

    @media (max-width:768px) {
      .asoc-tabla { overflow-x:auto; }
      .asoc-tabla table { min-width:640px; }
    }
  `;
  document.head.appendChild(s);
})();
