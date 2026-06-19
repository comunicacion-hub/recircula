// ============================================================
// RECIRCULA 360 — dashboard.js
// Dashboard ambiental — agregación en el cliente (Firestore)
// ============================================================

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const PROVINCIAS = ['El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo'];
const COLORES_PROV = {
  'El Oro':     '#33A8DE', 'Guayas':    '#00bda4',
  'Manabí':     '#506CFF', 'Sucumbíos': '#F5AD21',
  'Pichincha':  '#9FDA60', 'Chimborazo':'#FF376F',
};

// Metas editables (en memoria)
let METAS = { PET: 811, Suave: 248, Duro: 377 };

// Factores ambientales
const FACTOR_CO2  = { PET: 2.2,  Suave: 1.3,  Duro: 1.5  };  // TN CO₂ evitadas / TN
const FACTOR_AGUA = { PET: 3000, Suave: 1500, Duro: 2000 };  // litros / TN

// Materiales en la torta (usan el nombre real del catálogo)
const MATS_TORTA = ['PET','Plástico Duro','Plástico Suave','Cartón','Lata Aluminio','Vidrio'];
let MATS_FILTRO_ACTIVOS = MATS_TORTA.slice();

let chartTorta = null;
let chartLineas = null;

let DASH_FILTROS = { anio: [], mes: [], provincia: [], asociacion: [] };
let DASH_DATA    = null;

// ============================================================
// CONFIG DEL DRAWER DE FILTROS
// ============================================================

function registerDashboardFilters() {
  registerFilterConfig('dashboard', {
    badgeId: 'badge-dashboard',
    sections: [
      { key: 'mes',        title: 'Meses',        type: 'options', options: MESES, allLabel: 'Todos los meses' },
      { key: 'anio',       title: 'Años',         type: 'options', options: [], allLabel: 'Todos los años' },
      { key: 'provincia',  title: 'Provincias',   type: 'options', options: PROVINCIAS, allLabel: 'Todas las provincias' },
      { key: 'asociacion', title: 'Asociaciones', type: 'options', options: [], allLabel: 'Todas las asociaciones' },
    ],
    getValue: function(k) { return DASH_FILTROS[k] || ''; },
    setValue: function(k, v) { DASH_FILTROS[k] = v; },
    apply: function() { cargarDashboard(); },
  });
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderDashboard() {
  if (typeof Chart === 'undefined') {
    await new Promise(function(resolve) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  registerDashboardFilters();

  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div>' +
        '<div class="page-title">Dashboard Ambiental</div>' +
        '<div class="page-sub" id="dash-fecha">' + capitalize(fmtFechaLarga(new Date())) + '</div>' +
      '</div>' +
      '<div class="hdr-actions">' +
        '<button class="hdr-circle" onclick="openFilterDrawer(\'dashboard\')" title="Filtros">' +
          icoHTML('filter') +
          '<span class="filter-badge" id="badge-dashboard" style="display:none;">0</span>' +
        '</button>' +
        '<button class="hdr-circle hdr-circle-danger" onclick="cerrarSesion()" title="Volver al Hub">' +
          icoHTML('logout') +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div id="dash-content">' +
      '<div style="display:flex;align-items:center;justify-content:center;padding:60px;gap:16px">' +
        '<div class="spinner"></div><span style="color:var(--text-muted)">Cargando dashboard...</span>' +
      '</div>' +
    '</div>';

  await cargarDashboard();
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ============================================================
// CARGAR + AGREGAR (en el cliente)
// ============================================================

async function cargarDashboard() {
  try {
    const filtradas = (CAT.entregas || []).filter(function(e) {
      return pasaFiltro(DASH_FILTROS.anio,       String(e['Año'])) &&
             pasaFiltro(DASH_FILTROS.mes,        e['Mes']) &&
             pasaFiltro(DASH_FILTROS.provincia,  e['Provincia']) &&
             pasaFiltro(DASH_FILTROS.asociacion, e['ID_Asociacion']);
    });
    DASH_DATA = calcularDashboard(filtradas);
    poblarFiltrosDisponibles(DASH_DATA.filtrosDisponibles);
    renderContenidoDashboard();
    updateFilterBadge('dashboard');
  } catch (e) {
    console.error(e);
    showToast('Error al calcular el dashboard');
  }
}

// Agrega kilos/ventas por material, provincia y mes
function calcularDashboard(entregas) {
  const k = { totalTN: 0, tnPriorizables: 0, ingresosPET: 0, tnPET: 0, tnSuave: 0, tnDuro: 0 };
  const distribucion = {};
  const porProvMes   = {};
  const aniosSet = new Set();
  const mesesSet = new Set();

  entregas.forEach(function(e) {
    if (e['Año'] !== '' && e['Año'] != null) aniosSet.add(String(e['Año']));
    if (e['Mes']) mesesSet.add(e['Mes']);

    let totalKg = 0, prioKg = 0;
    (CAT.materiales || []).forEach(function(m) {
      const nombre = m['Nombre'];
      const kg = parseFloat(e[nombre + ' Kilos']) || 0;
      if (kg > 0) {
        totalKg += kg;
        if (m['Priorizable'] === true) prioKg += kg;
        distribucion[nombre] = (distribucion[nombre] || 0) + kg / 1000;
      }
    });

    k.totalTN        += totalKg / 1000;
    k.tnPriorizables += prioKg / 1000;
    k.ingresosPET    += parseFloat(e['PET Valor Venta']) || 0;
    k.tnPET          += (parseFloat(e['PET Kilos']) || 0) / 1000;
    k.tnSuave        += (parseFloat(e['Plástico Suave Kilos']) || 0) / 1000;
    k.tnDuro         += (parseFloat(e['Plástico Duro Kilos']) || 0) / 1000;

    const prov = e['Provincia'] || e['_provinciaAsociacion'] || '—';
    const mes  = e['Mes'] || '';
    if (mes) {
      porProvMes[prov] = porProvMes[prov] || {};
      porProvMes[prov][mes] = (porProvMes[prov][mes] || 0) + (parseFloat(e['PET Kilos']) || 0) / 1000;
    }
  });

  const meses = MESES.filter(function(m) { return mesesSet.has(m); });
  const anios = Array.from(aniosSet).filter(function(a) { return a && a !== 'undefined'; }).sort();

  return { kpis: k, distribucion: distribucion, porProvMes: porProvMes, meses: meses, filtrosDisponibles: { anios: anios } };
}

function poblarFiltrosDisponibles(f) {
  if (!f) return;
  const cfg = FILTER_CONFIGS['dashboard'];
  if (!cfg) return;
  const anioSec = cfg.sections.find(function(s) { return s.key === 'anio'; });
  if (anioSec && f.anios) anioSec.options = f.anios.map(String);
  const asocSec = cfg.sections.find(function(s) { return s.key === 'asociacion'; });
  if (asocSec) {
    asocSec.options = (CAT.asociaciones || []).map(function(a) {
      return { val: a['ID_Asociacion'], lbl: a['Nombre'] };
    });
  }
}

// ============================================================
// RENDER CONTENIDO
// ============================================================

function renderContenidoDashboard() {
  const d = DASH_DATA;
  const k = d.kpis;

  const co2PET   = (k.tnPET   || 0) * FACTOR_CO2.PET;
  const co2Suave = (k.tnSuave || 0) * FACTOR_CO2.Suave;
  const co2Duro  = (k.tnDuro  || 0) * FACTOR_CO2.Duro;
  const co2Max   = Math.max(co2PET, co2Suave, co2Duro, 1);

  const aguaPET   = (k.tnPET   || 0) * FACTOR_AGUA.PET;
  const aguaSuave = (k.tnSuave || 0) * FACTOR_AGUA.Suave;
  const aguaDuro  = (k.tnDuro  || 0) * FACTOR_AGUA.Duro;
  const aguaMax   = Math.max(aguaPET, aguaSuave, aguaDuro, 1);

  if (chartTorta)  { chartTorta.destroy();  chartTorta  = null; }
  if (chartLineas) { chartLineas.destroy(); chartLineas = null; }

  document.getElementById('dash-content').innerHTML =
    '<div class="dash-grid">' +

      '<div class="card dash-card-totales">' +
        '<div class="card-title">Totales</div>' +
        '<div class="totales-divider"></div>' +
        '<div class="totales-list">' +
          '<div class="totales-row"><span class="totales-label">TN Recuperadas</span><span class="totales-value">' + fmtNum(k.totalTN) + '</span></div>' +
          '<div class="totales-row"><span class="totales-label">TN Priorizables</span><span class="totales-value">' + fmtNum(k.tnPriorizables) + '</span></div>' +
          '<div class="totales-row"><span class="totales-label">Ingresos venta PET</span><span class="totales-value">' + fmtMoney(k.ingresosPET) + '</span></div>' +
        '</div>' +
      '</div>' +

      '<div class="card dash-card-torta">' +
        '<div class="card-title" style="justify-content:flex-end;">TN Recuperadas por material</div>' +
        '<div class="torta-wrap">' +
          '<div class="torta-canvas-wrap"><canvas id="chart-torta"></canvas></div>' +
          '<button class="icon-btn torta-filter-btn" onclick="abrirFiltroMateriales()" title="Filtrar materiales">' + icoHTML('filter') + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="card dash-card-co2">' +
        '<div class="card-title">CO₂ evitado</div>' +
        '<div class="bars-list">' +
          barraHorizontal('PET',   co2PET,   'bar-grad-pet',   't', 0, co2Max) +
          barraHorizontal('Suave', co2Suave, 'bar-grad-suave', 't', 0, co2Max) +
          barraHorizontal('Duro',  co2Duro,  'bar-grad-duro',  't', 0, co2Max) +
        '</div>' +
        '<div class="card-footnote">CO₂ evitado = Toneladas × Factor de ahorro</div>' +
      '</div>' +

      '<div class="card dash-card-meta">' +
        '<div class="card-title"><span>Avance vs meta</span>' +
          '<button class="icon-btn" onclick="abrirEditarMetas()" title="Editar metas">' + icoHTML('settings') + '</button>' +
        '</div>' +
        '<div class="bullet-list">' +
          bulletRow('PET',   k.tnPET,   METAS.PET,   'linear-gradient(90deg,#33A8DE,#506CFF)') +
          bulletRow('Duro',  k.tnDuro,  METAS.Duro,  'linear-gradient(90deg,#0BC3FF,#18AE97)') +
          bulletRow('Suave', k.tnSuave, METAS.Suave, 'linear-gradient(90deg,#9FDA60,#18AE97)') +
        '</div>' +
      '</div>' +

      '<div class="card dash-card-agua">' +
        '<div class="card-title">Ahorro de agua</div>' +
        '<div class="bars-list">' +
          barraHorizontal('PET',   aguaPET,   'bar-grad-pet',   'L', 0, aguaMax) +
          barraHorizontal('Suave', aguaSuave, 'bar-grad-suave', 'L', 0, aguaMax) +
          barraHorizontal('Duro',  aguaDuro,  'bar-grad-duro',  'L', 0, aguaMax) +
        '</div>' +
        '<div class="card-footnote">Ahorro de agua = Toneladas × Factor</div>' +
      '</div>' +

    '</div>' +

    '<div class="card dash-row-bottom">' +
      '<div class="card-title" style="justify-content:flex-end;">TN PET mensual por provincia</div>' +
      '<div style="position:relative;height:280px"><canvas id="chart-lineas"></canvas></div>' +
    '</div>';

  setTimeout(function() {
    initChartTorta(d.distribucion);
    initChartLineas(d.porProvMes, d.meses);
  }, 50);
}

function barraHorizontal(label, valor, gradClass, unidad, dec, max) {
  if (dec === undefined) dec = 0;
  if (max === undefined) max = 1;
  const v = valor || 0;
  const ancho = v <= 0 ? 0 : Math.max(6, Math.min(100, (v / max) * 100));
  const valFmt = dec === 0 ? fmtNum(v, 0) : fmtNum(v, dec);
  return '<div class="bars-row"><span>' + label + '</span>' +
    '<div class="bars-bar-track"><div class="bars-bar-fill ' + gradClass + '" style="width:' + ancho + '%;">' + valFmt + ' ' + unidad + '</div></div>' +
  '</div>';
}

function bulletRow(nombre, actual, meta, gradient) {
  const pct = meta > 0 ? (actual / meta) * 100 : 0;
  const widthPct = meta > 0 ? Math.min(100, (actual / (meta * 1.2)) * 100) : 0;
  const finalWidth = actual > 0 ? Math.max(8, widthPct) : 0;
  return '<div class="bullet-row">' +
    '<div class="bullet-head"><span>' + nombre + '</span>' +
      '<span class="bullet-meta-num">' + fmtNum(actual) + ' / ' + meta + ' TN</span></div>' +
    '<div class="bullet-track"><div class="bullet-meta-marker"></div>' +
      '<div class="bullet-fill" style="width:' + finalWidth + '%;background:' + gradient + '">' + pct.toFixed(0) + '%</div>' +
    '</div>' +
  '</div>';
}

// ============================================================
// CHART: TORTA
// ============================================================

function initChartTorta(distribucion) {
  const ctx = document.getElementById('chart-torta');
  if (!ctx) return;

  const colores = {
    'PET': '#33A8DE', 'Plástico Duro': '#506CFF', 'Plástico Suave': '#18AE97',
    'Cartón': '#F5AD21', 'Lata Aluminio': '#0BC3FF', 'Vidrio': '#9FDA60',
    'Otros materiales': '#D0D0D8',
  };

  const labels = [], datos = [], bgs = [];
  let otros = 0;

  Object.entries(distribucion).forEach(function(par) {
    const nombre = par[0], val = par[1];
    if (val <= 0) return;
    if (MATS_FILTRO_ACTIVOS.includes(nombre)) {
      labels.push(nombre);
      datos.push(parseFloat(val.toFixed(2)));
      bgs.push(colores[nombre] || '#ccc');
    } else {
      otros += val;
    }
  });

  if (otros > 0) {
    labels.push('Otros materiales');
    datos.push(parseFloat(otros.toFixed(2)));
    bgs.push(colores['Otros materiales']);
  }

  chartTorta = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: datos, backgroundColor: bgs, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { family: 'Outfit', size: 11 }, padding: 10, boxWidth: 10, boxHeight: 10 } },
        tooltip: { callbacks: { label: function(c) { return ' ' + c.label + ': ' + fmtNum(c.raw) + ' TN'; } } }
      },
      cutout: '62%',
    }
  });
}

// ============================================================
// CHART: LÍNEAS
// ============================================================

function initChartLineas(porProvMes, meses) {
  const ctx = document.getElementById('chart-lineas');
  if (!ctx) return;

  const provConDatos = PROVINCIAS.filter(function(p) {
    return meses.some(function(m) { return (porProvMes[p] && porProvMes[p][m] || 0) > 0; });
  });
  if (!provConDatos.length) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><p>Sin datos por provincia para este filtro</p></div>';
    return;
  }

  const datasets = provConDatos.map(function(p) {
    return {
      label: p,
      data: meses.map(function(m) { return parseFloat((porProvMes[p] && porProvMes[p][m] || 0).toFixed(2)); }),
      borderColor: COLORES_PROV[p],
      backgroundColor: COLORES_PROV[p] + '20',
      borderWidth: 2.5, tension: 0.35, pointRadius: 3.5, pointHoverRadius: 6, fill: false,
    };
  });

  chartLineas = new Chart(ctx, {
    type: 'line',
    data: { labels: meses.map(function(m) { return m.substring(0, 3); }), datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Outfit', size: 11 }, padding: 12, boxWidth: 12, usePointStyle: false } },
        tooltip: { callbacks: { label: function(c) { return ' ' + c.dataset.label + ': ' + fmtNum(c.raw) + ' TN'; } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Outfit', size: 11 } } },
        y: { grid: { color: '#f0f4f8' }, ticks: { font: { family: 'Outfit', size: 11 } } }
      }
    }
  });
}

// ============================================================
// FILTRO DE MATERIALES (multi-select sobre la torta)
// ============================================================

function abrirFiltroMateriales() {
  const todosLosMats = (CAT.materiales || []).length
    ? CAT.materiales.map(function(m) { return m['Nombre']; })
    : ['PET','Plástico Duro','Plástico Suave','Cartón','Lata Aluminio','Vidrio'];

  const checks = todosLosMats.map(function(m) {
    return '<label class="filter-opt">' +
      '<input type="checkbox" value="' + esc(m) + '" ' + (MATS_FILTRO_ACTIVOS.includes(m) ? 'checked' : '') + '>' +
      '<span>' + esc(m) + '</span></label>';
  }).join('');

  abrirModal(
    '<div class="modal" style="max-width:420px">' +
      '<div class="modal-head">' +
        '<div><div class="modal-title">Filtrar materiales</div><div class="modal-sub">Selecciona los materiales a mostrar en la gráfica</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div style="display:flex;gap:8px;margin-bottom:14px">' +
          '<button class="btn btn-glass btn-sm" onclick="selTodosMats(true)">Todos</button>' +
          '<button class="btn btn-glass btn-sm" onclick="selTodosMats(false)">Ninguno</button>' +
        '</div>' +
        '<div id="mats-checks">' + checks + '</div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="aplicarFiltroMateriales()">Aplicar</button>' +
      '</div>' +
    '</div>'
  );
}

function selTodosMats(todos) {
  document.querySelectorAll('#mats-checks input[type=checkbox]').forEach(function(cb) { cb.checked = todos; });
}

function aplicarFiltroMateriales() {
  MATS_FILTRO_ACTIVOS = Array.prototype.slice.call(document.querySelectorAll('#mats-checks input:checked')).map(function(cb) { return cb.value; });
  cerrarModal();
  if (DASH_DATA) {
    if (chartTorta) { chartTorta.destroy(); chartTorta = null; }
    initChartTorta(DASH_DATA.distribucion);
  }
}

// ============================================================
// EDITAR METAS
// ============================================================

function abrirEditarMetas() {
  abrirModal(
    '<div class="modal" style="max-width:420px">' +
      '<div class="modal-head">' +
        '<div><div class="modal-title">Editar metas anuales</div><div class="modal-sub">Las metas se usan para calcular el avance</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group"><label class="form-label">Meta PET (TN)</label>' +
          '<input type="number" class="form-input" id="meta-pet" value="' + METAS.PET + '" min="0"></div>' +
        '<div class="form-group"><label class="form-label">Meta Plástico Suave (TN)</label>' +
          '<input type="number" class="form-input" id="meta-suave" value="' + METAS.Suave + '" min="0"></div>' +
        '<div class="form-group"><label class="form-label">Meta Plástico Duro (TN)</label>' +
          '<input type="number" class="form-input" id="meta-duro" value="' + METAS.Duro + '" min="0"></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="guardarMetas()">Guardar</button>' +
      '</div>' +
    '</div>'
  );
}

function guardarMetas() {
  METAS.PET   = parseFloat(document.getElementById('meta-pet').value)   || METAS.PET;
  METAS.Suave = parseFloat(document.getElementById('meta-suave').value) || METAS.Suave;
  METAS.Duro  = parseFloat(document.getElementById('meta-duro').value)  || METAS.Duro;
  cerrarModal();
  showToast('Metas actualizadas ✓');
  if (DASH_DATA) renderContenidoDashboard();
}
