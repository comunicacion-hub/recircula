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
        _kpiBox('asoc-kpi-k1', fmtNum(k.recicladores), 'Recicladores') +
        _kpiBox('asoc-kpi-k2', fmtNum(k.asociaciones), 'Asociaciones') +
        _kpiBox('asoc-kpi-k3', fmtNum(k.lideres), 'Líderes de ReCircula') +
        _kpiBox('asoc-kpi-k4', fmtNum(k.fortalecimiento), 'En Fortalecimiento') +
        _kpiBox('asoc-kpi-k5', fmtNum(k.acompanamiento), 'En Acompañamiento') +
      '</div>' +

      '<div id="home-tabla">' + _tabla() + '</div>';

    document.getElementById('main-content').innerHTML = html;
    updateFilterBadge('home');
  }

  function _kpiBox(cls, num, lbl) {
    return '<div class="asoc-kpi"><div class="asoc-kpi-num ' + cls + '">' + num + '</div>' +
           '<div class="asoc-kpi-lbl">' + esc(lbl) + '</div></div>';
  }

  // ── Tabla resumen (desktop) + tarjetas (móvil) ──
  function _tabla() {
    const filas = _filas();
    if (!filas.length) {
      return '<div class="card"><p class="asoc-empty">No hay asociaciones que coincidan con el filtro.</p></div>';
    }

    const filasTabla = filas.map(function (f) {
      return '<tr>' +
        '<td class="asoc-td-nombre">' + esc(f.nombre) + '</td>' +
        '<td>' + (f.ini != null ? fmtNum(f.ini, 1) + '%' : '<span class="asoc-dash">—</span>') + '</td>' +
        '<td>' + (f.cie != null ? fmtNum(f.cie, 1) + '%' : '<span class="asoc-dash">—</span>') + '</td>' +
        '<td>' + _crecBadge(f.crec) + '</td>' +
        '<td>' + categoriaBadge(f.categoria) + '</td>' +
      '</tr>';
    }).join('');
    const tabla = '<div class="table-wrap asoc-tabla-desktop"><table>' +
      '<thead><tr><th>Asociación</th><th>% Inicial</th><th>% Cierre</th><th>Crecimiento</th><th>Categoría</th></tr></thead>' +
      '<tbody>' + filasTabla + '</tbody></table></div>';

    const cards = filas.map(function (f) {
      return '<div class="asoc-card">' +
        '<div class="asoc-card-top">' +
          '<div><div class="asoc-card-label">Asociación</div><div class="asoc-card-nombre">' + esc(f.nombre) + '</div></div>' +
          categoriaBadge(f.categoria) +
        '</div>' +
        '<div class="asoc-card-row">' +
          '<div class="asoc-card-cell"><span class="asoc-card-mini">% Inicial</span><b>' + (f.ini != null ? fmtNum(f.ini, 1) + '%' : '—') + '</b></div>' +
          '<div class="asoc-card-cell"><span class="asoc-card-mini">% Cierre</span><b>' + (f.cie != null ? fmtNum(f.cie, 1) + '%' : '—') + '</b></div>' +
          '<div class="asoc-card-cell"><span class="asoc-card-mini">Crecimiento</span>' + _crecBadge(f.crec) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    const cardsWrap = '<div class="asoc-cards-mobile">' + cards + '</div>';

    return tabla + cardsWrap;
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
    .asoc-kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:14px; margin-bottom:22px; }
    .asoc-kpi { background:var(--surface); border-radius:18px; padding:18px 14px; box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 14px rgba(0,0,0,.04); text-align:center; }
    .asoc-kpi-num { font-size:30px; font-weight:800; line-height:1; background-clip:text; -webkit-background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
    .asoc-kpi-k1 { background-image:var(--grad-b); }
    .asoc-kpi-k2 { background-image:var(--grad-c); }
    .asoc-kpi-k3 { background-image:var(--grad-d); }
    .asoc-kpi-k4 { background-image:var(--grad-a); }
    .asoc-kpi-k5 { background-image:var(--grad-e); }
    .asoc-kpi-lbl { font-size:12px; color:var(--text-muted); margin-top:7px; font-weight:600; line-height:1.25; }

    .asoc-td-nombre { font-weight:600; color:var(--text); }
    .asoc-dash { color:var(--text-dim); }
    .asoc-crec { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:700; }
    .asoc-crec-up   { background:rgba(24,174,151,.12); color:#0a9e83; }
    .asoc-crec-down { background:rgba(201,26,68,.10);  color:var(--err); }
    .asoc-crec-flat { background:rgba(0,0,0,.05);      color:var(--text-muted); }
    .asoc-empty { text-align:center; padding:40px 0; color:var(--text-dim); font-size:14px; }

    /* Tabla → tarjetas en móvil */
    .asoc-cards-mobile { display:none; }
    .asoc-card { background:var(--surface); border-radius:20px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.04); }
    .asoc-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
    .asoc-card-label { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.7px; }
    .asoc-card-nombre { font-size:16px; font-weight:700; color:var(--text); margin-top:2px; }
    .asoc-card-row { display:flex; gap:10px; margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }
    .asoc-card-cell { flex:1; display:flex; flex-direction:column; gap:4px; }
    .asoc-card-cell b { font-size:15px; font-weight:700; color:var(--text); }
    .asoc-card-mini { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:.5px; }

    @media (max-width:768px) {
      .asoc-kpis { grid-template-columns:repeat(2,1fr); }
      .asoc-tabla-desktop { display:none; }
      .asoc-cards-mobile { display:flex; flex-direction:column; gap:12px; }
    }
  `;
  document.head.appendChild(s);
})();
