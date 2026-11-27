/**
 * version.js — Fuente única de la versión de la app y del cache del Service Worker.
 *
 * Reglas:
 * - APP_VERSION es la versión visible del producto (semver). Subirla a mano sólo
 *   cuando hay una release; no vive en ningún otro archivo.
 * - BUILD es el sello de caché. `node scripts/sync-sw.js` lo incrementa en cada
 *   despliegue y reescribe CACHE_NAME tanto aquí como en sw.js, para no tener que
 *   subir el cache a mano ni olvidarlo.
 */

export const APP_VERSION = '4.0.0';

export const BUILD = 25;

export const CACHE_NAME = `tamalitos-v${BUILD}`;
