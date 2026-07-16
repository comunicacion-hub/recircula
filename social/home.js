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

    // 6) Certificación SECAP
    let conSecap = 0; recs.forEach(function (r) { if (r.certificacion_secap) conSecap++; });
    const segSecap = [
      { label: 'Con SECAP', value: conSecap, color: '#FF751F' },
      { label: 'Sin SECAP', value: totR - conSecap, color: '#e6e6ee' },
    ];

    return '<div class="charts-grid">' +
      _chartCard('Alianzas por etapa', 'users', totA ? _barsBlock(itemsEtapa, totA) : _emptyAlianzas()) +
      _chartCard('Recicladores por provincia', 'mapPin', _barsBlockProv(itemsProv, totR)) +
      _chartCard('Recicladores por sexo', 'user', _donutBlock(segSexo, fmtNum(totR), 'recicladores')) +
      _chartCard('Recicladores con RUC', 'file', _donutBlock(segRuc, fmtPct(totR ? conRuc / totR * 100 : 0), 'con RUC')) +
      _chartCard('Recicladores con cuenta bancaria', 'wallet', _donutBlock(segCta, fmtPct(totR ? conCta / totR * 100 : 0), 'con cuenta')) +
      _chartCard('Recicladores con certificación SECAP', 'cap', _donutBlock(segSecap, fmtPct(totR ? conSecap / totR * 100 : 0), 'con SECAP')) +
    '</div>';
  }

  function _chartCard(titulo, icono, contenido) {
    return '<div class="chart-card">' +
      '<div class="chart-head">' +
        '<span class="chart-ico chart-ico-' + icono + '">' + icoHTML(icono) + '</span>' +
        '<div class="chart-title">' + esc(titulo) + '</div>' +
      '</div>' + contenido + '</div>';
  }

  // Estado vacío de "Alianzas por etapa": mensaje + botón a la sección Alianzas
  function _emptyAlianzas() {
    return '<div class="empty-ali">' +
      '<div class="empty-ali-ico">' + icoHTML('handshake') + '</div>' +
      '<div class="empty-ali-txt">No existen alianzas registradas aún.</div>' +
      '<button class="empty-ali-btn" onclick="navTo(\'alianzas\')">Registrar alianza ' + icoHTML('chevRight') + '</button>' +
    '</div>';
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

  // Barras de provincia + recuadro "Total" abajo
  function _barsBlockProv(items, total) {
    if (!total || !items.length) return '<div class="chart-empty">Sin datos para mostrar</div>';
    return _barsBlock(items, total) +
      '<div class="bars-total">' +
        '<span class="bars-total-lbl">' + icoHTML('mapPin') + ' Total</span>' +
        '<span class="bars-total-val">' + fmtNum(total) + ' <em>recicladores</em></span>' +
      '</div>';
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
    const cx = 84, cy = 84, r = 66, C = 2 * Math.PI * r;
    let acc = 0;
    const arcs = segments.map(function (s) {
      const frac = tot ? s.value / tot : 0;
      const len = frac * C;
      const seg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + s.color +
        '" stroke-width="18" stroke-linecap="round" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-acc) +
        '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      acc += len;
      return seg;
    }).join('');
    return '<svg viewBox="0 0 168 168" class="donut">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#eef0f4" stroke-width="18"/>' +
      arcs +
      '<text x="84" y="80" text-anchor="middle" class="donut-top">' + esc(centerTop) + '</text>' +
      '<text x="84" y="101" text-anchor="middle" class="donut-sub">' + esc(centerSub) + '</text>' +
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
    .chart-head { display:flex; align-items:center; gap:11px; margin-bottom:18px; }
    .chart-ico { width:38px; height:38px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .chart-ico svg { width:20px; height:20px; }
    .chart-ico-users  { background:rgba(80,108,255,.12);  color:#506CFF; }
    .chart-ico-mapPin { background:rgba(51,168,222,.12);  color:#33A8DE; }
    .chart-ico-user   { background:rgba(155,108,255,.12); color:#7B5CFF; }
    .chart-ico-file   { background:rgba(24,174,151,.12);  color:#18AE97; }
    .chart-ico-wallet { background:rgba(80,108,255,.12);  color:#506CFF; }
    .chart-ico-cap    { background:rgba(255,117,31,.12);  color:#FF751F; }
    .chart-title { font-size:14px; font-weight:700; color:var(--text); }
    .chart-empty { text-align:center; padding:34px 0; color:var(--text-dim); font-size:13px; }

    /* Barras */
    .bars { display:flex; flex-direction:column; gap:14px; }
    .bar-top { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:6px; }
    .bar-lbl { font-size:13px; font-weight:600; color:var(--text); }
    .bar-val { font-size:12px; font-weight:700; color:var(--text-muted); }
    .bar-val em { font-style:normal; color:var(--text-dim); font-weight:600; }
    .bar-track { height:10px; background:#eef0f4; border-radius:20px; overflow:hidden; }
    .bar-fill { height:100%; border-radius:20px; transition:width .5s ease; }

    /* Recuadro Total (barras de provincia) */
    .bars-total { display:flex; align-items:center; justify-content:space-between; margin-top:16px; padding:12px 14px; background:rgba(51,168,222,.07); border-radius:12px; }
    .bars-total-lbl { display:flex; align-items:center; gap:7px; font-size:12.5px; font-weight:700; color:#33A8DE; }
    .bars-total-lbl svg { width:15px; height:15px; }
    .bars-total-val { font-size:14px; font-weight:800; color:var(--text); }
    .bars-total-val em { font-style:normal; font-size:12px; font-weight:600; color:var(--text-muted); }

    /* Dona */
    .donut-wrap { display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
    .donut { width:164px; height:164px; flex-shrink:0; }
    .donut-top { font-size:30px; font-weight:800; fill:var(--text); }
    .donut-sub { font-size:10px; font-weight:600; fill:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; }
    .lg { display:flex; flex-direction:column; gap:9px; flex:1; min-width:120px; }
    .lg-item { display:flex; align-items:center; gap:8px; font-size:13px; }
    .lg-dot { width:11px; height:11px; border-radius:3px; flex-shrink:0; }
    .lg-lbl { color:var(--text); font-weight:600; flex:1; }
    .lg-val { color:var(--text-muted); font-weight:600; font-size:12px; }

    /* Estado vacío: Alianzas por etapa */
    .empty-ali { display:flex; flex-direction:column; align-items:center; text-align:center; padding:20px 10px 8px; }
    .empty-ali-ico { width:64px; height:64px; border-radius:18px; background:rgba(80,108,255,.09); color:#506CFF; display:flex; align-items:center; justify-content:center; margin-bottom:14px; }
    .empty-ali-ico svg { width:30px; height:30px; }
    .empty-ali-txt { font-size:13px; color:var(--text-muted); line-height:1.5; margin-bottom:16px; max-width:200px; }
    .empty-ali-btn { display:inline-flex; align-items:center; gap:6px; background:none; border:1.5px solid #506CFF; color:#506CFF; font-family:inherit; font-size:13px; font-weight:700; padding:9px 16px; border-radius:12px; cursor:pointer; transition:background .15s,color .15s; }
    .empty-ali-btn svg { width:16px; height:16px; }
    .empty-ali-btn:hover { background:#506CFF; color:#fff; }

    @media (max-width:768px) {
      .charts-grid { grid-template-columns:1fr; }
      .donut-wrap { justify-content:center; }
    }
  `;
  document.head.appendChild(s);
})();
