/**
 * historial.js — Historial de Ventas (Sprint 4)
 *
 * HU-050: Listado de ventas + resumen diario (ventas, gastos y utilidad)
 * HU-051: Filtro por fecha con input date nativo
 * HU-052: Detalle de venta (desglose de productos inline)
 * HU-053: Cancelación de venta solo dentro de las últimas 24 h
 */

import { getVentasPorFecha, getCostosPorFecha, getDetallesByVentaId, put } from '../db.js';
import { crearDateFilter } from '../components/date-filter.js';
import { modal }           from '../components/modal.js';
import { toast }           from '../components/toast.js';
import { esc, formatMXN, formatFecha, formatHora, hoy } from '../utils.js';
import { navegarAtras }    from '../router.js';

const VENTANA_CANCELACION_MS = 24 * 60 * 60 * 1000;

/**
 * Indica si una venta aún puede cancelarse (menos de 24 h desde su creación).
 * HU-053.
 */
function _puedeCancelarse(venta) {
  if (!venta?.creadoEn) return false;
  const creado = new Date(venta.creadoEn).getTime();
  if (Number.isNaN(creado)) return false;
  return (Date.now() - creado) < VENTANA_CANCELACION_MS;
}

export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Historial de Ventas</h1>
      </div>

      <!-- Selector de fecha -->
      <div style="display:flex; gap: var(--space-2); align-items: center; margin-bottom: var(--space-4);">
        <div id="filtro-fecha-wrap" style="flex:1;"></div>
        <button class="btn btn-secondary btn-sm" id="btn-hoy">Hoy</button>
      </div>

      <!-- Resumen del día -->
      <div id="resumen-dia" class="summary-grid" style="margin-bottom: var(--space-5);"></div>

      <!-- Lista de ventas -->
      <div id="lista-ventas"></div>

    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);

  // Componente de filtro por fecha (input date nativo)
  const dateFilter = crearDateFilter({
    value: hoy(),
    onChange: () => _cargarVentas(container),
  });
  container.querySelector('#filtro-fecha-wrap').appendChild(dateFilter.elemento);

  // Volver a hoy
  container.querySelector('#btn-hoy').addEventListener('click', () => {
    dateFilter.value = hoy();
    _cargarVentas(container);
  });

  // Carga inicial
  await _cargarVentas(container);
}

// ══════════════════════════════════════════════════════════
// CARGA Y RENDER DE VENTAS
// ══════════════════════════════════════════════════════════

async function _cargarVentas(container) {
  const fecha  = container.querySelector('.date-filter__input')?.value || hoy();
  const ventas = await getVentasPorFecha(fecha, fecha);

  await _renderResumen(container, ventas, fecha);
  await _renderLista(container, ventas, fecha);
}

async function _renderResumen(container, ventas, fecha) {
  const resumenEl = container.querySelector('#resumen-dia');
  if (!resumenEl) return;

  const cobradas   = ventas.filter(v => v.estado === 'cobrada');
  const total      = cobradas.reduce((s, v) => s + (v.total || 0), 0);
  const pendientes = cobradas.filter(v => v.estadoPago === 'pendiente').length;

  // Gastos del día para calcular la utilidad bruta (HU-050)
  const costos   = await getCostosPorFecha(fecha, fecha);
  const gastos   = costos.reduce((s, c) => s + (c.monto || 0), 0);
  const utilidad = total - gastos;

  resumenEl.innerHTML = `
    <div class="summary-card">
      <span class="summary-card__value">${cobradas.length}</span>
      <span class="summary-card__label">Ventas</span>
    </div>
    <div class="summary-card summary-card--income">
      <span class="summary-card__value">${formatMXN(total)}</span>
      <span class="summary-card__label">Total vendido</span>
    </div>
    <div class="summary-card summary-card--expense">
      <span class="summary-card__value">${formatMXN(gastos)}</span>
      <span class="summary-card__label">Gastos</span>
    </div>
    <div class="summary-card summary-card--profit">
      <span class="summary-card__value">${formatMXN(utilidad)}</span>
      <span class="summary-card__label">Utilidad</span>
    </div>
    ${pendientes > 0 ? `
      <p class="text-sm text-muted" style="grid-column: 1 / -1; text-align: center; margin: 0;">
        ⚠️ ${pendientes} venta${pendientes !== 1 ? 's' : ''} fiada${pendientes !== 1 ? 's' : ''} pendiente${pendientes !== 1 ? 's' : ''} de pago
      </p>` : ''}
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
  const esCancelada     = venta.estado === 'cancelada';
  const esFiado         = venta.estadoPago === 'pendiente';
  const puedeCancelarse = !esCancelada && _puedeCancelarse(venta);

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
      ${esCancelada ? '' : (puedeCancelarse ? `
        <button class="btn btn-ghost btn-sm btn-cancelar-venta" data-id="${esc(venta.id)}"
                style="color: var(--color-danger); white-space: nowrap; font-size: var(--font-size-xs);">
          Cancelar
        </button>` : `
        <span class="text-xs text-muted" style="white-space: nowrap;"
              title="Solo se pueden cancelar ventas de las últimas 24 horas">🔒 No cancelable</span>`)}
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
