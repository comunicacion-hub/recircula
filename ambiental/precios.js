// ============================================================
// RECIRCULA 360 — precios.js
// Sección: Variación de Precios por Provincia
// Min/máx/promedio de precio por material, provincia y mes.
// Consume CAT.entregas y CAT.materiales (ya cargados por app.js).
// Provincia = provincia de la asociación. Defaults = materiales priorizables.
// ============================================================

const PRECIOS = (() => {

  // Meses en español para display
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Paleta para las provincias (cicla si hay más de 10)
  const COLORES = [
    '#0778bf','#5bbd70','#F5AD21','#F82D72','#506CFF',
    '#18AE97','#FF751F','#9FDA60','#86d2da','#FF376F'
  ];

  // Estado
  let _datos = [];           // [{ provincia, anio, mes, material, precio }]
  let _materiales = [];      // [{ nombre, priorizable }] desde catálogo
  let _anios = [];
  let _provincias = [];
  let _matSel = [];          // nombres de material seleccionados
  let _anioSel = null;
  let _provSel = 'TODAS';
  let _matGrafico = null;    // nombre del material activo en el gráfico

  // ── Inicializar sección ────────────────────────────────────
  function init() {
    try {
      _procesar();
      if (!_datos.length) {
        _render('<div class="precios-wrap"><div class="card-section"><p class="p-empty">No hay entregas con precios cargados todavía.</p></div></div>');
        return;
      }
      _renderUI();
    } catch (e) {
      console.error('precios.js init:', e);
      _render('<div class="precios-wrap"><div class="card-section"><p class="p-empty" style="color:#F82D72">Ocurrió un error al preparar los datos.</p></div></div>');
    }
  }

  // Nombres prioritarios por defecto (PET / Plástico Suave / Plástico Duro),
  // comparados con normKey() para tolerar acentos y mayúsculas del catálogo.
  const PRIORIDAD_KEYS = ['pet', 'plastico_suave', 'plastico_duro'];

  // ── Procesar datos desde CAT (sin releer Firestore) ────────
  function _procesar() {
    // Todos los materiales del catálogo (mismo criterio que entregaFromFS, que
    // los recorre sin filtrar). El precio de cada material vive en la entrega
    // bajo la clave  "<Nombre> Precio"  que arma entregaFromFS.
    _materiales = (CAT.materiales || [])
      .map(m => ({ nombre: m['Nombre'], priorizable: m['Priorizable'] === true }))
      .filter(m => m.nombre);

    const rows = [];
    (CAT.entregas || []).forEach(e => {
      const fecha = e['Fecha'] || '';
      if (!/^\d{4}-\d{2}/.test(fecha)) return;        // necesitamos año-mes
      const anio = parseInt(fecha.slice(0, 4), 10);
      const mes  = parseInt(fecha.slice(5, 7), 10) - 1; // 0-index

      // Provincia de la asociación (con respaldos)
      const provincia = e['_provinciaAsociacion'] || e['Provincia'] || '—';

      _materiales.forEach(({ nombre }) => {
        const precio = parseFloat(e[nombre + ' Precio']);
        if (!isNaN(precio) && precio > 0) {
          rows.push({ provincia, anio, mes, material: nombre, precio });
        }
      });
    });

    _datos = rows;
    _anios = [...new Set(rows.map(r => r.anio))].sort((a, b) => b - a);
    _provincias = [...new Set(rows.map(r => r.provincia))].filter(p => p !== '—').sort();

    if (!_anioSel || !_anios.includes(_anioSel)) _anioSel = _anios[0] ?? null;

    // Selección inicial: priorizables con datos → si no, PET/Suave/Duro por
    // nombre → si no, los primeros 3 que tengan datos.
    if (!_matSel.length) {
      const conDatos = new Set(rows.map(r => r.material));
      const disponibles = _materiales.filter(m => conDatos.has(m.nombre));
      let def = disponibles.filter(m => m.priorizable).map(m => m.nombre);
      if (!def.length) def = disponibles.filter(m => PRIORIDAD_KEYS.includes(normKey(m.nombre))).map(m => m.nombre);
      if (!def.length) def = disponibles.slice(0, 3).map(m => m.nombre);
      _matSel = def;
    }
    if (!_matGrafico || !_matSel.includes(_matGrafico)) _matGrafico = _matSel[0] ?? null;
  }

  // ── Estadísticas para un material ──────────────────────────
  // { [provincia]: { [mes]: { min, max, avg, n } } }
  function _calcStats(material) {
    const filtrado = _datos.filter(r =>
      r.material === material &&
      r.anio === _anioSel &&
      (_provSel === 'TODAS' || r.provincia === _provSel)
    );

    const mapa = {};
    filtrado.forEach(({ provincia, mes, precio }) => {
      (mapa[provincia] = mapa[provincia] || {});
      (mapa[provincia][mes] = mapa[provincia][mes] || []).push(precio);
    });

    const stats = {};
    Object.entries(mapa).forEach(([prov, meses]) => {
      stats[prov] = {};
      Object.entries(meses).forEach(([m, precios]) => {
        const min = Math.min(...precios);
        const max = Math.max(...precios);
        const avg = precios.reduce((a, b) => a + b, 0) / precios.length;
        stats[prov][+m] = { min, max, avg: +avg.toFixed(3), n: precios.length };
      });
    });
    return stats;
  }

  // ── Filas para la tabla comparativa ────────────────────────
  function _calcResumen() {
    const mats = _matSel.length ? _matSel : _materiales.map(m => m.nombre);
    const rows = [];
    mats.forEach(mat => {
      const stats = _calcStats(mat);
      const provs = _provSel === 'TODAS' ? Object.keys(stats).sort() : [_provSel].filter(p => stats[p]);
      provs.forEach(prov => {
        const meses = Array.from({ length: 12 }, (_, i) => ({
          mes: i,
          avg: stats[prov][i]?.avg ?? null,
          min: stats[prov][i]?.min ?? null,
          max: stats[prov][i]?.max ?? null,
        }));
        const conDato = meses.filter(m => m.avg !== null);
        let tendencia = 0;
        if (conDato.length >= 2) tendencia = conDato[conDato.length - 1].avg - conDato[0].avg;
        rows.push({ provincia: prov, material: mat, meses, tendencia });
      });
    });
    return rows;
  }

  // ── Render principal ───────────────────────────────────────
  function _renderUI() {
    const html = `
      <div class="precios-wrap">

        <div class="precios-filtros card-section">
          <div class="filtro-grupo">
            <label>Año</label>
            <select id="pr-anio" onchange="PRECIOS._onFiltro()">
              ${_anios.map(a => `<option value="${a}" ${a===_anioSel?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
          <div class="filtro-grupo">
            <label>Provincia</label>
            <select id="pr-prov" onchange="PRECIOS._onFiltro()">
              <option value="TODAS">Todas</option>
              ${_provincias.map(p => `<option value="${esc(p)}" ${p===_provSel?'selected':''}>${esc(p)}</option>`).join('')}
            </select>
          </div>
          <div class="filtro-grupo filtro-materiales">
            <label>Materiales</label>
            <div class="mat-checkboxes">
              ${_materiales.map(m => `
                <label class="mat-chip ${_matSel.includes(m.nombre)?'active':''}">
                  <input type="checkbox" value="${esc(m.nombre)}" ${_matSel.includes(m.nombre)?'checked':''} onchange="PRECIOS._onMatCheck(this)">
                  ${esc(m.nombre)}
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="card-section precios-chart-wrap">
          <div class="section-header-row">
            <h3>Evolución mensual — precio promedio ($/kg)</h3>
            <div class="chart-mat-tabs">
              ${_matSel.map(nombre => `
                <button class="mat-tab ${nombre===_matGrafico?'active':''}" data-mat="${esc(nombre)}" onclick="PRECIOS._onTabMat('${jsEsc(nombre)}')">${esc(nombre)}</button>
              `).join('')}
            </div>
          </div>
          <div id="pr-chart-container">${_buildChart()}</div>
        </div>

        <div class="card-section">
          <h3>Comparativa por provincia</h3>
          <div class="precios-table-scroll">${_buildTabla()}</div>
        </div>

      </div>
    `;
    _render(html);
  }

  // ── Gráfico SVG de líneas + leyenda HTML ───────────────────
  function _buildChart() {
    if (!_matGrafico) return '<p class="p-empty">Seleccioná al menos un material.</p>';
    const stats = _calcStats(_matGrafico);
    const provs = _provSel === 'TODAS' ? Object.keys(stats).sort() : [_provSel].filter(p => stats[p]);
    if (!provs.length) return '<p class="p-empty">Sin datos para este filtro.</p>';

    let allAvgs = [];
    provs.forEach(p => Object.values(stats[p]).forEach(s => allAvgs.push(s.avg)));
    if (!allAvgs.length) return '<p class="p-empty">Sin datos para este filtro.</p>';

    const W = 680, H = 240, PAD = { t: 20, r: 20, b: 36, l: 56 };
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;

    const lo = Math.min(...allAvgs), hi = Math.max(...allAvgs);
    const yMin = Math.max(0, lo === hi ? lo * 0.9 : lo - (hi - lo) * 0.15);
    const yMax = lo === hi ? (hi * 1.1 || 1) : hi + (hi - lo) * 0.15;

    const xScale = m => PAD.l + (m / 11) * innerW;
    const yScale = v => PAD.t + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

    const yTicks = 4;
    const grid = Array.from({ length: yTicks + 1 }, (_, i) => {
      const v = yMin + (i / yTicks) * (yMax - yMin);
      const y = yScale(v);
      return `<line x1="${PAD.l}" y1="${y}" x2="${PAD.l+innerW}" y2="${y}" stroke="rgba(0,35,67,0.08)" stroke-width="1"/>
        <text x="${PAD.l-8}" y="${y+4}" text-anchor="end" font-size="10" fill="#888">$${v.toFixed(2)}</text>`;
    }).join('');

    const xLabels = MESES.map((m, i) =>
      `<text x="${xScale(i)}" y="${PAD.t+innerH+16}" text-anchor="middle" font-size="10" fill="#888">${m}</text>`
    ).join('');

    const lineas = provs.map((prov, idx) => {
      const color = COLORES[idx % COLORES.length];
      const pts = Array.from({ length: 12 }, (_, m) => {
        const s = stats[prov][m];
        return s ? { x: xScale(m), y: yScale(s.avg), min: s.min, max: s.max, avg: s.avg, m } : null;
      }).filter(Boolean);
      if (!pts.length) return '';

      const linePath = pts.map((p, i) => `${i===0?'M':'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      const bandTop  = pts.map((p, i) => `${i===0?'M':'L'} ${p.x.toFixed(1)} ${yScale(p.min).toFixed(1)}`).join(' ');
      const bandBot  = [...pts].reverse().map(p => `L ${p.x.toFixed(1)} ${yScale(p.max).toFixed(1)}`).join(' ');
      const dots = pts.map(p =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5">
          <title>${esc(prov)} — ${MESES[p.m]}: Prom $${p.avg} · Mín $${p.min} · Máx $${p.max} (n=${stats[prov][p.m].n})</title>
        </circle>`
      ).join('');

      return `<path d="${bandTop} ${bandBot} Z" fill="${color}" fill-opacity="0.07"/>
        <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
        ${dots}`;
    }).join('');

    const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;max-width:${W}px">
      ${grid}${xLabels}${lineas}
    </svg>`;

    const leyenda = `<div class="pr-legend">${
      provs.map((prov, idx) => `<span class="pr-legend-item"><i style="background:${COLORES[idx % COLORES.length]}"></i>${esc(prov)}</span>`).join('')
    }</div>`;

    return svg + leyenda;
  }

  // ── Tabla comparativa ──────────────────────────────────────
  function _buildTabla() {
    const resumen = _calcResumen();
    if (!resumen.length) return '<p class="p-empty">Sin datos para este filtro.</p>';
    const colMeses = MESES.map(m => `<th>${m}</th>`).join('');

    const filas = resumen.map(({ provincia, material, meses, tendencia }) => {
      const celdas = meses.map(({ avg, min, max }) => {
        if (avg === null) return '<td class="sin-dato">—</td>';
        return `<td class="celda-precio" title="Mín $${min} · Máx $${max}">
            <span class="avg">$${fmtNum(avg, 2)}</span>
            <span class="rango">${fmtNum(min, 2)}–${fmtNum(max, 2)}</span>
          </td>`;
      }).join('');

      const tend = tendencia > 0
        ? `<span class="tend tend-up">▲ $${fmtNum(tendencia, 2)}</span>`
        : tendencia < 0
        ? `<span class="tend tend-down">▼ $${fmtNum(Math.abs(tendencia), 2)}</span>`
        : `<span class="tend tend-flat">= estable</span>`;

      return `<tr>
          <td class="td-prov">${esc(provincia)}</td>
          <td class="td-mat">${esc(material)}</td>
          ${celdas}
          <td class="td-tend">${tend}</td>
        </tr>`;
    }).join('');

    return `<table class="precios-tabla">
        <thead><tr><th>Provincia</th><th>Material</th>${colMeses}<th>Tendencia</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>`;
  }

  // ── Eventos ────────────────────────────────────────────────
  function _onFiltro() {
    const a = document.getElementById('pr-anio');
    const p = document.getElementById('pr-prov');
    if (a) _anioSel = +a.value;
    if (p) _provSel = p.value;
    if (!_matSel.includes(_matGrafico) && _matSel.length) _matGrafico = _matSel[0];
    _renderUI();
  }

  function _onMatCheck(el) {
    const nombre = el.value;
    if (el.checked) { if (!_matSel.includes(nombre)) _matSel.push(nombre); }
    else { _matSel = _matSel.filter(n => n !== nombre); }
    if (!_matSel.includes(_matGrafico)) _matGrafico = _matSel[0] ?? null;
    _renderUI();
  }

  function _onTabMat(nombre) {
    _matGrafico = nombre;
    const cont = document.getElementById('pr-chart-container');
    if (cont) cont.innerHTML = _buildChart();
    document.querySelectorAll('.mat-tab').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-mat') === nombre);
    });
  }

  // ── Helper render → #main-content (igual que las demás secciones) ──
  function _render(html) {
    const el = document.getElementById('main-content');
    if (el) el.innerHTML = html;
  }

  return { init, _onFiltro, _onMatCheck, _onTabMat };
})();

// ── Estilos propios de la sección ─────────────────────────────
(function _inyectarEstilos() {
  if (document.getElementById('precios-styles')) return;
  const s = document.createElement('style');
  s.id = 'precios-styles';
  s.textContent = `
    .precios-wrap { display:flex; flex-direction:column; gap:20px; }
    .card-section { background:#fff; border-radius:14px; padding:20px 24px; box-shadow:0 2px 12px rgba(0,35,67,.08); }
    .card-section h3 { font-size:15px; font-weight:600; color:#002343; margin:0 0 16px; }

    .precios-filtros { display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start; }
    .filtro-grupo { display:flex; flex-direction:column; gap:6px; }
    .filtro-grupo label { font-size:12px; font-weight:600; color:#555; text-transform:uppercase; letter-spacing:.4px; }
    .filtro-grupo select { border:1.5px solid #86d2da; border-radius:10px; padding:7px 12px; font-size:14px; color:#002343; background:#fff; cursor:pointer; outline:none; font-family:inherit; }
    .filtro-materiales { flex:1; min-width:240px; }
    .mat-checkboxes { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }
    .mat-chip { display:flex; align-items:center; gap:5px; padding:5px 12px; border-radius:20px; font-size:13px; border:1.5px solid #86d2da; color:#002343; cursor:pointer; transition:all .18s; background:#fff; }
    .mat-chip input { display:none; }
    .mat-chip.active { background:#002343; color:#fff; border-color:#002343; }
    .mat-chip:hover { border-color:#0778bf; }

    .section-header-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
    .section-header-row h3 { margin:0; }
    .chart-mat-tabs { display:flex; gap:6px; flex-wrap:wrap; }
    .mat-tab { padding:5px 14px; border-radius:20px; font-size:13px; font-family:inherit; border:1.5px solid #86d2da; background:#fff; color:#002343; cursor:pointer; transition:all .18s; }
    .mat-tab.active { background:#0778bf; color:#fff; border-color:#0778bf; }
    .mat-tab:hover { border-color:#0778bf; }

    .pr-legend { display:flex; flex-wrap:wrap; gap:14px; justify-content:center; margin-top:10px; }
    .pr-legend-item { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#333; }
    .pr-legend-item i { width:12px; height:4px; border-radius:2px; display:inline-block; }

    .precios-table-scroll { overflow-x:auto; }
    .precios-tabla { border-collapse:collapse; width:100%; font-size:13px; min-width:760px; }
    .precios-tabla th { background:#002343; color:#fff; padding:8px 10px; text-align:center; font-weight:500; white-space:nowrap; }
    .precios-tabla th:first-child, .precios-tabla th:nth-child(2) { text-align:left; }
    .precios-tabla tr:nth-child(even) td { background:#f7fbff; }
    .precios-tabla tr:hover td { background:#edf5fb; }
    .precios-tabla td { padding:7px 10px; border-bottom:1px solid #e5eef5; vertical-align:middle; }
    .td-prov { font-weight:600; color:#002343; white-space:nowrap; }
    .td-mat { color:#0778bf; white-space:nowrap; }
    .celda-precio { text-align:center; }
    .celda-precio .avg { display:block; font-weight:600; color:#002343; font-size:13px; }
    .celda-precio .rango { display:block; font-size:10px; color:#888; margin-top:1px; }
    .sin-dato { text-align:center; color:#bbb; font-size:12px; }
    .td-tend { text-align:center; white-space:nowrap; }
    .tend { font-size:12px; font-weight:600; padding:3px 8px; border-radius:20px; }
    .tend-up { background:#edfbf0; color:#27a04a; }
    .tend-down { background:#fff0f3; color:#e0364c; }
    .tend-flat { background:#f5f5f5; color:#888; }

    .p-empty, .p-loading { text-align:center; padding:40px 0; color:#888; font-size:14px; }
  `;
  document.head.appendChild(s);
})();
