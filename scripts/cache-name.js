/**
 * cache-name.js — Decide el nombre del cache del Service Worker.
 *
 * Vive aparte de sync-sw.js para poder probarlo sin que el script toque archivos.
 *
 * Reglas:
 *  - Si hay sha del commit (build de Vercel desde GitHub), el cache se nombra con
 *    los primeros 7 caracteres: cada deploy tiene su propio cache y los clientes
 *    bajan los assets nuevos. No hace falta subir nada a mano.
 *  - Sin sha (uso local o `deploy.cjs`), se sigue usando el contador BUILD.
 */

export function calcularCacheName({ sha = '', build = 0 } = {}) {
  const limpio = String(sha || '').trim();
  if (limpio) return `tamalitos-${limpio.slice(0, 7)}`;

  const numero = Number(build);
  const base = Number.isFinite(numero) && numero >= 0 ? Math.floor(numero) : 0;
  return `tamalitos-v${base + 1}`;
}
