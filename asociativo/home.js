// ============================================================
// DASHBOARD ASOCIATIVO — home.js (sección "Gráficos")
// KPIs + charts dinámicos (ApexCharts, sin donas):
//   · Recicladores por provincia (barras)
//   · Talleres por mes / Reuniones por mes (barras)
// ============================================================

const HOME = (() => {

  // Filtros del drawer (afectan los charts; los KPIs son totales globales)
  let _fProvs = [];
  let _fCats  = [];
  let _charts = [];   // instancias ApexCharts vivas (se destruyen al re-dibujar)

  const CATEGORIAS = ['Líderes de ReCircula', 'En Fortalecimiento', 'En Acompañamiento'];
  const MESES_ABR  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const PROV_PAL   = ['#506CFF', '#18AE97', '#F5AD21', '#7B5CFF', '#EF4444', '#0BC3FF', '#FF751F', '#C19A6B'];

  const CAT_COLOR = {
    'Líderes de ReCircula': '#18AE97',
    'En Fortalecimiento':   '#506CFF',
    'En Acompañamiento':    '#7B5CFF',
  };
  function _rgba(hex, a) {
    let h = String(hex || '').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    const n = parseInt(h, 16) || 0;
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // ── KPIs globales ──
  function _kpis() {
    let recicladores = 0;
    const cuenta = { 'Líderes de ReCircula': 0, 'En Fortalecimiento': 0, 'En Acompañamiento': 0 };
    CAT.asociaciones.forEach(function (a) {
      recicladores += parseFloat(a.num_recicladores) || 0;
      const cat = categoriaVigente(a.id_asociacion);
      if (cuenta[cat] !== undefined) cuenta[cat]++;
    });
    return {
      recicladores: recicladores,
      asociaciones: CAT.asociaciones.length,
      lideres: cuenta['Líderes de ReCircula'],
      fortalecimiento: cuenta['En Fortalecimiento'],
      acompanamiento: cuenta['En Acompañamiento'],
    };
  }

  function _provincias() {
    return Array.from(new Set(CAT.asociaciones.map(function (a) { return a.provincia; }).filter(Boolean))).sort();
  }

  // ── Datos: recicladores por provincia (respeta filtros prov + categoría) ──
  function _recPorProv() {
    const map = {};
    CAT.asociaciones.forEach(function (a) {
      const cat = categoriaVigente(a.id_asociacion);
      if (!pasaFiltro(_fProvs, a.provincia) || !pasaFiltro(_fCats, cat)) return;
      const p = a.provincia || 'Sin provincia';
      map[p] = (map[p] || 0) + (parseFloat(a.num_recicladores) || 0);
    });
    const rows = Object.keys(map).map(function (p) { return { prov: p, val: map[p] }; })
      .sort(function (a, b) { return b.val - a.val; });
    return {
      names: rows.map(function (r) { return r.prov; }),
      values: rows.map(function (r) { return r.val; }),
      colors: rows.map(function (_, i) { return PROV_PAL[i % PROV_PAL.length]; }),
    };
  }

  // ── Datos: encuentros por mes, por tipo (respeta filtro de provincia) ──
  function _encFecha(e) {
    const s = String(e.fecha_encuentro || '').substring(0, 10).split('-');
    if (s.length < 3) return null;
    const y = +s[0], m = +s[1]; if (!y || !m) return null;
    return { y: y, m: m };
  }
  function _encFiltrados() {
    return CAT.encuentros.filter(function (e) { return pasaFiltro(_fProvs, e.provincia); });
  }
  function _mesesVis() {
    const set = {};
    _encFiltrados().forEach(function (e) { const p = _encFecha(e); if (p) set[p.m] = true; });
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }
  function _encPorMes(tipo, meses) {
    const cnt = {}; meses.forEach(function (m) { cnt[m] = 0; });
    _encFiltrados().forEach(function (e) {
      if (e.tipo_encuentro !== tipo) return;
      const p = _encFecha(e); if (!p || cnt[p.m] === undefined) return;
      cnt[p.m]++;
    });
    return meses.map(function (m) { return cnt[m]; });
  }

  // ── Render principal ──
  function render() {
    _registrarFiltros();
    const k = _kpis();
    const html =
      '<div class="page-header">' +
        '<div>' +
          '<div class="page-title">Gráficos</div>' +
          '<div class="page-sub">' + esc(fmtFechaLarga(new Date())) + '</div>' +
        '</div>' +
        '<div class="hdr-actions">' +
          '<button class="hdr-circle" onclick="openFilterDrawer(\'home\', this)" title="Filtros" aria-label="Filtros">' +
            icoHTML('filter') + '<span class="filter-badge" id="home-filter-badge" style="display:none"></span>' +
          '</button>' +
          '<button class="hdr-circle" onclick="volverAlHub()" title="Volver al Hub" aria-label="Volver al Hub">' +
            icoHTML('logout') +
          '</button>' +
        '</div>' +
      '</div>' +

      '<div class="asoc-kpis">' +
        _kpiBox('users',    '#506CFF', fmtNum(k.recicladores),    'Recicladores',         'Total en la red') +
        _kpiBox('building', '#18AE97', fmtNum(k.asociaciones),    'Asociaciones',         'En la red') +
        _kpiBox('star',     '#F5AD21', fmtNum(k.lideres),         'Líderes de ReCircula', 'Activos') +
        _kpiBox('trendUp',  '#F82D72', fmtNum(k.fortalecimiento), 'En Fortalecimiento',   'En proceso') +
        _kpiBox('users',    '#7B5CFF', fmtNum(k.acompanamiento),  'En Acompañamiento',    'En seguimiento') +
      '</div>' +

      '<div id="home-charts">' + _chartsHtml() + '</div>';

    document.getElementById('main-content').innerHTML = html;
    updateFilterBadge('home');
    _initCharts();
  }

  function _kpiBox(ico, color, num, lbl, sub) {
    return '<div class="asoc-kpi">' +
      '<div class="asoc-kpi-head">' +
        '<span class="asoc-kpi-ico" style="background:' + _rgba(color, 0.12) + ';color:' + color + '">' + icoHTML(ico) + '</span>' +
        '<span class="asoc-kpi-lbl">' + esc(lbl) + '</span>' +
      '</div>' +
      '<div class="asoc-kpi-num" style="color:' + color + '">' + num + '</div>' +
      '<div class="asoc-kpi-sub">' + esc(sub) + '</div>' +
    '</div>';
  }

  function _chartsHtml() {
    return '<div class="card asoc-chart-card">' +
        '<div class="asoc-chart-title">' + icoHTML('users') + '<span>Recicladores por provincia</span></div>' +
        '<div class="asoc-apex" id="chProv"></div>' +
      '</div>' +
      '<div class="asoc-duo">' +
        '<div class="card asoc-chart-card">' +
          '<div class="asoc-chart-title">' + icoHTML('leaf') + '<span>Talleres por mes</span></div>' +
          '<div class="asoc-apex" id="chTaller"></div>' +
        '</div>' +
        '<div class="card asoc-chart-card">' +
          '<div class="asoc-chart-title">' + icoHTML('calendar') + '<span>Reuniones por mes</span></div>' +
          '<div class="asoc-apex" id="chReunion"></div>' +
        '</div>' +
      '</div>';
  }

  // ── Dibujo de los charts (destruye los previos y recrea) ──
  function _destroyCharts() { _charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); _charts = []; }
  function _initCharts() {
    _destroyCharts();
    if (typeof ApexCharts === 'undefined') return;

    // Recicladores por provincia (barras horizontales)
    const rp = _recPorProv();
    const elP = document.getElementById('chProv');
    if (elP) {
      if (!rp.names.length) elP.innerHTML = '<p class="asoc-empty">Sin datos para este filtro.</p>';
      else _push(elP, _barH(rp.names, rp.values, rp.colors, 'Recicladores'));
    }

    // Talleres / Reuniones por mes (barras verticales)
    const meses = _mesesVis();
    const labels = meses.map(function (m) { return MESES_ABR[m - 1]; });
    _barMes('chTaller', labels, _encPorMes('Taller', meses), '#7B5CFF', 'Talleres');
    _barMes('chReunion', labels, _encPorMes('Reunión', meses), '#506CFF', 'Reuniones');
  }
  function _push(el, opts) { const c = new ApexCharts(el, opts); c.render(); _charts.push(c); }

  function _barH(names, values, colors, name) {
    return {
      chart: { type: 'bar', height: Math.max(220, names.length * 38 + 30), fontFamily: 'Outfit, sans-serif', toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 700 } },
      series: [{ name: name, data: values }], colors: colors,
      plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 6, borderRadiusApplication: 'end', barHeight: '62%' } },
      dataLabels: { enabled: true, formatter: function (v) { return fmtNum(v); }, textAnchor: 'start', offsetX: 8, style: { fontSize: '12px', fontWeight: 700, colors: ['#2b2f3a'] } },
      xaxis: { categories: names, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#a4abba', fontSize: '11px' } } },
      yaxis: { labels: { style: { colors: '#767c8a', fontSize: '12.5px', fontWeight: 600 } } },
      grid: { borderColor: '#eef1f7', yaxis: { lines: { show: false } } },
      legend: { show: false }, tooltip: { y: { formatter: function (v) { return fmtNum(v) + ' recicladores'; } } },
    };
  }

  function _barMes(id, labels, data, color, name) {
    const el = document.getElementById(id); if (!el) return;
    if (!labels.length || !data.some(function (x) { return x > 0; })) {
      el.innerHTML = '<p class="asoc-empty">Sin ' + name.toLowerCase() + ' registrados.</p>';
      return;
    }
    _push(el, {
      chart: { type: 'bar', height: 250, fontFamily: 'Outfit, sans-serif', toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 700 } },
      series: [{ name: name, data: data }], colors: [color],
      plotOptions: { bar: { borderRadius: 6, borderRadiusApplication: 'end', columnWidth: '52%' } },
      dataLabels: { enabled: false },
      xaxis: { categories: labels, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#a4abba', fontSize: '12px', fontWeight: 600 } } },
      yaxis: { min: 0, forceNiceScale: true, labels: { formatter: function (v) { return fmtNum(Math.round(v)); }, style: { colors: '#a4abba', fontSize: '11px' } } },
      grid: { borderColor: '#eef1f7' },
      tooltip: { y: { formatter: function (v) { return fmtNum(v) + ' ' + name.toLowerCase(); } } },
    });
  }

  // ── Filtros (drawer) ──
  function _registrarFiltros() {
    registerFilterConfig('home', {
      badgeId: 'home-filter-badge',
      sections: [
        { key: 'prov', title: 'Provincia', type: 'options', options: _provincias() },
        { key: 'cat',  title: 'Categoría', type: 'options', options: CATEGORIAS },
      ],
      getValue: function (k) { return k === 'prov' ? _fProvs : _fCats; },
      setValue: function (k, v) { if (k === 'prov') _fProvs = v; else _fCats = v; },
      apply: function () { _initCharts(); },
    });
  }

  return { render: render };
})();

function renderHome() { HOME.render(); }

// ── Estilos propios (lo que no cubre styles.css) ──
(function () {
  if (document.getElementById('home-styles')) return;
  const s = document.createElement('style');
  s.id = 'home-styles';
  s.textContent = `
    /* KPIs */
    .asoc-kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:14px; }
    .asoc-kpi { background:var(--white); border:1px solid var(--border); border-radius:18px; padding:16px 18px; box-shadow:var(--shadow-sm); }
    .asoc-kpi-head { display:flex; align-items:center; gap:10px; }
    .asoc-kpi-ico { width:40px; height:40px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .asoc-kpi-ico svg { width:20px; height:20px; }
    .asoc-kpi-lbl { font-size:12.5px; color:var(--text-muted); font-weight:600; line-height:1.2; }
    .asoc-kpi-num { font-size:32px; font-weight:800; line-height:1.05; margin-top:12px; }
    .asoc-kpi-sub { font-size:11.5px; color:var(--text-dim); margin-top:4px; font-weight:500; }

    /* Charts */
    #home-charts { display:flex; flex-direction:column; gap:18px; }
    .asoc-chart-card { padding:20px 24px; }
    .asoc-chart-title { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:700; color:var(--text); margin-bottom:14px; }
    .asoc-chart-title svg { width:18px; height:18px; color:var(--text-muted); }
    .asoc-apex { width:100%; min-height:40px; }
    .asoc-duo { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
    .asoc-duo > * { min-width:0; }
    .asoc-empty { text-align:center; padding:40px 0; color:var(--text-dim); font-size:14px; }

    @media (max-width:900px) {
      .asoc-kpis { grid-template-columns:repeat(2,1fr); }
      .asoc-duo { grid-template-columns:1fr; }
    }
  `;
  document.head.appendChild(s);
})();
