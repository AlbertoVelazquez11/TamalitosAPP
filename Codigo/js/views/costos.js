/** costos.js — Stub Sprint 1 */
import { navegarAtras } from '../router.js';
export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Registrar Costos</h1>
      </div>
      <div class="empty-state" style="margin-top: var(--space-8);">
        <div class="empty-state__icon">🚧</div>
        <p class="empty-state__title">Módulo en Construcción</p>
        <p class="empty-state__desc">El registro de costos se implementa en el Sprint 3.</p>
      </div>
    </div>`;
  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
}

