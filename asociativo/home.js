// ============================================================
// DASHBOARD ASOCIATIVO — home.js (sección "Gráficos")
// Solo charts dinámicos (ApexCharts, sin donas ni KPIs ni tabla):
//   · Asociaciones por provincia (barras)
//   · Categoría de asociaciones % (barras)
//   · Estado asociativo — promedio de los 5 módulos (barras)
//   · Talleres por mes / Reuniones por mes (barras)
// ============================================================

const HOME = (() => {

  // Filtros del drawer (afectan todos los charts)
  let _fProvs = [];
  let _fCats  = [];
  let _charts = [];   // instancias ApexCharts vivas (se destruyen al re-dibujar)

  const CATEGORIAS = ['Líderes de ReCircula', 'En Fortalecimiento', 'En Acompañamiento'];
  const MESES_ABR  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const PROV_PAL   = ['#506CFF', '#18AE97', '#F5AD21', '#7B5CFF', '#EF4444', '#0BC3FF', '#FF751F', '#C19A6B'];
  const MODULO_PAL = ['#506CFF', '#18AE97', '#F5AD21', '#7B5CFF', '#EF4444'];

  const CAT_COLOR = {
    'Líderes de ReCircula': '#18AE97',
    'En Fortalecimiento':   '#506CFF',
    'En Acompañamiento':    '#7B5CFF',
  };

  function _asociacionesFiltradas() {
    return CAT.asociaciones.filter(function (a) {
      const cat = categoriaVigente(a.id_asociacion);
      return pasaFiltro(_fProvs, a.provincia) && pasaFiltro(_fCats, cat);
    });
  }

  function _provincias() {
    return Array.from(new Set(CAT.asociaciones.map(function (a) { return a.provincia; }).filter(Boolean))).sort();
  }

  // ── Datos: asociaciones por provincia ──
  function _asocPorProv() {
    const map = {};
    _asociacionesFiltradas().forEach(function (a) {
      const p = a.provincia || 'Sin provincia';
      map[p] = (map[p] || 0) + 1;
    });
    const rows = Object.keys(map).map(function (p) { return { prov: p, val: map[p] }; })
      .sort(function (a, b) { return b.val - a.val; });
    return {
      names: rows.map(function (r) { return r.prov; }),
      values: rows.map(function (r) { return r.val; }),
      colors: rows.map(function (_, i) { return PROV_PAL[i % PROV_PAL.length]; }),
    };
  }

  // ── Datos: % de asociaciones por categoría vigente ──
  function _categoriaPct() {
    const filtradas = _asociacionesFiltradas();
    const total = filtradas.length || 1;
    const cuenta = { 'Líderes de ReCircula': 0, 'En Fortalecimiento': 0, 'En Acompañamiento': 0 };
    filtradas.forEach(function (a) {
      const cat = categoriaVigente(a.id_asociacion);
      if (cuenta[cat] !== undefined) cuenta[cat]++;
    });
    return {
      names: CATEGORIAS,
      values: CATEGORIAS.map(function (c) { return +((cuenta[c] / total) * 100).toFixed(1); }),
      colors: CATEGORIAS.map(function (c) { return CAT_COLOR[c]; }),
    };
  }

  // ── Diagnóstico vigente de una asociación (más reciente: año desc, Cierre > Inicial) ──
  function _diagVigente(idAsociacion) {
    const ds = CAT.diagnosticos.filter(function (d) { return d.id_asociacion === idAsociacion; });
    if (!ds.length) return null;
    ds.sort(function (a, b) {
      const ay = parseFloat(a.anio) || 0, by = parseFloat(b.anio) || 0;
      if (by !== ay) return by - ay;
      const rank = function (t) { return t === 'Cierre' ? 1 : 0; };
      return rank(b.tipo) - rank(a.tipo);
    });
    return ds[0];
  }

  // ── Datos: "Estado asociativo" — promedio de los 5 módulos entre asociaciones filtradas ──
  const MODULOS = [
    { key: 'p_organizacional', lbl: 'Organiz.' },
    { key: 'p_productivo',     lbl: 'Product.' },
    { key: 'p_empresarial',    lbl: 'Empres.' },
    { key: 'p_ambiental',      lbl: 'Ambien.' },
    { key: 'p_financiero',     lbl: 'Financ.' },
  ];
  function _estadoAsociativo() {
    const sumas = { p_organizacional: 0, p_productivo: 0, p_empresarial: 0, p_ambiental: 0, p_financiero: 0 };
    let n = 0;
    _asociacionesFiltradas().forEach(function (a) {
      const d = _diagVigente(a.id_asociacion);
      if (!d) return;
      n++;
      MODULOS.forEach(function (m) { sumas[m.key] += parseFloat(d[m.key]) || 0; });
    });
    if (!n) return { names: [], values: [], colors: [] };
    return {
      names: MODULOS.map(function (m) { return m.lbl; }),
      values: MODULOS.map(function (m) { return +(sumas[m.key] / n).toFixed(1); }),
      colors: MODULO_PAL,
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

      '<div id="home-charts">' + _chartsHtml() + '</div>';

    document.getElementById('main-content').innerHTML = html;
    updateFilterBadge('home');
    _initCharts();
  }

  function _chartsHtml() {
    return '<div class="card asoc-chart-card">' +
        '<div class="asoc-chart-title">' + icoHTML('building') + '<span>Asociaciones por provincia</span></div>' +
        '<div class="asoc-apex" id="chAsocProv"></div>' +
      '</div>' +
      '<div class="asoc-duo">' +
        '<div class="card asoc-chart-card">' +
          '<div class="asoc-chart-title">' + icoHTML('star') + '<span>Categoría de asociaciones</span></div>' +
          '<div class="asoc-apex" id="chCategoria"></div>' +
        '</div>' +
        '<div class="card asoc-chart-card">' +
          '<div class="asoc-chart-title">' + icoHTML('trendUp') + '<span>Estado asociativo</span></div>' +
          '<div class="asoc-apex" id="chEstado"></div>' +
        '</div>' +
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

    _barHInto('chAsocProv', _asocPorProv(), 'Asociaciones', function (v) { return fmtNum(v); }, 'Sin asociaciones para este filtro.');
    _barHInto('chCategoria', _categoriaPct(), 'Asociaciones', function (v) { return fmtNum(v, 1) + '%'; }, 'Sin datos para este filtro.');
    _barHInto('chEstado', _estadoAsociativo(), 'Promedio', function (v) { return fmtNum(v, 1) + '%'; }, 'Sin diagnósticos registrados.');

    const meses = _mesesVis();
    const labels = meses.map(function (m) { return MESES_ABR[m - 1]; });
    _barMes('chTaller', labels, _encPorMes('Taller', meses), '#7B5CFF', 'Talleres');
    _barMes('chReunion', labels, _encPorMes('Reunión', meses), '#506CFF', 'Reuniones');
  }
  function _push(el, opts) { const c = new ApexCharts(el, opts); c.render(); _charts.push(c); }

  function _barHInto(id, data, seriesName, fmt, emptyMsg) {
    const el = document.getElementById(id); if (!el) return;
    if (!data.names.length) { el.innerHTML = '<p class="asoc-empty">' + esc(emptyMsg) + '</p>'; return; }
    _push(el, {
      chart: { type: 'bar', height: Math.max(200, data.names.length * 44 + 30), fontFamily: 'Outfit, sans-serif', toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 700 } },
      series: [{ name: seriesName, data: data.values }], colors: data.colors,
      plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 6, borderRadiusApplication: 'end', barHeight: '62%' } },
      dataLabels: { enabled: true, formatter: fmt, textAnchor: 'start', offsetX: 8, style: { fontSize: '12px', fontWeight: 700, colors: ['#2b2f3a'] } },
      xaxis: { categories: data.names, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#a4abba', fontSize: '11px' } } },
      yaxis: { labels: { style: { colors: '#767c8a', fontSize: '12.5px', fontWeight: 600 } } },
      grid: { borderColor: '#eef1f7', yaxis: { lines: { show: false } } },
      legend: { show: false }, tooltip: { y: { formatter: fmt } },
    });
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
    #home-charts { display:flex; flex-direction:column; gap:18px; }
    .asoc-chart-card { padding:20px 24px; }
    .asoc-chart-title { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:700; color:var(--text); margin-bottom:14px; }
    .asoc-chart-title svg { width:18px; height:18px; color:var(--text-muted); }
    .asoc-apex { width:100%; min-height:40px; }
    .asoc-duo { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
    .asoc-duo > * { min-width:0; }
    .asoc-empty { text-align:center; padding:40px 0; color:var(--text-dim); font-size:14px; }

    @media (max-width:900px) {
      .asoc-duo { grid-template-columns:1fr; }
    }
  `;
  document.head.appendChild(s);
})();
