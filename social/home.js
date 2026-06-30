// ============================================================
// DASHBOARD SOCIAL — home.js
// Sección Home: 5 gráficos generados en el frontend.
//  1) % de alianzas por etapa (Inicial/Intermedia/Final)
//  2) % de recicladores por provincia
//  3) % de recicladores por sexo
//  4) % de recicladores con RUC
//  5) % de recicladores con cuenta bancaria
// Filtros (drawer): provincia + asociación. Botón para volver al Hub.
// ============================================================

const HOME = (() => {

  let _fProvs = [];
  let _fAsocs = [];

  const ETAPAS = ['Inicial', 'Intermedia', 'Final'];
  const ETAPA_COLORS = ['#F5AD21', '#33A8DE', '#18AE97'];
  const PROV_COLORS = ['#506CFF', '#18AE97', '#F5AD21', '#F82D72', '#FF751F', '#33A8DE', '#9FDA60', '#FF85FF', '#0BC3FF', '#FF376F'];

  // ── Conjuntos filtrados ──
  function _recFiltrados() {
    return CAT.recicladores.filter(function (r) {
      return pasaFiltro(_fProvs, provinciaDeReciclador(r)) && pasaFiltro(_fAsocs, r.id_asociacion);
    });
  }
  function _aliFiltradas() {
    return CAT.alianzas.filter(function (a) {
      return pasaFiltroLista(_fProvs, a.provincias) && pasaFiltroLista(_fAsocs, a.asociaciones);
    });
  }

  function _provincias() {
    return Array.from(new Set(CAT.asocAmbiente.map(function (a) { return a.provincia; }).filter(Boolean))).sort();
  }
  function _asociaciones() {
    return CAT.asocAmbiente.map(function (a) { return { val: a.id_asociacion, lbl: a.nombre }; });
  }

  // ── Render principal ──
  function render() {
    _registrarFiltros();
    document.getElementById('main-content').innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<div class="page-title">Dashboard Social</div>' +
          '<div class="page-sub">' + esc(fmtFechaLarga(new Date())) + '</div>' +
        '</div>' +
        '<div class="hdr-actions">' +
          '<button class="hdr-circle" onclick="openFilterDrawer(\'home\')" title="Filtros" aria-label="Filtros">' +
            icoHTML('filter') + '<span class="filter-badge" id="home-filter-badge" style="display:none"></span>' +
          '</button>' +
          '<button class="hdr-circle" onclick="volverAlHub()" title="Volver al Hub" aria-label="Volver al Hub">' +
            icoHTML('logout') +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div id="home-charts">' + _charts() + '</div>';
    updateFilterBadge('home');
  }

  // ── Bloque de gráficos ──
  function _charts() {
    const recs = _recFiltrados();
    const alis = _aliFiltradas();
    const totR = recs.length;

    // 1) Alianzas por etapa (checklist múltiple → % de alianzas con cada etapa marcada)
    const totA = alis.length;
    const contE = { Inicial: 0, Intermedia: 0, Final: 0 };
    alis.forEach(function (a) { (a.etapas || []).forEach(function (e) { if (contE[e] != null) contE[e]++; }); });
    const itemsEtapa = ETAPAS.map(function (e, i) {
      return { label: e, value: contE[e], pct: totA ? contE[e] / totA * 100 : 0, color: ETAPA_COLORS[i] };
    });

    // 2) Recicladores por provincia
    const byProv = {};
    recs.forEach(function (r) { const p = provinciaDeReciclador(r) || 'Sin provincia'; byProv[p] = (byProv[p] || 0) + 1; });
    const itemsProv = Object.keys(byProv).map(function (p, i) {
      return { label: p, value: byProv[p], pct: totR ? byProv[p] / totR * 100 : 0 };
    }).sort(function (a, b) { return b.value - a.value; });
    itemsProv.forEach(function (it, i) { it.color = PROV_COLORS[i % PROV_COLORS.length]; });

    // 3) Sexo
    let m = 0, f = 0, sd = 0;
    recs.forEach(function (r) {
      const s = (r.sexo || '').toLowerCase();
      if (s.indexOf('masc') === 0) m++; else if (s.indexOf('fem') === 0) f++; else sd++;
    });
    const segSexo = [
      { label: 'Masculino', value: m, color: '#33A8DE' },
      { label: 'Femenino',  value: f, color: '#F82D72' },
    ];
    if (sd > 0) segSexo.push({ label: 'Sin dato', value: sd, color: '#d7d7e0' });

    // 4) RUC
    let conRuc = 0; recs.forEach(function (r) { if (r.ruc) conRuc++; });
    const segRuc = [
      { label: 'Con RUC', value: conRuc, color: '#18AE97' },
      { label: 'Sin RUC', value: totR - conRuc, color: '#e6e6ee' },
    ];

    // 5) Cuenta bancaria
    let conCta = 0; recs.forEach(function (r) { if (r.cuenta_bancaria) conCta++; });
    const segCta = [
      { label: 'Con cuenta', value: conCta, color: '#506CFF' },
      { label: 'Sin cuenta', value: totR - conCta, color: '#e6e6ee' },
    ];

    return '<div class="charts-grid">' +
      _chartCard('Alianzas por etapa', _barsBlock(itemsEtapa, totA)) +
      _chartCard('Recicladores por provincia', _barsBlock(itemsProv, totR)) +
      _chartCard('Recicladores por sexo', _donutBlock(segSexo, fmtNum(totR), 'recicladores')) +
      _chartCard('Recicladores con RUC', _donutBlock(segRuc, fmtPct(totR ? conRuc / totR * 100 : 0), 'con RUC')) +
      _chartCard('Recicladores con cuenta bancaria', _donutBlock(segCta, fmtPct(totR ? conCta / totR * 100 : 0), 'con cuenta')) +
    '</div>';
  }

  function _chartCard(titulo, contenido) {
    return '<div class="chart-card"><div class="chart-title">' + esc(titulo) + '</div>' + contenido + '</div>';
  }

  // ── Barras horizontales ──
  function _barsBlock(items, total) {
    if (!total || !items.length) return '<div class="chart-empty">Sin datos para mostrar</div>';
    return '<div class="bars">' + items.map(function (it) {
      return '<div class="bar-row">' +
        '<div class="bar-top"><span class="bar-lbl">' + esc(it.label) + '</span>' +
          '<span class="bar-val">' + fmtPct(it.pct) + ' <em>(' + it.value + ')</em></span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + Math.max(it.pct, 1.5) + '%;background:' + it.color + '"></div></div>' +
      '</div>';
    }).join('') + '</div>';
  }

  // ── Dona (SVG) + leyenda ──
  function _donutBlock(segments, centerTop, centerSub) {
    const tot = segments.reduce(function (a, s) { return a + s.value; }, 0);
    if (!tot) return '<div class="chart-empty">Sin datos para mostrar</div>';
    const legend = segments.filter(function (s) { return s.value > 0; }).map(function (s) {
      return '<div class="lg-item"><span class="lg-dot" style="background:' + s.color + '"></span>' +
        '<span class="lg-lbl">' + esc(s.label) + '</span>' +
        '<span class="lg-val">' + s.value + ' · ' + fmtPct(s.value / tot * 100) + '</span></div>';
    }).join('');
    return '<div class="donut-wrap">' + _donutSVG(segments, centerTop, centerSub) + '<div class="lg">' + legend + '</div></div>';
  }

  function _donutSVG(segments, centerTop, centerSub) {
    const tot = segments.reduce(function (a, s) { return a + s.value; }, 0);
    const cx = 70, cy = 70, r = 54, C = 2 * Math.PI * r;
    let acc = 0;
    const arcs = segments.map(function (s) {
      const frac = tot ? s.value / tot : 0;
      const len = frac * C;
      const seg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + s.color +
        '" stroke-width="16" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-acc) +
        '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      acc += len;
      return seg;
    }).join('');
    return '<svg viewBox="0 0 140 140" class="donut">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#eef0f4" stroke-width="16"/>' +
      arcs +
      '<text x="70" y="67" text-anchor="middle" class="donut-top">' + esc(centerTop) + '</text>' +
      '<text x="70" y="86" text-anchor="middle" class="donut-sub">' + esc(centerSub) + '</text>' +
    '</svg>';
  }

  // ── Filtros (drawer) ──
  function _registrarFiltros() {
    registerFilterConfig('home', {
      badgeId: 'home-filter-badge',
      sections: [
        { key: 'prov', title: 'Provincia',  type: 'options', options: _provincias() },
        { key: 'asoc', title: 'Asociación', type: 'options', options: _asociaciones() },
      ],
      getValue: function (k) { return k === 'prov' ? _fProvs : _fAsocs; },
      setValue: function (k, v) { if (k === 'prov') _fProvs = v; else _fAsocs = v; },
      apply: function () {
        const cont = document.getElementById('home-charts');
        if (cont) cont.innerHTML = _charts();
      },
    });
  }

  return { render: render };
})();

function renderHome() { HOME.render(); }

// ── Estilos propios ──
(function () {
  if (document.getElementById('home-styles')) return;
  const s = document.createElement('style');
  s.id = 'home-styles';
  s.textContent = `
    .charts-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:16px; }
    .chart-card { background:var(--surface); border-radius:20px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 14px rgba(0,0,0,.04); }
    .chart-title { font-size:14px; font-weight:700; color:var(--text); margin-bottom:18px; }
    .chart-empty { text-align:center; padding:34px 0; color:var(--text-dim); font-size:13px; }

    /* Barras */
    .bars { display:flex; flex-direction:column; gap:14px; }
    .bar-row { }
    .bar-top { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:6px; }
    .bar-lbl { font-size:13px; font-weight:600; color:var(--text); }
    .bar-val { font-size:12px; font-weight:700; color:var(--text-muted); }
    .bar-val em { font-style:normal; color:var(--text-dim); font-weight:600; }
    .bar-track { height:10px; background:#eef0f4; border-radius:20px; overflow:hidden; }
    .bar-fill { height:100%; border-radius:20px; transition:width .5s ease; }

    /* Dona */
    .donut-wrap { display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
    .donut { width:140px; height:140px; flex-shrink:0; }
    .donut-top { font-size:24px; font-weight:800; fill:var(--text); }
    .donut-sub { font-size:10px; font-weight:600; fill:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; }
    .lg { display:flex; flex-direction:column; gap:9px; flex:1; min-width:120px; }
    .lg-item { display:flex; align-items:center; gap:8px; font-size:13px; }
    .lg-dot { width:11px; height:11px; border-radius:3px; flex-shrink:0; }
    .lg-lbl { color:var(--text); font-weight:600; flex:1; }
    .lg-val { color:var(--text-muted); font-weight:600; font-size:12px; }

    @media (max-width:768px) {
      .charts-grid { grid-template-columns:1fr; }
      .donut-wrap { justify-content:center; }
    }
  `;
  document.head.appendChild(s);
})();
