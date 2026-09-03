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
        <button class="hdr-circle" onclick="openFilterDrawer('compradores', this)" title="Filtros">
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

// Cuatro niveles de intermediación; el Transformador (procesador final) es su
// propio grupo. Cada uno con su color y un descriptor corto.
const CMP_NIVELES = [
  { key: 'Nivel 1',       desc: 'Intermediario base',   color: '#506CFF' },
  { key: 'Nivel 2',       desc: 'Acopiador',            color: '#F5AD21' },
  { key: 'Nivel 3',       desc: 'Mayorista',            color: '#18AE97' },
  { key: 'Transformador', desc: 'Procesa el material',  color: '#7B5CFF' },
];
// Índice de grupo (0-3). Transformador va aparte; desconocidos → Nivel 1.
function _grupoNivel(nivel) {
  const n = String(nivel || '').trim();
  if (n === 'Nivel 2') return 1;
  if (n === 'Nivel 3') return 2;
  if (/transformador/i.test(n)) return 3;
  return 0;
}
// Iniciales para el avatar (1-2 letras, saltando conectores como "de"/"el").
function _inicialesCmp(nombre) {
  const skip = new Set(['el','la','los','las','de','del','y','s.a.','sa','cia']);
  const w = String(nombre || '').split(/\s+/).filter(x => x && !skip.has(x.toLowerCase().replace(/[.,]/g, '')));
  const a = (w[0] || '')[0] || '', b = (w[1] || '')[0] || '';
  return ((a + b) || String(nombre || '?')[0] || '?').toUpperCase();
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

  // Reparto en los 4 niveles
  const cols = [[], [], [], []];
  datos.forEach(c => { cols[_grupoNivel(c['Nivel Intermediacion'] || c['Nivel'])].push(c); });
  cols.forEach(arr => arr.sort((a, b) => (a['Nombre'] || '').localeCompare(b['Nombre'] || '', 'es')));

  const edit = puedeEditar();

  // Fila de comprador dentro de la tarjeta del nivel: avatar + nombre + provincia · destino.
  const fila = (c, color) => {
    const id     = jsEsc(c['ID_Comprador'] || '');
    const activo = c['Activo'] === true;
    const prov   = c['Provincia'] || 'Sin provincia';
    const dest   = c['Destino Final'] || '';
    const meta   = esc(prov) + (dest ? ' · ' + esc(dest) : '');
    return `<div class="cmp-row${activo ? '' : ' off'}" onclick="verComprador('${id}')">
      <span class="cmp-r-ava" style="background:${_rgbaCmp(color, .12)};color:${color}">${esc(_inicialesCmp(c['Nombre']))}</span>
      <span class="cmp-r-body">
        <span class="cmp-r-top"><b class="cmp-r-name">${esc(c['Nombre'] || '—')}</b>${activo ? '' : '<span class="cmp-r-off">Inactivo</span>'}</span>
        <span class="cmp-r-meta">${meta}</span>
      </span>
      <span class="cmp-r-acts">
        <button class="cmp-abtn" onclick="event.stopPropagation();verComprador('${id}')" title="Ver">${icoHTML('view')}</button>
        ${edit ? `<button class="cmp-abtn" onclick="event.stopPropagation();abrirFormComprador('${id}')" title="Editar">${icoHTML('edit')}</button>
        <button class="cmp-abtn del" onclick="event.stopPropagation();confirmarEliminarComprador('${id}')" title="Eliminar">${icoHTML('trash')}</button>` : ''}
      </span>
    </div>`;
  };

  // Una tarjeta (a ancho completo) por nivel, con sus compradores como filas.
  const secs = CMP_NIVELES.map((n, i) => {
    const lista = cols[i];
    const cnt   = lista.length;
    const cuerpo = cnt
      ? lista.map(c => fila(c, n.color)).join('')
      : `<div class="cmp-lvl-empty">Aún no hay compradores en este nivel.</div>`;
    return `<div class="card cmp-lvlcard">
      <div class="cmp-lvlcard-head">
        <div class="cmp-lvlcard-badge">
          <span class="cmp-lvlcard-acc" style="background:${n.color}"></span>
          <div><div class="cmp-lvlcard-name">${esc(n.key)}</div><div class="cmp-lvlcard-desc">${esc(n.desc)}</div></div>
        </div>
        <div class="cmp-lvlcard-cnt">${cnt} comprador${cnt !== 1 ? 'es' : ''}</div>
      </div>
      <div class="cmp-rows">${cuerpo}</div>
    </div>`;
  }).join('');

  wrap.innerHTML = `<div class="cmp-wrap">${secs}</div>`;
}

// ============================================================
// VER COMPRADOR
// ============================================================

function verComprador(id) {
  const c = CAT.compradores.find(x => x['ID_Comprador'] === id);
  if (!c) { showToast('Comprador no encontrado'); return; }
  const activo = c['Activo'] === true;
  const niv    = CMP_NIVELES[_grupoNivel(c['Nivel Intermediacion'] || c['Nivel'])];
  const color  = niv.color;

  abrirModal(`
    <div class="modal" style="max-width:520px">
      <div class="modal-head">
        <div style="display:flex;align-items:center;gap:14px;min-width:0">
          <span class="cmp-r-ava" style="width:48px;height:48px;border-radius:13px;font-size:17px;background:${_rgbaCmp(color, .12)};color:${color}">${esc(_inicialesCmp(c['Nombre']))}</span>
          <div style="min-width:0">
            <div class="modal-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c['Nombre']||'')}</div>
            <div class="modal-sub"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle"></span>${esc(niv.key)} · ${esc(niv.desc)}</div>
          </div>
        </div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">
        <div class="form-grid-2">
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
    .cmp-wrap { display:flex; flex-direction:column; gap:18px; }

    /* ── Una tarjeta a ancho completo por nivel (estilo Pesos) ── */
    .cmp-lvlcard { padding:20px 22px; }
    .cmp-lvlcard-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .cmp-lvlcard-badge { display:flex; align-items:center; gap:10px; min-width:0; }
    .cmp-lvlcard-acc { width:4px; height:22px; border-radius:3px; flex-shrink:0; }
    .cmp-lvlcard-name { font-size:14.5px; font-weight:700; letter-spacing:.2px; color:var(--text); }
    .cmp-lvlcard-desc { font-size:11.5px; color:var(--text-muted); font-weight:600; margin-top:1px; }
    .cmp-lvlcard-cnt { font-size:11.5px; color:var(--text-muted); font-weight:600; white-space:nowrap; flex-shrink:0; }

    .cmp-rows { margin-top:10px; }
    .cmp-row { display:flex; align-items:center; gap:13px; padding:11px 4px; cursor:pointer; border-radius:10px; transition:background .13s; }
    .cmp-row + .cmp-row { border-top:1px solid #eef1f6; }
    .cmp-row:hover { background:#f7f9fc; }
    .cmp-row.off { opacity:.55; }
    .cmp-r-ava { width:38px; height:38px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; letter-spacing:.3px; }
    .cmp-r-body { flex:1; min-width:0; display:flex; flex-direction:column; }
    .cmp-r-top { display:flex; align-items:center; gap:8px; min-width:0; }
    .cmp-r-name { font-size:13.5px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cmp-r-off { flex-shrink:0; font-size:9.5px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; color:var(--text-dim); background:#eef1f6; padding:2px 7px; border-radius:20px; }
    .cmp-r-meta { font-size:11.5px; color:var(--text-muted); font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px; }
    .cmp-r-acts { flex-shrink:0; display:flex; gap:4px; opacity:0; transition:opacity .14s; }
    .cmp-row:hover .cmp-r-acts { opacity:1; }
    .cmp-abtn { width:32px; height:32px; border-radius:9px; border:none; background:#eef1f6; color:var(--text-muted); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:.14s; }
    .cmp-abtn svg { width:15px; height:15px; } .cmp-abtn:hover { background:#e2e7f0; color:var(--text); }
    .cmp-abtn.del { color:#EF4444; background:rgba(239,68,68,.09); } .cmp-abtn.del:hover { background:rgba(239,68,68,.16); }

    .cmp-lvl-empty { padding:14px 4px; color:var(--text-dim); font-size:12.5px; }

    @media (max-width:900px) {
      .cmp-r-acts { opacity:1; }
    }
  `;
  document.head.appendChild(s);
})();
