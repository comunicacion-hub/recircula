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
function toggleNivelComprador(i) {
  const el = document.querySelector(`.cmp-lvl[data-nivel="${i}"]`);
  if (el) el.classList.toggle('open');
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

  const total   = datos.length;
  const activos = datos.filter(c => c['Activo'] === true).length;
  const edit    = puedeEditar();

  // Resumen (hero): número + barra de distribución por nivel + leyenda.
  const segs = CMP_NIVELES.map((n, i) => {
    const cnt = cols[i].length;
    const w = total ? (cnt / total * 100) : 0;
    return cnt ? `<span style="width:${w.toFixed(1)}%;background:${n.color}"></span>` : '';
  }).join('');
  const leg = CMP_NIVELES.map((n, i) =>
    `<div class="cmp-leg-it"><i style="background:${n.color}"></i>${esc(n.key)} <b>${cols[i].length}</b></div>`).join('');
  const hero = `<div class="cmp-hero">
    <div class="cmp-hero-l"><div class="cmp-hero-num">${total}</div>
      <div class="cmp-hero-lbl">compradores<br><b>${activos}</b> activos · ${total - activos} inactivos</div></div>
    <div class="cmp-hero-r"><div class="cmp-dist">${segs}</div><div class="cmp-leg">${leg}</div></div>
  </div>`;

  // Tarjeta de comprador: avatar de iniciales + nombre + provincia · destino final.
  const card = (c, color) => {
    const id     = jsEsc(c['ID_Comprador'] || '');
    const activo = c['Activo'] === true;
    const prov   = c['Provincia'] || 'Sin provincia';
    const dest   = c['Destino Final'] || '';
    const destHtml = dest ? `<span class="cmp-c-sep">·</span>${icoHTML('arrowRight')}<span class="cmp-c-dest">${esc(dest)}</span>` : '';
    return `<div class="cmp-card${activo ? '' : ' off'}" onclick="verComprador('${id}')">
      <span class="cmp-c-ava" style="background:${_rgbaCmp(color, .12)};color:${color}">${esc(_inicialesCmp(c['Nombre']))}</span>
      <div class="cmp-c-body">
        <div class="cmp-c-top"><span class="cmp-c-name">${esc(c['Nombre'] || '—')}</span>${activo ? '' : '<span class="cmp-c-off">Inactivo</span>'}</div>
        <div class="cmp-c-meta">${icoHTML('mapPin')}<span class="cmp-c-prov">${esc(prov)}</span>${destHtml}</div>
      </div>
      <div class="cmp-c-acts">
        <button class="cmp-abtn" onclick="event.stopPropagation();verComprador('${id}')" title="Ver">${icoHTML('view')}</button>
        ${edit ? `<button class="cmp-abtn" onclick="event.stopPropagation();abrirFormComprador('${id}')" title="Editar">${icoHTML('edit')}</button>
        <button class="cmp-abtn del" onclick="event.stopPropagation();confirmarEliminarComprador('${id}')" title="Eliminar">${icoHTML('trash')}</button>` : ''}
      </div>
    </div>`;
  };

  // Secciones por nivel — acordeón, todo colapsado al entrar.
  const secs = CMP_NIVELES.map((n, i) => {
    const lista = cols[i];
    const cnt   = lista.length;
    const cuerpo = cnt
      ? lista.map(c => card(c, n.color)).join('')
      : `<div class="cmp-lvl-empty"><span style="background:${_rgbaCmp(n.color, .1)};color:${n.color}">${icoHTML('cart')}</span>Aún no hay compradores en este nivel.</div>`;
    return `<div class="cmp-lvl" data-nivel="${i}">
      <button class="cmp-lvl-head" onclick="toggleNivelComprador(${i})">
        <span class="cmp-lvl-acc" style="background:${n.color}"></span>
        <span class="cmp-lvl-tt">${esc(n.key)}</span><span class="cmp-lvl-desc">${esc(n.desc)}</span>
        <span class="cmp-lvl-cnt">${cnt}</span>
        <span class="cmp-lvl-chev">${icoHTML('chevDown')}</span>
      </button>
      <div class="cmp-lvl-grid">${cuerpo}</div>
    </div>`;
  }).join('');

  wrap.innerHTML = `<div class="cmp-wrap">${hero}${secs}</div>`;
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
          <span class="cmp-c-ava" style="width:48px;height:48px;border-radius:13px;font-size:17px;background:${_rgbaCmp(color, .12)};color:${color}">${esc(_inicialesCmp(c['Nombre']))}</span>
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

    /* ── Resumen (hero) — deliberadamente suave para no competir con las tarjetas ── */
    .cmp-hero { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:20px 24px; display:flex; align-items:center; gap:30px; }
    .cmp-hero-l { display:flex; align-items:center; gap:12px; flex-shrink:0; }
    .cmp-hero-num { font-size:32px; font-weight:700; letter-spacing:-.5px; line-height:1; color:var(--text); }
    .cmp-hero-lbl { font-size:12.5px; color:var(--text-muted); font-weight:600; line-height:1.35; }
    .cmp-hero-lbl b { color:var(--text); font-weight:700; }
    .cmp-hero-r { flex:1; min-width:0; display:flex; flex-direction:column; gap:10px; }
    .cmp-dist { display:flex; height:7px; gap:2px; }
    .cmp-dist > span { height:100%; border-radius:3px; }
    .cmp-leg { display:flex; flex-wrap:wrap; gap:6px 20px; }
    .cmp-leg-it { display:flex; align-items:center; gap:7px; font-size:11.5px; color:var(--text-muted); font-weight:600; }
    .cmp-leg-it i { width:9px; height:9px; border-radius:3px; }
    .cmp-leg-it b { color:var(--text); font-weight:800; margin-left:1px; }

    /* ── Acordeón por nivel (colapsado al entrar) ── */
    .cmp-lvl { display:flex; flex-direction:column; gap:10px; }
    .cmp-lvl-head { display:flex; align-items:center; gap:11px; width:100%; padding:9px 12px; text-align:left; background:none; border:1px solid transparent; border-radius:12px; font-family:inherit; cursor:pointer; transition:background .14s, border-color .14s; }
    .cmp-lvl-head:hover { background:var(--surface); border-color:var(--border); }
    .cmp-lvl-acc { width:4px; height:20px; border-radius:3px; flex-shrink:0; }
    .cmp-lvl-tt { font-size:14px; font-weight:700; letter-spacing:.2px; color:var(--text); }
    .cmp-lvl-desc { font-size:12px; color:var(--text-dim); font-weight:500; }
    .cmp-lvl-cnt { margin-left:auto; font-size:11.5px; font-weight:700; color:var(--text-muted); background:var(--surface); border:1px solid var(--border); padding:3px 11px; border-radius:20px; }
    .cmp-lvl-head:hover .cmp-lvl-cnt { background:var(--white); }
    .cmp-lvl-chev { display:flex; color:var(--text-dim); transform:rotate(-90deg); transition:transform .25s ease; }
    .cmp-lvl-chev svg { width:17px; height:17px; }
    .cmp-lvl.open .cmp-lvl-chev { transform:rotate(0deg); color:var(--text-muted); }
    .cmp-lvl-grid { display:none; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; }
    .cmp-lvl.open .cmp-lvl-grid { display:grid; animation:cmpIn .24s ease; }
    @keyframes cmpIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }

    /* ── Tarjeta de comprador ── */
    .cmp-card { display:flex; align-items:center; gap:13px; padding:13px 15px; border-radius:14px; background:var(--white); border:1px solid var(--border); box-shadow:var(--shadow-sm); cursor:pointer; transition:box-shadow .15s, transform .12s, border-color .15s; min-width:0; }
    .cmp-card:hover { box-shadow:0 6px 18px rgba(0,0,0,.07); transform:translateY(-2px); border-color:transparent; }
    .cmp-c-ava { width:42px; height:42px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; letter-spacing:.3px; }
    .cmp-c-body { flex:1; min-width:0; }
    .cmp-c-top { display:flex; align-items:center; gap:8px; }
    .cmp-c-name { font-size:14px; font-weight:700; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cmp-c-off { flex-shrink:0; font-size:9.5px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; color:var(--text-dim); background:#eef1f6; padding:2px 7px; border-radius:20px; }
    .cmp-c-meta { display:flex; align-items:center; gap:6px; margin-top:4px; font-size:12px; color:var(--text-muted); min-width:0; }
    .cmp-c-meta svg { width:12.5px; height:12.5px; color:var(--text-dim); flex-shrink:0; }
    .cmp-c-prov { font-weight:600; flex-shrink:0; }
    .cmp-c-sep { color:var(--text-dim); flex-shrink:0; }
    .cmp-c-dest { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
    .cmp-c-acts { flex-shrink:0; display:flex; gap:3px; opacity:0; transition:opacity .14s; }
    .cmp-card:hover .cmp-c-acts { opacity:1; }
    .cmp-abtn { width:31px; height:31px; border-radius:8px; border:none; background:#eef1f6; color:var(--text-muted); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:.14s; }
    .cmp-abtn svg { width:15px; height:15px; } .cmp-abtn:hover { background:#e2e7f0; color:var(--text); }
    .cmp-abtn.del { color:#EF4444; background:rgba(239,68,68,.09); } .cmp-abtn.del:hover { background:rgba(239,68,68,.16); }
    .cmp-card.off { opacity:.6; }

    .cmp-lvl-empty { grid-column:1/-1; display:flex; align-items:center; gap:12px; padding:16px 18px; border:1px dashed var(--border); border-radius:14px; color:var(--text-dim); font-size:12.5px; }
    .cmp-lvl-empty span { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .cmp-lvl-empty svg { width:17px; height:17px; }

    @media (max-width:900px) {
      .cmp-hero { flex-direction:column; align-items:stretch; gap:16px; padding:18px 20px; }
      .cmp-hero-num { font-size:30px; }
      .cmp-leg { display:grid; grid-template-columns:1fr 1fr; gap:10px 12px; }
      .cmp-c-acts { opacity:1; }
      .cmp-lvl-grid { grid-template-columns:1fr; }
    }
  `;
  document.head.appendChild(s);
})();
