// ============================================================
// DASHBOARD SOCIAL — recicladores.js
// Sección Recicladores: lee/escribe la colección "recicladores"
// (compartida con la app de Fichas). CRUD: ver / editar / eliminar.
//  - La tabla NO muestra nada hasta aplicar filtros.
//  - Ficha completa al hacer clic en el nombre + descarga en PDF (con fotos).
//  - Editar permite reemplazar las 3 fotos (opcional) en la misma carpeta.
//  - Eliminar manda a la papelera la carpeta del reciclador en Drive.
// ============================================================

let RECS_FILTROS = { prov: [], asoc: [] };
let RECS_DATA = [];

const SEXOS = ['Masculino', 'Femenino'];

// ── Filtros (drawer): provincia (cruce con Asoc_Ambiente) + asociación ──
function registerRecicladoresFilters() {
  registerFilterConfig('recicladores', {
    badgeId: 'recs-filter-badge',
    sections: [
      { key: 'prov', title: 'Provincia',  type: 'options', options: _provinciasRecs() },
    ],
    getValue: function (k) { return RECS_FILTROS[k] || []; },
    setValue: function (k, v) { RECS_FILTROS[k] = v; },
    apply: function () { cargarRecicladores(); },
  });
}

function _provinciasRecs() {
  return Array.from(new Set(CAT.asocAmbiente.map(function (a) { return a.provincia; }).filter(Boolean))).sort();
}

function _hayFiltroRecs() {
  return (RECS_FILTROS.prov && RECS_FILTROS.prov.length > 0) || (RECS_FILTROS.asoc && RECS_FILTROS.asoc.length > 0);
}

// ── Render principal ──
// ── Estado de navegación (dos niveles) ──
let RECS_VISTA = 'asociaciones';  // 'asociaciones' | 'lista'
let RECS_ASOC_SEL = null;         // _docId de la asociación abierta

// docId canónico de la asociación de un reciclador (tolera id_asociacion o nombre)
function _asocDocIdDeReciclador(r) {
  let a = _buscarAsoc(r.id_asociacion);
  if (!a && r.asociacion_nombre) {
    a = CAT.asocAmbiente.find(function (x) { return (x.nombre || '').trim() === (r.asociacion_nombre || '').trim(); });
  }
  return a ? a._docId : null;
}

function _recsDeAsociacion(docId) {
  return CAT.recicladores
    .filter(function (r) { return _asocDocIdDeReciclador(r) === docId; })
    .slice()
    .sort(function (a, b) { return (a.nombres_apellidos || '').localeCompare(b.nombres_apellidos || ''); });
}

function renderRecicladores() {
  registerRecicladoresFilters();
  RECS_VISTA = 'asociaciones';   // al entrar siempre se muestran las asociaciones
  RECS_ASOC_SEL = null;
  renderVistaRecs();
  updateFilterBadge('recicladores');
}

// Wrapper: guardar/eliminar/aplicar-filtro refrescan la vista activa.
function cargarRecicladores() { renderVistaRecs(); }

function renderVistaRecs() {
  if (RECS_VISTA === 'lista' && RECS_ASOC_SEL) renderListaAsociacion();
  else renderAsociacionesCards();
}

// ── Nivel 1: asociaciones agrupadas por provincia ──
function renderAsociacionesCards() {
  RECS_VISTA = 'asociaciones';
  RECS_ASOC_SEL = null;
  const add = puedeEditar();

  // Conteo de recicladores por asociación
  const conteo = {};
  CAT.recicladores.forEach(function (r) {
    const id = _asocDocIdDeReciclador(r);
    if (id) conteo[id] = (conteo[id] || 0) + 1;
  });

  // Asociaciones (filtro de provincia opcional del drawer)
  let asocs = CAT.asocAmbiente.slice();
  const fProv = RECS_FILTROS.prov || [];
  if (fProv.length && !fProv.includes('__ALL__')) {
    asocs = asocs.filter(function (a) { return fProv.includes(a.provincia); });
  }

  const header =
    '<div class="page-header">' +
      '<div><div class="page-title">Recicladores</div><div class="page-sub">Elegí una asociación</div></div>' +
      '<div class="hdr-actions">' +
        '<button class="hdr-circle" onclick="openFilterDrawer(\'recicladores\')" title="Filtrar por provincia">' +
          icoHTML('filter') + '<span class="filter-badge" id="recs-filter-badge" style="display:none">0</span></button>' +
        '<button class="hdr-circle" onclick="exportarRecicladoresExcel()" title="Descargar Excel">' + icoHTML('download') + '</button>' +
        (add ? '<button class="hdr-circle hdr-circle-primary" onclick="abrirFormReciclador()" title="Nuevo reciclador">' + icoHTML('plus') + '</button>' : '') +
      '</div>' +
    '</div>';

  if (!asocs.length) {
    document.getElementById('main-content').innerHTML = header +
      '<div class="empty-state">' + icoHTML('users').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"') +
      '<p>No hay asociaciones</p></div>';
    return;
  }

  // Agrupar por provincia
  const grupos = {};
  asocs.forEach(function (a) {
    const prov = a.provincia || 'Sin provincia';
    (grupos[prov] = grupos[prov] || []).push(a);
  });
  const provsOrden = Object.keys(grupos).sort(function (a, b) { return a.localeCompare(b, 'es'); });

  const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

  const cuerpo = provsOrden.map(function (prov) {
    const lista = grupos[prov].slice().sort(function (a, b) { return (a.nombre || '').localeCompare(b.nombre || '', 'es'); });
    const filas = lista.map(function (a) {
      const n = conteo[a._docId] || 0;
      const vacia = n === 0;
      const pill = vacia
        ? '<span class="asoc-pill asoc-pill-0">0</span>'
        : '<span class="asoc-pill">' + n + '</span>';
      return '<button class="asoc-row' + (vacia ? ' asoc-row-vacia' : '') + '" onclick="abrirAsociacionRecs(\'' + jsEsc(a._docId) + '\')">' +
        '<span class="asoc-row-nombre">' + esc(a.nombre || '—') + '</span>' +
        '<span class="asoc-row-right">' + pill + '<span class="asoc-row-chev">' + CHEV + '</span></span>' +
      '</button>';
    }).join('');
    return '<div class="asoc-grupo">' +
      '<div class="asoc-grupo-titulo">' + esc(prov) + '</div>' +
      '<div class="asoc-grupo-lista">' + filas + '</div>' +
    '</div>';
  }).join('');

  document.getElementById('main-content').innerHTML = header + '<div class="asoc-provs">' + cuerpo + '</div>';
}

function abrirAsociacionRecs(docId) {
  RECS_ASOC_SEL = docId;
  RECS_VISTA = 'lista';
  renderVistaRecs();
}

function volverAAsociaciones() {
  RECS_ASOC_SEL = null;
  RECS_VISTA = 'asociaciones';
  renderVistaRecs();
}

// ── Nivel 2: lista de recicladores de la asociación ──
function renderListaAsociacion() {
  const asoc = _buscarAsoc(RECS_ASOC_SEL);
  const nombre = asoc ? (asoc.nombre || '—') : '—';
  const add = puedeEditar();
  RECS_DATA = _recsDeAsociacion(RECS_ASOC_SEL);

  const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';

  const header =
    '<div class="page-header">' +
      '<div>' +
        '<div class="rec-title-row">' +
          '<button class="rec-back" onclick="volverAAsociaciones()" title="Volver a asociaciones">' + BACK + '</button>' +
          '<div class="page-title">' + esc(nombre) + '</div>' +
        '</div>' +
        '<div class="page-sub">' + RECS_DATA.length + ' reciclador' + (RECS_DATA.length !== 1 ? 'es' : '') + '</div>' +
      '</div>' +
      '<div class="hdr-actions">' +
        '<button class="hdr-circle" onclick="exportarRecicladoresExcel()" title="Descargar Excel">' + icoHTML('download') + '</button>' +
        (add ? '<button class="hdr-circle hdr-circle-primary" onclick="abrirFormReciclador(null,\'' + jsEsc(RECS_ASOC_SEL) + '\')" title="Nuevo reciclador">' + icoHTML('plus') + '</button>' : '') +
      '</div>' +
    '</div>' +
    '<div id="recs-wrap"></div>';

  document.getElementById('main-content').innerHTML = header;
  renderTablaRecicladores();
}

function renderTablaRecicladores() {
  const wrap = document.getElementById('recs-wrap');
  if (!wrap) return;
  if (!RECS_DATA.length) {
    wrap.innerHTML = '<div class="empty-state">' +
      icoHTML('users').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"') +
      '<p>No hay recicladores con estos filtros</p></div>';
    return;
  }
  const edit = puedeEditar();
  const acciones = function (r) {
    const docId = jsEsc(r._docId || '');
    const carpeta = jsEsc(r.carpeta_id || '');
    return (carpeta ? '<button class="icon-btn" onclick="window.open(\'https://drive.google.com/drive/folders/' + carpeta + '\',\'_blank\')" title="Carpeta">' + icoHTML('folder') + '</button>' : '') +
      '<button class="icon-btn" onclick="verReciclador(\'' + docId + '\')" title="Ver ficha">' + icoHTML('view') + '</button>' +
      (edit ? '<button class="icon-btn primary" onclick="editarReciclador(\'' + docId + '\')" title="Editar">' + icoHTML('edit') + '</button>' +
        '<button class="icon-btn del" onclick="confirmarEliminarReciclador(\'' + docId + '\',\'' + carpeta + '\')" title="Eliminar">' + icoHTML('trash') + '</button>' : '');
  };

  // Tabla (desktop)
  const filas = RECS_DATA.map(function (r) {
    const docId = jsEsc(r._docId || '');
    return '<tr>' +
      '<td><a class="rec-nombre" onclick="verReciclador(\'' + docId + '\')">' + esc(r.nombres_apellidos || '—') + '</a></td>' +
      '<td>' + fmtFecha(r.fecha_nacimiento) + '</td>' +
      '<td>' + esc(r.celular || '—') + '</td>' +
      '<td data-actions-row><div class="td-actions">' + acciones(r) + '</div></td>' +
    '</tr>';
  }).join('');
  const tabla = '<div class="table-wrap rec-desk"><table>' +
    '<thead><tr><th>Nombre y apellidos</th><th>Fecha de nacimiento</th><th>Celular</th><th></th></tr></thead>' +
    '<tbody>' + filas + '</tbody></table></div>';

  // Tarjetas (móvil)
  const cards = RECS_DATA.map(function (r) {
    const docId = jsEsc(r._docId || '');
    return '<div class="rec-card">' +
      '<a class="rec-card-nombre" onclick="verReciclador(\'' + docId + '\')">' + esc(r.nombres_apellidos || '—') + '</a>' +
      '<div class="rec-card-grid">' +
        '<div class="rec-cell"><span class="rec-mini">Nacimiento</span><b>' + fmtFecha(r.fecha_nacimiento) + '</b></div>' +
        '<div class="rec-cell"><span class="rec-mini">Celular</span><b>' + esc(r.celular || '—') + '</b></div>' +
      '</div>' +
      '<div class="rec-foot"><div class="td-actions">' + acciones(r) + '</div></div>' +
    '</div>';
  }).join('');
  const cardsWrap = '<div class="rec-mob">' + cards + '</div>';

  wrap.innerHTML = tabla + cardsWrap +
    '<div style="font-size:12px;color:var(--text-dim);text-align:right;margin-top:10px">' + RECS_DATA.length + ' registro' + (RECS_DATA.length !== 1 ? 's' : '') + '</div>';
}

// ── Ver ficha (clic en el nombre) ──
function verReciclador(docId) {
  const r = CAT.recicladores.find(function (x) { return x._docId === docId; });
  if (!r) { showToast('Ficha no encontrada'); return; }
  const prov = provinciaDeReciclador(r);
  const dato = function (lbl, val) {
    return '<div class="rf-row"><span class="rf-lbl">' + esc(lbl) + '</span><span class="rf-val">' + (val ? esc(val) : '—') + '</span></div>';
  };
  const sino = function (b) { return b ? 'Sí' : 'No'; };
  const foto = function (urlOrId, titulo) {
    const src = driveImgSrc(urlOrId, 600);
    const inner = src
      ? '<img src="' + src + '" alt="' + esc(titulo) + '" loading="lazy" onerror="this.parentNode.classList.add(\'rf-foto-fail\');this.remove();">'
      : '';
    return '<div class="rf-foto">' + inner + '<span class="rf-foto-cap">' + esc(titulo) + '</span></div>';
  };

  abrirModal(
    '<div class="modal modal-lg">' +
      '<div class="modal-head"><div><div class="modal-title">' + esc(r.nombres_apellidos || 'Reciclador') + '</div>' +
        '<div class="modal-sub">' + esc(r.asociacion_nombre || nombreDeAsociacion(r.id_asociacion) || '—') + (prov ? ' · ' + esc(prov) : '') + '</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="rf-grid">' +
          dato('Sexo', r.sexo) +
          dato('Cédula', r.cedula) +
          dato('Fecha de nacimiento', fmtFecha(r.fecha_nacimiento)) +
          dato('Asociación', r.asociacion_nombre || nombreDeAsociacion(r.id_asociacion)) +
          dato('Fecha de afiliación', fmtFecha(r.fecha_afiliacion)) +
          dato('Provincia', prov) +
          dato('Domicilio', r.domicilio) +
          dato('Celular', r.celular) +
          dato('Cargas familiares', fmtNum(r.cargas_familiares)) +
          dato('RUC', sino(r.ruc)) +
          dato('Cuenta bancaria', sino(r.cuenta_bancaria)) +
          dato('Certificación SECAP', sino(r.certificacion_secap)) +
        '</div>' +
        '<div class="rf-fotos">' +
          foto(r.foto_perfil_id || r.foto_perfil_url, 'Foto de perfil') +
          foto(r.foto_cedula_anverso_id || r.foto_cedula_anverso_url, 'Cédula (anverso)') +
          foto(r.foto_cedula_reverso_id || r.foto_cedula_reverso_url, 'Cédula (reverso)') +
        '</div>' +
      '</div>' +
      '<div class="modal-foot">' +
        (r.carpeta_id ? '<a class="btn btn-glass" href="' + urlCarpeta(r.carpeta_id) + '" target="_blank" rel="noopener">Carpeta de Drive ↗</a>' : '') +
        '<button class="btn btn-primary" id="rec-pdf-btn" onclick="descargarRecicladorPDF(\'' + jsEsc(docId) + '\')">' + icoHTML('download') + ' Descargar PDF</button>' +
      '</div>' +
    '</div>'
  );
}

// ── Formulario (crear / editar) ──
function editarReciclador(docId) { abrirFormReciclador(docId); }

function abrirFormReciclador(docId, presetAsoc) {
  docId = docId || null;
  const r = docId ? CAT.recicladores.find(function (x) { return x._docId === docId; }) : null;
  const editing = !!r;

  const asocSel = r ? r.id_asociacion : (presetAsoc || '');
  const asocOpts = '<option value="">Seleccioná una asociación…</option>' + CAT.asocAmbiente.map(function (a) {
    return '<option value="' + esc(a._docId) + '"' + (asocSel === a._docId ? ' selected' : '') + '>' + esc(a.nombre) + '</option>';
  }).join('');
  const sexoOpts = '<option value="">—</option>' + SEXOS.map(function (s) {
    return '<option value="' + s + '"' + (r && r.sexo === s ? ' selected' : '') + '>' + s + '</option>';
  }).join('');

  const fotoInput = function (campo, label, urlActual) {
    const prev = urlActual ? '<a href="' + urlCarpeta(0) + '" onclick="return false" class="rec-foto-actual"><img src="' + driveImgSrc(urlActual, 200) + '" onerror="this.remove()"> foto actual</a>' : '<span class="rec-foto-none">sin foto</span>';
    return '<div class="form-group"><label class="form-label">' + esc(label) + '</label>' +
      '<input type="file" accept="image/*" class="form-input rec-file" id="' + campo + '">' +
      '<div class="rec-foto-hint">' + (editing ? prev + ' · dejá vacío para conservarla' : 'Opcional') + '</div></div>';
  };

  abrirModal(
    '<div class="modal modal-lg">' +
      '<div class="modal-head"><div><div class="modal-title">' + (editing ? 'Editar' : 'Nuevo') + ' reciclador</div>' +
        '<div class="modal-sub">Ficha de registro</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-grid-2">' +
          '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Nombres y apellidos *</label>' +
            '<input type="text" class="form-input" id="rec-nombre" value="' + esc(r ? r.nombres_apellidos : '') + '" placeholder="Nombre completo"></div>' +
          '<div class="form-group"><label class="form-label">Asociación</label><select class="form-select" id="rec-asoc">' + asocOpts + '</select></div>' +
          '<div class="form-group"><label class="form-label">Sexo</label><select class="form-select" id="rec-sexo">' + sexoOpts + '</select></div>' +
          '<div class="form-group"><label class="form-label">Cédula</label><input type="text" class="form-input" id="rec-cedula" maxlength="10" value="' + esc(r ? r.cedula : '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Celular</label><input type="text" class="form-input" id="rec-celular" maxlength="10" value="' + esc(r ? r.celular : '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Fecha de nacimiento</label><input type="date" class="form-input" id="rec-nac" value="' + _dmyToIso(r ? r.fecha_nacimiento : '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Fecha de afiliación</label><input type="date" class="form-input" id="rec-afi" value="' + _dmyToIso(r ? r.fecha_afiliacion : '') + '"></div>' +
          '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Domicilio</label><input type="text" class="form-input" id="rec-domicilio" value="' + esc(r ? r.domicilio : '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Cargas familiares</label><input type="number" class="form-input" id="rec-cargas" min="0" step="1" value="' + (r ? r.cargas_familiares : '') + '"></div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap">' +
          _sinoRec('rec-ruc', 'Tiene RUC', r ? r.ruc : false) +
          _sinoRec('rec-cuenta', 'Cuenta bancaria', r ? r.cuenta_bancaria : false) +
          _sinoRec('rec-secap', '¿Tiene certificación del SECAP?', r ? r.certificacion_secap : false) +
        '</div>' +
        '<div class="form-label" style="margin:18px 0 8px">Fotografías</div>' +
        '<div class="form-grid-2">' +
          fotoInput('rec-foto-perfil', 'Foto de perfil', r ? (r.foto_perfil_id || r.foto_perfil_url) : '') +
          fotoInput('rec-foto-anverso', 'Cédula (anverso)', r ? (r.foto_cedula_anverso_id || r.foto_cedula_anverso_url) : '') +
          fotoInput('rec-foto-reverso', 'Cédula (reverso)', r ? (r.foto_cedula_reverso_id || r.foto_cedula_reverso_url) : '') +
        '</div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-primary" id="rec-save-btn" onclick="guardarReciclador(' + (docId ? '\'' + jsEsc(docId) + '\'' : 'null') + ')">Guardar</button>' +
      '</div>' +
    '</div>'
  );
}

function _sinoRec(id, label, checked) {
  return '<label class="sino-row" style="flex:1"><span>' + esc(label) + '</span>' +
    '<span class="sino-switch"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><span class="sino-slider"></span></span></label>';
}

// dd/mm/aaaa  ⇄  aaaa-mm-dd
function _dmyToIso(dmy) {
  if (!dmy) return '';
  const m = String(dmy).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(dmy)) return String(dmy).substring(0, 10);
  return '';
}
function _isoToDmy(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? (m[3] + '/' + m[2] + '/' + m[1]) : String(iso);
}

// ── Guardar (escribe directo a Firestore; fotos a Drive) ──
async function guardarReciclador(docId) {
  const nombre = ((document.getElementById('rec-nombre') || {}).value || '').trim();
  if (!nombre) { showToast('El nombre es obligatorio'); return; }
  const idAsoc = (document.getElementById('rec-asoc') || {}).value || '';

  const actual = docId ? CAT.recicladores.find(function (x) { return x._docId === docId; }) : null;
  const asocNombre = idAsoc ? nombreDeAsociacion(idAsoc) : (actual ? actual.asociacion_nombre : '');

  const o = {
    id_asociacion:           idAsoc || (actual ? actual.id_asociacion : ''),
    asociacion_nombre:       asocNombre,
    nombres_apellidos:       nombre,
    sexo:                    (document.getElementById('rec-sexo') || {}).value || '',
    cedula:                  ((document.getElementById('rec-cedula') || {}).value || '').trim(),
    fecha_nacimiento:        _isoToDmy((document.getElementById('rec-nac') || {}).value || ''),
    fecha_afiliacion:        _isoToDmy((document.getElementById('rec-afi') || {}).value || ''),
    domicilio:               ((document.getElementById('rec-domicilio') || {}).value || '').trim(),
    celular:                 ((document.getElementById('rec-celular') || {}).value || '').trim(),
    cargas_familiares:       (document.getElementById('rec-cargas') || {}).value || 0,
    ruc:                     !!(document.getElementById('rec-ruc') || {}).checked,
    cuenta_bancaria:         !!(document.getElementById('rec-cuenta') || {}).checked,
    certificacion_secap:     !!(document.getElementById('rec-secap') || {}).checked,
    foto_perfil_url:         actual ? actual.foto_perfil_url : '',
    foto_cedula_anverso_url: actual ? actual.foto_cedula_anverso_url : '',
    foto_cedula_reverso_url: actual ? actual.foto_cedula_reverso_url : '',
    foto_perfil_id:          actual ? actual.foto_perfil_id : '',
    foto_cedula_anverso_id:  actual ? actual.foto_cedula_anverso_id : '',
    foto_cedula_reverso_id:  actual ? actual.foto_cedula_reverso_id : '',
    carpeta_id:              actual ? actual.carpeta_id : '',
  };

  if (r_cedulaInvalida(o.cedula)) { showToast('La cédula debe tener 10 dígitos'); return; }

  const btn = document.getElementById('rec-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  // Fotos nuevas seleccionadas
  const fPerfil = _archivo('rec-foto-perfil');
  const fAnverso = _archivo('rec-foto-anverso');
  const fReverso = _archivo('rec-foto-reverso');
  const hayFotosNuevas = !!(fPerfil || fAnverso || fReverso);

  // Drive: carpeta + subida (si hay token)
  const tok = driveToken();
  if (tok) {
    try {
      if (!o.carpeta_id) {
        const carpAsoc = await driveBuscarOCrear(asocNombre || 'Sin asociación', DRIVE_PARENTS.recicladores, tok);
        o.carpeta_id = await driveBuscarOCrear(nombre, carpAsoc, tok);
      }
      if (hayFotosNuevas) {
        const ts = Date.now();
        if (fPerfil)  { const up = await driveSubirArchivo(await comprimirImagen(fPerfil),  'perfil_' + ts + '.jpg',         o.carpeta_id, tok); o.foto_perfil_url = up.webViewLink; o.foto_perfil_id = up.id; }
        if (fAnverso) { const up = await driveSubirArchivo(await comprimirImagen(fAnverso), 'cedula_anverso_' + ts + '.jpg', o.carpeta_id, tok); o.foto_cedula_anverso_url = up.webViewLink; o.foto_cedula_anverso_id = up.id; }
        if (fReverso) { const up = await driveSubirArchivo(await comprimirImagen(fReverso), 'cedula_reverso_' + ts + '.jpg', o.carpeta_id, tok); o.foto_cedula_reverso_url = up.webViewLink; o.foto_cedula_reverso_id = up.id; }
      }
    } catch (e) {
      console.warn('Drive reciclador:', e);
      showToast('No se pudieron subir las fotos (se guarda el resto)');
    }
  } else if (hayFotosNuevas || !o.carpeta_id) {
    showToast('Sesión de Drive expirada: se guarda sin carpeta/fotos');
  }

  const fs = recicladorToFS(o);
  fs.actualizado_en = new Date();
  let r;
  if (docId) {
    r = await fsWrite(function () { return window.fb.setDoc(fsDoc('recicladores', docId), fs, { merge: true }); });
    if (r.ok) { const i = CAT.recicladores.findIndex(function (x) { return x._docId === docId; }); if (i >= 0) CAT.recicladores[i] = recicladorFromFS(Object.assign({ _docId: docId }, fs)); }
  } else {
    fs.creado_en = new Date();
    fs.creado_por = SESSION ? SESSION.email : '';
    const ref = window.fb.doc(fsCol('recicladores'));
    r = await fsWrite(function () { return window.fb.setDoc(ref, fs); });
    if (r.ok) CAT.recicladores.push(recicladorFromFS(Object.assign({ _docId: ref.id }, fs)));
  }

  if (!r.ok) { showToast('Error al guardar: ' + (r.error || '')); if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; } return; }
  showToast(r.offline ? 'Guardado (se sincronizará) ✓' : 'Guardado ✓');
  cerrarModal();
  cargarRecicladores();
}

function _archivo(id) { const el = document.getElementById(id); return (el && el.files && el.files[0]) ? el.files[0] : null; }
function r_cedulaInvalida(c) { return !!c && !/^\d{10}$/.test(c); }

// Comprime y reescala una imagen a JPEG (máx ~1280px). Devuelve Blob.
function comprimirImagen(file, maxLado, calidad) {
  maxLado = maxLado || 1280; calidad = calidad || 0.82;
  return new Promise(function (resolve) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function () {
      let w = img.width, h = img.height;
      if (w > h && w > maxLado) { h = Math.round(h * maxLado / w); w = maxLado; }
      else if (h >= w && h > maxLado) { w = Math.round(w * maxLado / h); h = maxLado; }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) { resolve(b || file); }, 'image/jpeg', calidad);
    };
    img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Eliminar (registro + papelera de la carpeta de Drive) ──
function confirmarEliminarReciclador(docId, carpetaId) {
  abrirModal(
    '<div class="modal" style="max-width:440px">' +
      '<div class="modal-head"><div class="modal-title">Eliminar reciclador</div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body"><p style="color:var(--text-muted);font-size:14px;line-height:1.6">' +
        'Se eliminará el registro y su carpeta de Drive (con las fotos) se enviará a la papelera. Esto afecta también a la app de Fichas. ¿Continuar?' +
      '</p></div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-danger" onclick="eliminarReciclador(\'' + jsEsc(docId) + '\',\'' + jsEsc(carpetaId) + '\')">Eliminar</button>' +
      '</div>' +
    '</div>'
  );
}

async function eliminarReciclador(docId, carpetaId) {
  if (!docId) { showToast('No se encontró la ficha'); return; }
  if (carpetaId) {
    const tok = driveToken();
    if (tok) { try { await driveEliminarCarpeta(carpetaId, tok); } catch (e) { console.warn('Drive papelera reciclador:', e); } }
  }
  const r = await fsWrite(function () { return window.fb.deleteDoc(fsDoc('recicladores', docId)); });
  if (!r.ok) { showToast('Error al eliminar: ' + (r.error || '')); return; }
  CAT.recicladores = CAT.recicladores.filter(function (x) { return x._docId !== docId; });
  showToast(r.offline ? 'Eliminado (se sincronizará) ✓' : 'Reciclador eliminado ✓');
  cerrarModal();
  cargarRecicladores();
}

// ── PDF de la ficha (con fotos) ──
async function descargarRecicladorPDF(docId) {
  const r = CAT.recicladores.find(function (x) { return x._docId === docId; });
  if (!r) { showToast('Ficha no encontrada'); return; }
  const btn = document.getElementById('rec-pdf-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  try {
    await cargarJsPDF();
    const tok = driveToken();
    // Descarga las imágenes como dataURL (vía Drive API con token).
    const imgs = {};
    if (tok) {
      const pares = [['perfil', r.foto_perfil_id || r.foto_perfil_url], ['anverso', r.foto_cedula_anverso_id || r.foto_cedula_anverso_url], ['reverso', r.foto_cedula_reverso_id || r.foto_cedula_reverso_url]];
      for (let i = 0; i < pares.length; i++) {
        try { imgs[pares[i][0]] = await _imagenDataURL(pares[i][1], tok); } catch (e) { imgs[pares[i][0]] = null; }
      }
    }
    _construirPDF(r, imgs);
    showToast('PDF generado ✓');
  } catch (e) {
    console.error('PDF:', e);
    showToast('No se pudo generar el PDF');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = icoHTML('download') + ' Descargar PDF'; }
  }
}

async function _imagenDataURL(urlOrId, token) {
  const m = String(urlOrId || '').match(/[-\w]{25,}/);
  if (!m) return null;
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + m[0] + '?alt=media&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const blob = await r.blob();
  return await new Promise(function (res) { const fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(null); }; fr.readAsDataURL(blob); });
}

function _construirPDF(r, imgs) {
  const jsPDF = window.jspdf.jsPDF;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  // Encabezado
  doc.setFillColor(0, 35, 67); doc.rect(0, 0, W, 70, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('Ficha de Reciclador', M, 34);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('ReCircula 360 · Redes Con Rostro', M, 52);
  y = 96;

  doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text(r.nombres_apellidos || 'Reciclador', M, y); y += 22;

  const prov = provinciaDeReciclador(r);
  const sino = function (b) { return b ? 'Sí' : 'No'; };
  const filas = [
    ['Sexo', r.sexo || '—'],
    ['Cédula', r.cedula || '—'],
    ['Fecha de nacimiento', fmtFecha(r.fecha_nacimiento)],
    ['Asociación', r.asociacion_nombre || nombreDeAsociacion(r.id_asociacion) || '—'],
    ['Provincia', prov || '—'],
    ['Fecha de afiliación', fmtFecha(r.fecha_afiliacion)],
    ['Domicilio', r.domicilio || '—'],
    ['Celular', r.celular || '—'],
    ['Cargas familiares', String(r.cargas_familiares != null ? r.cargas_familiares : '—')],
    ['RUC', sino(r.ruc)],
    ['Cuenta bancaria', sino(r.cuenta_bancaria)],
  ];
  doc.setFontSize(11);
  filas.forEach(function (f) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 90, 90);
    doc.text(f[0], M, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20);
    doc.text(String(f[1]), M + 150, y);
    y += 20;
  });

  // Fotos
  y += 10;
  doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 90, 90); doc.setFontSize(11);
  doc.text('Fotografías', M, y); y += 12;

  const cellW = (W - M * 2 - 20) / 3;
  const cellH = cellW * 0.75;
  const pies = ['Perfil', 'Cédula (anverso)', 'Cédula (reverso)'];
  const claves = ['perfil', 'anverso', 'reverso'];
  claves.forEach(function (k, i) {
    const x = M + i * (cellW + 10);
    doc.setDrawColor(220, 220, 228); doc.setFillColor(245, 245, 249);
    doc.rect(x, y, cellW, cellH, 'FD');
    if (imgs && imgs[k]) {
      try { doc.addImage(imgs[k], 'JPEG', x + 4, y + 4, cellW - 8, cellH - 8, undefined, 'FAST'); }
      catch (e) {}
    } else {
      doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text('Sin imagen', x + cellW / 2, y + cellH / 2, { align: 'center' });
    }
    doc.setTextColor(90, 90, 90); doc.setFontSize(9);
    doc.text(pies[i], x, y + cellH + 12);
  });

  const nomArch = (r.nombres_apellidos || 'reciclador').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  doc.save('Ficha_' + nomArch + '.pdf');
}

// ── Exportar Excel (respeta filtros) ──
async function exportarRecicladoresExcel() {
  if (!_hayFiltroRecs()) { showToast('Aplicá un filtro primero.'); return; }
  if (!RECS_DATA.length) { showToast('No hay datos para exportar.'); return; }
  try {
    await cargarSheetJS();
    if (!window.XLSX) { showToast('No se pudo cargar el exportador'); return; }
    const sino = function (b) { return b ? 'Sí' : 'No'; };
    const header = ['Nombres y Apellidos', 'Sexo', 'Cédula', 'Fecha Nacimiento', 'Asociación', 'Provincia', 'Fecha Afiliación', 'Domicilio', 'Celular', 'Cargas Familiares', 'RUC', 'Cuenta Bancaria'];
    const filas = RECS_DATA.map(function (r) {
      return [r.nombres_apellidos, r.sexo, r.cedula, r.fecha_nacimiento, r.asociacion_nombre || nombreDeAsociacion(r.id_asociacion),
        provinciaDeReciclador(r), r.fecha_afiliacion, r.domicilio, r.celular, parseFloat(r.cargas_familiares) || 0, sino(r.ruc), sino(r.cuenta_bancaria)];
    });
    const ws = XLSX.utils.aoa_to_sheet([header].concat(filas));
    ws['!cols'] = [{ wch: 28 }, { wch: 11 }, { wch: 13 }, { wch: 15 }, { wch: 26 }, { wch: 14 }, { wch: 15 }, { wch: 26 }, { wch: 12 }, { wch: 10 }, { wch: 7 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recicladores');
    XLSX.writeFile(wb, 'Recicladores_' + new Date().toISOString().substring(0, 10) + '.xlsx');
    showToast('Excel descargado ✓');
  } catch (e) { console.error('export recicladores:', e); showToast('Error al exportar'); }
}

// ── Estilos propios ──
(function () {
  if (document.getElementById('recs-styles')) return;
  const s = document.createElement('style');
  s.id = 'recs-styles';
  s.textContent = `
    .modal-lg { max-width:680px; }

    .rec-nombre, .rec-card-nombre { color:#2f5bd0; font-weight:600; cursor:pointer; text-decoration:none; }
    .rec-nombre:hover, .rec-card-nombre:hover { text-decoration:underline; }

    .recs-hint { text-align:center; padding:60px 24px; color:var(--text-muted); }
    .recs-hint-ico { color:var(--text-dim); opacity:.5; margin-bottom:14px; }
    .recs-hint-txt { font-size:16px; font-weight:700; color:var(--text); }
    .recs-hint-sub { font-size:13px; color:var(--text-dim); margin-top:6px; }

    /* Ficha */
    .rf-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 24px; }
    .rf-row { display:flex; justify-content:space-between; gap:12px; padding:9px 0; border-bottom:1px solid var(--border); font-size:13px; }
    .rf-lbl { color:var(--text-muted); font-weight:600; }
    .rf-val { color:var(--text); font-weight:600; text-align:right; }
    .rf-fotos { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:18px; }
    .rf-foto { position:relative; aspect-ratio:4/3; background:#f2f2f7; border:1px solid var(--border); border-radius:12px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    .rf-foto img { width:100%; height:100%; object-fit:cover; }
    .rf-foto-fail::after { content:'Sin imagen'; color:var(--text-dim); font-size:11px; }
    .rf-foto-cap { position:absolute; left:0; right:0; bottom:0; background:rgba(0,0,0,.55); color:#fff; font-size:10px; padding:3px 6px; text-align:center; }

    /* Form fotos */
    .rec-file { padding:8px; }
    .rec-foto-hint { font-size:11px; color:var(--text-dim); margin-top:5px; display:flex; align-items:center; gap:6px; }
    .rec-foto-actual { display:inline-flex; align-items:center; gap:5px; color:var(--text-muted); }
    .rec-foto-actual img { width:22px; height:22px; object-fit:cover; border-radius:4px; }
    .rec-foto-none { color:var(--text-dim); }

    /* Switch Sí/No */
    .sino-row { display:flex; align-items:center; justify-content:space-between; padding:11px 14px; border:1.5px solid var(--border); border-radius:12px; font-size:14px; color:var(--text); }
    .sino-switch { position:relative; width:44px; height:24px; flex-shrink:0; }
    .sino-switch input { opacity:0; width:0; height:0; position:absolute; }
    .sino-slider { position:absolute; inset:0; background:#d7d7e0; border-radius:24px; transition:.2s; cursor:pointer; }
    .sino-slider::before { content:""; position:absolute; width:18px; height:18px; left:3px; top:3px; background:#fff; border-radius:50%; transition:.2s; box-shadow:0 1px 2px rgba(0,0,0,.2); }
    .sino-switch input:checked + .sino-slider { background-image:var(--grad-c); }
    .sino-switch input:checked + .sino-slider::before { transform:translateX(20px); }

    /* Tarjetas móviles */
    .rec-mob { display:none; flex-direction:column; gap:12px; }
    .rec-card { background:var(--surface); border-radius:20px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.04); }
    .rec-card-nombre { font-size:16px; display:inline-block; }
    .rec-card-grid { display:flex; gap:10px; margin-top:12px; padding-top:12px; border-top:1px solid var(--border); }
    .rec-cell { flex:1; display:flex; flex-direction:column; gap:5px; }
    .rec-cell b { font-size:14px; font-weight:700; color:var(--text); }
    .rec-mini { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.5px; }
    .rec-foot { display:flex; justify-content:flex-end; margin-top:14px; }

    /* Nivel 1: asociaciones agrupadas por provincia */
    .asoc-provs { display:flex; flex-direction:column; gap:18px; }
    .asoc-grupo-titulo {
      font-size:11px; font-weight:700; color:var(--text-dim);
      text-transform:uppercase; letter-spacing:.6px; margin-bottom:7px; padding-left:2px;
    }
    .asoc-grupo-lista { background:var(--surface); border:1px solid var(--border); border-radius:14px; overflow:hidden; }
    .asoc-row {
      display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%;
      background:none; border:none; border-bottom:1px solid var(--border);
      padding:13px 16px; cursor:pointer; font-family:inherit; text-align:left;
      transition:background .13s;
    }
    .asoc-row:last-child { border-bottom:none; }
    .asoc-row:hover { background:rgba(80,108,255,.05); }
    .asoc-row-nombre { font-size:14px; color:var(--text); line-height:1.35; }
    .asoc-row-vacia .asoc-row-nombre { color:var(--text-muted); }
    .asoc-row-right { display:flex; align-items:center; gap:11px; flex-shrink:0; }
    .asoc-pill {
      background:rgba(80,108,255,.12); color:#506CFF; font-size:12px; font-weight:700;
      min-width:26px; height:22px; padding:0 8px; border-radius:20px;
      display:inline-flex; align-items:center; justify-content:center;
    }
    .asoc-pill-0 { background:rgba(0,0,0,.05); color:var(--text-dim); font-weight:600; }
    .asoc-row-chev { color:var(--text-dim); display:inline-flex; transition:transform .13s; }
    .asoc-row-chev svg { width:18px; height:18px; }
    .asoc-row:hover .asoc-row-chev { transform:translateX(3px); color:#506CFF; }

    /* Nivel 2: breadcrumb + volver */
    .rec-breadcrumb { font-size:12.5px; color:var(--text-muted); margin-bottom:6px; }
    .rec-breadcrumb a { color:#506CFF; cursor:pointer; font-weight:600; }
    .rec-breadcrumb a:hover { text-decoration:underline; }
    .rec-title-row { display:flex; align-items:center; gap:10px; }
    .rec-back {
      width:34px; height:34px; border-radius:10px; flex-shrink:0; border:1px solid var(--border);
      background:var(--surface); color:var(--text-muted); cursor:pointer;
      display:flex; align-items:center; justify-content:center; transition:background .15s, color .15s;
    }
    .rec-back:hover { background:rgba(80,108,255,.08); color:#506CFF; }
    .rec-back svg { width:18px; height:18px; }

    @media (max-width:768px) {
      .rec-desk { display:none; }
      .rec-mob { display:flex; }
      .rf-grid { grid-template-columns:1fr; }
      .rf-fotos { grid-template-columns:1fr; }
    }
  `;
  document.head.appendChild(s);
})();
