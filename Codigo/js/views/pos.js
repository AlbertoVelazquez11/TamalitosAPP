/**
 * pos.js — Punto de Venta (Sprint 3 — Fix)
 *
 * HU-040: Grilla táctil de productos activos
 * HU-041: Comanda reactiva con +/- por ítem
 * HU-042: Modal de cobro con descuento y confirmación
 * HU-043: Fiado / Pendiente de pago discreto
 *
 * BUGS CORREGIDOS:
 *  - Fix #1: El .view wrapper del router necesita height:100% cuando #app.pos-active (CSS fix)
 *  - Fix #2: El view-header del POS necesita padding-top del safe-area-top propio
 *    ya que #app.pos-active elimina el padding de #app
 *  - Fix #3: product-btn--added ahora existe en CSS
 *  - Fix #4: la grilla del POS necesita padding lateral explícito
 *    ya que .pos-products-section ya no hereda el padding de #app
 */

import { getProductosActivos, guardarVentaCompleta } from '../db.js';
import { store, agregarAlPedido, cambiarCantidad, limpiarPedido, calcularSubtotal } from '../store.js';
import { modal }   from '../components/modal.js';
import { toast }   from '../components/toast.js';
import { esc, formatMXN, hoy, ahoraHora } from '../utils.js';
import { navegar, navegarAtras } from '../router.js';

export async function render(container) {
  // Activar layout de dos paneles en #app
  const appEl = document.getElementById('app');
  appEl.classList.add('pos-active');

  // ── Cargar productos activos ──────────────────────────────
  const productos = await getProductosActivos();

  // ── Estructura base de la vista ──────────────────────────
  // NOTA: los productos vacíos y la grilla van dentro de pos-products-section
  // que tiene su propio scroll. El padding lateral viene de pos-products-section.
  container.innerHTML = `
    <div class="pos-view">

      <!-- Header: necesita padding-top para respetar safe-area (notch/dynamic island)
           ya que #app.pos-active resetea el padding del #app -->
      <div class="view-header pos-header">
        <button class="btn btn-icon" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Venta</h1>
        <div class="view-header__actions">
          <button class="btn btn-ghost btn-sm" id="btn-historial">📋 Historial</button>
        </div>
      </div>

      <!-- Sección de productos (scrolleable) -->
      <div class="pos-products-section">
        ${productos.length === 0 ? `
          <div class="empty-state" style="padding: var(--space-8) var(--space-4);">
            <div class="empty-state__icon">📦</div>
            <p class="empty-state__title">Sin productos activos</p>
            <p class="empty-state__desc">Ve a Configuración → Productos para agregar productos al catálogo.</p>
            <button class="btn btn-secondary" id="btn-ir-productos" style="margin-top: var(--space-4);">
              Ir a Productos
            </button>
          </div>` : `
          <div class="product-grid" id="product-grid">
            ${productos.map(p => `
              <button class="product-btn" data-id="${esc(p.id)}" type="button"
                      aria-label="${esc(p.nombre)} ${formatMXN(p.precio)}">
                <span class="product-btn__name">${esc(p.nombre)}</span>
                <span class="product-btn__price">${formatMXN(p.precio)}</span>
              </button>`).join('')}
          </div>`}
      </div>

      <!-- Panel de comanda (fijo en la parte inferior) -->
      <div class="order-panel" id="order-panel">
        <div class="order-panel__header">
          <span class="order-panel__title">Pedido actual</span>
          <button class="btn btn-ghost btn-sm" id="btn-limpiar" style="display:none;">Vaciar</button>
        </div>
        <div class="order-items-scroll" id="order-items"></div>
        <div class="order-panel__footer" id="order-footer">
          <p class="order-empty">Toca un producto para agregarlo al pedido.</p>
        </div>
      </div>

    </div>
  `;

  // ── Listeners de navegación ───────────────────────────────
  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-historial').addEventListener('click', () => navegar('historial'));
  container.querySelector('#btn-ir-productos')?.addEventListener('click', () => navegar('productos'));

  // ── Listeners de la grilla de productos ──────────────────
  container.querySelector('#product-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.product-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    const prod = productos.find(p => p.id === id);
    if (!prod) return;

    // Animación táctil de feedback
    btn.classList.add('product-btn--added');
    setTimeout(() => btn.classList.remove('product-btn--added'), 180);

    agregarAlPedido(prod);
  });

  // ── Listener del botón vaciar ─────────────────────────────
  container.querySelector('#btn-limpiar').addEventListener('click', async () => {
    const ok = await modal.confirmar(
      'Vaciar pedido',
      '¿Eliminar todos los productos del pedido actual?',
      'Vaciar',
      'btn-danger'
    );
    if (ok) {
      limpiarPedido();
      toast.info('Pedido vaciado.');
    }
  });

  // ── Suscripción reactiva a cambios del pedido ─────────────
  const unsubPedido = store.subscribe('pedidoActual', (pedido) => {
    _renderComanda(container, pedido);
  });

  // Render inicial con el pedido actual (puede ser vacío o tener items)
  _renderComanda(container, store.getState().pedidoActual);

  // ── Limpieza al desmontar ──────────────────────────────────
  return () => {
    appEl.classList.remove('pos-active');
    unsubPedido();
  };
}

// ══════════════════════════════════════════════════════════
// RENDERIZADO DE LA COMANDA
// ══════════════════════════════════════════════════════════

function _renderComanda(container, pedido) {
  const itemsEl   = container.querySelector('#order-items');
  const footerEl  = container.querySelector('#order-footer');
  const vaciarBtn = container.querySelector('#btn-limpiar');
  if (!itemsEl || !footerEl) return;

  if (pedido.length === 0) {
    itemsEl.innerHTML  = '';
    footerEl.innerHTML = '<p class="order-empty">Toca un producto para agregarlo al pedido.</p>';
    if (vaciarBtn) vaciarBtn.style.display = 'none';
    return;
  }

  if (vaciarBtn) vaciarBtn.style.display = '';

  // Renderizar ítems
  itemsEl.innerHTML = pedido.map(item => `
    <div class="order-item" data-id="${esc(item.productoId)}">
      <span class="order-item__name">${esc(item.nombre)}</span>
      <div class="order-item__qty-control">
        <button class="qty-btn" data-action="dec" data-id="${esc(item.productoId)}"
                aria-label="Quitar uno">−</button>
        <span class="order-item__qty">${item.cantidad}</span>
        <button class="qty-btn" data-action="inc" data-id="${esc(item.productoId)}"
                aria-label="Agregar uno">+</button>
      </div>
      <span class="order-item__subtotal">${formatMXN(item.precioUnitario * item.cantidad)}</span>
    </div>
  `).join('');

  // Delegación de eventos para +/-
  itemsEl.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id     = btn.dataset.id;
      const accion = btn.dataset.action;
      cambiarCantidad(id, accion === 'inc' ? 1 : -1);
    });
  });

  // Total y botón cobrar
  const subtotal = calcularSubtotal();
  footerEl.innerHTML = `
    <div class="order-total-row">
      <span class="order-total-label">Total</span>
      <span class="order-total-amount">${formatMXN(subtotal)}</span>
    </div>
    <button class="btn btn-primary btn-block home-cta" id="btn-cobrar"
            style="min-height: 56px; font-size: var(--font-size-lg);">
      Cobrar ${formatMXN(subtotal)}
    </button>
  `;

  container.querySelector('#btn-cobrar').addEventListener('click', () => {
    _abrirModalCobro(store.getState().pedidoActual);
  });
}

// ══════════════════════════════════════════════════════════
// MODAL DE COBRO
// ══════════════════════════════════════════════════════════

function _abrirModalCobro(pedido) {
  if (pedido.length === 0) return;

  const subtotal = pedido.reduce(
    (sum, item) => sum + item.precioUnitario * item.cantidad, 0
  );

  const resumenHTML = pedido.map(item => `
    <div class="cobro-item-row">
      <span>${esc(item.nombre)} × ${item.cantidad}</span>
      <span>${formatMXN(item.precioUnitario * item.cantidad)}</span>
    </div>
  `).join('');

  // Nota: no usamos .switch aquí porque iOS tiene bugs con inputs dentro de modals.
  // Usamos un checkbox estándar estilizado como toggle.
  const contenidoHTML = `
    <!-- Resumen del pedido -->
    <div class="cobro-summary">${resumenHTML}</div>

    <!-- Campo de descuento -->
    <div class="form-group">
      <label class="form-label" for="cobro-descuento">
        Descuento <span class="text-muted">(opcional, en pesos)</span>
      </label>
      <input id="cobro-descuento" type="number" class="form-input"
             placeholder="0.00" min="0" step="0.50"
             inputmode="decimal" autocomplete="off">
    </div>

    <!-- Total con descuento (actualizado por JS) -->
    <div class="cobro-total-row">
      <span class="cobro-total-label">Total a cobrar</span>
      <span class="cobro-total-amount" id="cobro-total-display">${formatMXN(subtotal)}</span>
    </div>

    <!-- Fiado (pendiente de pago) — discreto -->
    <div class="fiado-row">
      <label class="fiado-label" for="cobro-fiado">💸 Pendiente de pago (fiado)</label>
      <label class="switch">
        <input type="checkbox" id="cobro-fiado">
        <span class="switch__track"></span>
      </label>
    </div>
  `;

  const cerrar = modal.abrir({
    titulo:   'Confirmar Cobro',
    contenido: contenidoHTML,
    botones: [
      { texto: 'Cancelar',        clase: 'btn-ghost',   accion: () => cerrar() },
      { texto: '✓ Confirmar Cobro', clase: 'btn-primary', accion: () => _confirmarCobro(cerrar, subtotal) },
    ],
  });

  // Actualización reactiva del total cuando cambia el descuento
  // Usamos setTimeout para esperar a que el DOM del modal esté disponible
  setTimeout(() => {
    const inputDesc = document.getElementById('cobro-descuento');
    const totalDisp = document.getElementById('cobro-total-display');
    if (inputDesc && totalDisp) {
      inputDesc.addEventListener('input', () => {
        const desc  = Math.max(0, parseFloat(inputDesc.value) || 0);
        const total = Math.max(0, subtotal - desc);
        totalDisp.textContent = formatMXN(total);
      });
    }
  }, 80);
}

async function _confirmarCobro(cerrar, subtotal) {
  const descInput  = document.getElementById('cobro-descuento');
  const fiadoInput = document.getElementById('cobro-fiado');

  const descuento = Math.max(0, parseFloat(descInput?.value) || 0);
  const esFiado   = fiadoInput?.checked ?? false;

  if (descuento >= subtotal) {
    toast.error('El descuento no puede ser igual o mayor al total.');
    return;
  }

  const total  = subtotal - descuento;
  const pedido = store.getState().pedidoActual;

  if (pedido.length === 0) {
    toast.error('El pedido está vacío.');
    cerrar();
    return;
  }

  // Construir el objeto venta (sin id — db.js lo genera)
  const venta = {
    fecha:             hoy(),
    hora:              ahoraHora(),
    subtotal,
    descuento,
    total,
    estadoPago:        esFiado ? 'pendiente' : 'pagada',
    estado:            'cobrada',
    motivoCancelacion: null,
  };

  // Construir los detalles (snapshot del precio al momento de la venta)
  const detalles = pedido.map(item => ({
    productoId:      item.productoId,
    nombreProducto:  item.nombre,
    precioUnitario:  item.precioUnitario,
    cantidad:        item.cantidad,
    subtotalLinea:   item.precioUnitario * item.cantidad,
  }));

  try {
    const ventaId = await guardarVentaCompleta(venta, detalles);
    console.log('[POS] Venta registrada:', ventaId);

    cerrar();
    limpiarPedido();

    const msg = esFiado
      ? `Venta registrada como fiado — ${formatMXN(total)}`
      : `¡Venta registrada! — ${formatMXN(total)}`;
    toast.success(msg);

  } catch (e) {
    console.error('[POS] Error al guardar la venta:', e);
    toast.error('Error al registrar la venta. Intenta de nuevo.');
  }
}
