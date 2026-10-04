// ============================================================
// RECIRCULA — configuraciones/app.js
// Sección solo para Admin: usuarios y sus dashboards, módulos
// (colección Modulos) y períodos visibles en todos los dashboards
// (Configuracion/periodos). Reemplaza al antiguo Hub.
// ============================================================

const DOMAIN   = 'redesconrostro.org';
const HUB_URL  = 'https://recircula.redesconrostro.org';   // inicio de sesión
const MODULO_ACTUAL = 'configuraciones';
const ANIO_INICIO = 2025;   // primer año que aparece en Períodos (antes no hay datos)
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const PERIODOS_DEFECTO = { '2026': [1, 2, 3, 4] };   // mismo valor que en los dashboards

let SESSION = null;
let USUARIOS = [];
let MODULOS  = [];
let PER_GUARDADO = {};   // { '2026': [1,2,3,4] } meses OCULTOS por año, tal como está en Firestore
let PER_EDIT     = {};   // copia de trabajo: { '2026': [false x4, true x8] } true = se ve
let CURRENT_SECTION = null;
let APP_INICIADA = false;

// ============================================================
// HELPERS FIRESTORE (sobre window.fb)
// ============================================================

function fsCol(nombre) { return window.fb.collection(window.fb.db, nombre); }
function fsDoc(nombre, id) { return window.fb.doc(window.fb.db, nombre, id); }

async function fsGetAll(nombre) {
  const snap = await window.fb.getDocs(fsCol(nombre));
  return snap.docs.map(function(d) { return Object.assign({ _docId: d.id }, d.data()); });
}

function isActivo(v) { return v === true || v === 'TRUE' || v === 'true'; }

// Guarda los módulos en la caché que leen los dashboards para el menú de la flechita
function _actualizarCacheModulos() {
  try {
    const cache = _leerJSON(localStorage, 'rcr_hub_data') || {};
    cache.modulos = MODULOS;
    localStorage.setItem('rcr_hub_data', JSON.stringify(cache));
  } catch (e) {}
}

// ============================================================
// INICIO — autenticación + carga
// ============================================================

window.addEventListener('load', async function() {
  if (!window.fb) {
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;color:#555">No se pudo cargar Firebase. Revisá tu conexión e intentá de nuevo.</div>';
    return;
  }
  await window.fbReady;

  window.fb.onAuthStateChanged(window.fb.auth, async function(user) {
    if (!user) { window.location.href = HUB_URL; return; }
    if (APP_INICIADA) return;
    APP_INICIADA = true;
    await iniciarApp(user);
  });
});

async function iniciarApp(user) {
  initModSwitch();
  try {
    const res = await Promise.all([
      fsGetAll('Usuarios'),
      fsGetAll('Modulos'),
      fsGetAll('Configuracion').catch(function(e) { console.warn('Configuracion:', e); return []; }),
    ]);
    USUARIOS = res[0];
    MODULOS  = res[1];
    const per = res[2].find(function(d) { return d._docId === 'periodos'; });
    PER_GUARDADO = (per && per.ocultos && typeof per.ocultos === 'object') ? per.ocultos : PERIODOS_DEFECTO;
  } catch (e) {
    console.error('iniciarApp:', e);
    showToast('Error al cargar la configuración');
  }

  // Solo Admin (se verifica contra Firestore, no contra lo guardado en el navegador)
  const email = (user.email || '').toLowerCase();
  const me = USUARIOS.find(function(u) { return (u.email || '').toLowerCase() === email; });
  if (!me || me.rol !== 'Admin' || me.activo === false) { window.location.replace(HUB_URL); return; }
  SESSION = {
    _docId:  me._docId,
    nombre:  me.nombre || user.displayName || 'Admin',
    email:   email,
    rol:     'Admin',
    modulos: Array.isArray(me.modulos) ? me.modulos : [],
  };
  sessionStorage.setItem('rcr_session', JSON.stringify(SESSION));

  _actualizarCacheModulos();
  await cargarModulosNav();
  _resetPeriodos();
  mostrarApp();
  pintarIconosNav();
  navTo('usuarios');
}

function pintarIconosNav() {
  const map = { 'nav-usuarios': 'users', 'nav-modulos': 'grid', 'nav-periodos': 'calendar' };
  Object.keys(map).forEach(function(id) {
    const el = document.getElementById(id);
    if (el && !el.querySelector('svg')) el.insertAdjacentHTML('afterbegin', icoHTML(map[id]));
  });
}

// ============================================================
// NAVEGACIÓN
// ============================================================

function navTo(seccion) {
  CURRENT_SECTION = seccion;
  document.querySelectorAll('.bn-item').forEach(function(el) { el.classList.remove('active'); });
  const navEl = document.getElementById('nav-' + seccion);
  if (navEl) navEl.classList.add('active');
  closeModMenu();

  switch (seccion) {
    case 'usuarios': renderUsuarios(); break;
    case 'modulos':  renderModulos();  break;
    case 'periodos': renderPeriodos(); break;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Topbar común: el selector "recircula / configuraciones" lo inserta el observer
function _header(accionPrimaria) {
  return '<div class="page-header">' +
    '<div class="hdr-actions">' +
      (accionPrimaria || '') +
      '<button class="hdr-circle" onclick="cerrarSesion()" title="Cerrar sesión" aria-label="Cerrar sesión">' + icoHTML('logout') + '</button>' +
    '</div>' +
  '</div>';
}

function _render(html) { document.getElementById('main-content').innerHTML = html; }

// ============================================================
// USUARIOS
// ============================================================

function _slugDeModulo(id) {
  const m = MODULOS.find(function(x) { return x.id_modulo === id; });
  return m ? (_slugModulo(m.url || '') || m.nombre || id) : id;
}

function _modulosOrdenados() {
  return MODULOS.slice().sort(function(a, b) { return String(a.id_modulo || '').localeCompare(String(b.id_modulo || '')); });
}

function _iniciales(n) {
  const p = String(n || '?').trim().split(/\s+/).filter(Boolean);
  return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

function _rolBadge(rol) {
  const cls = rol === 'Admin' ? 'cfg-b-admin' : rol === 'Editor' ? 'cfg-b-editor' : 'cfg-b-vis';
  return '<span class="badge ' + cls + '">' + esc(rol || 'Visualizador') + '</span>';
}

function renderUsuarios() {
  const lista = USUARIOS.slice().sort(function(a, b) { return String(a.nombre || '').localeCompare(String(b.nombre || '')); });
  const mods = _modulosOrdenados();

  const filas = lista.map(function(u) {
    const activo = u.activo !== false;
    const asignados = Array.isArray(u.modulos) ? u.modulos : [];
    const pills = u.rol === 'Admin'
      ? '<span class="cfg-pill all">Todos los dashboards</span>'
      : (mods.map(function(m) {
          const on = asignados.indexOf(m.id_modulo) >= 0;
          return '<span class="cfg-pill' + (on ? '' : ' off') + '">' + esc(_slugDeModulo(m.id_modulo)) + '</span>';
        }).join('') || '<span class="cfg-pill off">Sin dashboards</span>');
    const yo = SESSION && u._docId === SESSION._docId;
    return '<div class="cfg-row' + (activo ? '' : ' inactivo') + '">' +
      '<div class="cfg-who"><div class="cfg-ava">' + esc(_iniciales(u.nombre)) + '</div>' +
        '<div class="cfg-who-txt"><div class="cfg-name">' + esc(u.nombre || '—') + (yo ? ' <span class="cfg-yo">tú</span>' : '') + '</div>' +
        '<div class="cfg-sub">' + esc(u.email || '') + '</div></div></div>' +
      _rolBadge(u.rol) +
      '<div class="cfg-pills">' + pills + '</div>' +
      '<span class="badge ' + (activo ? 'badge-on' : 'badge-off') + '">' + (activo ? 'Activo' : 'Inactivo') + '</span>' +
      '<div class="cfg-acts">' +
        '<button class="icon-btn" onclick="abrirFormUsuario(\'' + jsEsc(u._docId) + '\')" title="Editar" aria-label="Editar">' + icoHTML('edit') + '</button>' +
        (yo ? '' : '<button class="icon-btn del" onclick="confirmarEliminarUsuario(\'' + jsEsc(u._docId) + '\')" title="Eliminar" aria-label="Eliminar">' + icoHTML('trash') + '</button>') +
      '</div>' +
    '</div>';
  }).join('');

  _render(
    _header('<button class="hdr-circle hdr-circle-primary" onclick="abrirFormUsuario()" title="Agregar usuario" aria-label="Agregar usuario">' + icoHTML('plus') + '</button>') +
    '<div class="card">' +
      '<div class="cfg-card-head"><div>' +
        '<div class="cfg-card-title">Usuarios · ' + lista.length + '</div>' +
        '<div class="cfg-card-sub">Quién puede entrar y a qué dashboards. El Admin ve todo, incluida esta sección. Los cambios se aplican la próxima vez que la persona inicie sesión.</div>' +
      '</div></div>' +
      '<div class="cfg-rows">' + (filas || '<div class="cfg-empty">Todavía no hay usuarios.</div>') + '</div>' +
    '</div>'
  );
}

// Borrador del formulario (rol, dashboards y estado se eligen con chips)
let _usrDraft = null;

function abrirFormUsuario(docId) {
  const u = docId ? USUARIOS.find(function(x) { return x._docId === docId; }) : null;
  if (docId && !u) return;
  _usrDraft = {
    docId:   docId || '',
    nombre:  u ? (u.nombre || '') : '',
    email:   u ? (u.email || '') : '',
    rol:     u ? (u.rol || 'Visualizador') : 'Visualizador',
    modulos: u && Array.isArray(u.modulos) ? u.modulos.slice() : [],
    activo:  u ? u.activo !== false : true,
  };
  _pintarFormUsuario();
}

function _pintarFormUsuario() {
  const d = _usrDraft;
  const ayudaRol = {
    Admin: 'Ve y edita todo, incluida configuraciones.',
    Editor: 'Puede crear y editar registros en sus dashboards.',
    Visualizador: 'Solo lectura en sus dashboards.',
  }[d.rol] || '';
  const chipsMods = d.rol === 'Admin'
    ? '<div class="cfg-hint">El Admin ve todos los dashboards.</div>'
    : '<div class="filter-chips">' + _modulosOrdenados().map(function(m) {
        const on = d.modulos.indexOf(m.id_modulo) >= 0;
        return '<button type="button" class="filter-chip' + (on ? ' on' : '') + '" onclick="_usrToggleModulo(\'' + jsEsc(m.id_modulo) + '\')">' + esc(_slugDeModulo(m.id_modulo)) + '</button>';
      }).join('') + '</div>';

  abrirModal(
    '<div class="modal" style="max-width:520px">' +
      '<div class="modal-head"><div>' +
        '<div class="modal-title">' + (d.docId ? 'Editar usuario' : 'Nuevo usuario') + '</div>' +
        '<div class="modal-sub">' + (d.docId ? 'Cambia su rol, dashboards o estado' : 'Entrará con su cuenta de Google @' + DOMAIN) + '</div>' +
      '</div><button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-group"><label class="form-label" for="usr-nombre">Nombre *</label>' +
          '<input type="text" class="form-input" id="usr-nombre" placeholder="Nombre y apellido" value="' + esc(d.nombre) + '"></div>' +
        '<div class="form-group"><label class="form-label" for="usr-email">Correo *</label>' +
          '<input type="email" class="form-input" id="usr-email" placeholder="nombre@' + DOMAIN + '" value="' + esc(d.email) + '"' + (d.docId ? ' readonly' : '') + '></div>' +
        '<div class="form-group"><div class="form-label">Rol</div><div class="filter-chips">' +
          ['Admin', 'Editor', 'Visualizador'].map(function(r) {
            return '<button type="button" class="filter-chip' + (d.rol === r ? ' on' : '') + '" onclick="_usrSet(\'rol\', \'' + r + '\')">' + r + '</button>';
          }).join('') +
        '</div><div class="cfg-hint">' + ayudaRol + '</div></div>' +
        '<div class="form-group"><div class="form-label">Dashboards que puede ver</div>' + chipsMods + '</div>' +
        '<div class="form-group" style="margin-bottom:0"><div class="form-label">Estado</div><div class="filter-chips">' +
          '<button type="button" class="filter-chip' + (d.activo ? ' on' : '') + '" onclick="_usrSet(\'activo\', true)">Activo</button>' +
          '<button type="button" class="filter-chip' + (!d.activo ? ' on' : '') + '" onclick="_usrSet(\'activo\', false)">Inactivo</button>' +
        '</div></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-primary" id="usr-guardar" onclick="guardarUsuario()">' + icoHTML('check') + (d.docId ? 'Guardar' : 'Agregar') + '</button>' +
      '</div>' +
    '</div>'
  );
}

// Conserva lo escrito antes de repintar el formulario
function _usrLeerCampos() {
  const n = document.getElementById('usr-nombre'), e = document.getElementById('usr-email');
  if (n) _usrDraft.nombre = n.value;
  if (e) _usrDraft.email = e.value;
}
function _usrSet(campo, valor) { _usrLeerCampos(); _usrDraft[campo] = valor; _pintarFormUsuario(); }
function _usrToggleModulo(id) {
  _usrLeerCampos();
  const i = _usrDraft.modulos.indexOf(id);
  if (i < 0) _usrDraft.modulos.push(id); else _usrDraft.modulos.splice(i, 1);
  _pintarFormUsuario();
}

async function guardarUsuario() {
  _usrLeerCampos();
  const d = _usrDraft;
  const nombre = d.nombre.trim();
  const email  = d.email.trim().toLowerCase();
  if (!nombre || !email) { showToast('Escribe el nombre y el correo'); return; }
  if (!d.docId && !email.endsWith('@' + DOMAIN)) { showToast('El correo debe ser @' + DOMAIN); return; }

  const yo = SESSION && d.docId === SESSION._docId;
  if (yo && d.rol !== 'Admin') { showToast('No puedes quitarte el rol de Admin a ti mismo'); return; }
  if (yo && !d.activo) { showToast('No puedes desactivar tu propio usuario'); return; }

  // El Admin ve todo: se le guardan todos los módulos para que el dato sea coherente
  const modulos = d.rol === 'Admin' ? MODULOS.map(function(m) { return m.id_modulo; }).filter(Boolean) : d.modulos.slice();
  const btn = document.getElementById('usr-guardar'); if (btn) btn.disabled = true;

  try {
    if (d.docId) {
      const cambios = { nombre: nombre, rol: d.rol, activo: d.activo, modulos: modulos };
      await window.fb.updateDoc(fsDoc('Usuarios', d.docId), cambios);
      const i = USUARIOS.findIndex(function(x) { return x._docId === d.docId; });
      if (i >= 0) USUARIOS[i] = Object.assign({}, USUARIOS[i], cambios);
      if (yo) { SESSION.nombre = nombre; sessionStorage.setItem('rcr_session', JSON.stringify(SESSION)); }
    } else {
      const existe = USUARIOS.some(function(x) { return (x.email || '').toLowerCase() === email; });
      if (existe) { showToast('Ya existe un usuario con ese correo'); if (btn) btn.disabled = false; return; }
      const nuevo = { id_usuario: 'USR_' + Date.now(), nombre: nombre, email: email, rol: d.rol, activo: d.activo, modulos: modulos };
      const ref = await window.fb.addDoc(fsCol('Usuarios'), nuevo);
      USUARIOS.push(Object.assign({ _docId: ref.id }, nuevo));
    }
    cerrarModal();
    renderUsuarios();
    showToast(d.docId ? 'Usuario actualizado' : 'Usuario agregado');
  } catch (e) {
    console.error('guardarUsuario:', e);
    showToast('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
    if (btn) btn.disabled = false;
  }
}

function confirmarEliminarUsuario(docId) {
  const u = USUARIOS.find(function(x) { return x._docId === docId; });
  if (!u) return;
  abrirModal(
    '<div class="modal" style="max-width:440px">' +
      '<div class="modal-head"><div class="modal-title">Eliminar usuario</div><button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body"><p style="color:var(--text-muted);font-size:14px;line-height:1.6">' +
        '¿Seguro que quieres eliminar a <strong>' + esc(u.nombre || u.email) + '</strong>? Ya no podrá entrar a ningún dashboard. Esta acción no se puede deshacer.' +
      '</p></div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-danger" onclick="eliminarUsuario(\'' + jsEsc(docId) + '\')">Eliminar</button>' +
      '</div>' +
    '</div>'
  );
}

async function eliminarUsuario(docId) {
  if (SESSION && docId === SESSION._docId) { showToast('No puedes eliminar tu propio usuario'); return; }
  try {
    await window.fb.deleteDoc(fsDoc('Usuarios', docId));
    USUARIOS = USUARIOS.filter(function(x) { return x._docId !== docId; });
    cerrarModal();
    renderUsuarios();
    showToast('Usuario eliminado');
  } catch (e) {
    console.error('eliminarUsuario:', e);
    showToast('No se pudo eliminar. Revisa tu conexión e intenta de nuevo.');
  }
}

// ============================================================
// MÓDULOS (colección Modulos: lo que aparece en la flechita)
// ============================================================

function _estiloModulo(m) {
  const n = String((m.nombre || '') + ' ' + (m.url || '')).toLowerCase();
  if (n.indexOf('ambient') >= 0)   return { ico: 'recycle', fg: '#0778bf', bg: '#e6f1fb' };
  if (n.indexOf('asociativ') >= 0) return { ico: 'users',   fg: '#0f6e56', bg: '#e1f5ee' };
  if (n.indexOf('social') >= 0)    return { ico: 'user',    fg: '#185fa5', bg: '#eef3fb' };
  return { ico: 'grid', fg: '#506CFF', bg: 'rgba(80,108,255,0.1)' };
}

function renderModulos() {
  const filas = _modulosOrdenados().map(function(m) {
    const activo = isActivo(m.activo);
    const st = _estiloModulo(m);
    return '<div class="cfg-row cfg-row-mod' + (activo ? '' : ' inactivo') + '">' +
      '<div class="cfg-who"><div class="cfg-mod-ico" style="color:' + st.fg + ';background:' + st.bg + '">' + icoHTML(st.ico) + '</div>' +
        '<div class="cfg-who-txt"><div class="cfg-name">' + esc(m.nombre || '—') + '</div>' +
        '<div class="cfg-sub">' + esc(m.descripcion || '') + (m.descripcion ? ' · ' : '') + esc(m.id_modulo || '') + '</div></div></div>' +
      '<div class="cfg-url">' + esc(m.url || 'Sin enlace') + '</div>' +
      '<span class="badge ' + (activo ? 'badge-on' : 'badge-off') + '">' + (activo ? 'Activo' : 'Inactivo') + '</span>' +
      '<div class="cfg-acts">' +
        '<button class="icon-btn" onclick="abrirFormModulo(\'' + jsEsc(m._docId) + '\')" title="Editar" aria-label="Editar">' + icoHTML('edit') + '</button>' +
        '<button class="icon-btn del" onclick="confirmarEliminarModulo(\'' + jsEsc(m._docId) + '\')" title="Quitar" aria-label="Quitar">' + icoHTML('trash') + '</button>' +
      '</div>' +
    '</div>';
  }).join('');

  _render(
    _header('<button class="hdr-circle hdr-circle-primary" onclick="abrirFormModulo()" title="Nuevo módulo" aria-label="Nuevo módulo">' + icoHTML('plus') + '</button>') +
    '<div class="card">' +
      '<div class="cfg-card-head"><div>' +
        '<div class="cfg-card-title">Módulos · ' + MODULOS.length + '</div>' +
        '<div class="cfg-card-sub">Los dashboards que aparecen en el menú de la flechita. Un módulo inactivo no se muestra a nadie.</div>' +
      '</div></div>' +
      '<div class="cfg-rows">' + (filas || '<div class="cfg-empty">Todavía no hay módulos.</div>') + '</div>' +
    '</div>'
  );
}

let _modDraftActivo = true;

function abrirFormModulo(docId) {
  const m = docId ? MODULOS.find(function(x) { return x._docId === docId; }) : null;
  if (docId && !m) return;
  _modDraftActivo = m ? isActivo(m.activo) : true;
  _pintarFormModulo(docId || '', {
    nombre: m ? (m.nombre || '') : '',
    url:    m ? (m.url || '') : '',
    desc:   m ? (m.descripcion || '') : '',
  });
}

function _pintarFormModulo(docId, v) {
  abrirModal(
    '<div class="modal" style="max-width:520px">' +
      '<div class="modal-head"><div>' +
        '<div class="modal-title">' + (docId ? 'Editar módulo' : 'Nuevo módulo') + '</div>' +
        '<div class="modal-sub">Así aparece en el menú de la flechita</div>' +
      '</div><button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body">' +
        '<div class="form-group"><label class="form-label" for="mod-nombre">Nombre *</label>' +
          '<input type="text" class="form-input" id="mod-nombre" placeholder="Dashboard ..." value="' + esc(v.nombre) + '"></div>' +
        '<div class="form-group"><label class="form-label" for="mod-url">Enlace</label>' +
          '<input type="url" class="form-input" id="mod-url" placeholder="' + HUB_URL + '/..." value="' + esc(v.url) + '"></div>' +
        '<div class="form-group"><label class="form-label" for="mod-desc">Descripción</label>' +
          '<input type="text" class="form-input" id="mod-desc" value="' + esc(v.desc) + '"></div>' +
        '<div class="form-group" style="margin-bottom:0"><div class="form-label">Estado</div><div class="filter-chips">' +
          '<button type="button" class="filter-chip' + (_modDraftActivo ? ' on' : '') + '" onclick="_modSetActivo(\'' + jsEsc(docId) + '\', true)">Activo</button>' +
          '<button type="button" class="filter-chip' + (!_modDraftActivo ? ' on' : '') + '" onclick="_modSetActivo(\'' + jsEsc(docId) + '\', false)">Inactivo</button>' +
        '</div></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-primary" id="mod-guardar" onclick="guardarModulo(\'' + jsEsc(docId) + '\')">' + icoHTML('check') + (docId ? 'Guardar' : 'Crear') + '</button>' +
      '</div>' +
    '</div>'
  );
}

function _modLeerCampos() {
  return {
    nombre: (document.getElementById('mod-nombre') || {}).value || '',
    url:    (document.getElementById('mod-url') || {}).value || '',
    desc:   (document.getElementById('mod-desc') || {}).value || '',
  };
}
function _modSetActivo(docId, val) { const v = _modLeerCampos(); _modDraftActivo = val; _pintarFormModulo(docId, v); }

function _urlValida(s) {
  try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:'; } catch (e) { return false; }
}

// Siguiente id con el formato existente: MOD001, MOD002, ...
function _nuevoIdModulo() {
  const max = MODULOS.reduce(function(acc, m) {
    const n = parseInt(String(m.id_modulo || '').replace(/^MOD_?/i, ''), 10);
    return (!isNaN(n) && n < 100000) ? Math.max(acc, n) : acc;
  }, 0);
  return 'MOD' + String(max + 1).padStart(3, '0');
}

async function guardarModulo(docId) {
  const v = _modLeerCampos();
  const nombre = v.nombre.trim(), url = v.url.trim(), desc = v.desc.trim();
  if (!nombre) { showToast('Escribe el nombre del módulo'); return; }
  if (url && !_urlValida(url)) { showToast('El enlace debe empezar con https://'); return; }
  const btn = document.getElementById('mod-guardar'); if (btn) btn.disabled = true;

  try {
    if (docId) {
      const cambios = { nombre: nombre, url: url, descripcion: desc, activo: _modDraftActivo };
      await window.fb.updateDoc(fsDoc('Modulos', docId), cambios);
      const i = MODULOS.findIndex(function(x) { return x._docId === docId; });
      if (i >= 0) MODULOS[i] = Object.assign({}, MODULOS[i], cambios);
    } else {
      const nuevo = { id_modulo: _nuevoIdModulo(), nombre: nombre, url: url, descripcion: desc, activo: _modDraftActivo };
      const ref = await window.fb.addDoc(fsCol('Modulos'), nuevo);
      MODULOS.push(Object.assign({ _docId: ref.id }, nuevo));
    }
    _actualizarCacheModulos();
    await cargarModulosNav();
    cerrarModal();
    renderModulos();
    showToast(docId ? 'Módulo guardado' : 'Módulo creado');
  } catch (e) {
    console.error('guardarModulo:', e);
    showToast('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
    if (btn) btn.disabled = false;
  }
}

function confirmarEliminarModulo(docId) {
  const m = MODULOS.find(function(x) { return x._docId === docId; });
  if (!m) return;
  abrirModal(
    '<div class="modal" style="max-width:440px">' +
      '<div class="modal-head"><div class="modal-title">Quitar módulo</div><button class="modal-close" onclick="cerrarModal()"></button></div>' +
      '<div class="modal-body"><p style="color:var(--text-muted);font-size:14px;line-height:1.6">' +
        '¿Quitar <strong>' + esc(m.nombre || 'este módulo') + '</strong>? Dejará de aparecer en el menú para todos. El dashboard sigue existiendo en su enlace y puedes volver a crearlo con el botón +.' +
      '</p></div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn-glass" onclick="cerrarModal()">Cancelar</button>' +
        '<button class="btn btn-danger" onclick="eliminarModulo(\'' + jsEsc(docId) + '\')">Quitar</button>' +
      '</div>' +
    '</div>'
  );
}

async function eliminarModulo(docId) {
  try {
    await window.fb.deleteDoc(fsDoc('Modulos', docId));
    MODULOS = MODULOS.filter(function(x) { return x._docId !== docId; });
    _actualizarCacheModulos();
    await cargarModulosNav();
    cerrarModal();
    renderModulos();
    showToast('Módulo quitado');
  } catch (e) {
    console.error('eliminarModulo:', e);
    showToast('No se pudo quitar. Revisa tu conexión e intenta de nuevo.');
  }
}

// ============================================================
// PERÍODOS VISIBLES (Configuracion/periodos)
// En Firestore se guardan los meses OCULTOS por año; en pantalla se
// marca lo que SE VE. Así un año nuevo aparece completo sin tocar nada.
// ============================================================

function _aniosPeriodos() {
  const actual = new Date().getFullYear();
  const claves = Object.keys(PER_GUARDADO).map(Number).filter(function(n) { return n > 2000; });
  const desde = Math.min.apply(null, [ANIO_INICIO].concat(claves));
  const hasta = Math.max.apply(null, [actual].concat(claves));
  const anios = [];
  for (let y = desde; y <= hasta; y++) anios.push(String(y));
  return anios;
}

function _resetPeriodos() {
  PER_EDIT = {};
  _aniosPeriodos().forEach(function(y) {
    const ocultos = Array.isArray(PER_GUARDADO[y]) ? PER_GUARDADO[y].map(Number) : [];
    PER_EDIT[y] = MESES_CORTOS.map(function(_, k) { return ocultos.indexOf(k + 1) < 0; });
  });
}

function _ocultosDesdeEdit() {
  const out = {};
  Object.keys(PER_EDIT).forEach(function(y) {
    const ocultos = [];
    PER_EDIT[y].forEach(function(visible, k) { if (!visible) ocultos.push(k + 1); });
    if (ocultos.length) out[y] = ocultos;
  });
  return out;
}

function _periodosSinGuardar() {
  const norm = function(o) {
    const r = {};
    Object.keys(o).sort().forEach(function(y) {
      const arr = (o[y] || []).map(Number).sort(function(a, b) { return a - b; });
      if (arr.length) r[y] = arr;
    });
    return JSON.stringify(r);
  };
  return norm(_ocultosDesdeEdit()) !== norm(PER_GUARDADO);
}

function renderPeriodos() {
  const anios = Object.keys(PER_EDIT).sort();
  const sinGuardar = _periodosSinGuardar();

  const bloques = anios.map(function(y) {
    const arr = PER_EDIT[y];
    const n = arr.filter(Boolean).length;
    const estado = n === 12 ? '' : n === 0 ? ' nada' : ' parcial';
    const meta = n === 12 ? '<b>Todo el año visible</b>' : n === 0 ? '<b>Año oculto</b>' : '<b>' + n + ' de 12</b> meses visibles';
    return '<div class="per-yr">' +
      '<div class="per-yr-head">' +
        '<div class="per-yr-num">' + y + '</div>' +
        '<div class="per-yr-meta' + estado + '">' + meta + '</div>' +
        '<button type="button" class="per-chip per-chip-all' + (n === 12 ? ' on' : '') + '" aria-pressed="' + (n === 12) + '" onclick="togglePeriodoAnio(\'' + y + '\')">Todo el año</button>' +
      '</div>' +
      '<div class="per-months">' + MESES_CORTOS.map(function(mm, k) {
        return '<button type="button" class="per-chip' + (arr[k] ? ' on' : '') + '" aria-pressed="' + arr[k] + '" onclick="togglePeriodoMes(\'' + y + '\',' + k + ')">' + mm + '</button>';
      }).join('') + '</div>' +
    '</div>';
  }).join('');

  _render(
    _header('') +
    '<div class="card">' +
      '<div class="cfg-card-head"><div>' +
        '<div class="cfg-card-title">Períodos visibles</div>' +
        '<div class="cfg-card-sub">Lo marcado se ve en ambiental, asociativo y social, para todos los usuarios. Lo desmarcado se oculta de gráficos, tablas y descargas.</div>' +
      '</div></div>' +
      '<div class="per-years">' + bloques + '</div>' +
      '<div class="per-note">' + icoHTML('info') + '<span>Cuando empiece un año nuevo, aparecerá aquí completo y visible hasta que lo desmarques. Los registros que solo tienen año (sin mes) se ocultan cuando todo su año está desmarcado.</span></div>' +
      '<div class="per-foot">' +
        (sinGuardar ? '<span class="per-dirty">Hay cambios sin guardar</span>' : '') +
        '<button class="btn btn-glass" onclick="descartarPeriodos()"' + (sinGuardar ? '' : ' disabled') + '>Descartar</button>' +
        '<button class="btn btn-primary" id="per-guardar" onclick="guardarPeriodos()"' + (sinGuardar ? '' : ' disabled') + '>' + icoHTML('check') + 'Guardar cambios</button>' +
      '</div>' +
    '</div>'
  );
}

function togglePeriodoMes(y, k) { PER_EDIT[y][k] = !PER_EDIT[y][k]; renderPeriodos(); }
function togglePeriodoAnio(y) {
  const todos = PER_EDIT[y].every(Boolean);
  PER_EDIT[y] = MESES_CORTOS.map(function() { return !todos; });
  renderPeriodos();
}
function descartarPeriodos() { _resetPeriodos(); renderPeriodos(); }

async function guardarPeriodos() {
  const ocultos = _ocultosDesdeEdit();
  const btn = document.getElementById('per-guardar'); if (btn) btn.disabled = true;
  try {
    await window.fb.setDoc(fsDoc('Configuracion', 'periodos'), {
      ocultos: ocultos,
      actualizado: new Date().toISOString(),
      actualizado_por: SESSION ? SESSION.email : '',
    });
    PER_GUARDADO = ocultos;
    renderPeriodos();
    showToast('Períodos guardados: se aplican en los 3 dashboards');
  } catch (e) {
    console.error('guardarPeriodos:', e);
    showToast('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// UI — pantallas, toast, modal
// ============================================================

function mostrarApp() {
  const l = document.getElementById('screen-loading'); if (l) l.classList.add('hidden');
  const a = document.getElementById('screen-app');     if (a) a.classList.remove('hidden');
}

function showToast(msg, dur) {
  dur = dur || 3500;
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  if (showToast._tid) clearTimeout(showToast._tid);
  showToast._tid = setTimeout(function() { t.classList.remove('show'); }, dur);
}

function abrirModal(html) {
  const previo = document.getElementById('modal-overlay');
  const yaAbierto = !!previo;
  if (previo) previo.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id        = 'modal-overlay';
  // Al repintar el mismo formulario (chips) no se repite la animación de entrada
  if (yaAbierto) overlay.style.animation = 'none';
  if (yaAbierto) overlay.style.opacity = '1';
  overlay.innerHTML = html;
  if (yaAbierto) { const m = overlay.querySelector('.modal'); if (m) m.style.animation = 'none'; }
  overlay.addEventListener('click', function(e) { if (e.target === overlay) cerrarModal(); });
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.modal-close').forEach(function(el) {
    if (!el.innerHTML.trim()) el.innerHTML = icoHTML('close');
  });
  if (!yaAbierto) {
    setTimeout(function() {
      const first = overlay.querySelector('input:not([readonly])');
      if (first) { try { first.focus({ preventScroll: true }); } catch (e) {} }
    }, 60);
  }
}

function cerrarModal() {
  const m = document.getElementById('modal-overlay');
  if (!m) return;
  m.classList.add('closing');
  setTimeout(function() { m.remove(); }, 200);
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && document.getElementById('modal-overlay')) cerrarModal();
});

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function jsEsc(s) {
  if (s == null) return '';
  return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/\r?\n/g,'\\n');
}

// ============================================================
// SELECTOR DE MÓDULOS — "recircula / configuraciones ⌄" en la topbar
// La lista sale de la colección Modulos: primero la caché que deja el
// inicio de sesión (mismo dominio) y, si no está, directo de Firestore.
// Cada usuario ve solo sus dashboards; el Admin además ve
// "configuraciones". Bloque idéntico en ambiental, asociativo, social
// y configuraciones (solo cambia MODULO_ACTUAL).
// ============================================================

const CONFIG_URL = HUB_URL + '/configuraciones/';
let MODULOS_NAV = [];        // [{ id, slug, url }] módulos activos que el usuario puede ver
let MODULO_BLOQUEADO = false; // el usuario no tiene asignado el dashboard en el que está
let _esAdminNav = false;

function _slugModulo(url) {
  try {
    const path = new URL(url, location.href).pathname
      .replace(/\/index\.html?$/i, '').replace(/\/+$/, '');
    return (path.split('/').pop() || '').toLowerCase();
  } catch (e) { return ''; }
}

function _leerJSON(storage, key) {
  try { return JSON.parse(storage.getItem(key) || 'null'); } catch (e) { return null; }
}

async function cargarModulosNav() {
  let todos = null;
  const cache = _leerJSON(localStorage, 'rcr_hub_data');
  if (cache && Array.isArray(cache.modulos) && cache.modulos.length) todos = cache.modulos;
  if (!todos) {
    try { todos = await fsGetAll('Modulos'); }
    catch (e) { console.warn('cargarModulosNav:', e); todos = []; }
  }

  // Permisos: la sesión del inicio de sesión trae rol + modulos
  const ses = SESSION || _leerJSON(sessionStorage, 'rcr_session') || {};
  const permitidos = Array.isArray(ses.modulos) ? ses.modulos : [];
  _esAdminNav = ses.rol === 'Admin';
  const verTodos = _esAdminNav || ses.externo;

  MODULOS_NAV = todos
    .filter(function(m) {
      const activo = m.activo === true || m.activo === 'TRUE' || m.activo === 'true';
      if (!activo || !m.url || !String(m.url).trim()) return false;
      return verTodos || permitidos.indexOf(m.id_modulo) >= 0;
    })
    .map(function(m) { return { id: m.id_modulo || '', slug: _slugModulo(m.url), url: String(m.url).trim() }; })
    .filter(function(m) { return m.slug; })
    .sort(function(a, b) { return String(a.id).localeCompare(String(b.id)); });

  // Si este dashboard existe en Modulos pero el usuario no lo tiene asignado → bloqueado
  const existe = todos.some(function(m) { return m.url && _slugModulo(String(m.url).trim()) === MODULO_ACTUAL; });
  MODULO_BLOQUEADO = !_esAdminNav && existe && !MODULOS_NAV.some(function(m) { return m.slug === MODULO_ACTUAL; });

  document.querySelectorAll('.mod-switch').forEach(_pintarModSwitch);
}

// Lleva al usuario a un dashboard que sí tenga asignado (o al inicio de sesión)
function salirDeModuloBloqueado() {
  const destino = MODULOS_NAV.find(function(m) { return m.slug !== MODULO_ACTUAL; });
  window.location.replace(destino ? destino.url : HUB_URL);
}

function _opcionesMenu() {
  const ops = MODULOS_NAV.slice();
  if (_esAdminNav) ops.push({ id: '', slug: 'configuraciones', url: CONFIG_URL, sep: true });
  return ops;
}

function _hayOtrosModulos() {
  return _opcionesMenu().some(function(m) { return m.slug !== MODULO_ACTUAL; });
}

function _pintarModSwitch(btn) {
  const multi = _hayOtrosModulos();
  btn.classList.toggle('solo', !multi);
  btn.disabled = !multi;
  btn.setAttribute('aria-expanded', 'false');
}

// Cada sección pinta su propia .page-header; aquí se le inserta el selector
// (reemplaza al breadcrumb que antes ponía el CSS con ::before/::after).
function _injectModSwitch() {
  document.querySelectorAll('#main-content > .page-header:not(.has-switch)').forEach(function(h) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mod-switch';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.innerHTML =
      '<span class="mod-switch-brand">recircula</span>' +
      '<span class="mod-switch-sec">&nbsp;/ ' + esc(MODULO_ACTUAL) + '</span>' +
      '<span class="mod-switch-chev">' + icoHTML('chevDown') + '</span>';
    btn.addEventListener('click', function(e) { e.stopPropagation(); toggleModMenu(btn); });
    _pintarModSwitch(btn);
    h.insertBefore(btn, h.firstChild);
    h.classList.add('has-switch');
  });
}

function initModSwitch() {
  const main = document.getElementById('main-content');
  if (main) new MutationObserver(_injectModSwitch).observe(main, { childList: true });

  const menu = document.createElement('div');
  menu.className = 'mod-menu';
  menu.id = 'mod-menu';
  menu.setAttribute('role', 'menu');
  document.body.appendChild(menu);
}

let _modMenuBtn = null;

function toggleModMenu(btn) {
  const menu = document.getElementById('mod-menu');
  if (!menu) return;
  if (menu.classList.contains('open') && _modMenuBtn === btn) { closeModMenu(); return; }
  if (!_hayOtrosModulos()) return;

  menu.innerHTML = _opcionesMenu().map(function(m) {
    const actual = m.slug === MODULO_ACTUAL;
    return (m.sep ? '<div class="mod-menu-sep"></div>' : '') +
      '<a class="mod-menu-item' + (actual ? ' current' : '') + '" role="menuitem"' +
      (actual ? ' aria-current="page"' : ' href="' + esc(m.url) + '"') + '>' +
        '<span><b>recircula</b> / ' + esc(m.slug) + '</span>' +
        (actual ? '<span class="mod-menu-check">' + icoHTML('check') + '</span>' : '') +
      '</a>';
  }).join('');
  const cur = menu.querySelector('.current');
  if (cur) cur.addEventListener('click', closeModMenu);

  // Anclado bajo el botón (absoluto en el documento → acompaña al scroll)
  const r = btn.getBoundingClientRect();
  menu.style.top  = (r.bottom + window.scrollY + 10) + 'px';
  menu.style.left = Math.max(16, r.left + window.scrollX - 10) + 'px';

  _modMenuBtn = btn;
  btn.setAttribute('aria-expanded', 'true');
  btn.classList.add('open');
  menu.classList.add('open');
}

function closeModMenu() {
  const menu = document.getElementById('mod-menu');
  if (menu) menu.classList.remove('open');
  if (_modMenuBtn) {
    _modMenuBtn.setAttribute('aria-expanded', 'false');
    _modMenuBtn.classList.remove('open');
  }
  _modMenuBtn = null;
}

document.addEventListener('click', function(e) {
  const menu = document.getElementById('mod-menu');
  if (menu && menu.classList.contains('open') && !menu.contains(e.target)) closeModMenu();
});
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModMenu(); });
window.addEventListener('resize', closeModMenu);

// Cerrar sesión: cierra Firebase, limpia lo guardado y vuelve al inicio de sesión
async function cerrarSesion() {
  try { await window.fb.signOut(window.fb.auth); } catch (e) { console.warn('signOut:', e); }
  try {
    sessionStorage.clear();
    localStorage.removeItem('rcr_hub_data');
    localStorage.removeItem('rcr_hub_cache_time');
  } catch (e) {}
  window.location.href = HUB_URL;
}

