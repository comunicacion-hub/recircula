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
        ${puedeEditar() ? `
        <button class="hdr-circle hdr-circle-primary" onclick="abrirFormComprador()" title="Nuevo comprador">
          ${icoHTML('plus')}
        </button>
        ` : ''}
      </div>
    </div>

    <div id="compradores-table-wrap"></div>
  `;
  renderTablaCompradores();
}

// ============================================================
// TABLA
// ============================================================

// Columnas fijas por nivel (los "Transformador" y otros no estándar caen en Nivel 3)
const CMP_NIVELES = [
  { label: 'Nivel 1', color: '#506CFF' },
  { label: 'Nivel 2', color: '#18AE97' },
  { label: 'Nivel 3', color: '#7B5CFF' },
];
function _colDeNivel(nivel) {
  const n = String(nivel || '').trim();
  if (n === 'Nivel 2') return 1;
  if (n === 'Nivel 3' || /transformador/i.test(n)) return 2;
  return 0; // Nivel 1, vacío u otros
}
function _rgbaCmp(hex, a) {
  let h = String(hex || '').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

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

  // Repartir en las 3 columnas
  const cols = [[], [], []];
  datos.forEach(c => { cols[_colDeNivel(c['Nivel Intermediacion'] || c['Nivel'])].push(c); });
  cols.forEach(arr => arr.sort((a, b) => (a['Nombre'] || '').localeCompare(b['Nombre'] || '', 'es')));

  const edit = puedeEditar();

  const tarjeta = (c, color) => {
    const id     = jsEsc(c['ID_Comprador'] || '');
    const activo = c['Activo'] === true;
    return `<div class="cmp-card" onclick="verComprador('${id}')">
      <span class="cmp-ico" style="background:${_rgbaCmp(color, 0.13)};color:${color}">${icoHTML('store')}</span>
      <div class="cmp-info">
        <div class="cmp-nom">${esc(c['Nombre'] || '—')}</div>
        <div class="cmp-loc">${icoHTML('mapPin')} ${esc(c['Provincia'] || 'Sin provincia')}</div>
      </div>
      <div class="cmp-right" onclick="event.stopPropagation()">
        <span class="cmp-estado ${activo ? 'on' : 'off'}">${activo ? 'Activo' : 'Inactivo'}</span>
        <div class="cmp-acts td-actions">
          <button class="icon-btn" onclick="verComprador('${id}')" title="Ver">${icoHTML('view')}</button>
          ${edit ? `
            <button class="icon-btn primary" onclick="abrirFormComprador('${id}')" title="Editar">${icoHTML('edit')}</button>
            <button class="icon-btn del" onclick="confirmarEliminarComprador('${id}')" title="Eliminar">${icoHTML('trash')}</button>
          ` : ''}
        </div>
      </div>
    </div>`;
  };

  const columnas = CMP_NIVELES.map((niv, i) => {
    const lista = cols[i];
    const cuerpo = lista.length
      ? lista.map(c => tarjeta(c, niv.color)).join('')
      : `<div class="cmp-empty">
           <span class="cmp-empty-ico">${icoHTML('cart')}</span>
           <div class="cmp-empty-tit">Aún no hay compradores<br>en este nivel</div>
           <div class="cmp-empty-sub">Agrega un nuevo comprador<br>o cambia su nivel.</div>
         </div>`;
    return `<div class="cmp-col">
      <div class="cmp-col-head">
        <span class="cmp-col-badge" style="background:${niv.color}">${niv.label}</span>
        <span class="cmp-col-count">${lista.length} comprador${lista.length !== 1 ? 'es' : ''}</span>
      </div>
      <div class="cmp-col-body">${cuerpo}</div>
    </div>`;
  }).join('');

  wrap.innerHTML = `<div class="cmp-board">${columnas}</div>`;
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
        ${puedeEditar() ? `<button class="btn btn-primary" onclick="cerrarModal();abrirFormComprador('${jsEsc(id)}')">Editar</button>` : ''}
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
        ${puedeEditar() ? `<button class="btn btn-primary" id="btn-guardar-com" onclick="guardarComprador('${jsEsc(id||'')}')">${c?'Actualizar':'Guardar'}</button>` : ''}
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

// ============================================================
// ESTILOS (tablero Kanban por niveles)
// ============================================================
(function () {
  if (document.getElementById('compradores-styles')) return;
  const s = document.createElement('style');
  s.id = 'compradores-styles';
  s.textContent = `
    .cmp-board { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; align-items:start; }
    .cmp-col { background:rgba(0,0,0,.018); border:1px solid var(--border); border-radius:20px; padding:16px 14px; }
    .cmp-col-head { display:flex; align-items:center; gap:10px; padding:2px 4px 14px; }
    .cmp-col-badge { font-size:12px; font-weight:700; color:#fff; padding:5px 14px; border-radius:20px; }
    .cmp-col-count { font-size:12.5px; color:var(--text-muted); font-weight:500; }
    .cmp-col-body { display:flex; flex-direction:column; gap:11px; }

    .cmp-card { display:flex; align-items:flex-start; gap:12px; background:var(--surface); border:1px solid var(--border); border-radius:15px; padding:14px; cursor:pointer; transition:box-shadow .15s,transform .12s,border-color .15s; }
    .cmp-card:hover { box-shadow:0 6px 18px rgba(0,0,0,.08); transform:translateY(-2px); border-color:transparent; }
    .cmp-ico { width:42px; height:42px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .cmp-ico svg { width:21px; height:21px; }
    .cmp-info { flex:1; min-width:0; }
    .cmp-nom { font-size:14px; font-weight:700; color:var(--text); line-height:1.3; }
    .cmp-loc { display:flex; align-items:center; gap:5px; font-size:12.5px; color:var(--text-muted); margin-top:5px; }
    .cmp-loc svg { width:14px; height:14px; color:var(--text-dim); flex-shrink:0; }
    .cmp-right { display:flex; flex-direction:column; align-items:flex-end; gap:10px; flex-shrink:0; }
    .cmp-estado { font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; white-space:nowrap; }
    .cmp-estado.on { color:#0f9b84; background:rgba(24,174,151,.14); }
    .cmp-estado.off { color:var(--text-dim); background:rgba(0,0,0,.05); }
    .cmp-acts { display:flex; gap:5px; }

    .cmp-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:34px 10px; }
    .cmp-empty-ico { width:56px; height:56px; border-radius:16px; display:flex; align-items:center; justify-content:center; background:rgba(123,92,255,.09); color:#7B5CFF; margin-bottom:14px; }
    .cmp-empty-ico svg { width:26px; height:26px; opacity:.85; }
    .cmp-empty-tit { font-size:14px; font-weight:700; color:var(--text-muted); line-height:1.4; }
    .cmp-empty-sub { font-size:12px; color:var(--text-dim); margin-top:6px; line-height:1.5; }

    @media (max-width:900px) {
      .cmp-board { grid-template-columns:1fr; gap:16px; }
      .cmp-empty { padding:24px 10px; }
    }
  `;
  document.head.appendChild(s);
})();
