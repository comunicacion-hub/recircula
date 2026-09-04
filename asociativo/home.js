// ============================================================
// DASHBOARD ASOCIATIVO — home.js (sección "Gráficos")
// Línea visual unificada con Dashboard Ambiental (ReCircula 360).
// Simetría, alineación precisa y variedad analítica:
//   · Tarjeta superior de Totales (4 KPIs ejecutivos con sparklines)
//   · Fila 1: Categoría de asociaciones (Donut) + Provincias (Barras H)
//   · Fila 2: Estado asociativo (Radar 5 módulos) + Tipos de encuentro (Donut)
//   · Fila 3: Evolución mensual combinada (Encuentros y Asistencia)
// ============================================================

const HOME = (() => {

  let _fProvs = [];
  let _fCats  = [];
  let _charts = [];

  const CATEGORIAS = ['Líderes de ReCircula', 'En Fortalecimiento', 'En Acompañamiento'];
  const MESES_ABR  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Colores de categoría oficiales (Teal / Cyan / Ámbar)
  const CAT_COLOR = {
    'Líderes de ReCircula': '#18AE97',
    'En Fortalecimiento':   '#0BC3FF',
    'En Acompañamiento':    '#F5AD21',
  };

  // Paleta oficial ReCircula 360 (idéntica a Ambiental)
  const G_INDIGO = '#506CFF';
  const G_TEAL   = '#18AE97';
  const G_AMBAR  = '#F5AD21';
  const G_ROSA   = '#F82D72';
  const G_CYAN   = '#0BC3FF';
  const G_PURPLE = '#7B5CFF';

  const G_APEX_BASE = {
    fontFamily: 'Outfit, sans-serif',
    toolbar: { show: false },
    animations: { enabled: true, easing: 'easeinout', speed: 700 },
  };

  const MODULOS = [
    { key: 'p_organizacional', lbl: 'Organizacional' },
    { key: 'p_productivo',     lbl: 'Productivo' },
    { key: 'p_empresarial',    lbl: 'Empresarial' },
    { key: 'p_ambiental',      lbl: 'Ambiental' },
    { key: 'p_financiero',     lbl: 'Financiero' },
  ];

  const ENC_TIPO_META = {
    'Reunión':      { color: '#506CFF', icon: 'users' },
    'Taller':       { color: '#7B5CFF', icon: 'leaf' },
    'Capacitación': { color: '#18AE97', icon: 'presentation' },
    'Foro':         { color: '#F5AD21', icon: 'chat' },
    'Seminario':    { color: '#F82D72', icon: 'star' },
    'Otros':        { color: '#0d9aa8', icon: 'calendar' },
  };

  const _PROV_PAL = ['#506CFF', '#18AE97', '#F5AD21', '#F82D72', '#FF751F', '#33A8DE', '#7B5CFF', '#0BC3FF'];
  function _colorProv(prov) {
    if (typeof _provColorAsoc === 'function') return _provColorAsoc(prov);
    const k = String(prov || '').toLowerCase();
    let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return _PROV_PAL[h % _PROV_PAL.length];
  }

  function gRgba(hex, a) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    const n = parseInt(h, 16) || 0;
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  // ── Filtros y colecciones ──
  function _asociacionesFiltradas() {
    return (CAT.asociaciones || []).filter(function (a) {
      const cat = categoriaVigente(a.id_asociacion);
      return pasaFiltro(_fProvs, a.provincia) && pasaFiltro(_fCats, cat);
    });
  }

  function _provincias() {
    return Array.from(new Set((CAT.asociaciones || []).map(function (a) { return a.provincia; }).filter(Boolean))).sort();
  }

  function _diagVigente(idAsociacion) {
    const ds = (CAT.diagnosticos || []).filter(function (d) { return d.id_asociacion === idAsociacion; });
    if (!ds.length) return null;
    ds.sort(function (a, b) {
      const ay = parseFloat(a.anio) || 0, by = parseFloat(b.anio) || 0;
      if (by !== ay) return by - ay;
      return (b.tipo === 'Cierre' ? 1 : 0) - (a.tipo === 'Cierre' ? 1 : 0);
    });
    return ds[0];
  }

  function _encFecha(e) {
    const s = String(e.fecha_encuentro || '').substring(0, 10).split('-');
    if (s.length < 3) return null;
    const y = +s[0], m = +s[1]; if (!y || !m) return null;
    return { y: y, m: m };
  }

  function _encFiltrados() {
    return (CAT.encuentros || []).filter(function (e) {
      return pasaFiltro(_fProvs, e.provincia);
    });
  }

  function _mesesVis() {
    const set = {};
    _encFiltrados().forEach(function (e) { const p = _encFecha(e); if (p) set[p.m] = true; });
    const keys = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    return keys.length ? keys : [1, 2, 3, 4, 5, 6];
  }

  // ── Datos para los Gráficos ──
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
      colors: rows.map(function (r) { return _colorProv(r.prov); })
    };
  }

  function _categoriaData() {
    const filtradas = _asociacionesFiltradas();
    const total = filtradas.length;
    const cuenta = { 'Líderes de ReCircula': 0, 'En Fortalecimiento': 0, 'En Acompañamiento': 0 };
    filtradas.forEach(function (a) {
      const c = categoriaVigente(a.id_asociacion);
      if (cuenta[c] !== undefined) cuenta[c]++;
    });
    return {
      total: total,
      names: CATEGORIAS,
      values: CATEGORIAS.map(function (c) { return cuenta[c]; }),
      colors: CATEGORIAS.map(function (c) { return CAT_COLOR[c]; })
    };
  }

  function _estadoAsociativo() {
    const sumas = { p_organizacional: 0, p_productivo: 0, p_empresarial: 0, p_ambiental: 0, p_financiero: 0 };
    let n = 0;
    _asociacionesFiltradas().forEach(function (a) {
      const d = _diagVigente(a.id_asociacion);
      if (!d) return;
      n++;
      MODULOS.forEach(function (m) { sumas[m.key] += parseFloat(d[m.key]) || 0; });
    });
    if (!n) return { names: [], values: [], count: 0 };
    return {
      names: MODULOS.map(function (m) { return m.lbl; }),
      values: MODULOS.map(function (m) { return +(sumas[m.key] / n).toFixed(1); }),
      count: n
    };
  }

  function _tiposEncuentroData() {
    const encs = _encFiltrados();
    const count = {};
    const asist = {};
    Object.keys(ENC_TIPO_META).forEach(function (t) { count[t] = 0; asist[t] = 0; });

    encs.forEach(function (e) {
      const t = e.tipo_encuentro || 'Otros';
      const k = count[t] !== undefined ? t : 'Otros';
      count[k]++;
      asist[k] += parseFloat(e.num_asistentes) || 0;
    });

    const activeTypes = Object.keys(ENC_TIPO_META).filter(function (t) { return count[t] > 0; });
    const tipList = activeTypes.length ? activeTypes : ['Reunión', 'Taller', 'Capacitación'];

    return {
      names: tipList,
      values: tipList.map(function (t) { return count[t]; }),
      asistentes: tipList.map(function (t) { return asist[t]; }),
      colors: tipList.map(function (t) { return (ENC_TIPO_META[t] && ENC_TIPO_META[t].color) || '#0d9aa8'; }),
      total: encs.length
    };
  }

  function _evolucionData() {
    const meses = _mesesVis();
    const encs = _encFiltrados();
    const cEncs = {};
    const cAsist = {};
    meses.forEach(function (m) { cEncs[m] = 0; cAsist[m] = 0; });

    encs.forEach(function (e) {
      const p = _encFecha(e);
      if (!p || cEncs[p.m] === undefined) return;
      cEncs[p.m]++;
      cAsist[p.m] += parseFloat(e.num_asistentes) || 0;
    });

    return {
      meses: meses.map(function (m) { return MESES_ABR[m - 1]; }),
      encuentros: meses.map(function (m) { return cEncs[m]; }),
      asistentes: meses.map(function (m) { return cAsist[m]; }),
      hasData: encs.length > 0
    };
  }

  // ── Cálculo de KPIs y Sparklines ──
  function _calcKPIs() {
    const asocs = _asociacionesFiltradas();
    const encs = _encFiltrados();
    const estado = _estadoAsociativo();

    // 1. Total Asociaciones
    const totAsoc = asocs.length;
    const provsData = _asocPorProv();
    const asocSpark = provsData.values.slice(0, 6);

    // 2. Madurez Promedio
    let madurezVal = 0;
    if (estado.count > 0 && estado.values.length) {
      const sum = estado.values.reduce(function (a, b) { return a + b; }, 0);
      madurezVal = +(sum / estado.values.length).toFixed(1);
    }
    const madurezTxt = estado.count > 0 ? (fmtNum(madurezVal, 1) + '<small>%</small>') : '—';
    const madurezPill = estado.count > 0 ? (estado.count + ' de ' + totAsoc + ' diagnosticadas') : 'Sin diagnósticos';
    const madurezSpark = estado.values.length ? estado.values : [0, 0];

    // 3. Total Encuentros
    const totEnc = encs.length;
    const evo = _evolucionData();
    const encSpark = evo.encuentros.length ? evo.encuentros : [0, 0];
    const encPill = totEnc ? (totEnc + ' evento' + (totEnc === 1 ? '' : 's')) : 'Sin registros';

    // 4. Asistentes
    let totAsist = 0;
    encs.forEach(function (e) { totAsist += parseFloat(e.num_asistentes) || 0; });
    const promPorEnc = totEnc ? Math.round(totAsist / totEnc) : 0;
    const asistPill = totEnc ? (fmtNum(promPorEnc) + ' por evento') : '—';
    const asistSpark = evo.asistentes.length ? evo.asistentes : [0, 0];

    return {
      totAsoc: totAsoc,
      asocPill: totAsoc ? (_provincias().length + ' provincias') : '0 registros',
      asocSpark: asocSpark.length ? asocSpark : [0, 0],

      madurezTxt: madurezTxt,
      madurezPill: madurezPill,
      madurezSpark: madurezSpark,

      totEnc: totEnc,
      encPill: encPill,
      encSpark: encSpark,

      totAsist: totAsist,
      asistPill: asistPill,
      asistSpark: asistSpark,
    };
  }

  // ── Render Principal ──
  function render() {
    _registrarFiltros();
    const kpi = _calcKPIs();

    const html =
      '<div class="page-header">' +
        '<div>' +
          '<div class="page-title">Gráficos</div>' +
          '<div class="page-sub">' + capitalize(fmtFechaLarga(new Date())) + '</div>' +
        '</div>' +
        '<div class="hdr-actions">' +
          '<button class="hdr-circle" onclick="openFilterDrawer(\'home\', this)" title="Filtros" aria-label="Filtros">' +
            icoHTML('filter') +
            '<span class="filter-badge" id="home-filter-badge" style="display:none">0</span>' +
          '</button>' +
          '<button class="hdr-circle" onclick="volverAlHub()" title="Volver al Hub" aria-label="Volver al Hub">' +
            icoHTML('logout') +
          '</button>' +
        '</div>' +
      '</div>' +

      '<div class="g-wrap" id="home-charts">' +

        // ── Tarjeta superior de Totales (4 KPIs simétricos) ──
        '<div class="card g-tot" id="home-totales">' +
          _kpiSeg(0, 'building', G_INDIGO, 'Asociaciones', fmtNum(kpi.totAsoc), kpi.asocPill) +
          _kpiSeg(1, 'trendUp',  G_TEAL,   'Madurez asociativa', kpi.madurezTxt, kpi.madurezPill) +
          _kpiSeg(2, 'calendar', G_AMBAR,  'Total encuentros', fmtNum(kpi.totEnc), kpi.encPill) +
          _kpiSeg(3, 'users',    G_PURPLE, 'Participantes', fmtNum(kpi.totAsist), kpi.asistPill) +
        '</div>' +

        // ── Fila 1: Categorías (Donut) + Provincias (Barras H) ──
        '<div class="g-duo">' +

          '<div class="card">' +
            '<div class="card-title">' +
              '<span>Categoría de asociaciones</span>' +
              '<span style="font-size:11px;color:var(--text-dim);font-weight:600">diagnóstico vigente</span>' +
            '</div>' +
            '<div class="g-chart" id="chCategoria"></div>' +
            '<div class="g-chart-hint">Pasa el cursor para ver el detalle de cada categoría</div>' +
          '</div>' +

          '<div class="card">' +
            '<div class="card-title">' +
              '<span>Asociaciones por provincia</span>' +
              '<span style="font-size:11px;color:var(--text-dim);font-weight:600">distribución</span>' +
            '</div>' +
            '<div class="g-chart" id="chAsocProv"></div>' +
            '<div class="g-chart-hint">Distribución territorial de las organizaciones registradas</div>' +
          '</div>' +

        '</div>' +

        // ── Fila 2: Estado Asociativo (Radar) + Tipos de Encuentro (Donut) ──
        '<div class="g-duo">' +

          '<div class="card">' +
            '<div class="card-title">' +
              '<span>Estado asociativo</span>' +
              '<span style="font-size:11px;color:var(--text-dim);font-weight:600">promedio 5 módulos</span>' +
            '</div>' +
            '<div class="g-chart" id="chEstado"></div>' +
            '<div class="g-chart-hint">Evaluación diagnóstica multidimensional (escala de 0 a 100%)</div>' +
          '</div>' +

          '<div class="card">' +
            '<div class="card-title">' +
              '<span>Tipos de encuentro</span>' +
              '<span style="font-size:11px;color:var(--text-dim);font-weight:600">por modalidad</span>' +
            '</div>' +
            '<div class="g-chart" id="chTiposEncuentro"></div>' +
            '<div class="g-chart-hint">Eventos y actividades organizativas realizadas</div>' +
          '</div>' +

        '</div>' +

        // ── Fila 3: Evolución Temporal Completa ──
        '<div class="card">' +
          '<div class="card-title">' +
            '<span>Evolución mensual de encuentros y asistencia</span>' +
            '<span style="font-size:11px;color:var(--text-dim);font-weight:600">histórico temporal</span>' +
          '</div>' +
          '<div class="g-chart g-chart-evo" id="chEvolucion"></div>' +
          '<div class="g-chart-hint">Pasa el cursor para ver el detalle mensual · interactúa con la leyenda</div>' +
        '</div>' +

      '</div>';

    document.getElementById('main-content').innerHTML = html;
    updateFilterBadge('home');
    _initCharts();
  }

  function _kpiSeg(idx, ico, color, lbl, valTxt, pillTxt) {
    return '<div class="g-tot-seg">' +
      '<div class="g-tot-top">' +
        '<div class="g-tot-ic" style="background:' + gRgba(color, 0.13) + ';color:' + color + '">' + icoHTML(ico) + '</div>' +
        '<span class="g-tot-lbl">' + esc(lbl) + '</span>' +
      '</div>' +
      '<div class="g-tot-val" style="color:' + color + '">' + valTxt + '</div>' +
      '<div class="g-tot-foot">' +
        '<span class="g-pill ' + (idx === 1 ? 'up' : 'neutral') + '">' + esc(pillTxt) + '</span>' +
      '</div>' +
    '</div>';
  }

  // ── Inicialización y Dibujo de Gráficos (ApexCharts) ──
  function _destroyCharts() {
    _charts.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    _charts = [];
  }

  function _initCharts() {
    _destroyCharts();
    if (typeof ApexCharts === 'undefined') return;

    // 1. Donut: Categorías de Asociaciones
    _renderDonutCategorias();

    // 2. Barras Horizontales: Asociaciones por Provincia
    _renderBarrasProvincias();

    // 3. Radar: Estado Asociativo (5 módulos)
    _renderRadarEstado();

    // 4. Donut: Tipos de Encuentro
    _renderDonutTiposEncuentro();

    // 5. Evolución Temporal Combinada
    _renderEvolucionTemporal();
  }

  // ── Gráfico 1: Categorías (Donut) ──
  function _renderDonutCategorias() {
    const el = document.getElementById('chCategoria');
    if (!el) return;
    const d = _categoriaData();
    if (!d.total) {
      el.innerHTML = '<div class="empty-state"><p>Sin asociaciones para este filtro</p></div>';
      return;
    }

    const c = new ApexCharts(el, {
      chart: Object.assign({}, G_APEX_BASE, { type: 'donut', height: 265 }),
      series: d.values,
      labels: d.names,
      colors: d.colors,
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              name: { show: true, fontSize: '12px', fontWeight: 600, color: '#767c8a', offsetY: -4 },
              value: {
                show: true,
                fontSize: '24px',
                fontWeight: 800,
                color: 'var(--text)',
                offsetY: 4,
                formatter: function (val) { return fmtNum(val); }
              },
              total: {
                show: true,
                label: 'Total',
                fontSize: '11px',
                fontWeight: 700,
                color: '#a0a0b0',
                formatter: function (w) {
                  return w.globals.seriesTotals.reduce(function (a, b) { return a + b; }, 0);
                }
              }
            }
          }
        }
      },
      dataLabels: { enabled: false },
      stroke: { width: 2, colors: ['#ffffff'] },
      legend: {
        position: 'bottom',
        fontSize: '12px',
        fontWeight: 600,
        labels: { colors: '#767c8a' },
        markers: { width: 10, height: 10, radius: 5 },
        itemMargin: { horizontal: 8, vertical: 4 }
      },
      tooltip: {
        y: {
          formatter: function (val) {
            const pct = d.total ? ((val / d.total) * 100).toFixed(1) : '0.0';
            return val + ' asoc. (' + pct + '%)';
          }
        }
      }
    });
    c.render();
    _charts.push(c);
  }

  // ── Gráfico 2: Provincias (Barras Horizontales) ──
  function _renderBarrasProvincias() {
    const el = document.getElementById('chAsocProv');
    if (!el) return;
    const d = _asocPorProv();
    if (!d.names.length) {
      el.innerHTML = '<div class="empty-state"><p>Sin asociaciones para este filtro</p></div>';
      return;
    }

    const c = new ApexCharts(el, {
      chart: Object.assign({}, G_APEX_BASE, { type: 'bar', height: 265 }),
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 6,
          borderRadiusApplication: 'end',
          barHeight: d.names.length > 5 ? '65%' : '52%',
          distributed: true,
          dataLabels: { position: 'top' }
        }
      },
      series: [{ name: 'Asociaciones', data: d.values }],
      colors: d.colors.length ? d.colors : [G_INDIGO],
      xaxis: {
        categories: d.names,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: '#a4abba', fontSize: '11px', fontWeight: 600 },
          formatter: function (v) { return Math.round(v); }
        }
      },
      yaxis: {
        labels: {
          style: { colors: '#555e6d', fontSize: '12px', fontWeight: 600 },
          maxWidth: 130
        }
      },
      grid: { borderColor: '#eef1f7', padding: { left: 8, right: 28, top: -14, bottom: -8 } },
      dataLabels: {
        enabled: true,
        textAnchor: 'start',
        offsetX: 8,
        formatter: function (val) { return fmtNum(val); },
        style: { fontSize: '11px', fontWeight: 700, colors: ['#555e6d'] }
      },
      legend: { show: false },
      tooltip: {
        y: {
          formatter: function (val) {
            return fmtNum(val) + (val === 1 ? ' asociación' : ' asociaciones');
          }
        }
      }
    });
    c.render();
    _charts.push(c);
  }

  // ── Gráfico 3: Estado Asociativo (Radar 5 Módulos) ──
  function _renderRadarEstado() {
    const el = document.getElementById('chEstado');
    if (!el) return;
    const d = _estadoAsociativo();
    if (!d.count) {
      el.innerHTML = '<div class="empty-state"><p>Sin diagnósticos registrados</p></div>';
      return;
    }

    const c = new ApexCharts(el, {
      chart: Object.assign({}, G_APEX_BASE, { type: 'radar', height: 265 }),
      series: [{ name: 'Madurez promedio', data: d.values }],
      labels: d.names,
      colors: [G_INDIGO],
      fill: {
        opacity: 0.30
      },
      stroke: { width: 2.5, colors: [G_INDIGO] },
      markers: { size: 4.5, colors: ['#ffffff'], strokeColors: G_INDIGO, strokeWidth: 2, hover: { size: 7 } },
      yaxis: {
        min: 0,
        max: 100,
        tickAmount: 5,
        labels: {
          formatter: function (val) { return Math.round(val) + '%'; },
          style: { colors: '#a4abba', fontSize: '10px' }
        }
      },
      xaxis: {
        labels: {
          style: { colors: ['#333333', '#333333', '#333333', '#333333', '#333333'], fontSize: '11px', fontWeight: 700 }
        }
      },
      plotOptions: {
        radar: {
          polygons: {
            strokeColors: '#eef1f7',
            connectorColors: '#eef1f7',
            fill: { colors: ['#fafbfe', '#ffffff'] }
          }
        }
      },
      tooltip: {
        y: {
          formatter: function (val) { return fmtNum(val, 1) + '%'; }
        }
      }
    });
    c.render();
    _charts.push(c);
  }

  // ── Gráfico 4: Tipos de Encuentro (Donut) ──
  function _renderDonutTiposEncuentro() {
    const el = document.getElementById('chTiposEncuentro');
    if (!el) return;
    const d = _tiposEncuentroData();
    if (!d.total) {
      el.innerHTML = '<div class="empty-state"><p>Sin encuentros registrados</p></div>';
      return;
    }

    const c = new ApexCharts(el, {
      chart: Object.assign({}, G_APEX_BASE, { type: 'donut', height: 265 }),
      series: d.values,
      labels: d.names,
      colors: d.colors,
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              name: { show: true, fontSize: '12px', fontWeight: 600, color: '#767c8a', offsetY: -4 },
              value: {
                show: true,
                fontSize: '24px',
                fontWeight: 800,
                color: 'var(--text)',
                offsetY: 4,
                formatter: function (val) { return fmtNum(val); }
              },
              total: {
                show: true,
                label: 'Encuentros',
                fontSize: '11px',
                fontWeight: 700,
                color: '#a0a0b0',
                formatter: function (w) {
                  return w.globals.seriesTotals.reduce(function (a, b) { return a + b; }, 0);
                }
              }
            }
          }
        }
      },
      dataLabels: { enabled: false },
      stroke: { width: 2, colors: ['#ffffff'] },
      legend: {
        position: 'bottom',
        fontSize: '12px',
        fontWeight: 600,
        labels: { colors: '#767c8a' },
        markers: { width: 10, height: 10, radius: 5 },
        itemMargin: { horizontal: 8, vertical: 4 }
      },
      tooltip: {
        y: {
          formatter: function (val, opts) {
            const idx = opts.dataPointIndex;
            const personas = d.asistentes[idx] || 0;
            return val + ' encuentro' + (val === 1 ? '' : 's') + ' (' + fmtNum(personas) + ' participantes)';
          }
        }
      }
    });
    c.render();
    _charts.push(c);
  }

  // ── Gráfico 5: Evolución Temporal Combinada (Barras + Área) ──
  function _renderEvolucionTemporal() {
    const el = document.getElementById('chEvolucion');
    if (!el) return;
    const d = _evolucionData();
    if (!d.hasData) {
      el.innerHTML = '<div class="empty-state"><p>Sin encuentros registrados para este periodo</p></div>';
      return;
    }

    const c = new ApexCharts(el, {
      chart: Object.assign({}, G_APEX_BASE, { type: 'line', height: 300 }),
      series: [
        { name: 'Encuentros', type: 'column', data: d.encuentros },
        { name: 'Participantes', type: 'area', data: d.asistentes }
      ],
      colors: [G_INDIGO, G_TEAL],
      stroke: { width: [0, 3], curve: 'smooth' },
      fill: {
        type: ['solid', 'gradient'],
        gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0.02, stops: [0, 95] }
      },
      plotOptions: {
        bar: { columnWidth: '38%', borderRadius: 6, borderRadiusApplication: 'end' }
      },
      xaxis: {
        categories: d.meses,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: '#a4abba', fontSize: '12px', fontWeight: 600 } }
      },
      yaxis: [
        {
          title: { text: 'N° Encuentros', style: { color: G_INDIGO, fontSize: '11px', fontWeight: 600 } },
          labels: { formatter: function (v) { return Math.round(v); }, style: { colors: '#a4abba', fontSize: '11px' } },
          min: 0,
          forceNiceScale: true
        },
        {
          opposite: true,
          title: { text: 'Participantes', style: { color: G_TEAL, fontSize: '11px', fontWeight: 600 } },
          labels: { formatter: function (v) { return Math.round(v); }, style: { colors: '#a4abba', fontSize: '11px' } },
          min: 0,
          forceNiceScale: true
        }
      ],
      grid: { borderColor: '#eef1f7', xaxis: { lines: { show: false } } },
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        fontSize: '13px',
        fontWeight: 600,
        labels: { colors: '#767c8a' },
        markers: { width: 11, height: 11, radius: 6 },
        itemMargin: { horizontal: 12 }
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: function (v, opts) {
            if (opts.seriesIndex === 0) return fmtNum(v) + ' encuentro' + (v === 1 ? '' : 's');
            return fmtNum(v) + ' personas';
          }
        }
      }
    });
    c.render();
    _charts.push(c);
  }

  // ── Actualización de Totales y Filtros ──
  function _actualizarTotales() {
    const cont = document.getElementById('home-totales');
    if (!cont) return;
    const kpi = _calcKPIs();
    cont.innerHTML =
      _kpiSeg(0, 'building', G_INDIGO, 'Asociaciones', fmtNum(kpi.totAsoc), kpi.asocPill) +
      _kpiSeg(1, 'trendUp',  G_TEAL,   'Madurez asociativa', kpi.madurezTxt, kpi.madurezPill) +
      _kpiSeg(2, 'calendar', G_AMBAR,  'Total encuentros', fmtNum(kpi.totEnc), kpi.encPill) +
      _kpiSeg(3, 'users',    G_PURPLE, 'Participantes', fmtNum(kpi.totAsist), kpi.asistPill);
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
      apply: function () {
        _actualizarTotales();
        _initCharts();
      },
    });
  }

  return { render: render };
})();

function renderHome() { HOME.render(); }

