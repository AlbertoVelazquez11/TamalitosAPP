/**
 * insumos-hub.js — Hub de Insumos y Costos
 * Vista intermedia con acceso a los dos sub-módulos.
 */
import { navegar, navegarAtras } from '../router.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Insumos y Costos</h1>
      </div>

      <p class="text-muted text-sm" style="margin-bottom: var(--space-4);">
        Selecciona qué deseas administrar:
      </p>

      <div class="hub-grid">
        <div class="hub-card" id="btn-inventario" role="button" tabindex="0">
          <div class="hub-card__icon">🧾</div>
          <div class="hub-card__title">Inventario de Insumos</div>
        </div>
        <div class="hub-card" id="btn-costos" role="button" tabindex="0">
          <div class="hub-card__icon">💸</div>
          <div class="hub-card__title">Registrar Costos</div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-inventario').addEventListener('click', () => navegar('insumos'));
  container.querySelector('#btn-costos').addEventListener('click', () => navegar('costos'));
}

