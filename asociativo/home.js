// ============================================================
// DASHBOARD ASOCIATIVO — home.js (sección "Gráficos")
// Charts dinámicos (ApexCharts), todos del mismo tipo (barras verticales,
// como "Talleres"), sin donas ni tabla. Paleta del propio dashboard.
//   · Asociaciones por provincia · Categoría de asociaciones
//   · Estado asociativo (promedio de los 5 módulos)
//   · Talleres por mes · Reuniones por mes
// ============================================================

const HOME = (() => {

  let _fProvs = [];
  let _fCats  = [];
  let _charts = [];

  const CATEGORIAS = ['Líderes de ReCircula', 'En Fortalecimiento', 'En Acompañamiento'];
  const MESES_ABR  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Colores de categoría = los mismos de categoriaBadge (green / cyan / warn)
  const CAT_COLOR = {
    'Líderes de ReCircula': '#18AE97',
    'En Fortalecimiento':   '#0BC3FF',
    'En Acompañamiento':    '#F5AD21',
  };
  const MODULO_PAL = ['#506CFF', '#18AE97', '#F5AD21', '#7B5CFF', '#EF4444'];
  const TALLER_COLOR = '#7B5CFF';   // = color de Taller en encuentros
  const REUNION_COLOR = '#506CFF';  // = color de Reunión en encuentros

  // Color por provincia: reutiliza el de la sección Asociaciones si está,
  // con un respaldo por si se carga antes.
  const _PROV_PAL = ['#506CFF', '#18AE97', '#F5AD21', '#F82D72', '#FF751F', '#33A8DE', '#7B5CFF', '#0BC3FF'];
  function _colorProv(prov) {
    if (typeof _provColorAsoc === 'function') return _provColorAsoc(prov);
    const k = String(prov || '').toLowerCase();
    let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return _PROV_PAL[h % _PROV_PAL.length];
  }

  function _asociacionesFiltradas() {
    return CAT.asociaciones.filter(function (a) {
      const cat = categoriaVigente(a.id_asociacion);
      return pasaFiltro(_fProvs, a.provincia) && pasaFiltro(_fCats, cat);
    });
  }
  function _provincias() {
    return Array.from(new Set(CAT.asociaciones.map(function (a) { return a.provincia; }).filter(Boolean))).sort();
  }

  // ── Datos ──
  function _asocPorProv() {
    const map = {};
    _asociacionesFiltradas().forEach(function (a) {
      const p = a.provincia || 'Sin provincia';
      map[p] = (map[p] || 0) + 1;
    });
    const rows = Object.keys(map).map(function (p) { return { prov: p, val: map[p] }; })
      .sort(function (a, b) { return b.val - a.val; });
    return { names: rows.map(function (r) { return r.prov; }), values: rows.map(function (r) { return r.val; }),
      colors: rows.map(function (r) { return _colorProv(r.prov); }) };
  }

  function _categoriaPct() {
    const filtradas = _asociacionesFiltradas();
    const total = filtradas.length || 1;
    const cuenta = { 'Líderes de ReCircula': 0, 'En Fortalecimiento': 0, 'En Acompañamiento': 0 };
    filtradas.forEach(function (a) { const c = categoriaVigente(a.id_asociacion); if (cuenta[c] !== undefined) cuenta[c]++; });
    return { names: CATEGORIAS, values: CATEGORIAS.map(function (c) { return +((cuenta[c] / total) * 100).toFixed(1); }),
      colors: CATEGORIAS.map(function (c) { return CAT_COLOR[c]; }) };
  }

  function _diagVigente(idAsociacion) {
    const ds = CAT.diagnosticos.filter(function (d) { return d.id_asociacion === idAsociacion; });
    if (!ds.length) return null;
    ds.sort(function (a, b) {
      const ay = parseFloat(a.anio) || 0, by = parseFloat(b.anio) || 0;
      if (by !== ay) return by - ay;
      return (b.tipo === 'Cierre' ? 1 : 0) - (a.tipo === 'Cierre' ? 1 : 0);
    });
    return ds[0];
  }
  const MODULOS = [
    { key: 'p_organizacional', lbl: 'Organiz.' }, { key: 'p_productivo', lbl: 'Product.' },
    { key: 'p_empresarial', lbl: 'Empres.' }, { key: 'p_ambiental', lbl: 'Ambien.' },
    { key: 'p_financiero', lbl: 'Financ.' },
  ];
  function _estadoAsociativo() {
    const sumas = { p_organizacional: 0, p_productivo: 0, p_empresarial: 0, p_ambiental: 0, p_financiero: 0 };
    let n = 0;
    _asociacionesFiltradas().forEach(function (a) {
      const d = _diagVigente(a.id_asociacion); if (!d) return;
      n++; MODULOS.forEach(function (m) { sumas[m.key] += parseFloat(d[m.key]) || 0; });
    });
    if (!n) return { names: [], values: [], colors: [] };
    return { names: MODULOS.map(function (m) { return m.lbl; }),
      values: MODULOS.map(function (m) { return +(sumas[m.key] / n).toFixed(1); }), colors: MODULO_PAL };
  }

  function _encFecha(e) {
    const s = String(e.fecha_encuentro || '').substring(0, 10).split('-');
    if (s.length < 3) return null;
    const y = +s[0], m = +s[1]; if (!y || !m) return null;
    return { y: y, m: m };
  }
  function _encFiltrados() { return CAT.encuentros.filter(function (e) { return pasaFiltro(_fProvs, e.provincia); }); }
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
    return { names: meses.map(function (m) { return MESES_ABR[m - 1]; }), values: meses.map(function (m) { return cnt[m]; }) };
  }

  // ── Render ──
  function render() {
    _registrarFiltros();
    const html =
      '<div class="page-header">' +
        '<div><div class="page-title">Gráficos</div><div class="page-sub">' + esc(fmtFechaLarga(new Date())) + '</div></div>' +
        '<div class="hdr-actions">' +
          '<button class="hdr-circle" onclick="openFilterDrawer(\'home\', this)" title="Filtros" aria-label="Filtros">' +
            icoHTML('filter') + '<span class="filter-badge" id="home-filter-badge" style="display:none"></span></button>' +
          '<button class="hdr-circle" onclick="volverAlHub()" title="Volver al Hub" aria-label="Volver al Hub">' + icoHTML('logout') + '</button>' +
        '</div>' +
      '</div>' +
      '<div id="home-charts">' +
        '<div class="asoc-duo">' +
          _chartCard('building', 'Asociaciones por provincia', 'chAsocProv') +
          _chartCard('star', 'Categoría de asociaciones', 'chCategoria') +
        '</div>' +
        _chartCard('trendUp', 'Estado asociativo', 'chEstado', true) +
        '<div class="asoc-duo">' +
          _chartCard('leaf', 'Talleres por mes', 'chTaller') +
          _chartCard('calendar', 'Reuniones por mes', 'chReunion') +
        '</div>' +
      '</div>';
    document.getElementById('main-content').innerHTML = html;
    updateFilterBadge('home');
    _initCharts();
  }

  function _chartCard(ico, titulo, id) {
    return '<div class="card asoc-chart-card">' +
      '<div class="asoc-chart-title">' + icoHTML(ico) + '<span>' + esc(titulo) + '</span></div>' +
      '<div class="asoc-apex" id="' + id + '"></div>' +
    '</div>';
  }

  // ── Dibujo (destruye y recrea) ──
  function _destroyCharts() { _charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); _charts = []; }
  function _initCharts() {
    _destroyCharts();
    if (typeof ApexCharts === 'undefined') return;
    const intFmt = function (v) { return fmtNum(Math.round(v)); };
    const pctFmt = function (v) { return fmtNum(v, 1) + '%'; };

    _barV('chAsocProv', _asocPorProv(), { dl: intFmt, ytick: intFmt, tip: function (v) { return fmtNum(v) + ' asociación' + (v === 1 ? '' : 'es'); }, empty: 'Sin asociaciones para este filtro.' });
    _barV('chCategoria', _categoriaPct(), { dl: pctFmt, ytick: function (v) { return fmtNum(Math.round(v)) + '%'; }, tip: pctFmt, empty: 'Sin datos para este filtro.', maxY: 100 });
    _barV('chEstado', _estadoAsociativo(), { dl: pctFmt, ytick: function (v) { return fmtNum(Math.round(v)) + '%'; }, tip: pctFmt, empty: 'Sin diagnósticos registrados.', maxY: 100 });

    const meses = _mesesVis();
    const tData = _encPorMes('Taller', meses);   tData.colors = [TALLER_COLOR];
    const rData = _encPorMes('Reunión', meses);  rData.colors = [REUNION_COLOR];
    _barV('chTaller', tData, { dl: intFmt, ytick: intFmt, tip: function (v) { return fmtNum(v) + ' taller' + (v === 1 ? '' : 'es'); }, empty: 'Sin talleres registrados.', requireData: true });
    _barV('chReunion', rData, { dl: intFmt, ytick: intFmt, tip: function (v) { return fmtNum(v) + ' reunión' + (v === 1 ? '' : 'es'); }, empty: 'Sin reuniones registradas.', requireData: true });
  }

  // Barra vertical uniforme (mismo estilo que el chart de "Talleres")
  function _barV(id, data, opt) {
    const el = document.getElementById(id); if (!el) return;
    const hayDatos = data.names.length && (!opt.requireData || data.values.some(function (x) { return x > 0; }));
    if (!hayDatos) { el.innerHTML = '<p class="asoc-empty">' + esc(opt.empty) + '</p>'; return; }
    const colors = data.colors || [];
    const distributed = colors.length > 1;
    const c = new ApexCharts(el, {
      chart: { type: 'bar', height: 260, fontFamily: 'Outfit, sans-serif', toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 700 } },
      series: [{ name: 'Total', data: data.values }],
      colors: colors.length ? colors : ['#506CFF'],
      plotOptions: { bar: { distributed: distributed, borderRadius: 6, borderRadiusApplication: 'end', columnWidth: '52%', dataLabels: { position: 'top' } } },
      dataLabels: { enabled: true, offsetY: -18, formatter: opt.dl, style: { fontSize: '11px', fontWeight: 600, colors: ['#767c8a'] } },
      xaxis: { categories: data.names, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#a4abba', fontSize: '12px', fontWeight: 600 }, trim: true, hideOverlappingLabels: false } },
      yaxis: { min: 0, max: opt.maxY, forceNiceScale: !opt.maxY, labels: { formatter: opt.ytick, style: { colors: '#a4abba', fontSize: '11px' } } },
      grid: { borderColor: '#eef1f7', padding: { top: 8 } },
      legend: { show: false },
      tooltip: { y: { formatter: opt.tip, title: { formatter: function () { return ''; } } } },
    });
    c.render(); _charts.push(c);
  }

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

// ── Estilos propios ──
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
    @media (max-width:900px) { .asoc-duo { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(s);
})();
