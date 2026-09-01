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
        <div class="page-title">Comprador</div>
        <div class="page-sub">Registro</div>
      </div>
      <div class="hdr-actions">
        <button class="hdr-circle" onclick="openFilterDrawer('compradores')" title="Filtros">
          ${icoHTML('sliders')}
          <span class="filter-badge" id="badge-compradores" style="display:none;">0</span>
        </button>
        <button class="hdr-circle" onclick="exportarCompradoresExcel()" title="Descargar Excel">
          ${icoHTML('download')}
        </button>
      </div>
    </div>

    <div id="compradores-table-wrap"></div>
  `;
  if (puedeEditar()) {
    mostrarFAB('plus', abrirFormComprador, 'Nuevo comprador');
  }
  renderTablaCompradores();
}

// ============================================================
// TABLA
// ============================================================

// Un bloque por nivel (los "Transformador" y otros no estándar caen en Nivel 3).
// Colores de la maqueta: la misma tríada índigo / ámbar / teal del resto de la app.
const CMP_NIVELES = [
  { label: 'Nivel 1', color: '#506CFF' },
  { label: 'Nivel 2', color: '#F5AD21' },
  { label: 'Nivel 3', color: '#18AE97' },
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

  // Fila de comprador: punto del color del nivel + nombre + acciones.
  // La provincia y el estado no se muestran en la fila (la maqueta deja solo
  // el nombre); van en el title, y los inactivos se atenúan.
  const fila = (c, color) => {
    const id     = jsEsc(c['ID_Comprador'] || '');
    const activo = c['Activo'] === true;
    const tip    = `${c['Nombre'] || ''} · ${c['Provincia'] || 'Sin provincia'} · ${activo ? 'Activo' : 'Inactivo'}`;
    return `<div class="cmp-fila${activo ? '' : ' cmp-inactivo'}">
      <span class="cmp-dot" style="background:${color}"></span>
      <button class="cmp-nom" onclick="verComprador('${id}')" title="${esc(tip)}">${esc(c['Nombre'] || '—')}</button>
      <span class="cmp-acts td-actions">
        <button class="icon-btn" onclick="verComprador('${id}')" title="Ver">${icoHTML('view')}</button>
        ${edit ? `
          <button class="icon-btn primary" onclick="abrirFormComprador('${id}')" title="Editar">${icoHTML('edit')}</button>
          <button class="icon-btn del" onclick="confirmarEliminarComprador('${id}')" title="Eliminar">${icoHTML('close')}</button>
        ` : ''}
      </span>
    </div>`;
  };

  const bloques = CMP_NIVELES.map((niv, i) => {
    const lista = cols[i];
    const cuerpo = lista.length
      ? `<div class="cmp-lista">${lista.map(c => fila(c, niv.color)).join('')}</div>`
      : `<div class="cmp-empty">
           <span class="cmp-empty-ico" style="background:${_rgbaCmp(niv.color, 0.1)};color:${niv.color}">${icoHTML('cart')}</span>
           <div class="cmp-empty-tit">Aún no hay compradores en este nivel</div>
           <div class="cmp-empty-sub">Agrega un nuevo comprador o cambia su nivel.</div>
         </div>`;
    return `<div class="card cmp-nivel">
      <div class="cmp-nivel-tit">${esc(niv.label)}</div>
      ${cuerpo}
    </div>`;
  }).join('');

  wrap.innerHTML = `<div class="cmp-board">${bloques}</div>`;
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
          <div><div class="form-label">C.I / RUC</div><div style="font-size:14px;margin-top:4px">${esc(c['CI/RUC']||'—')}</div></div>
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
          <label class="form-label">C.I / RUC</label>
          <input type="text" class="form-input" id="com-ciruc" placeholder="Cédula o RUC (opcional)" value="${esc(c?.['CI/RUC']||'')}">
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
  const ciRuc     = document.getElementById('com-ciruc')?.value?.trim();
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
      'CI/RUC': ciRuc,
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

    const header = ['Nombre','Nivel intermediación','Provincia','Destino final','C.I / RUC','Activo'];
    const filas = datos.map(c => [
      c['Nombre'] || '',
      c['Nivel Intermediacion'] || c['Nivel'] || '',
      c['Provincia'] || '',
      c['Destino Final'] || '',
      c['CI/RUC'] || '',
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
    /* Un bloque apilado por nivel; los compradores van en 2 columnas dentro */
    .cmp-board { display:flex; flex-direction:column; gap:18px; }
    .cmp-nivel { padding:26px 30px; }
    .cmp-nivel-tit { font-size:17px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:var(--text); margin-bottom:22px; }

    /* columns (no grid) para que la lista se llene de arriba abajo */
    .cmp-lista { columns:2; column-gap:44px; }
    .cmp-fila { display:flex; align-items:center; gap:14px; break-inside:avoid; margin-bottom:16px; }
    .cmp-fila:last-child { margin-bottom:0; }
    .cmp-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .cmp-nom { flex:1; min-width:0; text-align:left; background:none; border:none; padding:0; cursor:pointer; font-family:inherit; font-size:14px; font-weight:400; color:var(--text); line-height:1.35; }
    .cmp-nom:hover { color:var(--blue2); }
    .cmp-acts { flex-shrink:0; display:flex; gap:8px; }
    /* Los tres botones vienen con su fondo tintado, como en la maqueta */
    .cmp-acts .icon-btn.primary { background:rgba(80,108,255,.1); }
    .cmp-acts .icon-btn.del { background:rgba(248,45,114,.1); color:#F82D72; }
    .cmp-inactivo { opacity:.55; }

    .cmp-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:20px 10px 8px; }
    .cmp-empty-ico { width:52px; height:52px; border-radius:15px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
    .cmp-empty-ico svg { width:25px; height:25px; opacity:.85; }
    .cmp-empty-tit { font-size:14px; font-weight:700; color:var(--text-muted); line-height:1.4; }
    .cmp-empty-sub { font-size:12px; color:var(--text-dim); margin-top:6px; line-height:1.5; }

    @media (max-width:820px) {
      .cmp-nivel { padding:20px 18px; }
      .cmp-nivel-tit { font-size:15px; margin-bottom:16px; }
      .cmp-lista { columns:1; }
      .cmp-empty { padding:14px 10px 4px; }
    }
  `;
  document.head.appendChild(s);
})();
