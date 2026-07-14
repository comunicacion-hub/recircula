// ============================================================
// RECIRCULA 360 — precios.js
// Sección: Variación de Precios por Provincia
// Consume CAT.entregas / CAT.materiales. Filtros en el drawer global.
// Lenguaje visual heredado de styles.css (gradientes A–E, .card, .table-wrap).
// ============================================================

const PRECIOS = (() => {

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // Meses que NO se muestran en Precios (0=Ene … 11=Dic). Oculta Enero–Abril
  // en gráfico, tabla, tarjetas, detalle y exportación (aunque estén vacíos).
  const PR_MESES_OCULTOS = [0, 1, 2, 3];
  const PR_MESES_VIS = Array.from({ length: 12 }, (_, i) => i)
    .filter(i => !PR_MESES_OCULTOS.includes(i));

  // Gradientes idénticos a styles.css (A–E). Stroke por url(#id); leyenda por var(--grad-*).
  const GRADS = [
    { id:'prGradB', from:'#33A8DE', to:'#506CFF', varName:'--grad-b' },
    { id:'prGradC', from:'#18AE97', to:'#0BC3FF', varName:'--grad-c' },
    { id:'prGradD', from:'#F5AD21', to:'#9FDA60', varName:'--grad-d' },
    { id:'prGradE', from:'#F82D72', to:'#FF85FF', varName:'--grad-e' },
    { id:'prGradA', from:'#FF751F', to:'#FF376F', varName:'--grad-a' },
  ];

  // Nombres prioritarios por defecto, comparados con normKey() (tolera acentos/mayúsculas)
  const PRIORIDAD_KEYS = ['pet', 'plastico_suave', 'plastico_duro'];

  // Íconos (trazo Outfit/Lucide, mismo estilo que el resto del shell)
  const ICO_FUNNEL   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>';
  const ICO_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

  // Estado
  let _datos = [];          // [{ provincia, anio, mes, material, precio }]
  let _materiales = [];     // [{ nombre, priorizable }]
  let _anios = [];
  let _provincias = [];
  let _matsActivos = [];    // materiales mostrados (derivado de _fMats)
  let _matGrafico = null;   // material activo en el gráfico

  // Filtros (seleccionados en el drawer)
  let _fAnios = [];
  let _fProvs = [];
  let _fMats  = [];

  // ── Init ───────────────────────────────────────────────────
  function init() {
    try {
      _procesar();
      if (!_datos.length) {
        _render(_header() + '<div class="card"><p class="pr-empty">No hay entregas con precios cargados todavía.</p></div>');
        return;
      }
      _registrarFiltros();
      _matsActivos = _resolverMats();
      if (!_matsActivos.includes(_matGrafico)) _matGrafico = _matsActivos[0] ?? null;
      _renderUI();
      if (typeof updateFilterBadge === 'function') updateFilterBadge('precios');
    } catch (e) {
      console.error('precios.js init:', e);
      _render(_header() + '<div class="card"><p class="pr-empty" style="color:var(--err)">Ocurrió un error al preparar los datos.</p></div>');
    }
  }

  // ── Procesar datos desde CAT (sin releer Firestore) ────────
  function _procesar() {
    _materiales = (CAT.materiales || [])
      .map(m => ({ nombre: m['Nombre'], priorizable: m['Priorizable'] === true }))
      .filter(m => m.nombre);

    const rows = [];
    (CAT.entregas || []).forEach(e => {
      // Mes = mes operativo del registro (campo Mes). NO se deriva de Fecha,
      // porque Fecha es la fecha de carga (puede caer en otro mes).
      const mes = _mesAIndice(e['Mes']);
      if (mes === null) return; // sin mes válido → se omite

      // Año operativo: parte de la Fecha de carga, pero si el mes operativo y
      // el mes de carga difieren por medio año o más, la carga cruzó el límite
      // de año (ej. diciembre cargado en enero) y se ajusta.
      let anio = null;
      const f = e['Fecha'] || '';
      if (/^\d{4}-\d{2}/.test(f)) {
        const uy = parseInt(f.slice(0, 4), 10);          // año de carga
        const um = parseInt(f.slice(5, 7), 10) - 1;      // mes de carga (0–11)
        anio = uy;
        const diff = mes - um;
        if (diff >= 6) anio = uy - 1;        // operativo muy adelante → carga rodó al año siguiente
        else if (diff <= -6) anio = uy + 1;  // operativo muy atrás → registro anticipado
      } else {
        const a = parseInt(e['Año'], 10);    // sin Fecha válida → campo Año tal cual
        if (!isNaN(a) && a >= 2000) anio = a;
      }
      if (anio === null || isNaN(anio)) return;

      const provincia = e['_provinciaAsociacion'] || e['Provincia'] || '—';
      _materiales.forEach(({ nombre }) => {
        const precio = parseFloat(e[nombre + ' Precio']);
        if (!isNaN(precio) && precio > 0) rows.push({ provincia, anio, mes, material: nombre, precio });
      });
    });

    _datos = rows;
    _anios = [...new Set(rows.map(r => r.anio))].sort((a, b) => b - a);
    _provincias = [...new Set(rows.map(r => r.provincia))].filter(p => p !== '—').sort();

    // Defaults (solo la primera vez)
    if (!_fAnios.length) _fAnios = _anios.length ? [String(_anios[0])] : [];
    if (!_fProvs.length) _fProvs = ['__ALL__'];
    if (!_fMats.length)  _fMats  = _matsPorDefecto();
    if (!_matGrafico) _matGrafico = _fMats.filter(m => m !== '__ALL__')[0] ?? null;
  }

  function _matsPorDefecto() {
    const conDatos = new Set(_datos.map(r => r.material));
    const disp = _materiales.filter(m => conDatos.has(m.nombre));
    let def = disp.filter(m => m.priorizable).map(m => m.nombre);
    if (!def.length) def = disp.filter(m => PRIORIDAD_KEYS.includes(normKey(m.nombre))).map(m => m.nombre);
    if (!def.length) def = disp.slice(0, 3).map(m => m.nombre);
    return def;
  }

  function _resolverMats() {
    const conDatos = new Set(_datos.map(r => r.material));
    let sel = _fMats.filter(m => m !== '__ALL__');
    if (!sel.length) sel = _materiales.map(m => m.nombre);
    return sel.filter(m => conDatos.has(m));
  }

  // Convierte el campo Mes a índice 0–11. Acepta número (4 / "04") o
  // nombre en español, completo o abreviado, tolerante a acentos y mayúsculas.
  function _mesAIndice(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    const txt = String(raw).trim();
    // Numérico: "4", "04", "4.0"
    if (/^\d{1,2}(\.0+)?$/.test(txt)) {
      const n = parseInt(txt, 10);
      return (n >= 1 && n <= 12) ? n - 1 : null;
    }
    // Nombre de mes (usa normKey global → minúsculas sin acentos)
    const NOMBRES = {
      enero: 0, ene: 0,
      febrero: 1, feb: 1,
      marzo: 2, mar: 2,
      abril: 3, abr: 3,
      mayo: 4, may: 4,
      junio: 5, jun: 5,
      julio: 6, jul: 6,
      agosto: 7, ago: 7,
      septiembre: 8, setiembre: 8, sep: 8, sept: 8, set: 8,
      octubre: 9, oct: 9,
      noviembre: 10, nov: 10,
      diciembre: 11, dic: 11,
    };
    const k = normKey(txt);
    return (k in NOMBRES) ? NOMBRES[k] : null;
  }

  // ── Filtros en el drawer global ────────────────────────────
  function _registrarFiltros() {
    if (typeof registerFilterConfig !== 'function') return;
    const conDatos = new Set(_datos.map(r => r.material));
    registerFilterConfig('precios', {
      badgeId: 'pr-filter-badge',
      sections: [
        { key: 'anio', title: 'Año',       type: 'options', options: _anios.map(a => ({ val: String(a), lbl: String(a) })) },
        { key: 'prov', title: 'Provincia', type: 'options', options: _provincias.map(p => ({ val: p, lbl: p })) },
        { key: 'mat',  title: 'Material',  type: 'options', options: _materiales.filter(m => conDatos.has(m.nombre)).map(m => ({ val: m.nombre, lbl: m.nombre })) },
      ],
      getValue: (k) => k === 'anio' ? _fAnios : k === 'prov' ? _fProvs : _fMats,
      setValue: (k, v) => { if (k === 'anio') _fAnios = v; else if (k === 'prov') _fProvs = v; else _fMats = v; },
      apply: _aplicarFiltros,
    });
  }

  function _aplicarFiltros() {
    _matsActivos = _resolverMats();
    if (!_matsActivos.includes(_matGrafico)) _matGrafico = _matsActivos[0] ?? null;
    const t = document.getElementById('pr-mat-tabs');     if (t) t.innerHTML = _buildTabs();
    const c = document.getElementById('pr-chart-container'); if (c) c.innerHTML = _buildChart();
    const k = document.getElementById('pr-comparativa');  if (k) k.innerHTML = _buildComparativa();
  }

  // ── Estadísticas (respeta filtros vía pasaFiltro) ──────────
  function _calcStats(material) {
    const filtrado = _datos.filter(r =>
      r.material === material &&
      pasaFiltro(_fAnios, String(r.anio)) &&
      pasaFiltro(_fProvs, r.provincia)
    );
    const mapa = {};
    filtrado.forEach(({ provincia, mes, precio }) => {
      (mapa[provincia] = mapa[provincia] || {});
      (mapa[provincia][mes] = mapa[provincia][mes] || []).push(precio);
    });
    const stats = {};
    Object.entries(mapa).forEach(([prov, meses]) => {
      stats[prov] = {};
      Object.entries(meses).forEach(([m, ps]) => {
        const min = Math.min(...ps), max = Math.max(...ps);
        const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
        stats[prov][+m] = { min, max, avg: +avg.toFixed(3), n: ps.length };
      });
    });
    return stats;
  }

  function _calcResumen() {
    const rows = [];
    _matsActivos.forEach(mat => {
      const stats = _calcStats(mat);
      const provs = Object.keys(stats).sort((a, b) => _provincias.indexOf(a) - _provincias.indexOf(b));
      provs.forEach(prov => {
        const meses = Array.from({ length: 12 }, (_, i) => ({
          mes: i, avg: stats[prov][i]?.avg ?? null, min: stats[prov][i]?.min ?? null, max: stats[prov][i]?.max ?? null,
        }));
        const conDato = PR_MESES_VIS.map(i => meses[i]).filter(m => m.avg !== null);
        let tendencia = 0;
        if (conDato.length >= 2) tendencia = conDato[conDato.length - 1].avg - conDato[0].avg;
        rows.push({ provincia: prov, material: mat, meses, tendencia });
      });
    });
    return rows;
  }

  // ── Header (page-header + acciones) ────────────────────────
  function _header() {
    return `
      <div class="page-header">
        <div>
          <div class="page-title">Precios</div>
          <div class="page-sub">Variación por provincia</div>
        </div>
        <div class="hdr-actions">
          <button class="hdr-circle" onclick="openFilterDrawer('precios')" title="Filtros" aria-label="Filtros">
            ${ICO_FUNNEL}<span class="filter-badge" id="pr-filter-badge" style="display:none"></span>
          </button>
          <button class="hdr-circle" onclick="PRECIOS._exportar()" title="Descargar Excel" aria-label="Descargar Excel">
            ${ICO_DOWNLOAD}
          </button>
        </div>
      </div>`;
  }

  function _renderUI() {
    _render(`
      ${_header()}
      <div class="card">
        <div class="card-title">
          <span>Evolución mensual · $/kg</span>
          <div class="cat-chips pr-tabs" id="pr-mat-tabs">${_buildTabs()}</div>
        </div>
        <div id="pr-chart-container">${_buildChart()}</div>
      </div>
      <div id="pr-comparativa">${_buildComparativa()}</div>
    `);
  }

  // ── Tabs de material (estilo .cat-chip del dashboard) ──────
  function _buildTabs() {
    if (!_matsActivos.length) return '';
    return _matsActivos.map(nombre =>
      `<button class="cat-chip ${nombre === _matGrafico ? 'active' : ''}" data-mat="${esc(nombre)}" onclick="PRECIOS._onTabMat('${jsEsc(nombre)}')">${esc(nombre)}</button>`
    ).join('');
  }

  // ── Gráfico SVG (gradientes A–E + leyenda) ─────────────────
  function _buildChart() {
    if (!_matGrafico) return '<p class="pr-empty">Seleccioná al menos un material.</p>';
    const stats = _calcStats(_matGrafico);
    const provs = Object.keys(stats).sort((a, b) => _provincias.indexOf(a) - _provincias.indexOf(b));
    if (!provs.length) return '<p class="pr-empty">Sin datos para este filtro.</p>';

    let allAvgs = [];
    provs.forEach(p => Object.values(stats[p]).forEach(s => allAvgs.push(s.avg)));
    if (!allAvgs.length) return '<p class="pr-empty">Sin datos para este filtro.</p>';

    const W = 720, H = 260, PAD = { t: 18, r: 18, b: 34, l: 58 };
    const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
    const lo = Math.min(...allAvgs), hi = Math.max(...allAvgs);
    const yMin = Math.max(0, lo === hi ? lo * 0.9 : lo - (hi - lo) * 0.15);
    const yMax = lo === hi ? (hi * 1.1 || 1) : hi + (hi - lo) * 0.15;
    const nVis = PR_MESES_VIS.length;
    const xS = pos => PAD.l + (nVis > 1 ? (pos / (nVis - 1)) : 0.5) * innerW;
    const yS = v => PAD.t + innerH - ((v - yMin) / ((yMax - yMin) || 1)) * innerH;

    const defs = `<defs>${GRADS.map(g =>
      `<linearGradient id="${g.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${g.from}"/><stop offset="100%" stop-color="${g.to}"/></linearGradient>`
    ).join('')}</defs>`;

    const grid = Array.from({ length: 5 }, (_, i) => {
      const v = yMin + (i / 4) * (yMax - yMin), y = yS(v);
      return `<line x1="${PAD.l}" y1="${y}" x2="${PAD.l + innerW}" y2="${y}" stroke="rgba(0,0,0,0.06)"/>
        <text x="${PAD.l - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#a0a0b0">$${v.toFixed(2)}</text>`;
    }).join('');

    const xLab = PR_MESES_VIS.map((mi, pos) =>
      `<text x="${xS(pos)}" y="${PAD.t + innerH + 18}" text-anchor="middle" font-size="11" fill="#a0a0b0">${MESES[mi]}</text>`
    ).join('');

    const lines = provs.map(prov => {
      const gi = _provincias.indexOf(prov);
      const g = GRADS[(gi < 0 ? 0 : gi) % GRADS.length];
      const pts = PR_MESES_VIS.map((mi, pos) => {
        const s = stats[prov][mi];
        return s ? { x: xS(pos), y: yS(s.avg), s, m: mi } : null;
      }).filter(Boolean);
      if (!pts.length) return '';
      const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      const top  = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${yS(p.s.min).toFixed(1)}`).join(' ');
      const bot  = [...pts].reverse().map(p => `L ${p.x.toFixed(1)} ${yS(p.s.max).toFixed(1)}`).join(' ');
      const dots = pts.map(p =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="url(#${g.id})" stroke="#fff" stroke-width="1.5">
          <title>${esc(prov)} — ${MESES[p.m]}: Prom $${p.s.avg} · Mín $${p.s.min} · Máx $${p.s.max} (n=${p.s.n})</title>
        </circle>`
      ).join('');
      return `<path d="${top} ${bot} Z" fill="url(#${g.id})" fill-opacity="0.08"/>
        <path d="${line}" fill="none" stroke="url(#${g.id})" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}`;
    }).join('');

    const svg = `<svg class="pr-chart-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${defs}${grid}${xLab}${lines}</svg>`;
    const leg = `<div class="pr-legend">${provs.map(prov => {
      const gi = _provincias.indexOf(prov);
      const g = GRADS[(gi < 0 ? 0 : gi) % GRADS.length];
      return `<span class="pr-legend-item"><i style="background:var(${g.varName})"></i>${esc(prov)}</span>`;
    }).join('')}</div>`;
    return svg + leg;
  }

  // ── Tabla comparativa (estilo .table-wrap del dashboard) ───
  function _tendBadge(t) {
    return t > 0 ? `<span class="pr-tend pr-tend-up">▲ $${fmtNum(t, 2)}</span>`
         : t < 0 ? `<span class="pr-tend pr-tend-down">▼ $${fmtNum(Math.abs(t), 2)}</span>`
         : `<span class="pr-tend pr-tend-flat">estable</span>`;
  }

  function _buildComparativa() {
    const head = `<div class="pr-heading">Comparativa por provincia</div>`;
    const resumen = _calcResumen();
    if (!resumen.length) return head + '<div class="card"><p class="pr-empty">Sin datos para este filtro.</p></div>';

    // DESKTOP: tabla ancha (solo meses visibles)
    const ths = PR_MESES_VIS.map(i => `<th>${MESES[i]}</th>`).join('');
    const filas = resumen.map(({ provincia, material, meses, tendencia }) => {
      const cels = PR_MESES_VIS.map(i => meses[i]).map(({ avg, min, max }) =>
        avg === null
          ? `<td class="pr-dash">—</td>`
          : `<td title="Mín $${min} · Máx $${max}"><span class="pr-avg">$${fmtNum(avg, 2)}</span><span class="pr-range">${fmtNum(min, 2)}–${fmtNum(max, 2)}</span></td>`
      ).join('');
      return `<tr>
        <td class="pr-prov">${esc(provincia)}</td>
        <td class="pr-mat">${esc(material)}</td>
        ${cels}
        <td>${_tendBadge(tendencia)}</td>
      </tr>`;
    }).join('');
    const tabla = `<div class="table-wrap pr-tabla-desktop"><table>
      <thead><tr><th>Provincia</th><th>Material</th>${ths}<th>Tendencia</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>`;

    // MÓVIL: tarjetas resumen (tocar → detalle mensual completo)
    const cards = resumen.map(({ provincia, material, meses, tendencia }) => {
      const conDato = PR_MESES_VIS.map(i => meses[i]).filter(m => m.avg !== null);
      const ultimo = conDato.length ? conDato[conDato.length - 1] : null;
      const resumenTxt = ultimo
        ? `Último: $${fmtNum(ultimo.avg, 2)} · ${conDato.length} ${conDato.length === 1 ? 'mes' : 'meses'} con dato`
        : 'Sin datos en el período';
      return `<div class="pr-card" onclick="PRECIOS._verDetalle('${jsEsc(provincia)}','${jsEsc(material)}')">
        <div class="pr-card-top">
          <div>
            <div class="pr-card-label">Provincia</div>
            <div class="pr-card-prov">${esc(provincia)}</div>
          </div>
          ${_tendBadge(tendencia)}
        </div>
        <div class="pr-card-mat">${esc(material)}</div>
        <div class="pr-card-foot">
          <span class="pr-card-hint">${resumenTxt}</span>
          <span class="pr-card-chev">Ver detalle ›</span>
        </div>
      </div>`;
    }).join('');
    const cardsWrap = `<div class="pr-cards-mobile">${cards}</div>`;

    return head + tabla + cardsWrap;
  }

  // Detalle mensual completo de una provincia+material (modal en móvil)
  function _verDetalle(prov, mat) {
    if (typeof abrirModal !== 'function') return;
    const s = _calcStats(mat)[prov] || {};
    const anioTxt = _fAnios.filter(a => a !== '__ALL__').join(', ') || 'Todos los años';
    const filas = PR_MESES_VIS.map(i => {
      const d = s[i];
      return d
        ? `<div class="pr-det-row"><span class="pr-det-mes">${MESES_FULL[i]}</span><span class="pr-det-val"><b>$${fmtNum(d.avg, 2)}</b><small>${fmtNum(d.min, 2)}–${fmtNum(d.max, 2)} · n=${d.n}</small></span></div>`
        : `<div class="pr-det-row pr-det-empty"><span class="pr-det-mes">${MESES_FULL[i]}</span><span class="pr-dash">—</span></div>`;
    }).join('');
    const conDato = PR_MESES_VIS.map(i => s[i]?.avg).filter(v => v != null);
    let tend = 0;
    if (conDato.length >= 2) tend = +(conDato[conDato.length - 1] - conDato[0]).toFixed(3);
    abrirModal(`
      <div class="modal">
        <div class="modal-head">
          <div>
            <div class="modal-title">${esc(mat)}</div>
            <div class="modal-sub">${esc(prov)} · ${esc(anioTxt)}</div>
          </div>
          <button class="modal-close" onclick="cerrarModal()"></button>
        </div>
        <div class="modal-body">
          <div class="pr-det-tend">Tendencia ${_tendBadge(tend)}</div>
          <div class="pr-detalle">${filas}</div>
        </div>
      </div>`);
  }

  // ── Eventos ────────────────────────────────────────────────
  function _onTabMat(nombre) {
    _matGrafico = nombre;
    const c = document.getElementById('pr-chart-container');
    if (c) c.innerHTML = _buildChart();
    document.querySelectorAll('#pr-mat-tabs .cat-chip').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-mat') === nombre)
    );
  }

  // ── Exportar Excel (tabla comparativa, respeta filtros) ────
  async function _exportar() {
    const resumen = _calcResumen();
    if (!resumen.length) { if (typeof showToast === 'function') showToast('No hay datos para exportar'); return; }
    try {
      if (typeof cargarSheetJS === 'function') await cargarSheetJS();
      if (!window.XLSX) { if (typeof showToast === 'function') showToast('No se pudo cargar el exportador'); return; }
      const aoa = [['Provincia', 'Material', ...PR_MESES_VIS.map(i => MESES[i]), 'Tendencia ($)']];
      resumen.forEach(r => {
        aoa.push([
          r.provincia, r.material,
          ...PR_MESES_VIS.map(i => r.meses[i]).map(m => m.avg === null ? '' : +m.avg.toFixed(2)),
          r.tendencia > 0 ? `+${r.tendencia.toFixed(2)}` : r.tendencia < 0 ? `${r.tendencia.toFixed(2)}` : '0',
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 16 }, { wch: 16 }, ...PR_MESES_VIS.map(() => ({ wch: 9 })), { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Precios');
      const yrs = _fAnios.filter(a => a !== '__ALL__');
      XLSX.writeFile(wb, `precios_${yrs.length ? yrs.join('-') : 'todos'}.xlsx`);
      if (typeof showToast === 'function') showToast('Excel descargado ✓');
    } catch (e) {
      console.error('export precios:', e);
      if (typeof showToast === 'function') showToast('Error al exportar');
    }
  }

  function _render(html) {
    const el = document.getElementById('main-content');
    if (el) el.innerHTML = html;
  }

  return { init, _onTabMat, _exportar, _verDetalle };
})();

// ── Estilos mínimos propios (lo que no cubre styles.css) ──────
(function _inyectarEstilos() {
  if (document.getElementById('precios-styles')) return;
  const s = document.createElement('style');
  s.id = 'precios-styles';
  s.textContent = `
    .pr-tabs { margin-bottom: 0; }
    .pr-heading { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 14px; }

    .pr-chart-svg { width: 100%; height: auto; display: block; }
    .pr-legend { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; margin-top: 14px; }
    .pr-legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); }
    .pr-legend-item i { width: 16px; height: 4px; border-radius: 2px; display: inline-block; }

    /* Centrar columnas de meses + tendencia, respetando .table-wrap */
    #pr-comparativa .table-wrap th:nth-child(n+3),
    #pr-comparativa .table-wrap td:nth-child(n+3) { text-align: center; }
    .pr-prov { font-weight: 600; color: var(--text); white-space: nowrap; }
    .pr-mat  { color: #1c7aa8; font-weight: 500; white-space: nowrap; }
    .pr-avg   { display: block; font-weight: 700; color: var(--text); }
    .pr-range { display: block; font-size: 11px; color: var(--text-dim); margin-top: 1px; }
    .pr-dash  { color: var(--text-dim); }
    .pr-tend  { display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .pr-tend-up   { background: rgba(24,174,151,0.12); color: #0a9e83; }
    .pr-tend-down { background: rgba(201,26,68,0.10);  color: var(--err); }
    .pr-tend-flat { background: rgba(0,0,0,0.05);      color: var(--text-muted); }

    .pr-empty { text-align: center; padding: 40px 0; color: var(--text-dim); font-size: 14px; }

    /* ── Móvil: tarjetas resumen (tap → detalle) ── */
    .pr-cards-mobile { display: none; }
    .pr-card {
      background: var(--surface); border-radius: 20px; padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);
      cursor: pointer; transition: transform .15s, box-shadow .15s;
    }
    .pr-card:active { transform: scale(0.99); box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06); }
    .pr-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .pr-card-label { font-size: 10px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: .7px; }
    .pr-card-prov { font-size: 17px; font-weight: 700; color: var(--text); margin-top: 2px; }
    .pr-card-mat { font-size: 14px; color: #1c7aa8; font-weight: 600; margin-top: 10px; }
    .pr-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
    .pr-card-hint { font-size: 12px; color: var(--text-muted); }
    .pr-card-chev { font-size: 13px; font-weight: 600; color: #506CFF; white-space: nowrap; }

    /* ── Modal detalle mensual ── */
    .pr-det-tend { font-size: 13px; color: var(--text-muted); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
    .pr-detalle { display: flex; flex-direction: column; }
    .pr-det-row { display: flex; align-items: center; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid var(--border); }
    .pr-det-row:last-child { border-bottom: none; }
    .pr-det-mes { font-size: 14px; color: var(--text); font-weight: 500; }
    .pr-det-val { display: flex; flex-direction: column; align-items: flex-end; }
    .pr-det-val b { font-size: 15px; font-weight: 700; color: var(--text); }
    .pr-det-val small { font-size: 11px; color: var(--text-dim); margin-top: 1px; }
    .pr-det-empty .pr-det-mes { color: var(--text-dim); }

    @media (max-width: 768px) {
      #pr-comparativa .pr-tabla-desktop { display: none; }
      .pr-cards-mobile { display: flex; flex-direction: column; gap: 12px; }
    }
  `;
  document.head.appendChild(s);
})();
