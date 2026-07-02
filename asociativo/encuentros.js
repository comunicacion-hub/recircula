// ============================================================
// DASHBOARD ASOCIATIVO — encuentros.js
// Encuentros: CRUD (con eliminar) + carpeta Drive
// (Encuentros > Asociación > Nombre del Encuentro).
// Al eliminar el registro se manda a papelera SOLO la carpeta del encuentro,
// no la de la asociación. Colección: Encuentros
// ============================================================

let ENC_FILTROS = { prov: [], asoc: [], tipo: [] };
let ENCUENTROS_DATA = [];

const TIPOS_ENCUENTRO = ['Reunión', 'Taller', 'Capacitación', 'Foro', 'Seminario', 'Otros'];

function registerEncuentrosFilters() {
  registerFilterConfig('encuentros', {
    badgeId: 'enc-filter-badge',
    sections: [
      { key: 'prov', title: 'Provincia',   type: 'options', options: _provinciasEnc() },
      { key: 'asoc', title: 'Asociación',  type: 'options', options: CAT.asocAmbiente.map(function (a) { return { val: a.id_asociacion, lbl: a.nombre }; }) },
      { key: 'tipo', title: 'Tipo de encuentro', type: 'options', options: TIPOS_ENCUENTRO },
    ],
    getValue: function (k) { return ENC_FILTROS[k] || []; },
    setValue: function (k, v) { ENC_FILTROS[k] = v; },
    apply: function () { cargarEncuentros(); },
  });
}

function _provinciasEnc() {
  return Array.from(new Set(CAT.encuentros.map(function (e) { return e.provincia; }).filter(Boolean))).sort();
}

function renderEncuentros() {
  registerEncuentrosFilters();
  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Encuentros</div><div class="page-sub">Talleres/Reuniones</div></div>' +
      '<div class="hdr-actions">' +
        '<button class="hdr-circle" onclick="openFilterDrawer(\'encuentros\')" title="Filtros">' +
          icoHTML('filter') + '<span class="filter-badge" id="enc-filter-badge" style="display:none">0</span></button>' +
        '<button class="hdr-circle" onclick="exportarEncuentrosExcel()" title="Descargar Excel">' + icoHTML('download') + '</button>' +
        (puedeEditar() ? '<button class="hdr-circle hdr-circle-primary" onclick="abrirFormEncuentro()" title="Nuevo encuentro">' + icoHTML('plus') + '</button>' : '') +
      '</div>' +
    '</div>' +
    '<div id="enc-table-wrap"></div>';
  cargarEncuentros();
  updateFilterBadge('encuentros');
}

function cargarEncuentros() {
  ENCUENTROS_DATA = CAT.encuentros.filter(function (e) {
    return pasaFiltro(ENC_FILTROS.prov, e.provincia) &&
           pasaFiltro(ENC_FILTROS.asoc, e.id_asociacion) &&
           pasaFiltro(ENC_FILTROS.tipo, e.tipo_encuentro);
  }).slice().sort(function (a, b) {
    const p = (a.provincia || '').localeCompare(b.provincia || '');
    if (p !== 0) return p;
    return String(b.fecha_encuentro || '').localeCompare(String(a.fecha_encuentro || ''));
  });
  renderTablaEncuentros();
}

function renderTablaEncuentros() {
  const wrap = document.getElementById('enc-table-wrap');
  if (!wrap) return;
  if (!ENCUENTROS_DATA.length) {
    wrap.innerHTML = '<div class="empty-state">' +
      icoHTML('view').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"') +
      '<p>No hay encuentros con estos filtros</p></div>';
    return;
  }
  const acciones = function (e) {
    const docId = jsEsc(e._docId || '');
    const carpeta = jsEsc(e.id_carpeta_drive || '');
    return (carpeta ? '<button class="icon-btn" onclick="window.open(\'https://drive.google.com/drive/folders/' + carpeta + '\',\'_blank\')" title="Carpeta">' + icoHTML('folder') + '</button>' : '') +
      '<button class="icon-btn" onclick="verEncuentro(\'' + docId + '\')" title="Ver">' + icoHTML('view') + '</button>' +
      (puedeEditar() ? '<button class="icon-btn primary" onclick="editarEncuentro(\'' + docId + '\')" title="Editar">' + icoHTML('edit') + '</button>' +
        '<button class="icon-btn del" onclick="confirmarEliminarEncuentro(\'' + docId + '\',\'' + carpeta + '\')" title="Eliminar">' + icoHTML('trash') + '</button>' : '');
  };

  // ── Tabla (desktop) ──
  const filas = ENCUENTROS_DATA.map(function (e) {
    return '<tr>' +
      '<td style="font-weight:600">' + esc(e.nombre_asociacion || '—') + '</td>' +
      '<td>' + esc(e.nombre_encuentro || '—') + '</td>' +
      '<td>' + esc(e.provincia || '—') + '</td>' +
      '<td>' + fmtFecha(e.fecha_encuentro) + '</td>' +
      '<td>' + _tipoEncBadge(e.tipo_encuentro) + '</td>' +
      '<td style="text-align:right">' + fmtNum(e.num_asistentes) + '</td>' +
      '<td data-actions-row><div class="td-actions">' + acciones(e) + '</div></td>' +
    '</tr>';
  }).join('');
  const tabla = '<div class="table-wrap enc-desk"><table>' +
    '<thead><tr><th>Asociación</th><th>Encuentro</th><th>Provincia</th><th>Fecha</th><th>Tipo</th><th style="text-align:right">Asistentes</th><th></th></tr></thead>' +
    '<tbody>' + filas + '</tbody></table></div>';

  // ── Tarjetas (móvil) ──
  const cards = ENCUENTROS_DATA.map(function (e) {
    return '<div class="enc-card">' +
      '<div class="enc-top">' +
        '<div class="enc-id"><div class="enc-label">Asociación</div>' +
          '<div class="enc-nombre">' + esc(e.nombre_asociacion || '—') + '</div></div>' +
        _tipoEncBadge(e.tipo_encuentro) +
      '</div>' +
      '<div class="enc-evento">' + esc(e.nombre_encuentro || '—') + '</div>' +
      '<div class="enc-grid">' +
        '<div class="enc-cell"><span class="enc-mini">Fecha</span><b>' + fmtFecha(e.fecha_encuentro) + '</b></div>' +
        '<div class="enc-cell"><span class="enc-mini">Asistentes</span><b>' + fmtNum(e.num_asistentes) + '</b></div>' +
        '<div class="enc-cell"><span class="enc-mini">Provincia</span><b>' + esc(e.provincia || '—') + '</b></div>' +
      '</div>' +
      '<div class="enc-foot"><div class="td-actions">' + acciones(e) + '</div></div>' +
    '</div>';
  }).join('');
  const cardsWrap = '<div class="enc-mob">' + cards + '</div>';

  wrap.innerHTML = tabla + cardsWrap +
    '<div style="font-size:12px;color:var(--text-dim);text-align:right;margin-top:10px">' + ENCUENTROS_DATA.length + ' registro' + (ENCUENTROS_DATA.length !== 1 ? 's' : '') + '</div>';
}

function _tipoEncBadge(t) {
  const map = { 'Reunión': 'badge-blue', 'Taller': 'badge-green', 'Capacitación': 'badge-cyan', 'Foro': 'badge-warn', 'Seminario': 'badge-nivel-3', 'Otros': 'badge-off' };
  return '<span class="badge ' + (map[t] || 'badge-off') + '">' + esc(t || '—') + '</span>';
}

// ── Ver ficha ──
function verEncuentro(docId) {
  const e = CAT.encuentros.find(function (x) { return x._docId === docId; });
  if (!e) { showToast('Encuentro no encontrado'); return; }
  abrirModal(
    '<div class="modal">' +
      '<div class="modal-head"><div><div class="modal-title">' + esc(e.nombre_encuentro || 'Encuentro') + '</div>' +
        '<div class="modal-sub">' + esc(e.nombre_asociacion || '—') + ' · ' + fmtFecha(e.fecha_encuentro) + '</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-grid-2" style="margin-bottom:16px">' +
          '<div><div class="form-label">Provincia</div><div style="font-size:14px">' + esc(e.provincia || '—') + '</div></div>' +
          '<div><div class="form-label">Tipo</div><div style="margin-top:4px">' + _tipoEncBadge(e.tipo_encuentro) + '</div></div>' +
          '<div><div class="form-label">N° de asistentes</div><div style="font-size:18px;font-weight:700">' + fmtNum(e.num_asistentes) + '</div></div>' +
          '<div><div class="form-label">Carpeta de Drive</div><div style="font-size:14px">' +
            (e.id_carpeta_drive ? '<a href="' + urlCarpeta(e.id_carpeta_drive) + '" target="_blank" rel="noopener" style="color:#506CFF;font-weight:600">Abrir carpeta ↗</a>' : '—') + '</div></div>' +
        '</div>' +
        '<div><div class="form-label">Invitados</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">' + (e.invitados ? esc(e.invitados) : '—') + '</div></div>' +
        '<div style="margin-top:14px"><div class="form-label">Resultados</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">' + (e.resultados ? esc(e.resultados) : '—') + '</div></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn-glass" onclick="cerrarModal()">Cerrar</button></div>' +
    '</div>'
  );
}

// ── Eliminar (manda a papelera SOLO la carpeta del encuentro) ──
function confirmarEliminarEncuentro(docId, folderId) {
  abrirModal(
    '<div class="modal" style="max-width:440px">' +
      '<div class="modal-head"><div class="modal-title">Eliminar encuentro</div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body"><p style="color:var(--text-muted);font-size:14px;line-height:1.6">' +
        '¿Seguro que quieres eliminar este encuentro? Se quitará el registro y su carpeta del encuentro se enviará a la papelera de Drive. La carpeta de la asociación se conserva.' +
      '</p></div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-danger" onclick="eliminarEncuentro(\'' + jsEsc(docId) + '\',\'' + jsEsc(folderId) + '\')">Eliminar</button>' +
      '</div>' +
    '</div>'
  );
}

async function eliminarEncuentro(docId, folderId) {
  if (!docId) { showToast('No se encontró el encuentro'); return; }
  // Papelera de la subcarpeta del encuentro (no la de la asociación)
  if (folderId) {
    const tok = driveToken();
    if (tok) {
      try { await driveEliminarCarpeta(folderId, tok); }
      catch (e) { console.warn('Drive papelera encuentro:', e); }
    }
  }
  const r = await fsWrite(function () { return window.fb.deleteDoc(fsDoc('Encuentros', docId)); });
  if (!r.ok) { showToast('Error al eliminar: ' + (r.error || '')); return; }
  CAT.encuentros = CAT.encuentros.filter(function (x) { return x._docId !== docId; });
  showToast(r.offline ? 'Eliminado (se sincronizará) ✓' : 'Encuentro eliminado ✓');
  cerrarModal();
  cargarEncuentros();
}

// ── Formulario ──
function editarEncuentro(docId) { abrirFormEncuentro(docId); }

function abrirFormEncuentro(docId) {
  docId = docId || null;
  const e = docId ? CAT.encuentros.find(function (x) { return x._docId === docId; }) : null;
  const editing = !!e;

  const asocField = editing
    ? '<input type="text" class="form-input" value="' + esc(e.nombre_asociacion) + '" readonly>' +
      '<input type="hidden" id="enc-asoc" value="' + esc(e.id_asociacion) + '">'
    : '<select class="form-select" id="enc-asoc" onchange="onAsocChangeEnc(this.value)">' +
        '<option value="">Seleccioná una asociación…</option>' + _asocOptions('') + '</select>';

  const tipoOpts = TIPOS_ENCUENTRO.map(function (t) {
    return '<option value="' + t + '"' + (e && e.tipo_encuentro === t ? ' selected' : '') + '>' + t + '</option>';
  }).join('');

  const hoy = new Date().toISOString().substring(0, 10);

  abrirModal(
    '<div class="modal">' +
      '<div class="modal-head"><div><div class="modal-title">' + (editing ? 'Editar' : 'Nuevo') + ' encuentro</div>' +
        '<div class="modal-sub">Taller / Reunión</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-grid-2">' +
          '<div class="form-group"><label class="form-label">Asociación</label>' + asocField + '</div>' +
          '<div class="form-group"><label class="form-label">Provincia</label><input type="text" class="form-input" id="enc-provincia" readonly value="' + esc(e ? e.provincia : '') + '"></div>' +
          '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Nombre del encuentro</label><input type="text" class="form-input" id="enc-nombre" placeholder="Ej. Taller de fortalecimiento" value="' + esc(e ? e.nombre_encuentro : '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Fecha</label><input type="date" class="form-input" id="enc-fecha" value="' + (e && e.fecha_encuentro ? String(e.fecha_encuentro).substring(0, 10) : hoy) + '"></div>' +
          '<div class="form-group"><label class="form-label">Tipo de encuentro</label><select class="form-select" id="enc-tipo">' + tipoOpts + '</select></div>' +
          '<div class="form-group"><label class="form-label">N° de asistentes</label><input type="number" class="form-input" id="enc-asist" min="0" step="1" value="' + (e ? e.num_asistentes : '') + '"></div>' +
        '</div>' +
        '<div class="form-group" style="margin-top:14px"><label class="form-label">Invitados</label><textarea class="form-textarea" id="enc-invitados" placeholder="Nombres o entidades invitadas…">' + esc(e ? e.invitados : '') + '</textarea></div>' +
        '<div class="form-group" style="margin-top:14px"><label class="form-label">Resultados</label><textarea class="form-textarea" id="enc-resultados" placeholder="Resultados del encuentro…">' + esc(e ? e.resultados : '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        (puedeEditar() ? '<button class="btn btn-primary" id="enc-save-btn" onclick="guardarEncuentro(' + (docId ? '\'' + jsEsc(docId) + '\'' : 'null') + ')">Guardar</button>' : '') +
      '</div>' +
    '</div>'
  );
}

function onAsocChangeEnc(idAsoc) {
  const amb = CAT.asocAmbiente.find(function (a) { return a.id_asociacion === idAsoc; });
  const prov = document.getElementById('enc-provincia');
  if (prov) prov.value = amb ? (amb.provincia || '') : '';
}

// ── Guardar ──
async function guardarEncuentro(docId) {
  const idAsoc = (document.getElementById('enc-asoc') || {}).value || '';
  if (!idAsoc) { showToast('Elegí una asociación'); return; }
  const nombre = ((document.getElementById('enc-nombre') || {}).value || '').trim();
  if (!nombre) { showToast('Indicá el nombre del encuentro'); return; }
  const fecha = (document.getElementById('enc-fecha') || {}).value || '';
  if (!fecha) { showToast('Indicá la fecha'); return; }
  const tipo = (document.getElementById('enc-tipo') || {}).value || '';
  if (!tipo) { showToast('Elegí el tipo de encuentro'); return; }

  const amb = CAT.asocAmbiente.find(function (a) { return a.id_asociacion === idAsoc; });
  const actual = docId ? CAT.encuentros.find(function (x) { return x._docId === docId; }) : null;
  const nombreAsoc = amb ? amb.nombre : (actual ? actual.nombre_asociacion : '');

  const o = {
    id_encuentro:    actual ? actual.id_encuentro : nuevoId('ENC'),
    id_asociacion:   idAsoc,
    nombre_asociacion:nombreAsoc,
    nombre_encuentro:nombre,
    provincia:       amb ? amb.provincia : (actual ? actual.provincia : ((document.getElementById('enc-provincia') || {}).value || '')),
    fecha_encuentro: fecha,
    tipo_encuentro:  tipo,
    num_asistentes:  (document.getElementById('enc-asist') || {}).value || 0,
    invitados:       (document.getElementById('enc-invitados') || {}).value || '',
    resultados:      (document.getElementById('enc-resultados') || {}).value || '',
    id_carpeta_drive:(actual && actual.id_carpeta_drive) ? actual.id_carpeta_drive : '',
  };

  const btn = document.getElementById('enc-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  // Carpeta de Drive: Encuentros > <Asociación> > <Nombre del Encuentro>
  // La de la asociación se busca/crea; la del encuentro se crea (solo si no existe ya).
  if (!o.id_carpeta_drive) {
    const tok = driveToken();
    if (tok) {
      try {
        const carpetaAsoc = await driveBuscarOCrear(nombreAsoc || idAsoc, DRIVE_PARENTS.encuentros, tok);
        o.id_carpeta_drive = await driveCrearCarpeta(nombre, carpetaAsoc, tok);
      } catch (e) { console.warn('Drive encuentro:', e); showToast('No se pudo crear la carpeta (se guarda igual)'); }
    } else {
      showToast('Sesión de Drive expirada: se guarda sin carpeta');
    }
  }

  const fs = encuentroToFS(o);
  let r;
  if (docId) {
    r = await fsWrite(function () { return window.fb.updateDoc(fsDoc('Encuentros', docId), fs); });
    if (r.ok) { const i = CAT.encuentros.findIndex(function (x) { return x._docId === docId; }); if (i >= 0) CAT.encuentros[i] = encuentroFromFS(Object.assign({ _docId: docId }, fs)); }
  } else {
    const ref = window.fb.doc(fsCol('Encuentros'));
    r = await fsWrite(function () { return window.fb.setDoc(ref, fs); });
    if (r.ok) CAT.encuentros.push(encuentroFromFS(Object.assign({ _docId: ref.id }, fs)));
  }

  if (!r.ok) { showToast('Error al guardar: ' + (r.error || '')); if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; } return; }
  showToast(r.offline ? 'Guardado (se sincronizará) ✓' : 'Guardado ✓');
  cerrarModal();
  cargarEncuentros();
}

// ── Exportar Excel ──
async function exportarEncuentrosExcel() {
  if (!ENCUENTROS_DATA.length) { showToast('No hay datos para exportar.'); return; }
  try {
    await cargarSheetJS();
    if (!window.XLSX) { showToast('No se pudo cargar el exportador'); return; }
    const header = ['Asociación', 'Encuentro', 'Provincia', 'Fecha', 'Tipo', 'N° Asistentes', 'Invitados', 'Resultados', 'URL Carpeta'];
    const filas = ENCUENTROS_DATA.map(function (e) {
      return [e.nombre_asociacion, e.nombre_encuentro, e.provincia, (e.fecha_encuentro || '').substring(0, 10), e.tipo_encuentro,
        parseFloat(e.num_asistentes) || 0, e.invitados || '', e.resultados || '', urlCarpeta(e.id_carpeta_drive)];
    });
    const ws = XLSX.utils.aoa_to_sheet([header].concat(filas));
    ws['!cols'] = [{ wch: 24 }, { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 36 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Encuentros');
    XLSX.writeFile(wb, 'Encuentros_' + new Date().toISOString().substring(0, 10) + '.xlsx');
    showToast('Excel descargado ✓');
  } catch (e) { console.error('export encuentros:', e); showToast('Error al exportar'); }
}

// ── Estilos propios (tarjetas móviles) ──
(function () {
  if (document.getElementById('enc-styles')) return;
  const s = document.createElement('style');
  s.id = 'enc-styles';
  s.textContent = `
    .enc-mob { display:none; flex-direction:column; gap:12px; }
    .enc-card { background:var(--surface); border-radius:20px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.04); }
    .enc-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
    .enc-id { min-width:0; }
    .enc-label { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.7px; }
    .enc-nombre { font-size:16px; font-weight:700; color:var(--text); margin-top:2px; line-height:1.3; }
    .enc-evento { font-size:14px; color:#1c7aa8; font-weight:600; margin-top:8px; }
    .enc-grid { display:flex; gap:10px; margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }
    .enc-cell { flex:1; display:flex; flex-direction:column; gap:5px; align-items:flex-start; min-width:0; }
    .enc-cell b { font-size:14px; font-weight:700; color:var(--text); }
    .enc-mini { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.5px; }
    .enc-foot { display:flex; justify-content:flex-end; margin-top:14px; }

    @media (max-width:768px) {
      .enc-desk { display:none; }
      .enc-mob { display:flex; }
    }
  `;
  document.head.appendChild(s);
})();
