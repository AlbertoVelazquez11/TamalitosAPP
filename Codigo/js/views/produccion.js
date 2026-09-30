/**
 * produccion.js — Registro de Producción (v2 · Sprint 2)
 *
 * Flujo:
 *  1. Confirmar que se realizó una nueva producción.
 *  2. Elegir producto y cantidad producida.
 *  3. Agregar insumos usados uno a uno (insumo + cantidad).
 *  4. Confirmar → resta insumos, suma producto y guarda histórico.
 *
 * Reglas:
 *  - Cantidades > 0.
 *  - Stock negativo permitido con advertencia.
 */

import { getAll, guardarProduccion } from '../db.js';
import { modal }     from '../components/modal.js';
import { toast }     from '../components/toast.js';
import { esc, formatCantidad } from '../utils.js';
import { navegar, navegarAtras } from '../router.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
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
        Registra una producción para sumar stock al producto y restar los insumos utilizados.
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

  const [insumos, productos] = await Promise.all([
    getAll('insumos'),
    getAll('productos'),
  ]);

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
               value="1" min="1" step="1" inputmode="numeric">
      </div>
    </div>

    <div class="section">
      <div class="section-title">Insumos utilizados</div>
      <div id="prod-insumos-lista">
        ${insumos.length === 0 ? `
          <p class="text-sm text-muted" style="padding: var(--space-2) var(--space-1);">
            No hay insumos registrados. Agrégalos en Inventario de Insumos.
          </p>` : ''}
      </div>
      ${insumos.length > 0 ? `
        <button class="btn btn-secondary btn-block" id="btn-agregar-insumo" style="margin-top: var(--space-2);">
          + Agregar insumo
        </button>` : ''}
    </div>

    <button class="btn btn-primary btn-block" id="btn-confirmar-produccion"
            style="margin-top: var(--space-4); min-height: var(--touch-lg);">
      Confirmar producción
    </button>
  `;

  const listaEl = contenido.querySelector('#prod-insumos-lista');

  if (insumos.length > 0) {
    contenido.querySelector('#btn-agregar-insumo')
      .addEventListener('click', () => listaEl.appendChild(_crearFilaInsumo(insumos)));
    // Fila inicial
    listaEl.appendChild(_crearFilaInsumo(insumos));
  }

  contenido.querySelector('#btn-confirmar-produccion')
    .addEventListener('click', () => _confirmarProduccion(container, activos, insumos));
}

function _crearFilaInsumo(insumos) {
  const elemento = document.createElement('div');
  elemento.className = 'produccion-insumo-row';

  elemento.innerHTML = `
    <select class="form-select prod-insumo-select">
      <option value="">Selecciona insumo…</option>
      ${insumos.map(i => `<option value="${esc(i.id)}">${esc(i.nombre)}${i.unidad ? ' (' + esc(i.unidad) + ')' : ''}</option>`).join('')}
    </select>
    <input class="form-input prod-insumo-cantidad" type="number"
           min="0" step="0.1" placeholder="0.0" inputmode="decimal" autocomplete="off">
    <button type="button" class="btn btn-icon btn-ghost prod-insumo-remove" aria-label="Quitar insumo">✕</button>
  `;

  elemento.querySelector('.prod-insumo-remove')
    .addEventListener('click', () => elemento.remove());

  return elemento;
}

// ══════════════════════════════════════════════════════════
// CONFIRMACIÓN Y GUARDADO
// ══════════════════════════════════════════════════════════

async function _confirmarProduccion(container, productos, insumos) {
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

  // Recolectar insumos desde las filas del DOM
  const usados   = [];
  const vistos   = new Set();
  const filasDom = container.querySelectorAll('.produccion-insumo-row');

  for (const fila of filasDom) {
    const insumoId = fila.querySelector('.prod-insumo-select')?.value;
    const cantidad = Number(fila.querySelector('.prod-insumo-cantidad')?.value);

    if (!insumoId) continue; // fila vacía
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error('Cada insumo debe tener una cantidad mayor a 0.');
      return;
    }
    if (vistos.has(insumoId)) {
      toast.error('No repitas el mismo insumo; suma sus cantidades en una sola fila.');
      return;
    }
    vistos.add(insumoId);

    const insumo = insumos.find(i => i.id === insumoId);
    usados.push({ insumoId, nombreInsumo: insumo?.nombre ?? '', cantidad });
  }

  if (usados.length === 0) {
    toast.error('Agrega al menos un insumo utilizado.');
    return;
  }

  const producto = productos.find(p => p.id === productoId);

  // Advertencia si algún insumo quedará en negativo
  const negativos = usados.filter(u => {
    const ins = insumos.find(i => i.id === u.insumoId);
    return ins && ((ins.cantidad ?? 0) - u.cantidad) < 0;
  });

  if (negativos.length > 0) {
    const confirmado = await new Promise(resolve => {
      const cerrar = modal.abrir({
        titulo: 'Stock insuficiente',
        contenido: `
          <p class="text-sm text-muted">Los siguientes insumos quedarán en negativo:</p>
          <div class="cobro-summary" style="margin-top: var(--space-2);">
            ${negativos.map(n => {
              const ins      = insumos.find(i => i.id === n.insumoId);
              const restante = (ins?.cantidad ?? 0) - n.cantidad;
              return `<div class="cobro-item-row"><span>${esc(n.nombreInsumo)}</span><span>${formatCantidad(restante)}</span></div>`;
            }).join('')}
          </div>
          <p class="text-sm" style="margin-top: var(--space-3);">¿Deseas continuar de todos modos?</p>
        `,
        botones: [
          { texto: 'Cancelar', clase: 'btn-ghost', accion: () => { cerrar(); resolve(false); } },
          { texto: 'Continuar', clase: 'btn-danger', accion: () => { cerrar(); resolve(true); } },
        ],
      });
    });
    if (!confirmado) return;
  }

  try {
    await guardarProduccion({
      productoId,
      nombreProducto: producto?.nombre ?? '',
      cantidadProducida,
      insumosUsados: usados,
    });
    toast.success(`Producción registrada: ${cantidadProducida} × ${producto?.nombre ?? ''}`);
    await _renderFormulario(container); // reiniciar para otra producción
  } catch (e) {
    console.error('[Producción] Error al guardar:', e);
    toast.error('Error al registrar la producción.');
  }
}
