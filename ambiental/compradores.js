// ============================================================
// RECIRCULA 360 — compradores.js
// CRUD de compradores sobre Firestore
// ============================================================

let COMPRADORES_FILTROS = { provincia: [], nivel: [] };

// ============================================================
// REGISTRAR DRAWER
// ============================================================

function registerCompradoresFilters() {
  registerFilterConfig('compradores', {
    badgeId: 'badge-compradores',
    sections: [
      { key: 'provincia', title: 'Provincia', type: 'options', options: ['El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo'], allLabel: 'Todas las provincias' },
      { key: 'nivel',     title: 'Nivel',     type: 'options', options: ['Nivel 1','Nivel 2','Nivel 3','Transformador'], allLabel: 'Todos los niveles' },
    ],
    getValue: (k) => COMPRADORES_FILTROS[k] || '',
    setValue: (k, v) => { COMPRADORES_FILTROS[k] = v; },
    apply: () => renderTablaCompradores(),
  });
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

function renderCompradores() {
  registerCompradoresFilters();
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Compradores</div>
        <div class="page-sub">Registro</div>
      </div>
      <div class="hdr-actions">
        <button class="hdr-circle" onclick="openFilterDrawer('compradores')" title="Filtros">
          ${icoHTML('filter')}
          <span class="filter-badge" id="badge-compradores" style="display:none;">0</span>
        </button>
        <button class="hdr-circle" onclick="exportarCompradoresExcel()" title="Descargar Excel">
          ${icoHTML('download')}
        </button>
        <button class="hdr-circle hdr-circle-primary" onclick="abrirFormComprador()" title="Nuevo comprador">
          ${icoHTML('plus')}
        </button>
      </div>
    </div>

    <div id="compradores-table-wrap"></div>
  `;
  renderTablaCompradores();
}

// ============================================================
// TABLA
// ============================================================

function renderTablaCompradores() {
  const wrap = document.getElementById('compradores-table-wrap');
  if (!wrap) return;

  let datos = (CAT.compradores || []).slice();
  const fProv  = COMPRADORES_FILTROS.provincia || [];
  const fNivel = COMPRADORES_FILTROS.nivel     || [];
  const filtrarPorProv  = fProv.length  > 0 && !fProv.includes('__ALL__');
  const filtrarPorNivel = fNivel.length > 0 && !fNivel.includes('__ALL__');
  if (filtrarPorProv)  datos = datos.filter(c => fProv.includes(c['Provincia']));
  if (filtrarPorNivel) datos = datos.filter(c => fNivel.includes(c['Nivel Intermediacion'] || c['Nivel']));

  if (!datos.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        ${icoHTML('cart').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"')}
        <p>No hay compradores con estos filtros</p>
      </div>`;
    return;
  }

  const filas = datos.map(c => {
    const id     = jsEsc(c['ID_Comprador'] || '');
    const nivel  = c['Nivel Intermediacion'] || c['Nivel'] || '';
    const activo = c['Activo'] === true;
    return `<tr>
      <td><strong>Nombre</strong><br><span style="font-weight:600">${esc(c['Nombre']||'—')}</span></td>
      <td><strong>Nivel</strong><br>${nivelBadge(nivel)}</td>
      <td data-hide-mobile><strong>Provincia</strong><br>${esc(c['Provincia']||'—')}</td>
      <td data-hide-mobile><strong>Destino final</strong><br><span style="font-size:12px;color:var(--text-muted)">${esc(c['Destino Final']||'—')}</span></td>
      <td><strong>Activo</strong><br><span class="badge ${activo?'badge-on':'badge-off'}">${activo?'Sí':'No'}</span></td>
      <td data-actions-row>
        <div class="td-actions">
          <button class="icon-btn" onclick="verComprador('${id}')" title="Ver">${icoHTML('view')}</button>
          ${SESSION.rol !== 'Visualizador' ? `
            <button class="icon-btn primary" onclick="abrirFormComprador('${id}')" title="Editar">${icoHTML('edit')}</button>
            <button class="icon-btn del" onclick="confirmarEliminarComprador('${id}')" title="Eliminar">${icoHTML('trash')}</button>
          ` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Nivel</th>
            <th>Provincia</th>
            <th>Destino final</th>
            <th>Activo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div style="font-size:12px;color:var(--text-dim);text-align:right">
      ${datos.length} comprador${datos.length !== 1 ? 'es' : ''}
    </div>
  `;
}

// ============================================================
// VER COMPRADOR
// ============================================================

function verComprador(id) {
  const c = CAT.compradores.find(x => x['ID_Comprador'] === id);
  if (!c) { showToast('Comprador no encontrado'); return; }
  const activo = c['Activo'] === true;

  abrirModal(`
    <div class="modal" style="max-width:520px">
      <div class="modal-head">
        <div>
          <div class="modal-title">${esc(c['Nombre']||'')}</div>
          <div class="modal-sub">Detalle del comprador</div>
        </div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">
        <div class="form-grid-2">
          <div><div class="form-label">Nivel</div><div style="margin-top:4px">${nivelBadge(c['Nivel Intermediacion']||c['Nivel'])}</div></div>
          <div><div class="form-label">Estado</div><div style="margin-top:4px"><span class="badge ${activo?'badge-on':'badge-off'}">${activo?'Activo':'Inactivo'}</span></div></div>
          <div><div class="form-label">Provincia</div><div style="font-size:14px;margin-top:4px">${esc(c['Provincia']||'—')}</div></div>
          <div><div class="form-label">ID</div><div style="font-size:12px;margin-top:4px;font-family:monospace;color:var(--text-muted)">${esc(c['ID_Comprador']||'—')}</div></div>
        </div>
        <div style="margin-top:14px">
          <div class="form-label">Destino final</div>
          <div style="font-size:14px;margin-top:4px;line-height:1.6">${esc(c['Destino Final']||'Sin información')}</div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cerrar</button>
        ${SESSION.rol !== 'Visualizador' ? `<button class="btn btn-primary" onclick="cerrarModal();abrirFormComprador('${jsEsc(id)}')">Editar</button>` : ''}
      </div>
    </div>
  `);
}

// ============================================================
// FORMULARIO NUEVO / EDITAR
// ============================================================

function abrirFormComprador(id = null) {
  const c = id ? CAT.compradores.find(x => x['ID_Comprador'] === id) : null;
  const activo = !c || c['Activo'] === true;

  abrirModal(`
    <div class="modal" style="max-width:560px">
      <div class="modal-head">
        <div>
          <div class="modal-title">${c?'Editar comprador':'Nuevo comprador'}</div>
          <div class="modal-sub">${c?'Modifica los datos del comprador':'Registra un nuevo comprador'}</div>
        </div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="com-nombre" placeholder="Nombre del comprador" value="${esc(c?.['Nombre']||'')}">
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Nivel intermediación</label>
            <select class="form-select" id="com-nivel">
              ${['Nivel 1','Nivel 2','Nivel 3','Transformador'].map(n =>
                `<option value="${n}" ${(c?.['Nivel Intermediacion']||c?.['Nivel'])===n?'selected':''}>${n}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Provincia</label>
            <select class="form-select" id="com-provincia">
              <option value="">Sin asignar</option>
              ${['El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo'].map(p =>
                `<option value="${p}" ${c?.['Provincia']===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Destino final</label>
          <input type="text" class="form-input" id="com-destino" placeholder="Ej: Se vende a INTERCIA S.A." value="${esc(c?.['Destino Final']||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Activo</label>
          <select class="form-select" id="com-activo">
            <option value="true"  ${activo?'selected':''}>Sí</option>
            <option value="false" ${!activo?'selected':''}>No</option>
          </select>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-com" onclick="guardarComprador('${jsEsc(id||'')}')">${c?'Actualizar':'Guardar'}</button>
      </div>
    </div>
  `);
}

// ============================================================
// GUARDAR (Firestore)
// ============================================================

async function guardarComprador(id) {
  const nombre    = document.getElementById('com-nombre')?.value?.trim();
  const nivel     = document.getElementById('com-nivel')?.value;
  const provincia = document.getElementById('com-provincia')?.value;
  const destino   = document.getElementById('com-destino')?.value?.trim();
  const activo    = document.getElementById('com-activo')?.value === 'true';

  if (!nombre) { showToast('El nombre es obligatorio'); return; }

  const btn = document.getElementById('btn-guardar-com');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const actual = id ? (CAT.compradores.find(x => x['ID_Comprador'] === id) || {}) : {};
    const docId  = id ? (actual._docId || null) : null;
    const data = {
      ID_Comprador: id || '',
      Nombre: nombre,
      'Nivel Intermediacion': nivel,
      Provincia: provincia,
      'Destino Final': destino,
      Activo: activo,
    };
    const res = await guardarCompradorFS(docId, data);
    if (!res.ok) { showToast('Error: ' + (res.error || 'desconocido')); return; }
    showToast(res.offline ? 'Guardado (se sincronizará) ✓' : (id ? 'Comprador actualizado ✓' : 'Comprador creado ✓'));
    cerrarModal();
    renderTablaCompradores();
  } catch (e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = id ? 'Actualizar' : 'Guardar'; }
  }
}

// ============================================================
// ELIMINAR (Firestore)
// ============================================================

function confirmarEliminarComprador(id) {
  const c = CAT.compradores.find(x => x['ID_Comprador'] === id);
  if (!c) return;
  abrirModal(`
    <div class="modal" style="max-width:440px">
      <div class="modal-head">
        <div class="modal-title">Eliminar comprador</div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:14px;line-height:1.6">
          ¿Seguro que quieres eliminar <strong>${esc(c['Nombre'])}</strong>? Esta acción no se puede deshacer.
        </p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="eliminarComprador('${jsEsc(id)}')">Eliminar</button>
      </div>
    </div>
  `);
}

async function eliminarComprador(id) {
  try {
    const c = CAT.compradores.find(x => x['ID_Comprador'] === id);
    const docId = c ? c._docId : null;
    if (!docId) { showToast('No se encontró el comprador'); return; }
    const res = await eliminarCompradorFS(docId);
    if (!res.ok) { showToast('Error al eliminar'); return; }
    showToast(res.offline ? 'Eliminado (se sincronizará) ✓' : 'Comprador eliminado ✓');
    cerrarModal();
    renderTablaCompradores();
  } catch (e) {
    console.error(e);
    showToast('Error al eliminar');
  }
}

// ============================================================
// EXPORTAR A EXCEL (respeta los filtros aplicados)
// ============================================================

async function exportarCompradoresExcel() {
  // Mismo filtrado que la tabla
  let datos = (CAT.compradores || []).slice();
  const fProv  = COMPRADORES_FILTROS.provincia || [];
  const fNivel = COMPRADORES_FILTROS.nivel     || [];
  const filtrarPorProv  = fProv.length  > 0 && !fProv.includes('__ALL__');
  const filtrarPorNivel = fNivel.length > 0 && !fNivel.includes('__ALL__');
  if (filtrarPorProv)  datos = datos.filter(c => fProv.includes(c['Provincia']));
  if (filtrarPorNivel) datos = datos.filter(c => fNivel.includes(c['Nivel Intermediacion'] || c['Nivel']));

  if (!datos.length) {
    showToast('No hay compradores para exportar');
    return;
  }

  try {
    await cargarSheetJS();

    const header = ['Nombre','Nivel intermediación','Provincia','Destino final','Activo'];
    const filas = datos.map(c => [
      c['Nombre'] || '',
      c['Nivel Intermediacion'] || c['Nivel'] || '',
      c['Provincia'] || '',
      c['Destino Final'] || '',
      c['Activo'] === true ? 'Sí' : 'No',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...filas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Compradores');
    const fecha = new Date().toISOString().substring(0, 10);
    XLSX.writeFile(wb, `Compradores_${fecha}.xlsx`);
    showToast(`${datos.length} comprador${datos.length !== 1 ? 'es' : ''} exportado${datos.length !== 1 ? 's' : ''} ✓`);
  } catch (e) {
    console.error(e);
    showToast('Error al exportar el Excel');
  }
}
