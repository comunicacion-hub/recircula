// ============================================================
// RECIRCULA 360 — precios.js
// Sección: Variación de Precios por Provincia
// Muestra min/máx/promedio de precio por material, provincia y mes
// Materiales por defecto: PET, Plástico Suave, Plástico Duro
// ============================================================

const PRECIOS = (() => {

  // ── Materiales disponibles ──────────────────────────────────
  const MATERIALES_TODOS = [
    { key: 'PET',           label: 'PET' },
    { key: 'Plastico_Suave', label: 'Plástico Suave' },
    { key: 'Plastico_Duro',  label: 'Plástico Duro' },
    { key: 'Carton',         label: 'Cartón' },
    { key: 'Papel',          label: 'Papel' },
    { key: 'Lata_Aluminio',  label: 'Lata Aluminio' },
    { key: 'Vidrio',         label: 'Vidrio' },
    { key: 'Chatarra',       label: 'Chatarra' },
    { key: 'Aceite',         label: 'Aceite' },
    { key: 'Electronico',    label: 'Electrónico' },
    { key: 'Ropa',           label: 'Ropa' },
    { key: 'Madera',         label: 'Madera' },
  ];

  const MATERIALES_DEFAULT = ['PET', 'Plastico_Suave', 'Plastico_Duro'];

  // Meses en español para display
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Paleta para las provincias (cicla si hay más de 8)
  const COLORES = [
    '#0778bf','#5bbd70','#F5AD21','#F82D72','#506CFF',
    '#18AE97','#FF751F','#9FDA60','#86d2da','#FF376F'
  ];

  // Estado local
  let _datos = [];          // rows procesadas: { provincia, año, mes, material, precio }
  let _años = [];
  let _provincias = [];
  let _matSel = [...MATERIALES_DEFAULT];
  let _añoSel = '';
  let _provSel = 'TODAS';
  let _matGrafico = 'PET'; // material activo en gráfico de línea

  // ── Inicializar sección ────────────────────────────────────
  async function init() {
    _render('<p class="p-loading">Cargando datos…</p>');
    try {
      await _cargarDatos();
      _renderUI();
    } catch (e) {
      console.error('precios.js init:', e);
      _render('<p class="p-loading" style="color:#F82D72">Error al cargar datos. Verifica la conexión.</p>');
    }
  }

  // ── Cargar y procesar datos ────────────────────────────────
  async function _cargarDatos() {
    const { db, collection, getDocs } = window.fb;

    // Cargar Asociaciones para tener Provincia
    const snapAsoc = await getDocs(collection(db, 'Asoc_Ambiente'));
    const mapAsoc = {}; // id → provincia
    snapAsoc.forEach(d => {
      const a = d.data();
      mapAsoc[d.id] = a.Provincia || a.provincia || '—';
    });

    // Cargar Entregas
    const snapEnt = await getDocs(collection(db, 'Entregas'));
    const rows = [];

    snapEnt.forEach(d => {
      const e = d.data();
      const fecha = e.Fecha || e.fecha || '';
      if (!fecha) return;

      const partes = fecha.split('-');
      if (partes.length < 2) return;
      const año  = parseInt(partes[0], 10);
      const mes  = parseInt(partes[1], 10) - 1; // 0-index

      const idAsoc   = e.ID_Asociacion || e.id_asociacion || '';
      const provincia = mapAsoc[idAsoc] || '—';

      // Extraer precio de cada material
      MATERIALES_TODOS.forEach(({ key }) => {
        // Intentamos variantes de nombre de campo
        const precioRaw =
          e[`${key}_Precio`]      ??
          e[`${key} Precio`]      ??
          e[key + '_precio']      ??
          null;

        const precio = parseFloat(precioRaw);
        if (!isNaN(precio) && precio > 0) {
          rows.push({ provincia, año, mes, material: key, precio });
        }
      });
    });

    _datos = rows;

    // Años y provincias únicos
    _años = [...new Set(rows.map(r => r.año))].sort((a, b) => b - a);
    _provincias = [...new Set(rows.map(r => r.provincia))].filter(p => p !== '—').sort();

    if (_años.length && !_añoSel) _añoSel = _años[0];
  }

  // ── Calcular estadísticas ──────────────────────────────────
  // Retorna: { [provincia]: { [mes]: { min, max, avg, n } } }
  function _calcStats(material) {
    const filtrado = _datos.filter(r => {
      if (r.material !== material) return false;
      if (r.año !== _añoSel) return false;
      if (_provSel !== 'TODAS' && r.provincia !== _provSel) return false;
      return true;
    });

    const mapa = {}; // provincia → mes → [precios]
    filtrado.forEach(({ provincia, mes, precio }) => {
      if (!mapa[provincia]) mapa[provincia] = {};
      if (!mapa[provincia][mes]) mapa[provincia][mes] = [];
      mapa[provincia][mes].push(precio);
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

  // ── Calcular tabla resumen comparativa ─────────────────────
  // Retorna filas: { provincia, material, meses: [{ mes, avg }], tendencia }
  function _calcResumen() {
    const matsFiltradas = _matSel.length ? _matSel : MATERIALES_DEFAULT;
    const rows = [];

    matsFiltradas.forEach(mat => {
      const stats = _calcStats(mat);
      const provs = _provSel === 'TODAS' ? Object.keys(stats) : [_provSel].filter(p => stats[p]);

      provs.forEach(prov => {
        const mesesData = Array.from({ length: 12 }, (_, i) => ({
          mes: i,
          avg: stats[prov][i]?.avg ?? null,
          min: stats[prov][i]?.min ?? null,
          max: stats[prov][i]?.max ?? null,
        }));

        // Tendencia: diferencia entre último y primer mes con dato
        const conDato = mesesData.filter(m => m.avg !== null);
        let tendencia = 0;
        if (conDato.length >= 2) {
          tendencia = conDato[conDato.length - 1].avg - conDato[0].avg;
        }

        rows.push({ provincia: prov, material: mat, meses: mesesData, tendencia });
      });
    });

    return rows;
  }

  // ── Render principal ───────────────────────────────────────
  function _renderUI() {
    const html = `
      <div class="precios-wrap">

        <!-- Filtros -->
        <div class="precios-filtros card-section">
          <div class="filtro-grupo">
            <label>Año</label>
            <select id="pr-año" onchange="PRECIOS._onFiltro()">
              ${_años.map(a => `<option value="${a}" ${a===_añoSel?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
          <div class="filtro-grupo">
            <label>Provincia</label>
            <select id="pr-prov" onchange="PRECIOS._onFiltro()">
              <option value="TODAS">Todas</option>
              ${_provincias.map(p => `<option value="${p}" ${p===_provSel?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="filtro-grupo filtro-materiales">
            <label>Materiales</label>
            <div class="mat-checkboxes">
              ${MATERIALES_TODOS.map(m => `
                <label class="mat-chip ${_matSel.includes(m.key)?'active':''}">
                  <input type="checkbox" value="${m.key}" ${_matSel.includes(m.key)?'checked':''} onchange="PRECIOS._onMatCheck(this)">
                  ${m.label}
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Gráfico de línea por mes -->
        <div class="card-section precios-chart-wrap">
          <div class="section-header-row">
            <h3>Evolución mensual — precio promedio ($/kg)</h3>
            <div class="chart-mat-tabs">
              ${_matSel.map(k => {
                const lbl = MATERIALES_TODOS.find(m=>m.key===k)?.label || k;
                return `<button class="mat-tab ${k===_matGrafico?'active':''}" onclick="PRECIOS._onTabMat('${k}')">${lbl}</button>`;
              }).join('')}
            </div>
          </div>
          <div id="pr-chart-container">
            ${_buildLineChart()}
          </div>
        </div>

        <!-- Tabla comparativa -->
        <div class="card-section">
          <h3>Comparativa por provincia</h3>
          <div class="precios-table-scroll">
            ${_buildTabla()}
          </div>
        </div>

      </div>
    `;
    _render(html);
  }

  // ── Gráfico SVG de líneas ──────────────────────────────────
  function _buildLineChart() {
    const stats   = _calcStats(_matGrafico);
    const provs   = _provSel === 'TODAS' ? Object.keys(stats) : [_provSel].filter(p => stats[p]);

    if (!provs.length) return '<p class="p-empty">Sin datos para este filtro.</p>';

    const W = 680, H = 240, PAD = { t: 20, r: 20, b: 40, l: 52 };
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;

    // Todos los promedios para escala
    let allAvgs = [];
    provs.forEach(p => {
      Object.values(stats[p]).forEach(s => allAvgs.push(s.avg));
    });
    if (!allAvgs.length) return '<p class="p-empty">Sin datos para este filtro.</p>';

    const yMin = Math.max(0, Math.min(...allAvgs) * 0.85);
    const yMax = Math.max(...allAvgs) * 1.1;

    const xScale = m => PAD.l + (m / 11) * innerW;
    const yScale = v => PAD.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

    // Ticks Y
    const yTicks = 4;
    const tickLines = Array.from({ length: yTicks + 1 }, (_, i) => {
      const v = yMin + (i / yTicks) * (yMax - yMin);
      const y = yScale(v);
      return `
        <line x1="${PAD.l}" y1="${y}" x2="${PAD.l + innerW}" y2="${y}" stroke="rgba(0,35,67,0.08)" stroke-width="1"/>
        <text x="${PAD.l - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#666">${v.toFixed(2)}</text>
      `;
    }).join('');

    // Etiquetas X
    const xLabels = MESES.map((m, i) => `
      <text x="${xScale(i)}" y="${PAD.t + innerH + 16}" text-anchor="middle" font-size="10" fill="#666">${m}</text>
    `).join('');

    // Líneas por provincia
    const lineas = provs.map((prov, idx) => {
      const color = COLORES[idx % COLORES.length];
      const puntos = Array.from({ length: 12 }, (_, m) => {
        const s = stats[prov][m];
        return s ? { x: xScale(m), y: yScale(s.avg), min: s.min, max: s.max, avg: s.avg, m } : null;
      }).filter(Boolean);

      if (!puntos.length) return '';

      const path = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      // Banda min-max
      const bandaTop = puntos.map((p, i) => `${i===0?'M':'L'} ${p.x} ${yScale(p.min)}`).join(' ');
      const bandaBot = [...puntos].reverse().map((p, i) => `${i===0?'L':'L'} ${p.x} ${yScale(p.max)}`).join(' ');

      const dots = puntos.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5">
          <title>${prov} — ${MESES[p.m]}: Prom $${p.avg} | Min $${p.min} | Máx $${p.max}</title>
        </circle>
      `).join('');

      return `
        <path d="${bandaTop} ${bandaBot} Z" fill="${color}" fill-opacity="0.08"/>
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
        ${dots}
      `;
    }).join('');

    // Leyenda
    const leyenda = provs.map((prov, idx) => {
      const color = COLORES[idx % COLORES.length];
      const offsetX = PAD.l + (idx * 120);
      return `
        <rect x="${offsetX}" y="${H - 12}" width="10" height="3" rx="1.5" fill="${color}"/>
        <text x="${offsetX + 14}" y="${H - 8}" font-size="10" fill="#333">${prov}</text>
      `;
    }).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px">
        ${tickLines}
        ${xLabels}
        ${lineas}
        ${leyenda}
      </svg>
    `;
  }

  // ── Tabla comparativa ──────────────────────────────────────
  function _buildTabla() {
    const resumen = _calcResumen();
    if (!resumen.length) return '<p class="p-empty">Sin datos para este filtro.</p>';

    const colMeses = MESES.map((m, i) => `<th>${m}</th>`).join('');

    const filas = resumen.map(({ provincia, material, meses, tendencia }) => {
      const matLabel = MATERIALES_TODOS.find(m => m.key === material)?.label || material;
      const celdas = meses.map(({ avg, min, max }) => {
        if (avg === null) return '<td class="sin-dato">—</td>';
        return `
          <td class="celda-precio" title="Min $${min} | Máx $${max}">
            <span class="avg">$${avg}</span>
            <span class="rango">${min}–${max}</span>
          </td>
        `;
      }).join('');

      const tendIcon = tendencia > 0
        ? `<span class="tend tend-up">▲ $${tendencia.toFixed(3)}</span>`
        : tendencia < 0
        ? `<span class="tend tend-down">▼ $${Math.abs(tendencia).toFixed(3)}</span>`
        : `<span class="tend tend-flat">= estable</span>`;

      return `
        <tr>
          <td class="td-prov">${provincia}</td>
          <td class="td-mat">${matLabel}</td>
          ${celdas}
          <td class="td-tend">${tendIcon}</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="precios-tabla">
        <thead>
          <tr>
            <th>Provincia</th>
            <th>Material</th>
            ${colMeses}
            <th>Tendencia</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    `;
  }

  // ── Eventos ────────────────────────────────────────────────
  function _onFiltro() {
    _añoSel  = +document.getElementById('pr-año').value;
    _provSel = document.getElementById('pr-prov').value;
    // Asegurar que _matGrafico siga siendo válido
    if (!_matSel.includes(_matGrafico) && _matSel.length) _matGrafico = _matSel[0];
    _renderUI();
  }

  function _onMatCheck(el) {
    const key = el.value;
    if (el.checked) {
      if (!_matSel.includes(key)) _matSel.push(key);
    } else {
      _matSel = _matSel.filter(k => k !== key);
    }
    if (!_matSel.includes(_matGrafico) && _matSel.length) _matGrafico = _matSel[0];
    _renderUI();
  }

  function _onTabMat(key) {
    _matGrafico = key;
    // Solo re-render el gráfico para no perder scroll de tabla
    document.getElementById('pr-chart-container').innerHTML = _buildLineChart();
    document.querySelectorAll('.mat-tab').forEach(b => {
      b.classList.toggle('active', b.textContent.trim() === (MATERIALES_TODOS.find(m=>m.key===key)?.label||key));
    });
  }

  // ── Helper render ──────────────────────────────────────────
  function _render(html) {
    const el = document.getElementById('section-precios');
    if (el) el.innerHTML = html;
  }

  // API pública
  return { init, _onFiltro, _onMatCheck, _onTabMat };
})();

// ── Estilos propios de la sección ─────────────────────────────
(function _inyectarEstilos() {
  if (document.getElementById('precios-styles')) return;
  const s = document.createElement('style');
  s.id = 'precios-styles';
  s.textContent = `
    /* ── Contenedor principal ── */
    .precios-wrap { display:flex; flex-direction:column; gap:20px; }

    /* ── Card genérica ── */
    .card-section {
      background:#fff;
      border-radius:14px;
      padding:20px 24px;
      box-shadow:0 2px 12px rgba(0,35,67,.08);
    }
    .card-section h3 {
      font-size:15px; font-weight:600; color:#002343;
      margin:0 0 16px;
    }

    /* ── Filtros ── */
    .precios-filtros { display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start; }
    .filtro-grupo { display:flex; flex-direction:column; gap:6px; }
    .filtro-grupo label { font-size:12px; font-weight:600; color:#555; text-transform:uppercase; letter-spacing:.4px; }
    .filtro-grupo select {
      border:1.5px solid #86d2da; border-radius:10px;
      padding:7px 12px; font-size:14px; color:#002343;
      background:#fff; cursor:pointer; outline:none;
      font-family:inherit;
    }
    .filtro-materiales { flex:1; min-width:240px; }
    .mat-checkboxes { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }
    .mat-chip {
      display:flex; align-items:center; gap:5px;
      padding:5px 12px; border-radius:20px; font-size:13px;
      border:1.5px solid #86d2da; color:#002343; cursor:pointer;
      transition:all .18s; background:#fff;
    }
    .mat-chip input { display:none; }
    .mat-chip.active { background:#002343; color:#fff; border-color:#002343; }
    .mat-chip:hover { border-color:#0778bf; }

    /* ── Gráfico ── */
    .precios-chart-wrap {}
    .section-header-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
    .section-header-row h3 { margin:0; }
    .chart-mat-tabs { display:flex; gap:6px; flex-wrap:wrap; }
    .mat-tab {
      padding:5px 14px; border-radius:20px; font-size:13px; font-family:inherit;
      border:1.5px solid #86d2da; background:#fff; color:#002343; cursor:pointer;
      transition:all .18s;
    }
    .mat-tab.active { background:#0778bf; color:#fff; border-color:#0778bf; }
    .mat-tab:hover { border-color:#0778bf; }

    /* ── Tabla ── */
    .precios-table-scroll { overflow-x:auto; }
    .precios-tabla {
      border-collapse:collapse; width:100%; font-size:13px; min-width:700px;
    }
    .precios-tabla th {
      background:#002343; color:#fff;
      padding:8px 10px; text-align:center; font-weight:500; white-space:nowrap;
    }
    .precios-tabla th:first-child,
    .precios-tabla th:nth-child(2) { text-align:left; }
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
    .tend-up   { background:#edfbf0; color:#27a04a; }
    .tend-down { background:#fff0f3; color:#e0364c; }
    .tend-flat { background:#f5f5f5; color:#888; }

    /* ── Estados vacíos / carga ── */
    .p-loading, .p-empty {
      text-align:center; padding:40px 0; color:#888; font-size:14px;
    }
  `;
  document.head.appendChild(s);
})();
