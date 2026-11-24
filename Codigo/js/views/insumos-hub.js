/**
 * insumos-hub.js — Hub de Administración
 * Vista intermedia con acceso a los dos sub-módulos.
 */
import { navegar, navegarAtras } from '../router.js';
import { icon } from '../components/icons.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">${icon('arrow-left', 20)}</button>
        <h1 class="view-header__title">Administración</h1>
      </div>

      <p class="text-muted text-sm" style="margin-bottom: var(--space-4);">
        Selecciona qué deseas administrar:
      </p>

      <div class="hub-grid">
        <!-- Oculto temporalmente v4.0.0: Insumos y Registrar Costos -->
        <div class="hub-card" id="btn-produccion" role="button" tabindex="0">
          <div class="hub-card__icon">🏭</div>
          <div class="hub-card__title">Producción</div>
        </div>
        <div class="hub-card" id="btn-clientes" role="button" tabindex="0">
          <div class="hub-card__icon">👥</div>
          <div class="hub-card__title">Clientes</div>
        </div>
        <div class="hub-card" id="btn-pedidos" role="button" tabindex="0">
          <div class="hub-card__icon">🛒</div>
          <div class="hub-card__title">Pedidos</div>
        </div>
        <!-- Oculto temporalmente v4.0.0: Recetas -->
        <div class="hub-card" id="btn-perfiles" role="button" tabindex="0">
          <div class="hub-card__icon">🏪</div>
          <div class="hub-card__title">Perfiles</div>
        </div>
        <div class="hub-card" id="btn-finanzas" role="button" tabindex="0">
          <div class="hub-card__icon">💰</div>
          <div class="hub-card__title">Finanzas</div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-produccion').addEventListener('click', () => navegar('produccion'));
  container.querySelector('#btn-clientes').addEventListener('click', () => navegar('clientes'));
  container.querySelector('#btn-pedidos').addEventListener('click', () => navegar('pedidos'));
  container.querySelector('#btn-perfiles').addEventListener('click', () => navegar('perfiles'));
  container.querySelector('#btn-finanzas').addEventListener('click', () => navegar('finanzas'));
}

