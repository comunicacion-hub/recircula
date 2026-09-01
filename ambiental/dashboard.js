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

// Material mostrado en el gráfico "Evolución por Material" (elegible con el ícono ⚙️)
let MATERIAL_EVOLUCION = 'PET';

// ── Paleta de la sección Gráficos ──────────────────────────
// Tres colores + rosa solo para tendencias a la baja. No usa la paleta
// multicolor por material (esa vive en Pesos).
const G_INDIGO = '#506CFF';
const G_AMBAR  = '#F5AD21';
const G_TEAL   = '#18AE97';

// Color de cada punto temporal en "Evolución": rampa secuencial de índigo
// (claro = mes más antiguo → oscuro = mes más reciente). El eje representa
// un orden, y una escala secuencial es la codificación correcta para eso;
// interpolar entre los tres colores de marca daba tonos turbios (marrón,
// oliva) en los meses intermedios.
const G_EVO_CLARO  = '#B9C4FF';
const G_EVO_OSCURO = '#2E42C4';

function gMezcla(hexA, hexB, t) {
  const rgb = function(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  };
  const a = rgb(hexA), b = rgb(hexB);
  return 'rgb(' + a.map(function(v, i) { return Math.round(v + (b[i] - v) * t); }).join(',') + ')';
}

function gColorPunto(i, n) {
  if (n <= 1) return G_INDIGO;
  return gMezcla(G_EVO_CLARO, G_EVO_OSCURO, i / (n - 1));
}

// El track de "Avance vs meta" llega al 140% de la meta, así la línea
// del 100% cae dentro del track y se puede leer el sobrecumplimiento.
const G_ESCALA_META = 1.4;
const G_POS_100 = (100 / (100 * G_ESCALA_META)) * 100; // % del track

// Nombres cortos para la grilla de materiales
const G_MAT_CORTO = {
  'Plástico Suave': 'Suave',
  'Plástico Duro':  'Duro',
  'Lata Aluminio':  'Lata/Aluminio',
  'Papel Archivo':  'Papel',
};

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

    k.totalTN        += totalKg / 1000;
    k.tnPriorizables += prioKg / 1000;
    k.ingresosPET    += parseFloat(e['PET Valor Venta']) || 0;
    k.tnPET          += (parseFloat(e['PET Kilos']) || 0) / 1000;
    k.tnSuave        += (parseFloat(e['Plástico Suave Kilos']) || 0) / 1000;
    k.tnDuro         += (parseFloat(e['Plástico Duro Kilos']) || 0) / 1000;

    const prov = e['Provincia'] || e['_provinciaAsociacion'] || '—';
    const mes  = mesCanon;
    if (mes) {
      porProvMesMat[prov] = porProvMesMat[prov] || {};
      porProvMesMat[prov][mes] = porProvMesMat[prov][mes] || {};
      (CAT.materiales || []).forEach(function(m) {
        const nombre = m['Nombre'];
        const tn = (parseFloat(e[nombre + ' Kilos']) || 0) / 1000;
        if (tn > 0) porProvMesMat[prov][mes][nombre] = (porProvMesMat[prov][mes][nombre] || 0) + tn;
      });
    }
  });

  const meses = MESES.filter(function(m) { return mesesSet.has(m); });
  const anios = Array.from(aniosSet).filter(function(a) { return a && a !== 'undefined'; }).sort();

  return { kpis: k, distribucion: distribucion, porProvMesMat: porProvMesMat, meses: meses, filtrosDisponibles: { anios: anios } };
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

  document.getElementById('dash-content').innerHTML =
    '<div class="g-wrap">' +

      // ── Fila 1: tres KPI ──
      '<div class="g-kpis">' +
        gKpi('recycle', 'TN Recuperados',  fmtNum(k.totalTN),             G_INDIGO) +
        gKpi('star',    'TN Priorizables', fmtNum(k.tnPriorizables),      G_AMBAR) +
        gKpi('dollar',  'Ingresos PET',    fmtNum(k.ingresosPET, 0),      G_TEAL) +
      '</div>' +

      // ── Fila 2: Impacto Ambiental + Avance vs Meta ──
      '<div class="g-duo">' +

        '<div class="card">' +
          '<div class="card-title">Impacto Ambiental</div>' +
          '<div class="g-imp">' +
            gImpRow('PET',   co2.PET,   agua.PET,   co2Max, aguaMax) +
            gImpRow('Suave', co2.Suave, agua.Suave, co2Max, aguaMax) +
            gImpRow('Duro',  co2.Duro,  agua.Duro,  co2Max, aguaMax) +
          '</div>' +
          '<div class="g-ley">' +
            '<span class="g-ley-item"><span class="g-ley-chip" style="background:' + G_INDIGO + '"></span>CO₂ Evitado</span>' +
            '<span class="g-ley-item"><span class="g-ley-chip" style="background:' + G_AMBAR + '"></span>Ahorro de agua</span>' +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-title">Avance vs Meta</div>' +
          '<div class="g-meta-body">' +
            gMetaRow('PET',   k.tnPET,   METAS.PET,   G_INDIGO) +
            gMetaRow('Suave', k.tnSuave, METAS.Suave, G_TEAL) +
            gMetaRow('Duro',  k.tnDuro,  METAS.Duro,  G_AMBAR) +
            '<div class="g-meta-line" style="left:' + G_POS_100 + '%"></div>' +
            '<div class="g-meta-100" style="left:' + G_POS_100 + '%">100%</div>' +
          '</div>' +
          '<div class="g-foot">' +
            '<button class="icon-btn" onclick="abrirEditarMetas()" title="Editar metas">' + icoHTML('settings') + '</button>' +
          '</div>' +
        '</div>' +

      '</div>' +

      // ── Fila 3: Evolución + TN por material ──
      '<div class="g-duo">' +

        '<div class="card">' +
          '<div class="card-title"><span>Evolución ' + esc(MATERIAL_EVOLUCION) + '</span>' +
            '<button class="icon-btn" onclick="abrirSelectorMaterialEvolucion()" title="Elegir material">' + icoHTML('settings') + '</button>' +
          '</div>' +
          gEvolucion(d.porProvMesMat, d.meses, MATERIAL_EVOLUCION) +
        '</div>' +

        '<div class="card">' +
          '<div class="card-title">TN Recuperadas por material</div>' +
          gMateriales(d.distribucion, d.porProvMesMat, d.meses) +
          '<div class="g-foot">' +
            '<button class="icon-btn" onclick="abrirFiltroMateriales()" title="Elegir materiales">' + icoHTML('settings') + '</button>' +
          '</div>' +
        '</div>' +

      '</div>' +

    '</div>';
}

// ── KPI ─────────────────────────────────────────────────────
function gKpi(icono, label, valor, color) {
  return '<div class="card g-kpi">' +
    '<div class="g-kpi-ico" style="background:' + color + '">' + icoHTML(icono) + '</div>' +
    '<div class="g-kpi-txt">' +
      '<div class="g-kpi-lbl">' + esc(label) + '</div>' +
      '<div class="g-kpi-val" style="color:' + color + '">' + valor + '</div>' +
    '</div>' +
  '</div>';
}

// ── Impacto Ambiental: dos barras por material (CO₂ y agua) ──
// Cada serie se normaliza contra su propio máximo porque las unidades
// no son comparables (toneladas de CO₂ vs litros de agua).
function gImpRow(label, co2, agua, co2Max, aguaMax) {
  return '<div class="g-imp-row">' +
    '<div class="g-imp-lbl">' + label + '</div>' +
    '<div class="g-imp-bars">' +
      gImpBar(co2,  co2Max,  G_INDIGO, fmtNum(co2, 0)  + ' t') +
      gImpBar(agua, aguaMax, G_AMBAR,  fmtNum(agua, 0) + ' L') +
    '</div>' +
  '</div>';
}

function gImpBar(valor, max, color, texto) {
  const v = valor || 0;
  // Tope en 82% para que la cifra al final de la barra siempre quepa.
  const w = v <= 0 ? 0 : Math.max(3, Math.min(82, (v / max) * 82));
  return '<div class="g-imp-bar">' +
    '<div class="g-imp-fill" style="width:' + w + '%;background:' + color + '"></div>' +
    '<span class="g-imp-val">' + texto + '</span>' +
  '</div>';
}

// ── Avance vs Meta ──────────────────────────────────────────
function gMetaRow(nombre, actual, meta, color) {
  const a = actual || 0;
  const pct = meta > 0 ? (a / meta) * 100 : 0;
  const w = meta > 0 ? Math.min(100, pct / G_ESCALA_META) : 0;
  const wFinal = a > 0 ? Math.max(13, w) : 0;
  return '<div class="g-meta-row">' +
    '<div class="g-meta-lbl">' + nombre + '</div>' +
    '<span class="g-meta-num">' + fmtNum(a) + ' / ' + fmtNum(meta, 0) + ' TN</span>' +
    '<div class="g-meta-track">' +
      '<div class="g-meta-fill" style="width:' + wFinal + '%;background:' + color + '">' + pct.toFixed(0) + '%</div>' +
    '</div>' +
  '</div>';
}

// ── Evolución por material: un slope chart por provincia ────
// Los puntos se dibujan como trazos de largo cero con remate redondo y
// vector-effect="non-scaling-stroke": así quedan circulares aunque el
// SVG se estire horizontalmente (preserveAspectRatio="none").
function gEvolucion(porProvMesMat, meses, material) {
  const mat = material || MATERIAL_EVOLUCION;
  const valor = function(p, m) {
    return (porProvMesMat[p] && porProvMesMat[p][m] && porProvMesMat[p][m][mat]) || 0;
  };

  const provs = PROVINCIAS.filter(function(p) {
    return meses.some(function(m) { return valor(p, m) > 0; });
  });

  if (!provs.length || !meses.length) {
    return '<div class="empty-state"><p>Sin datos de ' + esc(mat) + ' para este filtro</p></div>';
  }

  // Escala compartida entre provincias para que las filas sean comparables
  let max = 0;
  provs.forEach(function(p) {
    meses.forEach(function(m) { max = Math.max(max, valor(p, m)); });
  });
  if (max <= 0) max = 1;

  const x = function(i) {
    return meses.length === 1 ? 50 : 2 + (i * 96) / (meses.length - 1);
  };
  const y = function(v) { return 23 - (v / max) * 20; };

  const filas = provs.map(function(p) {
    const pts = meses.map(function(m, i) { return x(i) + ',' + y(valor(p, m)); }).join(' ');
    const dots = meses.map(function(m, i) {
      const v = valor(p, m);
      const c = gColorPunto(i, meses.length);
      return '<line x1="' + x(i) + '" y1="' + y(v) + '" x2="' + x(i) + '" y2="' + y(v) + '" ' +
             'stroke="' + c + '" stroke-width="9" stroke-linecap="round" vector-effect="non-scaling-stroke">' +
             '<title>' + esc(m) + ': ' + fmtNum(v) + ' TN</title></line>';
    }).join('');
    return '<div class="g-evo-row">' +
      '<div class="g-evo-prov">' + esc(p) + '</div>' +
      '<svg class="g-evo-svg" viewBox="0 0 100 26" preserveAspectRatio="none">' +
        '<polyline points="' + pts + '" fill="none" stroke="#d8dce6" stroke-width="1.5" vector-effect="non-scaling-stroke"/>' +
        dots +
      '</svg>' +
    '</div>';
  }).join('');

  // Leyenda: qué mes es cada color de punto
  const leyenda = meses.map(function(m, i) {
    return '<span class="g-ley-item">' +
      '<span class="g-ley-chip" style="border-radius:50%;background:' + gColorPunto(i, meses.length) + '"></span>' +
      esc(m) + '</span>';
  }).join('');

  return '<div class="g-evo">' + filas + '</div>' +
         '<div class="g-ley">' + leyenda + '</div>';
}

// ── TN Recuperadas por material ─────────────────────────────
// Valor = total TN del filtro actual. Flecha = último mes con datos
// comparado con el mes anterior (si hay al menos dos meses).
function gMateriales(distribucion, porProvMesMat, meses) {
  const totalMes = function(mes, mat) {
    let t = 0;
    Object.keys(porProvMesMat).forEach(function(p) {
      const mm = porProvMesMat[p][mes];
      if (mm && mm[mat]) t += mm[mat];
    });
    return t;
  };

  const ult  = meses.length ? meses[meses.length - 1] : null;
  const prev = meses.length > 1 ? meses[meses.length - 2] : null;

  const items = [];
  let otros = 0, otrosUlt = 0, otrosPrev = 0;

  Object.keys(distribucion).forEach(function(nombre) {
    const val = distribucion[nombre];
    if (!(val > 0)) return;
    const vUlt  = ult  ? totalMes(ult,  nombre) : 0;
    const vPrev = prev ? totalMes(prev, nombre) : 0;
    if (MATS_FILTRO_ACTIVOS.includes(nombre)) {
      items.push({ nombre: G_MAT_CORTO[nombre] || nombre, val: val, ult: vUlt, prev: vPrev });
    } else {
      otros += val; otrosUlt += vUlt; otrosPrev += vPrev;
    }
  });

  items.sort(function(a, b) { return b.val - a.val; });
  if (otros > 0) items.push({ nombre: 'Otros materiales', val: otros, ult: otrosUlt, prev: otrosPrev });

  if (!items.length) {
    return '<div class="empty-state"><p>Sin materiales con datos para este filtro</p></div>';
  }

  const filas = items.map(function(it) {
    let cls = 'flat', ico = '', tip = 'Sin mes anterior para comparar';
    if (prev) {
      if (it.ult > it.prev)      { cls = 'up';   ico = icoHTML('triUp');   tip = 'Subió vs ' + prev; }
      else if (it.ult < it.prev) { cls = 'down'; ico = icoHTML('triDown'); tip = 'Bajó vs ' + prev; }
      else                       { tip = 'Sin cambio vs ' + prev; }
    }
    return '<div class="g-mat">' +
      '<span class="g-mat-nom">' + esc(it.nombre) + '</span>' +
      '<span class="g-mat-badge ' + cls + '" title="' + esc(tip) + '">' + ico + fmtNum(it.val) + ' TN</span>' +
    '</div>';
  }).join('');

  return '<div class="g-mats">' + filas + '</div>';
}

// ============================================================
// SELECTOR DE MATERIAL (gráfico "Evolución por Material")
// ============================================================

function abrirSelectorMaterialEvolucion() {
  const mats = (CAT.materiales || []).length
    ? CAT.materiales.map(function(m) { return m['Nombre']; })
    : ['PET','Plástico Duro','Plástico Suave','Cartón','Lata Aluminio','Vidrio'];

  const opts = mats.map(function(m) {
    return '<label class="filter-opt">' +
      '<input type="radio" name="mat-evo" value="' + esc(m) + '" ' + (m === MATERIAL_EVOLUCION ? 'checked' : '') + '>' +
      '<span>' + esc(m) + '</span></label>';
  }).join('');

  abrirModal(
    '<div class="modal" style="max-width:420px">' +
      '<div class="modal-head">' +
        '<div><div class="modal-title">Evolución por material</div><div class="modal-sub">Elige el material a mostrar en la gráfica</div></div>' +
        '<button class="modal-close" onclick="cerrarModal()"></button>' +
      '</div>' +
      '<div class="modal-body"><div id="mat-evo-opts">' + opts + '</div></div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="aplicarMaterialEvolucion()">Aplicar</button>' +
      '</div>' +
    '</div>'
  );
}

function aplicarMaterialEvolucion() {
  const sel = document.querySelector('#mat-evo-opts input[name=mat-evo]:checked');
  if (sel) MATERIAL_EVOLUCION = sel.value;
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
