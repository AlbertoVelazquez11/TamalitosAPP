/**
 * produccion.js — Registro de Producción (v2 · Sprint 2)
 *
 * Flujo:
 *  1. Confirmar que se realizó una nueva producción.
 *  2. Elegir producto y cantidad producida.
 *  3. Confirmar → suma stock del producto y guarda histórico.
 *
 * Reglas:
 *  - Cantidades > 0.
 *  - Stock negativo permitido con advertencia.
 */

import { getAll, guardarProduccion } from '../db.js';
import { modal }     from '../components/modal.js';
import { toast }     from '../components/toast.js';
import { esc } from '../utils.js';
import { navegar, navegarAtras } from '../router.js';
import { icon } from '../components/icons.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">${icon('arrow-left', 20)}</button>
        <h1 class="view-header__title">Producción</h1>
      </div>
      <div id="produccion-contenido"></div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);

  // Confirmación inicial
  const ok = await modal.confirmar(
    'Nueva Producción',
    '¿Se realizó una nueva producción?',
    'Sí, registrar',
    'btn-primary'
  );

  if (ok) {
    await _renderFormulario(container);
  } else {
    _renderIntro(container);
  }
}

// ══════════════════════════════════════════════════════════
// INTRO / FORMULARIO
// ══════════════════════════════════════════════════════════

function _renderIntro(container) {
  const contenido = container.querySelector('#produccion-contenido');
  contenido.innerHTML = `
    <div class="empty-state" style="padding: var(--space-8) var(--space-4);">
      <div class="empty-state__icon">🏭</div>
      <p class="empty-state__title">Producción</p>
      <p class="empty-state__desc">
        Registra una producción para sumar stock al producto.
      </p>
      <button class="btn btn-primary" id="btn-iniciar-produccion" style="margin-top: var(--space-4);">
        Registrar producción
      </button>
    </div>`;

  contenido.querySelector('#btn-iniciar-produccion')
    .addEventListener('click', () => _renderFormulario(container));
}

async function _renderFormulario(container) {
  const contenido = container.querySelector('#produccion-contenido');

  const productos = await getAll('productos');

  const activos = productos
    .filter(p => p.activo !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  if (activos.length === 0) {
    contenido.innerHTML = `
      <div class="empty-state" style="padding: var(--space-8) var(--space-4);">
        <div class="empty-state__icon">📦</div>
        <p class="empty-state__title">Sin productos activos</p>
        <p class="empty-state__desc">Necesitas productos activos para registrar una producción.</p>
        <button class="btn btn-secondary" id="btn-ir-productos" style="margin-top: var(--space-4);">Ir a Productos</button>
      </div>`;
    contenido.querySelector('#btn-ir-productos')
      .addEventListener('click', () => navegar('productos'));
    return;
  }

  contenido.innerHTML = `
    <div class="card" style="margin-bottom: var(--space-4);">
      <div class="form-group">
        <label class="form-label" for="prod-producto">Producto *</label>
        <select id="prod-producto" class="form-select">
          <option value="">Selecciona producto…</option>
          ${activos.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-top: var(--space-3);">
        <label class="form-label" for="prod-cantidad">Cantidad producida *</label>
        <input id="prod-cantidad" type="number" class="form-input"
               placeholder="1" min="1" step="1" inputmode="numeric">
      </div>
    </div>

    <button class="btn btn-primary btn-block" id="btn-confirmar-produccion"
            style="margin-top: var(--space-4); min-height: var(--touch-lg);">
      Confirmar producción
    </button>
  `;

  contenido.querySelector('#btn-confirmar-produccion')
    .addEventListener('click', () => _confirmarProduccion(container, activos));
}

// ══════════════════════════════════════════════════════════
// CONFIRMACIÓN Y GUARDADO
// ══════════════════════════════════════════════════════════

async function _confirmarProduccion(container, productos) {
  const productoId        = container.querySelector('#prod-producto')?.value;
  const cantidadProducida = Number(container.querySelector('#prod-cantidad')?.value);

  if (!productoId) {
    toast.error('Selecciona el producto.');
    return;
  }
  if (!Number.isInteger(cantidadProducida) || cantidadProducida <= 0) {
    toast.error('La cantidad producida debe ser un entero mayor a 0.');
    return;
  }

  const producto = productos.find(p => p.id === productoId);

  try {
    await guardarProduccion({
      productoId,
      nombreProducto: producto?.nombre ?? '',
      cantidadProducida,
    });
    toast.success(`Producción registrada: ${cantidadProducida} × ${producto?.nombre ?? ''}`);
    navegar('insumos-costos'); // volver al menú anterior
  } catch (e) {
    console.error('[Producción] Error al guardar:', e);
    toast.error('Error al registrar la producción.');
  }
}
