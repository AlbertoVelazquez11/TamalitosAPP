/**
 * historial.js — Historial de Ventas (Sprint 3 — versión básica)
 *
 * HU-050: Listado de ventas cobradas
 * HU-051: Priorizar ventas del día actual
 *
 * Muestra las ventas del día actual por defecto.
 * Sprint 4 agregará: filtros por semana/mes/año, resumen de utilidad,
 * cancelación de ventas y exportación CSV.
 */

import { getVentasPorFecha, getDetallesByVentaId, put } from '../db.js';
import { modal }           from '../components/modal.js';
import { toast }           from '../components/toast.js';
import { esc, formatMXN, formatFecha, formatHora, hoy } from '../utils.js';
import { navegarAtras }    from '../router.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Historial de Ventas</h1>
      </div>

      <!-- Selector de fecha -->
      <div style="display:flex; gap: var(--space-2); align-items: center; margin-bottom: var(--space-4);">
        <input type="date" id="filtro-fecha" class="form-input" value="${hoy()}"
               max="${hoy()}" style="flex:1;">
        <button class="btn btn-secondary btn-sm" id="btn-hoy">Hoy</button>
      </div>

      <!-- Resumen del día -->
      <div id="resumen-dia" class="summary-grid" style="margin-bottom: var(--space-5);"></div>

      <!-- Lista de ventas -->
      <div id="lista-ventas"></div>

    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);

  // Volver a hoy
  container.querySelector('#btn-hoy').addEventListener('click', () => {
    container.querySelector('#filtro-fecha').value = hoy();
    _cargarVentas(container);
  });

  // Cambio de fecha
  container.querySelector('#filtro-fecha').addEventListener('change', () => {
    _cargarVentas(container);
  });

  // Carga inicial
  await _cargarVentas(container);
}

// ══════════════════════════════════════════════════════════
// CARGA Y RENDER DE VENTAS
// ══════════════════════════════════════════════════════════

async function _cargarVentas(container) {
  const fecha  = container.querySelector('#filtro-fecha').value;
  const ventas = await getVentasPorFecha(fecha, fecha);

  _renderResumen(container, ventas);
  await _renderLista(container, ventas, fecha);
}

function _renderResumen(container, ventas) {
  const resumenEl = container.querySelector('#resumen-dia');
  if (!resumenEl) return;

  const cobradas  = ventas.filter(v => v.estado === 'cobrada');
  const total     = cobradas.reduce((s, v) => s + (v.total || 0), 0);
  const pendientes = cobradas.filter(v => v.estadoPago === 'pendiente').length;

  resumenEl.innerHTML = `
    <div class="summary-card">
      <span class="summary-card__value">${cobradas.length}</span>
      <span class="summary-card__label">Ventas</span>
    </div>
    <div class="summary-card">
      <span class="summary-card__value">${formatMXN(total)}</span>
      <span class="summary-card__label">Total del día</span>
    </div>
    <div class="summary-card">
      <span class="summary-card__value">${pendientes}</span>
      <span class="summary-card__label">Fiados</span>
    </div>
  `;
}

async function _renderLista(container, ventas, fecha) {
  const listaEl = container.querySelector('#lista-ventas');
  if (!listaEl) return;

  if (ventas.length === 0) {
    listaEl.innerHTML = `
      <div class="empty-state" style="margin-top: var(--space-4);">
        <div class="empty-state__icon">📋</div>
        <p class="empty-state__title">Sin ventas</p>
        <p class="empty-state__desc">No hay ventas registradas para ${formatFecha(fecha)}.</p>
      </div>`;
    return;
  }

  listaEl.innerHTML = '';

  for (const venta of ventas) {
    const detalles = await getDetallesByVentaId(venta.id);
    const card = _crearTarjetaVenta(venta, detalles, container);
    listaEl.appendChild(card);
  }
}

function _crearTarjetaVenta(venta, detalles, container) {
  const esCancelada = venta.estado === 'cancelada';
  const esFiado     = venta.estadoPago === 'pendiente';

  const div = document.createElement('div');
  div.className = 'card';
  div.style.marginBottom = 'var(--space-3)';
  if (esCancelada) {
    div.style.opacity = '0.55';
  }

  div.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap: var(--space-2);">
      <div style="flex:1;">
        <div style="display:flex; align-items:center; gap: var(--space-2); flex-wrap:wrap;">
          <span style="font-weight: var(--font-weight-bold); font-size: var(--font-size-base);">
            ${formatMXN(venta.total)}
          </span>
          ${esFiado     ? '<span class="badge-pending">Fiado</span>' : ''}
          ${esCancelada ? '<span class="badge badge-danger">Cancelada</span>' : ''}
        </div>
        <div class="text-sm text-muted" style="margin-top: 2px;">
          ${formatFecha(venta.fecha)} · ${formatHora(venta.hora)}
          ${venta.descuento > 0 ? `· Descuento: ${formatMXN(venta.descuento)}` : ''}
        </div>
      </div>
      ${!esCancelada ? `
        <button class="btn btn-ghost btn-sm btn-cancelar-venta" data-id="${esc(venta.id)}"
                style="color: var(--color-danger); white-space: nowrap; font-size: var(--font-size-xs);">
          Cancelar
        </button>` : ''}
    </div>

    <!-- Detalle de productos -->
    <div style="margin-top: var(--space-3); padding-top: var(--space-2); border-top: 1px solid var(--color-divider);">
      ${detalles.map(d => `
        <div style="display:flex; justify-content:space-between; font-size:var(--font-size-sm); padding: 2px 0;">
          <span>${esc(d.nombreProducto)} × ${d.cantidad}</span>
          <span style="color:var(--color-text-muted);">${formatMXN(d.subtotalLinea)}</span>
        </div>`).join('')}
    </div>
  `;

  // Evento de cancelación
  div.querySelector('.btn-cancelar-venta')?.addEventListener('click', async () => {
    await _cancelarVenta(venta, container);
  });

  return div;
}

// ══════════════════════════════════════════════════════════
// CANCELACIÓN DE VENTA
// ══════════════════════════════════════════════════════════

async function _cancelarVenta(venta, container) {
  // Pedir motivo de cancelación vía modal personalizado
  const cerrar = modal.abrir({
    titulo: 'Cancelar Venta',
    contenido: `
      <p class="text-sm text-muted" style="margin-bottom: var(--space-3);">
        La venta de <strong>${formatMXN(venta.total)}</strong>
        se marcará como cancelada y no contará en los ingresos del día.
      </p>
      <div class="form-group">
        <label class="form-label" for="motivo-cancel">Motivo <span class="text-muted">(opcional)</span></label>
        <input id="motivo-cancel" type="text" class="form-input"
               placeholder="Ej. Pedido incorrecto, cliente no pagó…" maxlength="80">
      </div>
    `,
    botones: [
      { texto: 'No cancelar', clase: 'btn-ghost',  accion: () => cerrar() },
      { texto: 'Cancelar venta', clase: 'btn-danger', accion: async () => {
        const motivo = document.getElementById('motivo-cancel')?.value.trim() || 'Sin motivo';
        try {
          await put('ventas', {
            ...venta,
            estado:            'cancelada',
            motivoCancelacion: motivo,
            actualizadoEn:     new Date().toISOString(),
          });
          toast.success('Venta cancelada.');
          cerrar();
          await _cargarVentas(container);
        } catch (e) {
          toast.error('Error al cancelar la venta.');
          console.error(e);
        }
      }},
    ],
  });
}
