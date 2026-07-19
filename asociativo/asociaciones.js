// ============================================================
// DASHBOARD ASOCIATIVO — asociaciones.js
// Ficha asociativa: CRUD + checklist de documentos + carpeta Drive.
// Colección: Asoc_Asociativo
// ============================================================

let ASOC_FILTROS = { prov: [], cat: [] };
let ASOCIACIONES_DATA = [];

const CATEGORIAS_ASOC = ['Líderes de ReCircula', 'En Fortalecimiento', 'En Acompañamiento'];

// Documentos (PDF) que se suben desde la ficha. Subir un PDF = documento presente.
// multi:true → admite varios archivos (se guarda el año actual en cada uno).
const ASOC_DOCS = [
  { key: 'resolucion',    lbl: 'Resolución/Estatuto',        file: 'Resolucion_Estatuto',    multi: false },
  { key: 'directiva',     lbl: 'Directiva',                  file: 'Directiva',              multi: false },
  { key: 'ruc',           lbl: 'RUC',                        file: 'RUC',                    multi: false },
  { key: 'acta',          lbl: 'Acta de compromiso',         file: 'Acta_compromiso',        multi: false },
  { key: 'plan_cap',      lbl: 'Plan de capacitación',       file: 'Plan_capacitacion',      multi: true },
  { key: 'resultado_cap', lbl: 'Resultados de capacitación', file: 'Resultado_capacitacion', multi: true },
];
const ASOC_DOCS_TOTAL = ASOC_DOCS.length;
function _asocDocDef(key) { return ASOC_DOCS.find(function (d) { return d.key === key; }); }
// Normaliza a lista de archivos [{id,url,nombre,anio?}] (soporta el modelo viejo de 1 objeto)
function _asocDocList(docs, key) {
  const v = docs ? docs[key] : null;
  if (!v) return [];
  return Array.isArray(v) ? v.slice() : [v];
}
function _asocDocPresente(a, key) { return _asocDocList(a && a.documentos, key).length > 0; }
function _asocDocsCount(a) { return ASOC_DOCS.filter(function (d) { return _asocDocPresente(a, d.key); }).length; }

// Estado de trabajo del formulario: copia editable de documentos + archivos a mandar a papelera al guardar
let _ASOC_FORM = null;

function _renderAsocDocs() {
  const cont = document.getElementById('asoc-docs-cont');
  if (!cont || !_ASOC_FORM) return;
  const anio = new Date().getFullYear();
  cont.innerHTML = ASOC_DOCS.map(function (d) {
    const lista = _asocDocList(_ASOC_FORM.documentos, d.key);
    const files = lista.map(function (f, i) {
      const et = (d.multi && f.anio) ? '<span class="asoc-f-anio">' + esc(String(f.anio)) + '</span>' : '';
      return '<div class="asoc-f-row">' +
        '<span class="asoc-f-nom">' + esc(f.nombre || d.lbl) + '</span>' + et +
        (f.url ? '<a class="asoc-f-ver" href="' + esc(f.url) + '" target="_blank" rel="noopener" title="Ver PDF">' + icoHTML('view') + '</a>' : '') +
        '<button type="button" class="asoc-f-del" onclick="_asocQuitarArchivo(\'' + d.key + '\',' + i + ')" title="Eliminar archivo">' + icoHTML('trash') + '</button>' +
      '</div>';
    }).join('');
    const inputLbl = d.multi ? ('Agregar archivo(s) · año ' + anio) : (lista.length ? 'Reemplazar archivo' : 'Subir archivo');
    return '<div class="asoc-doc-item">' +
      '<div class="asoc-doc-cab"><span class="asoc-doc-lbl">' + esc(d.lbl) + (d.multi ? ' <span class="asoc-doc-tag">varios · por año</span>' : '') + '</span></div>' +
      (files ? '<div class="asoc-f-list">' + files + '</div>' : '') +
      '<label class="asoc-doc-add">' + icoHTML('cloudUp') + '<span>' + inputLbl + '</span>' +
        '<input type="file" accept="application/pdf,.pdf"' + (d.multi ? ' multiple' : '') + ' class="asoc-doc-file" id="asoc-doc-' + d.key + '" onchange="_asocFileSel(this,\'' + d.key + '\')"></label>' +
      '<div class="asoc-doc-pend" id="asoc-pend-' + d.key + '"></div>' +
    '</div>';
  }).join('');
}

// Muestra el/los archivo(s) recién seleccionado(s) (aún sin guardar)
function _asocFileSel(input, key) {
  const cont = document.getElementById('asoc-pend-' + key);
  if (!cont) return;
  const files = input.files ? Array.prototype.slice.call(input.files) : [];
  cont.innerHTML = files.map(function (f) {
    return '<div class="asoc-f-pend">' + icoHTML('check') + '<span>' + esc(f.name) + '</span><small>listo para subir al guardar</small></div>';
  }).join('');
}

// Quita un archivo de la copia de trabajo (se enviará a papelera al guardar)
function _asocQuitarArchivo(key, idx) {
  if (!_ASOC_FORM) return;
  const lista = _asocDocList(_ASOC_FORM.documentos, key);
  const f = lista[idx];
  if (!f) return;
  if (f.id) _ASOC_FORM.eliminar.push(f.id);
  lista.splice(idx, 1);
  const def = _asocDocDef(key);
  _ASOC_FORM.documentos[key] = (def && def.multi) ? lista : (lista[0] || null);
  _renderAsocDocs();
}

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
    const on = _asocDocPresente(a, d.key);
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
    return '<button class="icon-btn" onclick="event.stopPropagation();verAsociacion(\'' + docId + '\')" title="Ver">' + icoHTML('view') + '</button>' +
      (edit ? '<button class="icon-btn primary" onclick="event.stopPropagation();editarAsociacion(\'' + docId + '\')" title="Editar">' + icoHTML('edit') + '</button>' +
        '<button class="icon-btn del" onclick="event.stopPropagation();confirmarEliminarAsociacion(\'' + docId + '\')" title="Eliminar">' + icoHTML('trash') + '</button>' : '');
  };

  const fila = function (a, col) {
    const docId = jsEsc(a._docId || '');
    const cnt = _asocDocsCount(a);
    const pillCol = cnt >= ASOC_DOCS_TOTAL ? '#18AE97' : cnt > 0 ? '#F5AD21' : null;
    const pill = pillCol
      ? '<span class="asoc-row-pill" style="background:' + _asocRgba(pillCol, 0.14) + ';color:' + pillCol + '">' + cnt + '/' + ASOC_DOCS_TOTAL + '</span>'
      : '<span class="asoc-row-pill asoc-row-pill-0">' + cnt + '/' + ASOC_DOCS_TOTAL + '</span>';
    return '<div class="asoc-row" onclick="verAsociacion(\'' + docId + '\')">' +
      '<span class="asoc-row-ico" style="background:' + _asocRgba(col, 0.12) + ';color:' + col + '">' + icoHTML('users') + '</span>' +
      '<span class="asoc-row-nom">' + esc(a.nombre || '—') + '</span>' +
      '<span class="asoc-row-right">' + pill +
        '<span class="asoc-row-acts td-actions">' + acciones(a) + '</span>' +
      '</span>' +
    '</div>';
  };

  const cuerpo = provs.map(function (prov) {
    const col = _provColorAsoc(prov);
    const lista = grupos[prov].slice().sort(function (a, b) { return (a.nombre || '').localeCompare(b.nombre || '', 'es'); });
    return '<div class="asoc-prov-grupo">' +
      '<div class="asoc-prov-cab">' +
        '<span class="asoc-prov-ico" style="background:' + _asocRgba(col, 0.14) + ';color:' + col + '">' + icoHTML('mapPin') + '</span>' +
        '<span class="asoc-prov-nom">' + esc(prov) + '</span>' +
        '<span class="asoc-prov-count">' + lista.length + ' asociaci' + (lista.length !== 1 ? 'ones' : 'ón') + '</span>' +
      '</div>' +
      '<div class="asoc-prov-lista">' + lista.map(function (a) { return fila(a, col); }).join('') + '</div>' +
    '</div>';
  }).join('');

  wrap.innerHTML = '<div class="asoc-provs">' + cuerpo + '</div>' +
    '<div style="font-size:12px;color:var(--text-dim);text-align:center;margin-top:16px">' + ASOCIACIONES_DATA.length + ' registro' + (ASOCIACIONES_DATA.length !== 1 ? 's' : '') + '</div>';
}

// ── Ver ficha (solo lectura) ──
function verAsociacion(docId) {
  const a = CAT.asociaciones.find(function (x) { return x._docId === docId; });
  if (!a) { showToast('Ficha no encontrada'); return; }
  const cnt = _asocDocsCount(a);
  const bloques = ASOC_DOCS.map(function (d) {
    const lista = _asocDocList(a.documentos, d.key);
    const archivos = lista.length
      ? lista.map(function (f) {
          const et = (d.multi && f.anio) ? ' <span class="asoc-doc-anio">' + esc(String(f.anio)) + '</span>' : '';
          return '<a class="asoc-doc-chip" href="' + esc(f.url || '#') + '" target="_blank" rel="noopener">' + icoHTML('view') + ' ' + esc(f.nombre || d.lbl) + et + '</a>';
        }).join('')
      : '<span class="asoc-doc-chip asoc-doc-chip-off">' + icoHTML('close') + ' Sin archivo</span>';
    return '<div class="asoc-doc-grp"><div class="asoc-doc-grp-lbl">' + esc(d.lbl) + (lista.length > 1 ? ' <span class="asoc-doc-num">' + lista.length + '</span>' : '') + '</div>' +
      '<div class="asoc-doc-grp-files">' + archivos + '</div></div>';
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
        '<div class="asoc-docs-ver">' + bloques + '</div>' +
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

  // Copia de trabajo de documentos (para agregar/quitar antes de guardar)
  _ASOC_FORM = {
    docId: docId,
    documentos: JSON.parse(JSON.stringify((a && a.documentos) ? a.documentos : {})),
    eliminar: [],
  };

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
        '<div class="asoc-docs" id="asoc-docs-cont"></div>' +
        '<div class="form-group" style="margin-top:16px"><label class="form-label">Observaciones</label>' +
          '<textarea class="form-textarea" id="asoc-obs" placeholder="Notas adicionales…">' + esc(a ? a.observaciones : '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        (puedeEditar() ? '<button class="btn btn-primary" id="asoc-save-btn" onclick="guardarAsociacion(' + (docId ? '\'' + jsEsc(docId) + '\'' : 'null') + ')">Guardar</button>' : '') +
      '</div>' +
    '</div>'
  );
  _renderAsocDocs();
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
    documentos:      JSON.parse(JSON.stringify((_ASOC_FORM && _ASOC_FORM.documentos) ? _ASOC_FORM.documentos : {})),
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

  // Recolectar archivos nuevos por documento (single = 1; multi = varios)
  const anio = new Date().getFullYear();
  const nuevos = [];
  ASOC_DOCS.forEach(function (d) {
    const el = document.getElementById('asoc-doc-' + d.key);
    if (!el || !el.files || !el.files.length) return;
    const files = Array.prototype.slice.call(el.files, 0, d.multi ? el.files.length : 1);
    files.forEach(function (f) { nuevos.push({ key: d.key, file: d.file, multi: d.multi, archivo: f }); });
  });

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
          const fname = n.multi ? (n.file + '_' + anio + '.pdf') : (n.file + '.pdf');
          const up = await driveSubirArchivo(n.archivo, fname, o.id_carpeta_drive, tok);
          const meta = { id: up.id, url: up.webViewLink, nombre: fname };
          if (n.multi) {
            meta.anio = anio;
            const arr = _asocDocList(o.documentos, n.key);
            arr.push(meta);
            o.documentos[n.key] = arr;
          } else {
            // reemplaza: si había uno anterior, mandarlo a papelera
            const prev = o.documentos[n.key];
            if (prev && prev.id && tok) { try { await driveEliminarCarpeta(prev.id, tok); } catch (e) {} }
            o.documentos[n.key] = meta;
          }
        } catch (e) { console.warn('Subida documento:', e); showToast('No se pudo subir ' + n.file); }
      }
    }
  }

  // Aplicar eliminaciones marcadas en el formulario (mandar a papelera)
  if (_ASOC_FORM && _ASOC_FORM.eliminar.length && tok) {
    for (let i = 0; i < _ASOC_FORM.eliminar.length; i++) {
      try { await driveEliminarCarpeta(_ASOC_FORM.eliminar[i], tok); } catch (e) { console.warn('Papelera archivo:', e); }
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
    const sino = function (a, key) { return _asocDocPresente(a, key) ? 'Sí' : 'No'; };
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
    /* Filas agrupadas por provincia (un solo nivel) */
    .asoc-provs { display:flex; flex-direction:column; gap:22px; }
    .asoc-prov-cab { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
    .asoc-prov-ico { width:34px; height:34px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .asoc-prov-ico svg { width:17px; height:17px; }
    .asoc-prov-nom { font-size:14px; font-weight:800; color:var(--text); text-transform:uppercase; letter-spacing:.4px; }
    .asoc-prov-count { font-size:11px; font-weight:600; color:var(--text-dim); background:rgba(0,0,0,.04); padding:3px 10px; border-radius:20px; }
    .asoc-prov-lista { display:flex; flex-direction:column; gap:10px; }

    .asoc-row { display:flex; align-items:center; gap:14px; width:100%; text-align:left; background:var(--surface); border:1px solid var(--border); border-radius:15px; padding:13px 18px; cursor:pointer; transition:box-shadow .15s,transform .12s,border-color .15s; }
    .asoc-row:hover { box-shadow:0 6px 18px rgba(0,0,0,.08); transform:translateY(-2px); border-color:transparent; }
    .asoc-row-ico { width:40px; height:40px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .asoc-row-ico svg { width:19px; height:19px; }
    .asoc-row-nom { flex:1; min-width:0; font-size:14px; font-weight:700; color:var(--text); line-height:1.3; }
    .asoc-row-right { display:flex; align-items:center; gap:12px; flex-shrink:0; }
    .asoc-row-pill { font-size:12.5px; font-weight:700; padding:5px 12px; border-radius:20px; white-space:nowrap; }
    .asoc-row-pill-0 { color:var(--text-dim); background:rgba(0,0,0,.05); }
    .asoc-row-acts { display:flex; gap:5px; }

    /* Casillas de PDF en el formulario */
    .asoc-docs { display:flex; flex-direction:column; gap:10px; }
    .asoc-doc-item { border:1px solid var(--border); border-radius:12px; padding:12px 14px; }
    .asoc-doc-cab { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
    .asoc-doc-lbl { font-size:13px; font-weight:700; color:var(--text); }
    .asoc-doc-tag { font-size:10px; font-weight:700; color:#7B5CFF; background:rgba(123,92,255,.12); padding:2px 8px; border-radius:20px; margin-left:6px; }

    .asoc-f-list { display:flex; flex-direction:column; gap:7px; margin-bottom:10px; }
    .asoc-f-row { display:flex; align-items:center; gap:8px; background:rgba(0,0,0,.03); border-radius:9px; padding:8px 10px; }
    .asoc-f-nom { flex:1; min-width:0; font-size:12.5px; color:var(--text); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .asoc-f-anio { font-size:10.5px; font-weight:700; color:#0a9e83; background:rgba(24,174,151,.14); padding:2px 8px; border-radius:20px; flex-shrink:0; }
    .asoc-f-ver, .asoc-f-del { width:28px; height:28px; border-radius:8px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; border:none; cursor:pointer; }
    .asoc-f-ver { background:rgba(80,108,255,.1); color:#506CFF; text-decoration:none; }
    .asoc-f-ver:hover { background:rgba(80,108,255,.2); }
    .asoc-f-ver svg { width:14px; height:14px; }
    .asoc-f-del { background:rgba(201,26,68,.09); color:#c91a44; }
    .asoc-f-del:hover { background:rgba(201,26,68,.18); }
    .asoc-f-del svg { width:14px; height:14px; }

    .asoc-doc-add { display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600; color:#506CFF; cursor:pointer; padding:9px 12px; border:1.5px dashed var(--border); border-radius:10px; }
    .asoc-doc-add:hover { border-color:#506CFF; background:rgba(80,108,255,.04); }
    .asoc-doc-add svg { width:16px; height:16px; }
    .asoc-doc-add input[type=file] { display:none; }

    /* Documentos en la ficha de detalle */
    .asoc-docs-ver { display:flex; flex-direction:column; gap:14px; }
    .asoc-doc-grp-lbl { font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase; letter-spacing:.4px; }
    .asoc-doc-num { font-size:10px; color:#506CFF; background:rgba(80,108,255,.12); padding:1px 7px; border-radius:20px; margin-left:4px; }
    .asoc-doc-grp-files { display:flex; flex-wrap:wrap; gap:8px; }
    .asoc-doc-chip { display:inline-flex; align-items:center; gap:8px; padding:9px 13px; border:1px solid var(--border); border-radius:11px; font-size:13px; font-weight:600; color:#0a9e83; text-decoration:none; background:rgba(24,174,151,.06); }
    .asoc-doc-chip svg { width:15px; height:15px; }
    .asoc-doc-chip:hover { background:rgba(24,174,151,.14); }
    .asoc-doc-chip-off { color:var(--text-dim); background:transparent; }
    .asoc-doc-anio { font-size:10.5px; font-weight:700; color:#0a9e83; background:rgba(24,174,151,.16); padding:1px 7px; border-radius:20px; }

    /* Archivo recién seleccionado (aún sin guardar) */
    .asoc-doc-pend { margin-top:8px; display:flex; flex-direction:column; gap:6px; }
    .asoc-f-pend { display:flex; align-items:center; gap:7px; background:rgba(24,174,151,.08); border:1px solid rgba(24,174,151,.25); border-radius:9px; padding:8px 10px; font-size:12px; color:#0a9e83; }
    .asoc-f-pend svg { width:14px; height:14px; flex-shrink:0; }
    .asoc-f-pend span { font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .asoc-f-pend small { margin-left:auto; font-size:10.5px; color:var(--text-dim); white-space:nowrap; flex-shrink:0; }

    @media (max-width:768px) {
      .asoc-row { padding:12px 14px; gap:11px; }
      .asoc-row-ico { width:36px; height:36px; }
      .asoc-row-right { gap:8px; }
    }
  `;
  document.head.appendChild(s);
})();
