// ============================================================
// RECIRCULA 360 — entregas.js
// Filtra sobre CAT.entregas (cargado de Firestore). Sin backend.
// ============================================================

let ENTREGAS_DATA    = [];
let ENTREGAS_FILTROS = { anio: [], mes: [], asociacion: [], provincia: [] };
let EVIDENCIAS_LISTA = [];
let ENTREGAS_LOADED  = false;

// ============================================================
// REGISTRAR DRAWER
// ============================================================

function registerEntregasFilters() {
  registerFilterConfig('entregas', {
    badgeId: 'badge-entregas',
    sections: [
      { key: 'mes',        title: 'Meses',        type: 'options', options: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'], allLabel: 'Todos los meses' },
      { key: 'anio',       title: 'Años',         type: 'options', options: ['2024','2025','2026','2027','2028'], allLabel: 'Todos los años' },
      { key: 'provincia',  title: 'Provincias',   type: 'options', options: ['El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo'], allLabel: 'Todas las provincias' },
      { key: 'asociacion', title: 'Asociaciones', type: 'options', options: CAT.asociaciones.map(a => ({ val: a['ID_Asociacion'], lbl: a['Nombre'] })), allLabel: 'Todas las asociaciones' },
    ],
    getValue: (k) => ENTREGAS_FILTROS[k] || '',
    setValue: (k, v) => { ENTREGAS_FILTROS[k] = v; },
    apply: () => cargarEntregas(),
  });
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

function renderEntregas() {
  registerEntregasFilters();
  ENTREGAS_LOADED = false;

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Entregas</div>
        <div class="page-sub">Registro</div>
      </div>
      <div class="hdr-actions">
        <button class="hdr-circle" onclick="openFilterDrawer('entregas')" title="Filtros">
          ${icoHTML('filter')}
          <span class="filter-badge" id="badge-entregas" style="display:none;">0</span>
        </button>
        <button class="hdr-circle hdr-circle-primary" onclick="abrirFormEntrega()" title="Nueva entrega">
          ${icoHTML('plus')}
        </button>
      </div>
    </div>

    <!-- Tabla (vacía al inicio con mensaje sutil) -->
    <div id="entregas-table-wrap">
      <div class="entregas-placeholder">Selecciona los filtros para ver información</div>
    </div>
  `;
}

// ============================================================
// CARGAR ENTREGAS (filtrado local sobre CAT.entregas)
// ============================================================

async function cargarEntregas() {
  const wrap = document.getElementById('entregas-table-wrap');
  if (!wrap) return;

  // Regla: Entregas NO carga hasta que el usuario aplique al menos un filtro
  if (!tieneAlgunFiltroAplicado(ENTREGAS_FILTROS)) {
    wrap.innerHTML = `<div class="entregas-placeholder">Selecciona los filtros para ver información</div>`;
    ENTREGAS_LOADED = false;
    return;
  }

  ENTREGAS_DATA = (CAT.entregas || []).filter(e =>
    pasaFiltro(ENTREGAS_FILTROS.anio,       String(e['Año'])) &&
    pasaFiltro(ENTREGAS_FILTROS.mes,        e['Mes']) &&
    pasaFiltro(ENTREGAS_FILTROS.provincia,  e['Provincia']) &&
    pasaFiltro(ENTREGAS_FILTROS.asociacion, e['ID_Asociacion'])
  ).sort((a, b) => String(b['Fecha'] || '').localeCompare(String(a['Fecha'] || '')));

  ENTREGAS_LOADED = true;
  renderTablaEntregas();
}

// ============================================================
// TABLA
// ============================================================

function renderTablaEntregas() {
  const wrap = document.getElementById('entregas-table-wrap');
  if (!wrap) return;

  if (!ENTREGAS_DATA.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        ${icoHTML('recycle').replace('<svg', '<svg style="width:48px;height:48px;opacity:0.4"')}
        <p>No hay entregas con estos filtros</p>
      </div>`;
    return;
  }

  const filas = ENTREGAS_DATA.map(e => {
    const petKg     = parseFloat(e['PET Kilos'] || 0);
    const suaveKg   = parseFloat(e['Plástico Suave Kilos'] || 0);
    const duroKg    = parseFloat(e['Plástico Duro Kilos'] || 0);
    const total     = parseFloat(e['Valor Total'] || 0);
    const carpeta   = e['ID_Carpeta_Evidencia'];
    const idEnt     = jsEsc(e['ID_Entrega'] || '');
    const docId     = jsEsc(e['_docId'] || '');
    const idCarpeta = jsEsc(carpeta || '');

    return `
      <tr>
        <td style="font-size:12px;color:var(--text-muted)"><strong>Período</strong><br>${esc(e['Mes']||'')} ${esc(e['Año']||'')}</td>
        <td style="font-weight:500"><strong>Asociación</strong><br>${esc(e['_nombreAsociacion']||'—')}</td>
        <td data-hide-mobile><strong>Comprador</strong><br>${esc(e['_nombreComprador']||'—')}</td>
        <td data-hide-mobile><strong>Nivel</strong><br>${nivelBadge(e['_nivelComprador']||e['Nivel Intermediacion'])}</td>
        <td data-hide-mobile style="text-align:right;font-weight:600"><strong>PET</strong><br>${fmtNum(petKg)} kg</td>
        <td data-hide-mobile style="text-align:right"><strong>Suave</strong><br>${fmtNum(suaveKg)} kg</td>
        <td data-hide-mobile style="text-align:right"><strong>Duro</strong><br>${fmtNum(duroKg)} kg</td>
        <td data-hide-mobile style="text-align:right;font-weight:700;color:#0a9e83"><strong>Valor</strong><br>${fmtMoney(total)}</td>
        <td data-hide-mobile><strong>Evidencia</strong><br>
          ${carpeta
            ? `<button class="icon-btn" onclick="window.open('https://drive.google.com/drive/folders/${idCarpeta}','_blank')" title="Ver carpeta">${icoHTML('folder')}</button>`
            : '<span style="color:var(--text-dim);font-size:12px">—</span>'}
        </td>
        <td data-actions-row>
          <div class="td-actions">
            ${carpeta
              ? `<button class="icon-btn" onclick="window.open('https://drive.google.com/drive/folders/${idCarpeta}','_blank')" title="Carpeta de evidencias">${icoHTML('folder')}</button>`
              : ''}
            <button class="icon-btn" onclick="verEntrega('${idEnt}')" title="Ver">${icoHTML('view')}</button>
            ${SESSION.rol !== 'Visualizador' ? `
              <button class="icon-btn primary" onclick="editarEntrega('${idEnt}')" title="Editar">${icoHTML('edit')}</button>
              <button class="icon-btn del" onclick="confirmarEliminarEntrega('${docId}','${idCarpeta}')" title="Eliminar">${icoHTML('trash')}</button>
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
            <th>Período</th>
            <th>Asociación</th>
            <th>Comprador</th>
            <th>Nivel</th>
            <th style="text-align:right">PET kg</th>
            <th style="text-align:right">Suave kg</th>
            <th style="text-align:right">Duro kg</th>
            <th style="text-align:right">Valor total</th>
            <th>Evidencia</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div style="font-size:12px;color:var(--text-dim);text-align:right">
      ${ENTREGAS_DATA.length} registro${ENTREGAS_DATA.length !== 1 ? 's' : ''}
    </div>
  `;
}

// ============================================================
// ELIMINAR
// ============================================================

function confirmarEliminarEntrega(docId, folderId) {
  abrirModal(`
    <div class="modal" style="max-width:440px">
      <div class="modal-head">
        <div class="modal-title">Eliminar entrega</div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:14px;line-height:1.6">
          ¿Seguro que quieres eliminar esta entrega?
          Se eliminará la fila del registro. Esta acción no se puede deshacer.
        </p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="eliminarEntrega('${jsEsc(docId)}')">Eliminar</button>
      </div>
    </div>
  `);
}

async function eliminarEntrega(docId) {
  if (!docId) { showToast('No se encontró la entrega'); return; }
  try {
    const res = await eliminarEntregaFS(docId);
    if (!res.ok) { showToast('Error al eliminar: ' + (res.error || '')); return; }
    showToast(res.offline ? 'Eliminada (se sincronizará) ✓' : 'Entrega eliminada ✓');
    cerrarModal();
    await cargarEntregas();
  } catch (e) {
    console.error(e);
    showToast('Error al eliminar');
  }
}

// ============================================================
// VER ENTREGA
// ============================================================

function verEntrega(id) {
  const e = ENTREGAS_DATA.find(r => r['ID_Entrega'] === id);
  if (!e) { showToast('Entrega no encontrada'); return; }

  const MATS = ['PET','Plástico Suave','Plástico Duro','Lata Aluminio','Vidrio','Cartón',
    'Chatarra','Cobre','Papel Archivo','Periódico','Soplado','Tetrapak','Suela','Bronce','Batería','Acero'];

  const filasMat = MATS.filter(m => parseFloat(e[m+' Kilos']||0) > 0).map(m => {
    const kg     = parseFloat(e[m+' Kilos']||0);
    const precio = parseFloat(e[m+' Precio']||0);
    const venta  = parseFloat(e[m+' Valor Venta']||0) || kg*precio;
    const prio   = ['PET','Plástico Suave','Plástico Duro'].includes(m);
    return `<tr>
      <td style="${prio?'font-weight:600;color:#1c7aa8':''}">${esc(m)}</td>
      <td style="text-align:right">${fmtNum(kg)} kg</td>
      <td style="text-align:right">$${fmtNum(precio,2)}/kg</td>
      <td style="text-align:right;font-weight:600;color:#0a9e83">${fmtMoney(venta)}</td>
    </tr>`;
  }).join('');

  abrirModal(`
    <div class="modal">
      <div class="modal-head">
        <div>
          <div class="modal-title">Detalle de entrega</div>
          <div class="modal-sub">${esc(e['Mes']||'')} ${esc(e['Año']||'')} · ${esc(e['_nombreAsociacion']||'')}</div>
        </div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">
        <div class="form-grid-2" style="margin-bottom:16px">
          <div><div class="form-label">Fecha</div><div style="font-size:14px">${fmtFecha(e['Fecha'])}</div></div>
          <div><div class="form-label">Provincia</div><div style="font-size:14px">${esc(e['Provincia']||e['_provinciaAsociacion']||'—')}</div></div>
          <div><div class="form-label">Comprador</div><div style="font-size:14px">${esc(e['_nombreComprador']||'—')}</div></div>
          <div><div class="form-label">Nivel</div><div>${nivelBadge(e['Nivel Intermediacion'])}</div></div>
          <div><div class="form-label">Actividad fuente</div><div style="font-size:14px">${esc(e['Actividad Fuente']||'—')}</div></div>
          <div><div class="form-label">Valor total</div><div style="font-size:18px;font-weight:700;color:#0a9e83">${fmtMoney(e['Valor Total'])}</div></div>
        </div>
        <div class="materiales-section">
          <div class="materiales-section-title">Materiales entregados</div>
          <div class="table-wrap" style="border-radius:14px;box-shadow:none;border:1px solid var(--border)"><table>
            <thead><tr><th>Material</th><th style="text-align:right">Kilos</th><th style="text-align:right">Precio</th><th style="text-align:right">Valor</th></tr></thead>
            <tbody>${filasMat||'<tr><td colspan="4" style="text-align:center;color:var(--text-dim)">Sin materiales</td></tr>'}</tbody>
          </table></div>
        </div>
        ${e['Observaciones'] ? `<div style="margin-top:14px"><div class="form-label">Observaciones</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">${esc(e['Observaciones'])}</div></div>` : ''}
      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cerrar</button>
      </div>
    </div>
  `);
}

// ============================================================
// FORMULARIO
// ============================================================

function editarEntrega(id) { abrirFormEntrega(id); }

function abrirFormEntrega(id = null) {
  const e = id ? ENTREGAS_DATA.find(r => r['ID_Entrega'] === id) : null;
  EVIDENCIAS_LISTA = [];

  const todosMats = CAT.materiales.length ? CAT.materiales : [
    { Nombre: 'PET', Priorizable: true },
    { Nombre: 'Plástico Suave', Priorizable: true },
    { Nombre: 'Plástico Duro', Priorizable: true },
    { Nombre: 'Cartón' },
    { Nombre: 'Vidrio' },
    { Nombre: 'Lata Aluminio' },
  ];
  const priorizables = todosMats.filter(m => m['Priorizable']==='Sí' || m['Priorizable']===true);
  const otros = todosMats.filter(m => !(m['Priorizable']==='Sí' || m['Priorizable']===true));

  const filaMaterial = (mat) => {
    const n    = mat['Nombre'];
    const prio = mat['Priorizable']==='Sí' || mat['Priorizable']===true;
    const kg   = e ? (e[n+' Kilos']||'') : '';
    const prec = e ? (e[n+' Precio']||'') : '';
    const vent = e ? parseFloat(e[n+' Valor Venta']||0) : 0;
    const mid  = n.replace(/[^a-zA-Z0-9]/g,'_');
    return `
      <div class="material-row${prio?' material-priorizable':''}">
        <div class="material-row-label">${esc(n)}${prio?` <span class="badge badge-cyan" style="font-size:9px;padding:1px 6px">Prio</span>`:''}</div>
        <input type="number" class="form-input" id="mat-kg-${mid}" placeholder="Kilos" value="${kg}" min="0" step="0.01" oninput="calcularValorMaterial('${mid}')">
        <input type="number" class="form-input" id="mat-precio-${mid}" placeholder="$/kg" value="${prec}" min="0" step="0.01" oninput="calcularValorMaterial('${mid}')">
        <div class="material-valor" id="mat-venta-${mid}">${vent>0?fmtMoney(vent):'—'}</div>
      </div>`;
  };

  abrirModal(`
    <div class="modal" style="max-width:720px">
      <div class="modal-head">
        <div><div class="modal-title">${e?'Editar entrega':'Nueva entrega'}</div><div class="modal-sub">Registra los kilos y precios por material</div></div>
        <button class="modal-close" onclick="cerrarModal()"></button>
      </div>
      <div class="modal-body">

        <div class="form-grid-3">
          <div class="form-group">
            <label class="form-label">Fecha</label>
            <input type="date" class="form-input" id="ent-fecha" readonly value="${e?.['Fecha']?String(e.Fecha).substring(0,10):new Date().toISOString().substring(0,10)}">
          </div>
          <div class="form-group">
            <label class="form-label">Año *</label>
            <select class="form-select" id="ent-anio">
              <option value="">Selecciona...</option>
              ${['2024','2025','2026','2027','2028'].map(a=>`<option value="${a}" ${String(e?.['Año'])===a?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Mes *</label>
            <select class="form-select" id="ent-mes">
              <option value="">Selecciona...</option>
              ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map(m=>`<option value="${m}" ${e?.['Mes']===m?'selected':''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Asociación *</label>
            <select class="form-select" id="ent-asociacion" onchange="autocompletarProvincia(this.value)">
              <option value="">Selecciona una asociación</option>
              ${CAT.asociaciones.map(a=>`<option value="${esc(a['ID_Asociacion'])}" ${e?.['ID_Asociacion']===a['ID_Asociacion']?'selected':''}>${esc(a['Nombre'])}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Provincia</label>
            <input type="text" class="form-input" id="ent-provincia" readonly value="${esc(e?.['Provincia']||e?.['_provinciaAsociacion']||'')}">
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Comprador *</label>
            <select class="form-select" id="ent-comprador" onchange="autocompletarNivel(this.value)">
              <option value="">Selecciona un comprador</option>
              ${CAT.compradores.map(c=>`<option value="${esc(c['ID_Comprador'])}" data-nivel="${esc(c['Nivel']||c['Nivel Intermediacion']||'')}" ${e?.['ID_Comprador']===c['ID_Comprador']?'selected':''}>${esc(c['Nombre'])}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nivel intermediación <span style="font-weight:400;text-transform:none;color:var(--text-dim);font-size:10px">(auto)</span></label>
            <input type="text" class="form-input" id="ent-nivel" readonly value="${esc(e?.['Nivel Intermediacion']||'')}">
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Actividad fuente</label>
            <select class="form-select" id="ent-actividad">
              <option value="">Selecciona...</option>
              ${['Recuperación a pie de Vereda / Fuente','Recuperación en Relleno','Recuperación GIRA','Otros'].map(a=>`<option value="${a}" ${e?.['Actividad Fuente']===a?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
        </div>

        ${priorizables.length ? `
        <div class="materiales-section">
          <div class="materiales-section-title">Materiales priorizables</div>
          ${priorizables.map(filaMaterial).join('')}
        </div>` : ''}

        ${otros.length ? `
        <div class="materiales-section">
          <div class="materiales-section-title">Otros materiales</div>
          ${otros.map(filaMaterial).join('')}
        </div>` : ''}

        <div style="margin-top:14px;display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:12px 16px;background:rgba(24,174,151,0.06);border-radius:12px">
          <span style="font-size:13px;color:var(--text-muted);font-weight:600">VALOR TOTAL:</span>
          <span id="ent-total" style="font-size:22px;font-weight:700;color:#0a9e83">${e?fmtMoney(e['Valor Total']):'$0,00'}</span>
        </div>

        <div class="form-group" style="margin-top:14px">
          <label class="form-label">Observaciones</label>
          <textarea class="form-textarea" id="ent-obs" placeholder="Notas adicionales...">${esc(e?.['Observaciones']||'')}</textarea>
        </div>

      </div>
      <div class="modal-foot">
        <button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-entrega" onclick="guardarEntrega('${jsEsc(id||'')}')">${e?'Actualizar':'Guardar entrega'}</button>
      </div>
    </div>
  `);

  if (e?.['ID_Asociacion']) autocompletarProvincia(e['ID_Asociacion']);
  if (e?.['ID_Comprador'])  autocompletarNivel(e['ID_Comprador']);
  if (e) recalcularTotal();
}

function autocompletarProvincia(idAsoc) {
  const inp = document.getElementById('ent-provincia');
  if (!inp) return;
  const a = CAT.asociaciones.find(x => x['ID_Asociacion'] === idAsoc);
  inp.value = a ? (a['Provincia']||'') : '';
}

function autocompletarNivel(idComp) {
  const inp = document.getElementById('ent-nivel');
  if (!inp) return;
  const c = CAT.compradores.find(x => x['ID_Comprador'] === idComp);
  inp.value = c ? (c['Nivel'] || c['Nivel Intermediacion'] || '') : '';
}

function calcularValorMaterial(mid) {
  const kg = parseFloat(document.getElementById('mat-kg-'+mid)?.value || 0);
  const pr = parseFloat(document.getElementById('mat-precio-'+mid)?.value || 0);
  const v  = kg * pr;
  const vEl = document.getElementById('mat-venta-'+mid);
  if (vEl) vEl.textContent = v > 0 ? fmtMoney(v) : '—';
  recalcularTotal();
}

function recalcularTotal() {
  let total = 0;
  document.querySelectorAll('[id^="mat-venta-"]').forEach(el => {
    const t = el.textContent.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');
    const n = parseFloat(t);
    if (!isNaN(n)) total += n;
  });
  const totEl = document.getElementById('ent-total');
  if (totEl) totEl.textContent = fmtMoney(total);
}

// ============================================================
// GUARDAR (Firestore)
// ============================================================

async function guardarEntrega(id) {
  const fecha       = document.getElementById('ent-fecha').value;
  const anio        = document.getElementById('ent-anio').value;
  const mes         = document.getElementById('ent-mes').value;
  const idAsoc      = document.getElementById('ent-asociacion').value;
  const provincia   = document.getElementById('ent-provincia').value;
  const idComp      = document.getElementById('ent-comprador').value;
  const nivel       = document.getElementById('ent-nivel').value;
  const actividad   = document.getElementById('ent-actividad').value;
  const obs         = document.getElementById('ent-obs').value;

  if (!anio || !mes) { showToast('Año y mes son obligatorios'); return; }
  if (!idAsoc) { showToast('Selecciona una asociación'); return; }
  if (!idComp) { showToast('Selecciona un comprador'); return; }

  // Mantener la carpeta de evidencia existente si es edición
  const actual = id ? (CAT.entregas.find(r => r['ID_Entrega'] === id) || {}) : {};

  const data = {
    ID_Entrega: id || '',
    Fecha: fecha, 'Año': anio, Mes: mes,
    ID_Asociacion: idAsoc, Provincia: provincia,
    ID_Comprador: idComp, 'Nivel Intermediacion': nivel,
    'Actividad Fuente': actividad,
    Observaciones: obs,
    'ID_Carpeta_Evidencia': actual['ID_Carpeta_Evidencia'] || '',
  };

  let total = 0;
  document.querySelectorAll('[id^="mat-kg-"]').forEach(inp => {
    const mid = inp.id.replace('mat-kg-','');
    const kg = parseFloat(inp.value || 0);
    const precio = parseFloat(document.getElementById('mat-precio-'+mid)?.value || 0);
    const venta = kg * precio;
    if (kg > 0) {
      const matReal = (CAT.materiales || []).find(m => m['Nombre'].replace(/[^a-zA-Z0-9]/g,'_') === mid);
      const realName = matReal ? matReal['Nombre'] : mid.replace(/_/g,' ');
      data[realName + ' Kilos']       = kg;
      data[realName + ' Precio']      = precio;
      data[realName + ' Valor Venta'] = venta;
      total += venta;
    }
  });
  data['Valor Total'] = total;

  const btn = document.getElementById('btn-guardar-entrega');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const docId = id ? (actual._docId || null) : null;
    const res = await guardarEntregaFS(docId, data);
    if (!res.ok) { showToast('Error: ' + (res.error || 'desconocido')); return; }
    showToast(res.offline ? 'Guardada (se sincronizará) ✓' : (id ? 'Entrega actualizada ✓' : 'Entrega creada ✓'));
    cerrarModal();
    if (ENTREGAS_LOADED) await cargarEntregas();
  } catch (e) {
    console.error(e);
    showToast('Error al guardar');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = id ? 'Actualizar' : 'Guardar entrega'; }
  }
}
