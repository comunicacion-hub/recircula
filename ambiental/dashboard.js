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

// Materiales mostrados en "Evolución" (null = todos los que tengan datos).
let EVOLUCION_MATS = null;

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
  registerDashboardFilters();

  document.getElementById('main-content').innerHTML =
    '<div class="page-header">' +
      '<div>' +
        '<div class="page-title">Gráficos</div>' +
        '<div class="page-sub" id="dash-fecha">' + capitalize(fmtFechaLarga(new Date())) + '</div>' +
      '</div>' +
      '<div class="hdr-actions">' +
        '<button class="hdr-circle" onclick="openFilterDrawer(\'dashboard\')" title="Filtros">' +
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

// ============================================================
// CARGAR + AGREGAR (en el cliente)
// ============================================================

async function cargarDashboard() {
  try {
    const filtradas = (CAT.entregas || []).filter(function(e) {
      return pasaFiltro(DASH_FILTROS.anio,       String(e['Año'])) &&
             pasaFiltro(DASH_FILTROS.mes,        mesCanonico(e['Mes'])) &&
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
}

// ── Totales: 3 KPI con pill de tendencia + sparkline ────────
function gTotales(k, porMes, meses) {
  const serie = function(campo) { return meses.map(function(m) { return (porMes[m] && porMes[m][campo]) || 0; }); };
  const seg = function(icono, color, label, valTxt, vals) {
    return '<div class="g-tot-seg">' +
      '<div class="g-tot-top"><div class="g-tot-ic" style="background:' + gRgba(color, .13) + ';color:' + color + '">' + icoHTML(icono) + '</div>' +
        '<span class="g-tot-lbl">' + esc(label) + '</span></div>' +
      '<div class="g-tot-val" style="color:' + color + '">' + valTxt + '</div>' +
      '<div class="g-tot-foot">' + gTrend(vals) + gSparkline(vals, color) + '</div>' +
    '</div>';
  };
  return '<div class="card g-tot">' +
    seg('recycle', G_INDIGO, 'TN Recuperados',  fmtNum(k.totalTN),           serie('totalTN')) +
    seg('star',    G_AMBAR,  'TN Priorizables', fmtNum(k.tnPriorizables),    serie('prioTN')) +
    seg('dollar',  G_TEAL,   'Ingresos PET',    '$' + fmtNum(k.ingresosPET, 0), serie('ingresosPET')) +
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

function gSparkline(vals, color) {
  let v = (vals && vals.length) ? vals.slice() : [0];
  if (v.length === 1) v = [v[0], v[0]];
  const n = v.length;
  const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
  const x = function(i) { return (i / (n - 1)) * 100; };
  const y = function(val) { return hi === lo ? 17 : 30 - ((val - lo) / (hi - lo)) * 24; };
  const pts = v.map(function(val, i) { return x(i).toFixed(1) + ',' + y(val).toFixed(1); });
  const last = pts[pts.length - 1].split(',');
  return '<svg class="g-spark" viewBox="0 0 100 34" preserveAspectRatio="none">' +
    '<polygon points="' + pts.join(' ') + ' 100,34 0,34" fill="' + gRgba(color, .12) + '"/>' +
    '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.8" fill="' + color + '"/></svg>';
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

// ── Zona de Recuperación (barras, mismo patrón que Avance) ──
function gZona(zonas, totalTN) {
  const items = G_ZONAS.map(function(z) { return { z: z, tn: (zonas && zonas[z]) || 0 }; })
    .filter(function(i) { return i.tn > 0; });
  items.sort(function(a, b) { return b.tn - a.tn; });
  if (!items.length) return '<div class="empty-state"><p>Sin datos de zona para este filtro</p></div>';
  const total = totalTN > 0 ? totalTN : items.reduce(function(s, i) { return s + i.tn; }, 0) || 1;
  const rows = items.map(function(i) {
    const pct = (i.tn / total) * 100;
    const w = Math.max(6, Math.min(100, pct));
    const color = G_ZONA_COLOR[i.z] || '#c3c8d4';
    return '<div>' +
      '<div class="g-z-top"><span class="g-z-name">' + esc(i.z) + '</span><span class="g-z-val">' + fmtNum(i.tn) + ' TN</span></div>' +
      '<div class="g-z-track"><div class="g-z-fill" style="width:' + w + '%;background:' + color + '">' + pct.toFixed(0) + '%</div></div>' +
    '</div>';
  }).join('');
  return rows + '<div class="g-z-note">Total recuperado · ' + fmtNum(total) + ' TN en ' +
    items.length + ' zona' + (items.length !== 1 ? 's' : '') + '</div>';
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

// ── TN Recuperados por Material: barras horizontales ────────
function gMateriales(distribucion) {
  const items = [];
  let otros = 0;
  Object.keys(distribucion || {}).forEach(function(nombre) {
    const val = distribucion[nombre];
    if (!(val > 0)) return;
    if (MATS_FILTRO_ACTIVOS.includes(nombre)) items.push({ nombre: nombre, val: val });
    else otros += val;
  });
  items.sort(function(a, b) { return b.val - a.val; });
  if (otros > 0) items.push({ nombre: 'Otros materiales', val: otros, otros: true });
  if (!items.length) return '<div class="empty-state"><p>Sin materiales con datos para este filtro</p></div>';

  const max = Math.max.apply(null, items.map(function(i) { return i.val; }).concat([1]));
  return items.map(function(it) {
    const w = Math.max(3, Math.min(100, (it.val / max) * 100));
    const color = it.otros ? '#c3c8d4' : gMatColor(it.nombre);
    const nom = it.otros ? 'Otros' : (G_MAT_CORTO[it.nombre] || it.nombre);
    const dim = it.otros ? ' style="color:var(--text-dim)"' : '';
    return '<div class="g-matrow"><span class="g-matname"' + dim + '>' + esc(nom) + '</span>' +
      '<div class="g-mattrack"><div class="g-matfill" style="width:' + w + '%;background:' + color + '"></div></div>' +
      '<span class="g-matval"' + dim + '>' + fmtNum(it.val) + '</span></div>';
  }).join('');
}

// ── Evolución por Material: una línea por material sobre los meses ──
// Todos los materiales con datos se muestran al inicio; el ⚙️ abre un modal
// para filtrar cuáles ver (EVOLUCION_MATS). Escala Y compartida.
function gEvolucionMats(porMesMat, meses) {
  if (!meses.length) return '<div class="empty-state"><p>Sin datos para este filtro</p></div>';

  const valor = function(n, m) { return (porMesMat[m] || {})[n] || 0; };
  const conDatos = {};
  meses.forEach(function(m) {
    const mm = porMesMat[m] || {};
    Object.keys(mm).forEach(function(n) { if (mm[n] > 0) conDatos[n] = true; });
  });
  let mats = Object.keys(conDatos);
  const totalDe = function(n) { return meses.reduce(function(s, m) { return s + valor(n, m); }, 0); };
  mats.sort(function(a, b) { return totalDe(b) - totalDe(a); });
  const shown = EVOLUCION_MATS ? mats.filter(function(n) { return EVOLUCION_MATS.includes(n); }) : mats;
  if (!shown.length) return '<div class="empty-state"><p>Elige al menos un material (⚙️)</p></div>';

  let yMax = 0;
  shown.forEach(function(n) { meses.forEach(function(m) { yMax = Math.max(yMax, valor(n, m)); }); });
  if (yMax <= 0) yMax = 1;

  const padL = 60, padR = 20, padT = 20, padB = 40, innerW = 1000 - padL - padR, innerH = 300 - padT - padB;
  const x = function(i) { return meses.length === 1 ? (padL + innerW / 2) : padL + (i / (meses.length - 1)) * innerW; };
  const y = function(v) { return padT + innerH - (v / yMax) * innerH; };

  let grid = '', ylab = '';
  for (let g = 0; g <= 4; g++) {
    const val = yMax * g / 4, yy = y(val);
    grid += '<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (padL + innerW) + '" y2="' + yy.toFixed(1) + '" stroke="#eef1f7" stroke-width="1"/>';
    ylab += '<text x="' + (padL - 10) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-family="Outfit" font-size="11" fill="#a0a0b0">' + fmtNum(val, 0) + '</text>';
  }
  const xlab = meses.map(function(m, i) {
    return '<text x="' + x(i).toFixed(1) + '" y="' + (padT + innerH + 20) + '" text-anchor="middle" font-family="Outfit" font-size="12" font-weight="600" fill="#767c8a">' + esc(m.substring(0, 3)) + '</text>';
  }).join('');

  const lineas = shown.map(function(n) {
    const c = gMatColor(n);
    const pts = meses.map(function(m, i) { return x(i).toFixed(1) + ',' + y(valor(n, m)).toFixed(1); }).join(' ');
    const dots = meses.map(function(m, i) {
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(valor(n, m)).toFixed(1) + '" r="4" fill="' + c + '" stroke="#fff" stroke-width="1.5">' +
        '<title>' + esc(n) + ' · ' + esc(m) + ': ' + fmtNum(valor(n, m)) + ' TN</title></circle>';
    }).join('');
    return '<polyline points="' + pts + '" fill="none" stroke="' + c + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' + dots;
  }).join('');

  const leg = shown.map(function(n) {
    return '<span class="g-eleg"><span class="g-eleg-c" style="background:' + gMatColor(n) + '"></span>' + esc(G_MAT_CORTO[n] || n) + '</span>';
  }).join('');

  return '<svg class="g-evochart" viewBox="0 0 1000 300">' + grid + ylab + '<g>' + xlab + '</g>' + lineas + '</svg>' +
    '<div class="g-evoleg">' + leg + '</div>';
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
