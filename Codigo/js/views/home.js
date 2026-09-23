/**
 * home.js — Vista de la Pantalla de Inicio
 *
 * Exporta: render(container) → cleanup()
 *
 * Contenido:
 *  - Barra superior con botón de engrane (→ Config) y badge de versión
 *  - Hero con logo, nombre del negocio y tagline
 *  - Botón CTA principal "Registrar Venta"
 *  - Botón secundario "Insumos y Costos"
 */

import { store }   from '../store.js';
import { navegar } from '../router.js';

/**
 * @param {HTMLElement} container — El contenedor .view asignado por el router
 * @returns {Function} cleanup — Se llama al desmontar la vista
 */
export async function render(container) {
  const { config } = store.getState();

  container.innerHTML = `
    <div class="home-view">

      <!-- Barra superior -->
      <div class="home-topbar">
        <button class="btn btn-icon" id="btn-config" aria-label="Configuración">
          ⚙️
        </button>
      </div>

      <!-- Hero: Logo + Nombre del negocio -->
      <div class="home-hero">
        <div class="home-logo" aria-hidden="true">🫔</div>
        <div>
          <h1 class="home-business-name" id="home-business-name">
            ${_escapar(config?.nombreNegocio ?? 'Mi Negocio')}
          </h1>
          <p class="home-tagline text-muted">Administración de Ventas</p>
        </div>
      </div>

      <!-- Acciones principales -->
      <div class="home-actions">
        <button class="btn btn-primary home-cta" id="btn-venta">
          💰 Registrar Venta
        </button>
        <button class="btn btn-secondary home-secondary-btn" id="btn-insumos">
          📦 Insumos y Costos
        </button>
      </div>

      <!-- Badge de versión en la parte inferior -->
      <div style="text-align:center; padding: var(--space-4) 0 var(--space-2);">
        <span class="version-badge">v${config?.version ?? '1.0.0'}</span>
      </div>

    </div>
  `;

  // ── Eventos ────────────────────────────────────────────
  container.querySelector('#btn-config')
    .addEventListener('click', () => navegar('config'));

  container.querySelector('#btn-venta')
    .addEventListener('click', () => navegar('venta'));

  container.querySelector('#btn-insumos')
    .addEventListener('click', () => navegar('insumos-costos'));

  // ── Suscripción reactiva al nombre del negocio ─────────
  const unsub = store.subscribe('config', (config) => {
    const el = container.querySelector('#home-business-name');
    if (el) el.textContent = config?.nombreNegocio ?? 'Mi Negocio';
  });

  // Devolver función de limpieza
  return () => {
    unsub();
  };
}

// Utilidad simple de escapado HTML
function _escapar(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

