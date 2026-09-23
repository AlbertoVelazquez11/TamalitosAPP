/**
 * router.js — Hash Router de TamalitosAPP
 *
 * Gestiona la navegación entre vistas sin recargar la página.
 * Usa el hash de la URL (#/ruta) para compatibilidad con iOS WebKit Standalone.
 *
 * Funcionamiento:
 *  1. Al cambiar el hash (window.hashchange), busca la ruta en el mapa.
 *  2. Importa el módulo de la vista de forma dinámica (lazy loading).
 *  3. Limpia el contenedor #app y monta la nueva vista con animación.
 *  4. Actualiza el store con la ruta activa.
 */

import { store } from './store.js';

// ══════════════════════════════════════════════════════════
// MAPA DE RUTAS
// Cada ruta apunta a una función factory que devuelve
// una promesa con el módulo de la vista.
// ══════════════════════════════════════════════════════════

const ROUTES = {
  '':               () => import('./views/home.js'),
  'venta':          () => import('./views/pos.js'),
  'historial':      () => import('./views/historial.js'),
  'insumos-costos': () => import('./views/insumos-hub.js'),
  'insumos':        () => import('./views/insumos.js'),
  'costos':         () => import('./views/costos.js'),
  'config':         () => import('./views/config.js'),
  'productos':      () => import('./views/productos.js'),
};

// Función de limpieza de la vista activa (suscripciones, timers, etc.)
let _cleanupFn = null;

// Referencia al contenedor principal del router
const getApp = () => document.getElementById('app');

// ══════════════════════════════════════════════════════════
// NAVEGACIÓN PROGRAMÁTICA
// ══════════════════════════════════════════════════════════

/**
 * Navega a una ruta cambiando el hash de la URL.
 * @param {string} ruta — Ej: 'venta', 'historial', '' (home)
 */
export function navegar(ruta) {
  window.location.hash = ruta ? `/${ruta}` : '/';
}

/**
 * Navega hacia atrás en el historial del navegador.
 */
export function navegarAtras() {
  window.history.back();
}

// ══════════════════════════════════════════════════════════
// RESOLUCIÓN DE RUTAS
// ══════════════════════════════════════════════════════════

/**
 * Extrae la clave de ruta del hash actual.
 * '#/venta' → 'venta'
 * '#/'      → ''
 * ''        → ''
 * @returns {string}
 */
function getRutaActual() {
  const hash = window.location.hash || '#/';
  // Quitar '#/' del inicio
  return hash.replace(/^#\/?/, '').trim();
}

// ══════════════════════════════════════════════════════════
// CICLO DE MONTAJE DE VISTAS
// ══════════════════════════════════════════════════════════

/**
 * Resuelve la ruta actual, importa el módulo y monta la vista.
 */
async function resolverYMontar() {
  const ruta  = getRutaActual();
  const app   = getApp();

  // Ejecutar limpieza de la vista anterior
  if (typeof _cleanupFn === 'function') {
    try { _cleanupFn(); } catch (e) { /* ignorar */ }
    _cleanupFn = null;
  }

  // Buscar loader de la ruta, caer a home si no existe
  const loader = ROUTES[ruta] ?? ROUTES[''];

  try {
    // Limpieza visual sin parpadeo (opacity en lugar de innerHTML = '')
    app.style.opacity = '0';
    app.style.transition = 'opacity 100ms ease';

    // Importar módulo de la vista
    const modulo = await loader();

    // El módulo debe exportar una función `render(container)` y
    // opcionalmente una función `cleanup()`.
    if (typeof modulo.render !== 'function') {
      throw new Error(`La vista '${ruta}' no exporta una función render()`);
    }

    // Limpiar contenido anterior y montar nueva vista
    app.innerHTML = '';
    app.scrollTop = 0;

    // Contenedor de la vista con animación
    const viewEl = document.createElement('div');
    viewEl.className = 'view view-enter';
    app.appendChild(viewEl);

    // Restaurar visibilidad
    app.style.opacity = '1';

    // Llamar al render de la vista
    const cleanup = await modulo.render(viewEl);
    _cleanupFn = cleanup ?? null;

    // Actualizar store con la ruta activa
    store.setState({ vistaActual: ruta });

    // Sincronizar el tema en el documento (por si hubo cambio)
    _aplicarTema();

  } catch (error) {
    console.error(`[Router] Error al montar la vista '${ruta}':`, error);
    app.innerHTML = `
      <div class="view empty-state" style="padding: 2rem;">
        <div class="empty-state__icon">⚠️</div>
        <p class="empty-state__title">Error al cargar la pantalla</p>
        <p class="empty-state__desc">${error.message}</p>
        <button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.location.hash='/'">
          Volver al inicio
        </button>
      </div>`;
    app.style.opacity = '1';
  }
}

// ══════════════════════════════════════════════════════════
// TEMA CLARO / OSCURO
// ══════════════════════════════════════════════════════════

function _aplicarTema() {
  const { config } = store.getState();
  const tema = config?.tema ?? 'light';
  document.documentElement.setAttribute('data-theme', tema);

  // Actualizar theme-color del manifest para la barra de estado de iOS
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.content = tema === 'dark' ? '#0f172a' : '#ffffff';
  }
}

// ══════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ══════════════════════════════════════════════════════════

/**
 * Inicializa el router.
 * Llamar una sola vez desde app.js tras cargar la config.
 */
export function initRouter() {
  // Escuchar cambios de ruta por hash
  window.addEventListener('hashchange', resolverYMontar);

  // Resolver la ruta inicial al cargar la app
  resolverYMontar();

  // Suscribirse a cambios de tema para actualizar el documento
  store.subscribe('config', _aplicarTema);
}

