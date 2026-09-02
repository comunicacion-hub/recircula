// ============================================================
// RECIRCULA 360 — dashboard.js
// Dashboard ambiental — agregación en el cliente (Firestore)
// ============================================================

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const PROVINCIAS = ['El Oro','Guayas','Manabí','Sucumbíos','Pichincha','Chimborazo'];
const COLORES_PROV = {
  'El Oro':     '#18AE97', 'Guayas':    '#00bda4',
  'Manabí':     '#506CFF', 'Sucumbíos': '#F5AD21',
  'Pichincha':  '#9FDA60', 'Chimborazo':'#FF376F',
};

// Metas editables (en memoria)
let METAS = { PET: 811, Suave: 248, Duro: 377 };

// Factores ambientales — Marco Metodológico de Indicadores de Desempeño Ambiental (ReCircula)
const FACTOR_CO2  = { PET: 2.17, Suave: 1.58, Duro: 1.42 };  // tCO₂e evitadas / TN
const FACTOR_AGUA = { PET: 3000, Suave: 3930, Duro: 4900 };  // litros / TN

// Materiales listados individualmente en "TN Recuperadas por material";
// el resto se agrupa en "Otros materiales" (editable con el ⚙️ de la tarjeta)
const MATS_TORTA = ['PET','Plástico Duro','Plástico Suave','Cartón','Lata Aluminio','Vidrio'];
let MATS_FILTRO_ACTIVOS = MATS_TORTA.slice();

// ── Paleta de acento de la sección (índigo / ámbar / teal) ──
const G_INDIGO = '#506CFF';
const G_AMBAR  = '#F5AD21';
const G_TEAL   = '#18AE97';

// El track de "Avance vs meta" llega al 130% de la meta: la línea del 100%
// queda antes del final y la barra puede pasarse (excedente = zona verde).
const G_ESCALA_META = 1.3;
const G_POS_100 = (100 / (100 * G_ESCALA_META)) * 100; // % del track (≈76.9)

// Nombres cortos para la lista de materiales
const G_MAT_CORTO = {
  'Plástico Suave': 'Suave',
  'Plástico Duro':  'Duro',
  'Lata Aluminio':  'Lata',
  'Papel Archivo':  'Papel',
};

// Color por material (misma paleta que Pesos) para las barras de "TN por
// material" y las líneas de "Evolución".
const G_MAT_COLOR = {
  'PET': '#506CFF', 'Plástico Suave': '#F5AD21', 'Plástico Duro': '#18AE97',
  'Lata Aluminio': '#EF4444', 'Vidrio': '#33A8DE', 'Cartón': '#C19A6B',
  'Soplado': '#0BC3FF', 'Papel Archivo': '#7B5CFF', 'Tetrapak': '#0f9b84',
  'Chatarra': '#8a8a99', 'Cobre': '#B5651D', 'Periódico': '#B8B8C8',
  'Suela': '#4A4A55', 'Bronce': '#CD7F32', 'Batería': '#9B1C1C', 'Acero': '#A8AEB8',
  'Otros materiales': '#c3c8d4',
};
function gMatColor(n) { return G_MAT_COLOR[n] || '#c3c8d4'; }

function gRgba(hex, a) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(function(c) { return c + c; }).join('');
  const n = parseInt(h, 16) || 0;
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

// Zona de recuperación: mapea el texto de "Actividad Fuente" a las 3 zonas
// del gráfico (tolerante a variantes de redacción).
const G_ZONAS = ['En Relleno', 'Pie de Vereda', 'Punto GIRA', 'Otros'];
const G_ZONA_COLOR = { 'En Relleno': G_INDIGO, 'Pie de Vereda': G_TEAL, 'Punto GIRA': G_AMBAR, 'Otros': '#c3c8d4' };
function gZonaDe(act) {
  const s = String(act || '').toLowerCase();
  if (s.indexOf('relleno') >= 0) return 'En Relleno';
  if (s.indexOf('vereda') >= 0 || s.indexOf('fuente') >= 0) return 'Pie de Vereda';
  if (s.indexOf('gira') >= 0) return 'Punto GIRA';
  return 'Otros';
}

// Materiales mostrados en "Evolución" por defecto (los 3 priorizables;
// null significaría "todos los que tengan datos" — el ⚙️ deja elegir otros).
let EVOLUCION_MATS = ['PET', 'Plástico Suave', 'Plástico Duro'];

let DASH_FILTROS = { anio: [], mes: [], provincia: [], asociacion: [] };
let DASH_DATA    = null;

// ── Gráficos dinámicos (ApexCharts) ──────────────────────────
// Los charts se dibujan tras insertar el HTML (contenedores vacíos) y se
// destruyen/recrean en cada re-render. Si ApexCharts no cargó, degradan a nada.
let _dashApex     = [];             // instancias vivas
let _dashSparks   = [];             // [{ serie, color }] de los 3 KPIs
let _dashEvoPrep  = null, _dashZonaPrep = null, _dashTNPrep = null;
const G_APEX_BASE = { fontFamily: 'Outfit, sans-serif', toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 750 } };
function _apexOk() { return typeof ApexCharts !== 'undefined'; }
function _destruirDashApex() { _dashApex.forEach(function (c) { try { c.destroy(); } catch (e) {} }); _dashApex = []; }

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
      { key: 'asociacion', title: 'Asociación',   type: 'search',  placeholder: 'Buscar por nombre...' },
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
  registerDashboardFilters();

  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div>' +
        '<div class="page-title">Gráficos</div>' +
        '<div class="page-sub" id="dash-fecha">' + capitalize(fmtFechaLarga(new Date())) + '</div>' +
      '</div>' +
      '<div class="hdr-actions">' +
        '<button class="hdr-circle" onclick="openFilterDrawer(\'dashboard\', this)" title="Filtros">' +
          icoHTML('sliders') +
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

// Los meses llegan de Firestore con mayúsculas inconsistentes ("julio",
// "Julio"). Todo lo que agrupe o compare por mes pasa por aquí para que
// coincida con MESES; devuelve '' si no reconoce el valor.
function mesCanonico(m) {
  const k = String(m || '').trim().toLowerCase();
  const i = MESES.findIndex(function(x) { return x.toLowerCase() === k; });
  return i >= 0 ? MESES[i] : '';
}

// Filtro de Asociación = texto libre (no lista de checks, para no alargar el
// popover con decenas de asociaciones). Busca por coincidencia parcial del
// nombre, tolerante a acentos/mayúsculas (vía normKey).
function pasaBusquedaAsociacion(idAsoc) {
  const txt = (DASH_FILTROS.asociacion && DASH_FILTROS.asociacion[0]) || '';
  if (!txt.trim()) return true;
  const asoc = (CAT.asociaciones || []).find(function(a) { return a['ID_Asociacion'] === idAsoc; });
  const nombre = asoc ? asoc['Nombre'] : idAsoc;
  return normKey(nombre).indexOf(normKey(txt)) >= 0;
}

// ============================================================
// CARGAR + AGREGAR (en el cliente)
// ============================================================

async function cargarDashboard() {
  try {
    const filtradas = (CAT.entregas || []).filter(function(e) {
      return pasaFiltro(DASH_FILTROS.anio,      String(e['Año'])) &&
             pasaFiltro(DASH_FILTROS.mes,       mesCanonico(e['Mes'])) &&
             pasaFiltro(DASH_FILTROS.provincia, e['Provincia']) &&
             pasaBusquedaAsociacion(e['ID_Asociacion']);
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
  const porProvMesMat = {}; // { provincia: { mes: { material: TN } } }
  const porMesMat = {};     // { mes: { material: TN } }  (todas las provincias)
  const porMes = {};        // { mes: { totalTN, prioTN, ingresosPET } }
  const zonas = {};         // { zona: TN }
  const aniosSet = new Set();
  const mesesSet = new Set();

  entregas.forEach(function(e) {
    if (e['Año'] !== '' && e['Año'] != null) aniosSet.add(String(e['Año']));
    const mesCanon = mesCanonico(e['Mes']);
    if (mesCanon) mesesSet.add(mesCanon);

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

    const totalTN = totalKg / 1000;
    const petVenta = parseFloat(e['PET Valor Venta']) || 0;
    k.totalTN        += totalTN;
    k.tnPriorizables += prioKg / 1000;
    k.ingresosPET    += petVenta;
    k.tnPET          += (parseFloat(e['PET Kilos']) || 0) / 1000;
    k.tnSuave        += (parseFloat(e['Plástico Suave Kilos']) || 0) / 1000;
    k.tnDuro         += (parseFloat(e['Plástico Duro Kilos']) || 0) / 1000;

    // Zona de recuperación: el TN de la entrega se reparte entre sus actividades
    const acts = Array.isArray(e['Actividad Fuente']) ? e['Actividad Fuente']
               : (e['Actividad Fuente'] ? [e['Actividad Fuente']] : []);
    if (acts.length && totalTN > 0) {
      const cuota = totalTN / acts.length;
      acts.forEach(function(a) { const z = gZonaDe(a); zonas[z] = (zonas[z] || 0) + cuota; });
    }

    const prov = e['Provincia'] || e['_provinciaAsociacion'] || '—';
    const mes  = mesCanon;
    if (mes) {
      porMes[mes] = porMes[mes] || { totalTN: 0, prioTN: 0, ingresosPET: 0 };
      porMes[mes].totalTN += totalTN;
      porMes[mes].prioTN  += prioKg / 1000;
      porMes[mes].ingresosPET += petVenta;

      porProvMesMat[prov] = porProvMesMat[prov] || {};
      porProvMesMat[prov][mes] = porProvMesMat[prov][mes] || {};
      porMesMat[mes] = porMesMat[mes] || {};
      (CAT.materiales || []).forEach(function(m) {
        const nombre = m['Nombre'];
        const tn = (parseFloat(e[nombre + ' Kilos']) || 0) / 1000;
        if (tn > 0) {
          porProvMesMat[prov][mes][nombre] = (porProvMesMat[prov][mes][nombre] || 0) + tn;
          porMesMat[mes][nombre] = (porMesMat[mes][nombre] || 0) + tn;
        }
      });
    }
  });

  const meses = MESES.filter(function(m) { return mesesSet.has(m); });
  const anios = Array.from(aniosSet).filter(function(a) { return a && a !== 'undefined'; }).sort();

  return {
    kpis: k, distribucion: distribucion, porProvMesMat: porProvMesMat,
    porMesMat: porMesMat, porMes: porMes, zonas: zonas,
    meses: meses, filtrosDisponibles: { anios: anios }
  };
}

function poblarFiltrosDisponibles(f) {
  if (!f) return;
  const cfg = FILTER_CONFIGS['dashboard'];
  if (!cfg) return;
  const anioSec = cfg.sections.find(function(s) { return s.key === 'anio'; });
  if (anioSec && f.anios) anioSec.options = f.anios.map(String);
}

// ============================================================
// RENDER CONTENIDO
// ============================================================

function renderContenidoDashboard() {
  const d = DASH_DATA;
  const k = d.kpis;

  const co2 = {
    PET:   (k.tnPET   || 0) * FACTOR_CO2.PET,
    Suave: (k.tnSuave || 0) * FACTOR_CO2.Suave,
    Duro:  (k.tnDuro  || 0) * FACTOR_CO2.Duro,
  };
  const agua = {
    PET:   (k.tnPET   || 0) * FACTOR_AGUA.PET,
    Suave: (k.tnSuave || 0) * FACTOR_AGUA.Suave,
    Duro:  (k.tnDuro  || 0) * FACTOR_AGUA.Duro,
  };
  const co2Max  = Math.max(co2.PET,  co2.Suave,  co2.Duro,  1);
  const aguaMax = Math.max(agua.PET, agua.Suave, agua.Duro, 1);

  const co2Total  = co2.PET + co2.Suave + co2.Duro;
  const aguaTotal = agua.PET + agua.Suave + agua.Duro;
  const aguaTxt   = aguaTotal >= 1e6 ? fmtNum(aguaTotal / 1e6, 2) + '<u>M litros</u>' : fmtNum(aguaTotal, 0) + '<u>litros</u>';

  document.getElementById('dash-content').innerHTML =
    '<div class="g-wrap">' +

      // ── Totales (una sola tarjeta) ──
      gTotales(k, d.porMes, d.meses) +

      // ── Fila: Avance vs Meta | Zona de Recuperación ──
      '<div class="g-duo">' +

        '<div class="card">' +
          '<div class="card-title"><span>Avance vs Meta</span>' +
            '<button class="icon-btn" onclick="abrirEditarMetas()" title="Editar metas">' + icoHTML('settings') + '</button></div>' +
          '<div class="g-body g-meta">' +
            gMetaRow('PET',   k.tnPET,   METAS.PET,   G_INDIGO) +
            gMetaRow('Suave', k.tnSuave, METAS.Suave, G_TEAL) +
            gMetaRow('Duro',  k.tnDuro,  METAS.Duro,  G_AMBAR) +
            '<div class="g-meta-note"><i></i> La línea marca el 100% de la meta · la zona verde es el excedente</div>' +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-title">Zona de Recuperación</div>' +
          '<div class="g-body g-zona">' + gZona(d.zonas, k.totalTN) + '</div>' +
        '</div>' +

      '</div>' +

      // ── Fila: Impacto Ambiental | TN por Material ──
      '<div class="g-duo">' +

        '<div class="card">' +
          '<div class="card-title"><span>Impacto Ambiental</span>' +
            '<span style="font-size:11px;color:var(--text-dim);font-weight:600">por material</span></div>' +
          '<div class="g-body g-imp2">' +
            gImpGrupo('CO₂ Evitado', fmtNum(co2Total, 0) + '<u>t CO₂e</u>',
              [['PET', co2.PET, G_INDIGO], ['Suave', co2.Suave, G_AMBAR], ['Duro', co2.Duro, G_TEAL]],
              function(v) { return fmtNum(v, 0) + ' t'; }) +
            gImpGrupo('Ahorro de Agua', aguaTxt,
              [['PET', agua.PET, G_INDIGO], ['Suave', agua.Suave, G_AMBAR], ['Duro', agua.Duro, G_TEAL]],
              function(v) { return fmtNum(v, 0) + ' L'; }) +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-title"><span>TN Recuperados por Material</span>' +
            '<button class="icon-btn" onclick="abrirFiltroMateriales()" title="Elegir materiales">' + icoHTML('settings') + '</button></div>' +
          '<div class="g-body g-mat2">' + gMateriales(d.distribucion) + '</div>' +
        '</div>' +

      '</div>' +

      // ── Evolución por Material (ancho completo) ──
      '<div class="card">' +
        '<div class="card-title"><span>Evolución por Material</span>' +
          '<button class="icon-btn" onclick="abrirFiltroEvolucion()" title="Elegir materiales">' + icoHTML('settings') + '</button></div>' +
        gEvolucionMats(d.porMesMat, d.meses) +
      '</div>' +

    '</div>';

  _initDashCharts();   // dibuja los charts en los contenedores recién insertados
}

// ── Totales: 3 KPI con pill de tendencia + sparkline ────────
function gTotales(k, porMes, meses) {
  const serie = function(campo) { return meses.map(function(m) { return (porMes[m] && porMes[m][campo]) || 0; }); };
  _dashSparks = [
    { serie: serie('totalTN'),     color: G_INDIGO },
    { serie: serie('prioTN'),      color: G_AMBAR  },
    { serie: serie('ingresosPET'), color: G_TEAL   },
  ];
  const seg = function(idx, icono, color, label, valTxt, vals) {
    return '<div class="g-tot-seg">' +
      '<div class="g-tot-top"><div class="g-tot-ic" style="background:' + gRgba(color, .13) + ';color:' + color + '">' + icoHTML(icono) + '</div>' +
        '<span class="g-tot-lbl">' + esc(label) + '</span></div>' +
      '<div class="g-tot-val" style="color:' + color + '">' + valTxt + '</div>' +
      '<div class="g-tot-foot">' + gTrend(vals) + '<div class="g-spark" id="dash-spark-' + idx + '"></div></div>' +
    '</div>';
  };
  return '<div class="card g-tot">' +
    seg(0, 'recycle', G_INDIGO, 'TN Recuperados',  fmtNum(k.totalTN),           serie('totalTN')) +
    seg(1, 'star',    G_AMBAR,  'TN Priorizables', fmtNum(k.tnPriorizables),    serie('prioTN')) +
    seg(2, 'dollar',  G_TEAL,   'Ingresos PET',    '$' + fmtNum(k.ingresosPET, 0), serie('ingresosPET')) +
  '</div>';
}

function gTrend(vals) {
  if (!vals || vals.length < 2) return '<span class="g-pill up">— <small>sin histórico</small></span>';
  const cur = vals[vals.length - 1], prev = vals[vals.length - 2];
  if (prev <= 0) return '<span class="g-pill up">— <small>sin mes previo</small></span>';
  const ch = ((cur - prev) / prev) * 100;
  const up = ch >= 0;
  return '<span class="g-pill ' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + ' ' + fmtNum(Math.abs(ch), 1) + '% <small>vs. mes ant.</small></span>';
}

// ── Avance vs Meta (línea del 100% antes del final + excedente) ──
function gMetaRow(nombre, actual, meta, color) {
  const a = actual || 0;
  const pct = meta > 0 ? (a / meta) * 100 : 0;
  const w = meta > 0 ? Math.min(100, pct / G_ESCALA_META) : 0;
  const wFinal = a > 0 ? Math.max(11, w) : 0;
  const num = fmtNum(a) + ' / ' + fmtNum(meta, 0) + ' TN' + (pct >= 100 ? ' · <span class="ok">✓ superada</span>' : '');
  const over = 'left:' + G_POS_100 + '%';
  return '<div>' +
    '<div class="g-meta-top"><span class="g-meta-name">' + nombre + '</span><span class="g-meta-num">' + num + '</span></div>' +
    '<div class="g-meta-track">' +
      '<div class="g-meta-over" style="' + over + '"></div>' +
      '<div class="g-meta-fill" style="width:' + wFinal + '%;background:' + color + '">' + pct.toFixed(0) + '%</div>' +
      '<div class="g-meta-goal" style="' + over + '"></div>' +
    '</div>' +
  '</div>';
}

// ── Zona de Recuperación (dona interactiva) ──
function gZona(zonas, totalTN) {
  _dashZonaPrep = _prepZona(zonas, totalTN);
  if (!_dashZonaPrep) return '<div class="empty-state"><p>Sin datos de zona para este filtro</p></div>';
  return '<div class="g-chart" id="dash-zona"></div>';
}

// ── Impacto Ambiental: un grupo de barras por métrica ──────
function gImpGrupo(titulo, totalTxt, rows, fmtVal) {
  const max = Math.max.apply(null, rows.map(function(r) { return r[1]; }).concat([1]));
  const bars = rows.map(function(r) {
    const w = r[1] <= 0 ? 0 : Math.max(2, Math.min(100, (r[1] / max) * 100));
    return '<div class="g-ibar"><span class="g-ibn">' + esc(r[0]) + '</span>' +
      '<div class="g-ibt"><div class="g-ibf" style="width:' + w + '%;background:' + r[2] + '"></div></div>' +
      '<span class="g-ibv">' + fmtVal(r[1]) + '</span></div>';
  }).join('');
  return '<div class="g-imp-grp">' +
    '<div class="g-imp-gh"><span>' + esc(titulo) + '</span><b>' + totalTxt + '</b></div>' + bars + '</div>';
}

// ── TN Recuperados por Material: barras horizontales interactivas ──
function gMateriales(distribucion) {
  _dashTNPrep = _prepMateriales(distribucion);
  if (!_dashTNPrep) return '<div class="empty-state"><p>Sin materiales con datos para este filtro</p></div>';
  return '<div class="g-chart" id="dash-tn"></div>';
}

// ── Evolución por Material: línea interactiva (ApexCharts) ──
// Todos los materiales con datos se muestran al inicio; el ⚙️ abre un modal
// para filtrar cuáles ver (EVOLUCION_MATS). Escala Y compartida.
function gEvolucionMats(porMesMat, meses) {
  _dashEvoPrep = _prepEvolucion(porMesMat, meses);
  if (!_dashEvoPrep) return '<div class="empty-state"><p>Sin datos para este filtro</p></div>';
  if (_dashEvoPrep.empty) return '<div class="empty-state"><p>Elige al menos un material con el ⚙️</p></div>';
  return '<div class="g-chart" id="dash-evo"></div>' +
    '<div class="g-chart-hint">Pasa el cursor para ver el detalle · toca un material en la leyenda para mostrarlo u ocultarlo</div>';
}

// ── Preparación de datos para los charts ──
function _prepEvolucion(porMesMat, meses) {
  if (!meses.length) return null;
  const valor = function(n, m) { return (porMesMat[m] || {})[n] || 0; };
  const conDatos = {};
  meses.forEach(function(m) { const mm = porMesMat[m] || {}; Object.keys(mm).forEach(function(n) { if (mm[n] > 0) conDatos[n] = true; }); });
  let mats = Object.keys(conDatos);
  const totalDe = function(n) { return meses.reduce(function(s, m) { return s + valor(n, m); }, 0); };
  mats.sort(function(a, b) { return totalDe(b) - totalDe(a); });
  const shown = EVOLUCION_MATS ? mats.filter(function(n) { return EVOLUCION_MATS.includes(n); }) : mats;
  if (!shown.length) return { empty: true };
  return {
    series: shown.map(function(n) { return { name: G_MAT_CORTO[n] || n, data: meses.map(function(m) { return +valor(n, m).toFixed(2); }) }; }),
    colors: shown.map(function(n) { return gMatColor(n); }),
    categories: meses.map(function(m) { return m.substring(0, 3); }),
  };
}
function _prepZona(zonas, totalTN) {
  const items = G_ZONAS.map(function(z) { return { z: z, tn: (zonas && zonas[z]) || 0 }; }).filter(function(i) { return i.tn > 0; });
  items.sort(function(a, b) { return b.tn - a.tn; });
  if (!items.length) return null;
  const total = totalTN > 0 ? totalTN : items.reduce(function(s, i) { return s + i.tn; }, 0) || 1;
  return {
    labels: items.map(function(i) { return i.z; }),
    values: items.map(function(i) { return +i.tn.toFixed(2); }),
    colors: items.map(function(i) { return G_ZONA_COLOR[i.z] || '#c3c8d4'; }),
    total: total,
  };
}
function _prepMateriales(distribucion) {
  const items = []; let otros = 0;
  Object.keys(distribucion || {}).forEach(function(nombre) {
    const val = distribucion[nombre]; if (!(val > 0)) return;
    if (MATS_FILTRO_ACTIVOS.includes(nombre)) items.push({ nombre: nombre, val: val }); else otros += val;
  });
  items.sort(function(a, b) { return b.val - a.val; });
  if (otros > 0) items.push({ nombre: 'Otros materiales', val: otros, otros: true });
  if (!items.length) return null;
  return {
    categories: items.map(function(i) { return i.otros ? 'Otros' : (G_MAT_CORTO[i.nombre] || i.nombre); }),
    values: items.map(function(i) { return +i.val.toFixed(2); }),
    colors: items.map(function(i) { return i.otros ? '#c3c8d4' : gMatColor(i.nombre); }),
  };
}

// ── Dibujo de los charts (tras insertar el HTML) ──
function _initDashCharts() {
  _destruirDashApex();
  if (!_apexOk()) return;
  _dashSparks.forEach(function(s, i) { _mkSpark('dash-spark-' + i, s.serie, s.color); });
  if (_dashEvoPrep && !_dashEvoPrep.empty) _mkEvolucion('dash-evo', _dashEvoPrep);
  if (_dashZonaPrep) _mkZona('dash-zona', _dashZonaPrep);
  if (_dashTNPrep) _mkMateriales('dash-tn', _dashTNPrep);
}
function _mkSpark(id, serie, color) {
  const el = document.getElementById(id); if (!el) return;
  const c = new ApexCharts(el, {
    chart: { type: 'area', height: 38, sparkline: { enabled: true }, animations: { enabled: true, speed: 800 } },
    series: [{ name: '', data: serie.length ? serie : [0, 0] }],
    colors: [color], stroke: { curve: 'smooth', width: 2.2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: .4, opacityTo: 0, stops: [0, 100] } },
    tooltip: { enabled: true, x: { show: false }, y: { formatter: function(v) { return fmtNum(v); }, title: { formatter: function() { return ''; } } }, marker: { show: false } },
  });
  c.render(); _dashApex.push(c);
}
function _mkEvolucion(id, p) {
  const el = document.getElementById(id); if (!el) return;
  const c = new ApexCharts(el, {
    chart: Object.assign({}, G_APEX_BASE, { type: 'area', height: 330 }),
    series: p.series, colors: p.colors, stroke: { curve: 'smooth', width: 3 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: .22, opacityTo: .02, stops: [0, 95] } },
    dataLabels: { enabled: false }, markers: { size: 0, hover: { size: 6 } },
    xaxis: { categories: p.categories, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#a4abba', fontSize: '12px', fontWeight: 600 } } },
    yaxis: { labels: { formatter: function(v) { return fmtNum(v); }, style: { colors: '#a4abba', fontSize: '11px' } } },
    grid: { borderColor: '#eef1f7', xaxis: { lines: { show: false } } },
    legend: { position: 'top', horizontalAlign: 'left', fontSize: '13px', fontWeight: 600, labels: { colors: '#767c8a' }, markers: { width: 11, height: 11, radius: 6 }, itemMargin: { horizontal: 10 } },
    tooltip: { shared: true, intersect: false, y: { formatter: function(v) { return fmtNum(v) + ' TN'; } } },
  });
  c.render(); _dashApex.push(c);
}
function _mkZona(id, p) {
  const el = document.getElementById(id); if (!el) return;
  const c = new ApexCharts(el, {
    chart: Object.assign({}, G_APEX_BASE, { type: 'donut', height: 290 }),
    series: p.values, labels: p.labels, colors: p.colors, stroke: { width: 2, colors: ['#fff'] },
    plotOptions: { pie: { donut: { size: '68%', labels: { show: true,
      value: { fontSize: '22px', fontWeight: 800, color: '#2b2f3a', formatter: function(v) { return fmtNum(v); } },
      total: { show: true, label: 'Total TN', fontSize: '11px', color: '#a4abba', fontWeight: 600, formatter: function() { return fmtNum(p.total); } } } } } },
    dataLabels: { enabled: false },
    legend: { position: 'bottom', fontSize: '12.5px', fontWeight: 600, labels: { colors: '#767c8a' }, markers: { width: 10, height: 10, radius: 5 }, itemMargin: { horizontal: 8, vertical: 3 } },
    tooltip: { y: { formatter: function(v) { return fmtNum(v) + ' TN'; } } },
  });
  c.render(); _dashApex.push(c);
}
function _mkMateriales(id, p) {
  const el = document.getElementById(id); if (!el) return;
  const h = Math.max(210, p.categories.length * 42);
  const c = new ApexCharts(el, {
    chart: Object.assign({}, G_APEX_BASE, { type: 'bar', height: h }),
    series: [{ name: 'TN', data: p.values }], colors: p.colors,
    plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 6, borderRadiusApplication: 'end', barHeight: '64%' } },
    dataLabels: { enabled: true, formatter: function(v) { return fmtNum(v); }, textAnchor: 'start', offsetX: 8, style: { fontSize: '12px', fontWeight: 700, colors: ['#2b2f3a'] } },
    xaxis: { categories: p.categories, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#a4abba', fontSize: '11px' } } },
    yaxis: { labels: { style: { colors: '#767c8a', fontSize: '12.5px', fontWeight: 600 } } },
    grid: { borderColor: '#eef1f7', yaxis: { lines: { show: false } } },
    legend: { show: false }, tooltip: { y: { formatter: function(v) { return fmtNum(v) + ' TN'; } } },
  });
  c.render(); _dashApex.push(c);
}

// ============================================================
// FILTRO DE MATERIALES — Evolución (multi-select)
// ============================================================

function abrirFiltroEvolucion() {
  const mats = (CAT.materiales || []).map(function(m) { return m['Nombre']; });
  const checks = mats.map(function(m) {
    const on = EVOLUCION_MATS ? EVOLUCION_MATS.includes(m) : true;
    return '<label class="filter-opt">' +
      '<input type="checkbox" value="' + esc(m) + '" ' + (on ? 'checked' : '') + '>' +
      '<span>' + esc(m) + '</span></label>';
  }).join('');

  abrirModal(
    '<div class="modal" style="max-width:420px">' +
      '<div class="modal-head">' +
        '<div><div class="modal-title">Materiales</div><div class="modal-sub">Elige cuáles ver en la evolución</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div style="display:flex;gap:8px;margin-bottom:14px">' +
          '<button class="btn btn-glass btn-sm" onclick="selTodosEvo(true)">Todos</button>' +
          '<button class="btn btn-glass btn-sm" onclick="selTodosEvo(false)">Ninguno</button>' +
        '</div>' +
        '<div id="evo-checks">' + checks + '</div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="aplicarFiltroEvolucion()">Aplicar</button>' +
      '</div>' +
    '</div>'
  );
}

function selTodosEvo(todos) {
  document.querySelectorAll('#evo-checks input[type=checkbox]').forEach(function(cb) { cb.checked = todos; });
}

function aplicarFiltroEvolucion() {
  EVOLUCION_MATS = Array.prototype.slice.call(document.querySelectorAll('#evo-checks input:checked')).map(function(cb) { return cb.value; });
  cerrarModal();
  if (DASH_DATA) renderContenidoDashboard();
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
  if (DASH_DATA) renderContenidoDashboard();
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
