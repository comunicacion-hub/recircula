// ============================================================
// DASHBOARD ASOCIATIVO — home.js
// Sección Home: 5 KPIs + tabla resumen generada en frontend.
// La tabla cruza Asoc_Asociativo con Diagnosticos (Inicial/Cierre).
// ============================================================

const HOME = (() => {

  // Filtros del drawer (solo afectan la tabla; los KPIs son totales globales)
  let _fProvs = [];
  let _fCats  = [];

  const CATEGORIAS = ['Líderes de ReCircula', 'En Fortalecimiento', 'En Acompañamiento'];

  // ── Valoración del diagnóstico más reciente de un tipo (Inicial/Cierre) ──
  function _pctTipo(idAsoc, tipo) {
    const ds = CAT.diagnosticos.filter(function (d) { return d.id_asociacion === idAsoc && d.tipo === tipo; });
    if (!ds.length) return null;
    ds.sort(function (a, b) { return (parseFloat(b.anio) || 0) - (parseFloat(a.anio) || 0); });
    const v = parseFloat(ds[0].valoracion_total);
    return isNaN(v) ? null : v;
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

  // Orden de categorías: Líderes → Fortalecimiento → Acompañamiento → sin diagnóstico
  function _catRank(cat) {
    return cat === 'Líderes de ReCircula' ? 0
         : cat === 'En Fortalecimiento'   ? 1
         : cat === 'En Acompañamiento'    ? 2 : 3;
  }

  // ── Filas de la tabla (filtradas y ordenadas por categoría) ──
  function _filas() {
    return CAT.asociaciones
      .filter(function (a) {
        const cat = categoriaVigente(a.id_asociacion);
        return pasaFiltro(_fProvs, a.provincia) && pasaFiltro(_fCats, cat);
      })
      .map(function (a) {
        const ini = _pctTipo(a.id_asociacion, 'Inicial');
        const cie = _pctTipo(a.id_asociacion, 'Cierre');
        const crec = (ini != null && cie != null) ? +(cie - ini).toFixed(2) : null;
        return { nombre: a.nombre, provincia: a.provincia, ini: ini, cie: cie, crec: crec, categoria: categoriaVigente(a.id_asociacion) };
      })
      .sort(function (x, y) {
        const r = _catRank(x.categoria) - _catRank(y.categoria);
        return r !== 0 ? r : (x.nombre || '').localeCompare(y.nombre || '');
      });
  }

  // ── Provincias disponibles para el filtro ──
  function _provincias() {
    return Array.from(new Set(CAT.asociaciones.map(function (a) { return a.provincia; }).filter(Boolean))).sort();
  }

  // ── Render principal ──
  function render() {
    _registrarFiltros();
    const k = _kpis();
    const html =
      '<div class="page-header">' +
        '<div>' +
          '<div class="page-title">Dashboard Asociativo</div>' +
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

      '<div class="asoc-kpis">' +
        _kpiBox('users',    '#506CFF', fmtNum(k.recicladores),    'Recicladores',         'Total en la red') +
        _kpiBox('building', '#18AE97', fmtNum(k.asociaciones),    'Asociaciones',         'En la red') +
        _kpiBox('star',     '#F5AD21', fmtNum(k.lideres),         'Líderes de ReCircula', 'Activos') +
        _kpiBox('trendUp',  '#F82D72', fmtNum(k.fortalecimiento), 'En Fortalecimiento',   'En proceso') +
        _kpiBox('users',    '#7B5CFF', fmtNum(k.acompanamiento),  'En Acompañamiento',    'En seguimiento') +
      '</div>' +

      '<div id="home-tabla">' + _tabla() + '</div>';

    document.getElementById('main-content').innerHTML = html;
    updateFilterBadge('home');
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

  // Color por categoría (para leyenda, avatar y barra)
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

  // ── Tabla de desempeño (desktop) + tarjetas (móvil) ──
  function _tabla() {
    const filas = _filas();

    // Encabezado con leyenda de categorías
    const leyenda = CATEGORIAS.map(function (c) {
      return '<span class="asoc-leg"><span class="asoc-leg-dot" style="background:' + CAT_COLOR[c] + '"></span>' + esc(c) + '</span>';
    }).join('');
    const cabecera =
      '<div class="asoc-tabla-head">' +
        '<div class="asoc-tabla-titulo">' +
          '<span class="asoc-tabla-ico">' + icoHTML('users') + '</span>' +
          '<span>Desempeño de asociaciones</span>' +
        '</div>' +
        '<div class="asoc-leyenda">' + leyenda + '</div>' +
      '</div>';

    if (!filas.length) {
      return '<div class="card asoc-tabla-card">' + cabecera +
        '<p class="asoc-empty">No hay asociaciones que coincidan con el filtro.</p></div>';
    }

    const barra = function (pct, color) {
      if (pct == null) return '<span class="asoc-dash">—</span>';
      const w = Math.max(0, Math.min(pct, 100));
      return '<div class="asoc-pct">' +
        '<div class="asoc-pct-val" style="color:' + color + '">' + fmtNum(pct, 1) + '%</div>' +
        '<div class="asoc-bar"><div class="asoc-bar-fill" style="width:' + w + '%;background:' + color + '"></div></div>' +
      '</div>';
    };
    const avatar = function (cat) {
      const col = CAT_COLOR[cat] || '#a0a0b0';
      return '<span class="asoc-avatar" style="background:' + _rgba(col, 0.12) + ';color:' + col + '">' + icoHTML('users') + '</span>';
    };
    const accion = function (f) {
      return '<button class="asoc-accion" onclick="navTo(\'asociaciones\')" title="Ver asociaciones">' + icoHTML('chevRight') + '</button>';
    };

    const filasTabla = filas.map(function (f) {
      const col = CAT_COLOR[f.categoria] || '#506CFF';
      return '<tr>' +
        '<td class="asoc-td-nombre"><div class="asoc-nom-cell">' + avatar(f.categoria) + '<span>' + esc(f.nombre) + '</span></div></td>' +
        '<td>' + barra(f.ini, col) + '</td>' +
        '<td>' + (f.cie != null ? fmtNum(f.cie, 1) + '%' : '<span class="asoc-dash">—</span>') + '</td>' +
        '<td>' + _crecBadge(f.crec) + '</td>' +
        '<td>' + categoriaBadge(f.categoria) + '</td>' +
        '<td style="text-align:right">' + accion(f) + '</td>' +
      '</tr>';
    }).join('');
    const tabla = '<div class="table-wrap asoc-tabla-desktop"><table>' +
      '<thead><tr><th>Asociación</th><th>% Inicial</th><th>% Cierre</th><th>Crecimiento</th><th>Categoría</th><th style="text-align:right">Acción</th></tr></thead>' +
      '<tbody>' + filasTabla + '</tbody></table></div>';

    const cards = filas.map(function (f) {
      const col = CAT_COLOR[f.categoria] || '#506CFF';
      return '<div class="asoc-card">' +
        '<div class="asoc-card-top">' +
          '<div class="asoc-nom-cell">' + avatar(f.categoria) + '<div><div class="asoc-card-nombre">' + esc(f.nombre) + '</div></div></div>' +
          categoriaBadge(f.categoria) +
        '</div>' +
        '<div class="asoc-card-pct">' + barra(f.ini, col) + '</div>' +
        '<div class="asoc-card-row">' +
          '<div class="asoc-card-cell"><span class="asoc-card-mini">% Cierre</span><b>' + (f.cie != null ? fmtNum(f.cie, 1) + '%' : '—') + '</b></div>' +
          '<div class="asoc-card-cell"><span class="asoc-card-mini">Crecimiento</span>' + _crecBadge(f.crec) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    const cardsWrap = '<div class="asoc-cards-mobile">' + cards + '</div>';

    return '<div class="card asoc-tabla-card">' + cabecera + tabla + cardsWrap + '</div>';
  }

  function _crecBadge(c) {
    if (c == null) return '<span class="asoc-dash">—</span>';
    if (c > 0) return '<span class="asoc-crec asoc-crec-up">▲ ' + fmtNum(c, 1) + '</span>';
    if (c < 0) return '<span class="asoc-crec asoc-crec-down">▼ ' + fmtNum(Math.abs(c), 1) + '</span>';
    return '<span class="asoc-crec asoc-crec-flat">=</span>';
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
      apply: function () {
        const cont = document.getElementById('home-tabla');
        if (cont) cont.innerHTML = _tabla();
      },
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
    /* Tarjetas-resumen */
    .asoc-kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:14px; margin-bottom:22px; }
    .asoc-kpi { background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 14px rgba(0,0,0,.04); }
    .asoc-kpi-head { display:flex; align-items:center; gap:10px; }
    .asoc-kpi-ico { width:40px; height:40px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .asoc-kpi-ico svg { width:20px; height:20px; }
    .asoc-kpi-lbl { font-size:12.5px; color:var(--text-muted); font-weight:600; line-height:1.2; }
    .asoc-kpi-num { font-size:32px; font-weight:800; line-height:1.05; margin-top:12px; }
    .asoc-kpi-sub { font-size:11.5px; color:var(--text-dim); margin-top:4px; font-weight:500; }

    /* Tabla de desempeño */
    .asoc-tabla-card { padding:22px 24px; }
    .asoc-tabla-head { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:18px; }
    .asoc-tabla-titulo { display:flex; align-items:center; gap:12px; font-size:17px; font-weight:800; color:var(--text); }
    .asoc-tabla-ico { width:40px; height:40px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:rgba(123,92,255,.1); color:#7B5CFF; }
    .asoc-tabla-ico svg { width:20px; height:20px; }
    .asoc-leyenda { display:flex; flex-wrap:wrap; gap:8px; }
    .asoc-leg { display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:600; color:var(--text-muted); background:rgba(0,0,0,.03); padding:6px 12px; border-radius:20px; }
    .asoc-leg-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

    .asoc-nom-cell { display:flex; align-items:center; gap:11px; }
    .asoc-avatar { width:38px; height:38px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .asoc-avatar svg { width:18px; height:18px; }
    .asoc-td-nombre { font-weight:700; color:var(--text); }

    .asoc-pct { min-width:120px; }
    .asoc-pct-val { font-size:14px; font-weight:800; }
    .asoc-bar { height:6px; background:#eef0f4; border-radius:20px; overflow:hidden; margin-top:6px; }
    .asoc-bar-fill { height:100%; border-radius:20px; transition:width .5s ease; }

    .asoc-accion { width:36px; height:36px; border-radius:50%; border:1px solid var(--border); background:var(--surface); color:var(--text-muted); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:background .15s,color .15s,border-color .15s; }
    .asoc-accion:hover { background:rgba(80,108,255,.1); color:#506CFF; border-color:transparent; }
    .asoc-accion svg { width:17px; height:17px; }

    .asoc-dash { color:var(--text-dim); }
    .asoc-crec { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:700; }
    .asoc-crec-up   { background:rgba(24,174,151,.12); color:#0a9e83; }
    .asoc-crec-down { background:rgba(201,26,68,.10);  color:var(--err); }
    .asoc-crec-flat { background:rgba(0,0,0,.05);      color:var(--text-muted); }
    .asoc-empty { text-align:center; padding:40px 0; color:var(--text-dim); font-size:14px; }

    /* Tabla → tarjetas en móvil */
    .asoc-cards-mobile { display:none; }
    .asoc-card { background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:16px; }
    .asoc-card + .asoc-card { margin-top:12px; }
    .asoc-card-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .asoc-card-nombre { font-size:15px; font-weight:700; color:var(--text); }
    .asoc-card-pct { margin-top:14px; }
    .asoc-card-row { display:flex; gap:10px; margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }
    .asoc-card-cell { flex:1; display:flex; flex-direction:column; gap:4px; }
    .asoc-card-cell b { font-size:15px; font-weight:700; color:var(--text); }
    .asoc-card-mini { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.5px; }

    @media (max-width:900px) {
      .asoc-kpis { grid-template-columns:repeat(2,1fr); }
      .asoc-tabla-desktop { display:none; }
      .asoc-cards-mobile { display:block; }
      .asoc-tabla-card { padding:16px; }
    }
  `;
  document.head.appendChild(s);
})();
