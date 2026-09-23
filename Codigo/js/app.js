/**
 * app.js — Bootstrap de TamalitosAPP
 *
 * Punto de entrada único de la SPA.
 * Orden de inicialización:
 *   1. Cargar configuración (localStorage)
 *   2. Inicializar la base de datos (IndexedDB)
 *   3. Aplicar tema al documento
 *   4. Inicializar el router (monta la vista inicial)
 *   5. Registrar el Service Worker
 */

import { cargarConfig, store }    from './store.js';
import { openDB }                 from './db.js';
import { initRouter }             from './router.js';

// openDB es lazy-singleton, pero la llamamos aquí para inicializar
// el esquema de IndexedDB antes de que cualquier vista lo necesite.
// Si falla, la app sigue funcionando — las vistas manejarán errores individuales.
async function initDB() {
  try {
    await openDB();
    console.log('[App] IndexedDB inicializado correctamente.');
  } catch (e) {
    console.error('[App] No se pudo abrir IndexedDB:', e);
  }
}

/**
 * Aplica el tema (light/dark) al elemento <html>
 * y actualiza el meta theme-color de iOS.
 */
function aplicarTema(config) {
  const tema = config?.tema ?? 'light';
  document.documentElement.setAttribute('data-theme', tema);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.content = tema === 'dark' ? '#0f172a' : '#ffffff';
  }
}

/**
 * Registra el Service Worker.
 * En iOS WebKit, los SW solo funcionan bajo HTTPS o localhost.
 */
async function registrarSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[App] Service Workers no soportados en este entorno.');
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    console.log('[App] Service Worker registrado. Scope:', reg.scope);

    reg.onupdatefound = () => {
      const worker = reg.installing;
      worker.onstatechange = () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[App] Nueva versión del SW disponible.');
        } else if (worker.state === 'installed') {
          console.log('[App] App lista para uso offline.');
        }
      };
    };
  } catch (err) {
    console.error('[App] Error al registrar Service Worker:', err);
  }
}

/**
 * Punto de entrada principal.
 */
async function main() {
  console.log('[App] Iniciando TamalitosAPP...');

  // 1. Cargar configuración del negocio
  const config = cargarConfig();
  console.log(`[App] Negocio: "${config.nombreNegocio}" — Tema: ${config.tema}`);

  // 2. Aplicar tema antes de mostrar cualquier vista (evitar flash)
  aplicarTema(config);

  // 3. Pre-inicializar IndexedDB en segundo plano
  initDB();

  // 4. Inicializar el router (monta la vista según el hash actual)
  initRouter();

  // 5. Registrar Service Worker
  registrarSW();

  console.log('[App] Inicialización completa.');
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', main);

