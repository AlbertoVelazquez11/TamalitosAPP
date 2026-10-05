/**
 * historial.js — Historial de Ventas (Sprint 4)
 *
 * HU-050: Listado de ventas + resumen diario (ventas, gastos y utilidad)
 * HU-051: Filtro por fecha con input date nativo
 * HU-052: Detalle de venta (desglose de productos inline)
 * HU-053: Cancelación de venta solo dentro de las últimas 24 h
 */

import { getVentasPorFecha, getCostosPorFecha, getDetallesByVentaId, cancelarVenta, put, aplicarMovimiento } from '../db.js';
import { crearDateFilter } from '../components/date-filter.js';
import { modal }           from '../components/modal.js';
import { toast }           from '../components/toast.js';
import { esc, formatMXN, formatFecha, formatHora, hoy } from '../utils.js';
import { navegarAtras }    from '../router.js';

const VENTANA_CANCELACION_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE              = 50; // Paginación "cargar más" para listas largas (Sprint 5 — 5.3)

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

  const cobradas       = ventas.filter(v => v.estado === 'cobrada');
  const ventasNormales = cobradas.filter(v => v.tipo !== 'noIngreso');
  const ingresos       = ventasNormales.filter(v => v.estadoPago === 'pagada');
  const fiadas         = ventasNormales.filter(v => v.estadoPago === 'pendiente');
  const sinIngreso     = cobradas.filter(v => v.tipo === 'noIngreso');

  const total = ingresos.reduce((s, v) => s + (v.total || 0), 0);

  // Gastos del día para calcular la utilidad bruta (HU-050)
  const costos   = await getCostosPorFecha(fecha, fecha);
  const gastos   = costos.reduce((s, c) => s + (c.monto || 0), 0);
  const utilidad = total - gastos;

  resumenEl.innerHTML = `
    <div class="summary-card">
      <span class="summary-card__value">${ventasNormales.length}</span>
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
    ${(fiadas.length + sinIngreso.length) > 0 ? `
      <p class="text-sm text-muted" style="grid-column: 1 / -1; text-align: center; margin: 0;">
        ⚠️ ${fiadas.length} fiada${fiadas.length !== 1 ? 's' : ''} pendiente${fiadas.length !== 1 ? 's' : ''} · ${sinIngreso.length} sin ingreso
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

  let mostradas = 0;

  async function _renderPagina() {
    const lote = ventas.slice(mostradas, mostradas + PAGE_SIZE);
    if (lote.length === 0) return;

    // Consultar detalles en paralelo para evitar la cascada secuencial de transacciones
    const detallesLote = await Promise.all(
      lote.map(v => getDetallesByVentaId(v.id))
    );

    lote.forEach((venta, i) => {
      listaEl.appendChild(_crearTarjetaVenta(venta, detallesLote[i], container));
    });

    mostradas += lote.length;

    // Quitar el botón "Cargar más" anterior antes de decidir si crear otro
    listaEl.querySelector('.btn-cargar-mas')?.remove();

    if (mostradas < ventas.length) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-block btn-cargar-mas';
      btn.textContent = `Cargar más (${mostradas} de ${ventas.length})`;
      btn.addEventListener('click', _renderPagina);
      listaEl.appendChild(btn);
    }
  }

  await _renderPagina();
}

function _crearTarjetaVenta(venta, detalles, container) {
  const esCancelada     = venta.estado === 'cancelada';
  const esFiado         = venta.estadoPago === 'pendiente';
  const esSinIngreso    = venta.tipo === 'noIngreso';
  const esPagadoFiado   = venta.estadoPago === 'pagada' && !!venta.pagadoEn;
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
          ${esFiado        ? '<span class="badge-pending">Fiado</span>' : ''}
          ${esPagadoFiado  ? '<span class="badge badge-success">Pagado</span>' : ''}
          ${esSinIngreso   ? '<span class="badge badge-warning">Sin ingreso</span>' : ''}
          ${esCancelada    ? '<span class="badge badge-danger">Cancelada</span>' : ''}
        </div>
        <div class="text-sm text-muted" style="margin-top: 2px;">
          ${formatFecha(venta.fecha)} · ${formatHora(venta.hora)}
          ${venta.descuento > 0 ? `· Descuento: ${formatMXN(venta.descuento)}` : ''}
          ${esSinIngreso && venta.motivoNoIngreso ? `· ${esc(venta.motivoNoIngreso)}` : ''}
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

    ${esFiado && !esCancelada ? `
      <button class="btn btn-primary btn-block btn-pagar-fiado" data-id="${esc(venta.id)}"
              style="margin-top: var(--space-3); min-height: 40px;">
        💵 Registrar pago
      </button>` : ''}
  `;

  // Evento de cancelación
  div.querySelector('.btn-cancelar-venta')?.addEventListener('click', async () => {
    await _cancelarVenta(venta, container);
  });

  // Evento de registrar pago (fiado)
  div.querySelector('.btn-pagar-fiado')?.addEventListener('click', () => {
    _registrarPagoFiado(venta, container);
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
        se marcará como cancelada, no contará en los ingresos del día
        y se restaurará el stock de los productos.
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
          await cancelarVenta(venta.id, motivo);
          toast.success('Venta cancelada. Stock restaurado.');
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

// ══════════════════════════════════════════════════════════
// REGISTRAR PAGO DE FIADO
// ══════════════════════════════════════════════════════════

async function _registrarPagoFiado(venta, container) {
  const confirmado = await modal.confirmar(
    'Registrar Pago',
    `¿Confirmar el pago de ${formatMXN(venta.total)}? A partir de ahora contará como ingreso.`,
    'Registrar pago',
    'btn-primary'
  );
  if (!confirmado) return;

  try {
    await put('ventas', {
      ...venta,
      estadoPago: 'pagada',
      pagadoEn:   new Date().toISOString(),
    });

    // El pago del fiado suma a Caja
    if ((venta.total || 0) > 0) {
      await aplicarMovimiento({
        tipo:     'pagoFiado',
        monto:    venta.total,
        destino:  'caja',
        concepto: 'Pago de fiado',
        refId:    venta.id,
      });
    }

    toast.success('Pago registrado.');
    await _cargarVentas(container);
  } catch (e) {
    console.error('[Historial] Error al registrar pago:', e);
    toast.error('Error al registrar el pago.');
  }
}
