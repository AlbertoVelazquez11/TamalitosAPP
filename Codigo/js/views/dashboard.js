/**
 * dashboard.js — Dashboard "Venta por producto" (v2 · Sprint 4)
 *
 * Muestra:
 *  - Selector de período (día / semana / mes / año).
 *  - Resumen: Ingresos (pagadas), Sin ingresos y Fiadas pendientes.
 *  - Gráfica de pastel (SVG) de cantidad vendida por producto + % + ingresos.
 *
 * Reglas:
 *  - El pastel incluye todo lo entregado (venta, fiada y sin ingreso), excluyendo canceladas.
 *  - Los "ingresos" por producto usan el precio de venta (snapshot), no el precio actual.
 */

import { getVentasPorFecha, getDetallesByVentaId } from '../db.js';
import { rangoDePeriodo } from '../export.js';
import { esc, formatMXN, formatCantidad } from '../utils.js';
import { navegarAtras } from '../router.js';

const COLORES = ['#FFAFCC', '#CDB4DB', '#A2D2FF', '#FFC8DD', '#b8a0e0', '#f0a855', '#2ecc8a', '#60b8ff', '#f06e85', '#7a8ab8'];

const PERIODOS = [
  { id: 'dia',    label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes',    label: 'Mes' },
  { id: 'anio',   label: 'Año' },
];

export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Dashboard</h1>
      </div>

      <!-- Selector de período -->
      <div class="dash-periodo" id="dash-periodo">
        ${PERIODOS.map(p => `<button class="btn btn-secondary btn-sm" data-periodo="${p.id}">${p.label}</button>`).join('')}
      </div>

      <!-- Resumen financiero -->
      <div id="dash-resumen" class="summary-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: var(--space-5);"></div>

      <!-- Gráfica -->
      <div id="dash-pie"></div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);

  container.querySelectorAll('#dash-periodo .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _setActivo(container, btn.dataset.periodo);
      _cargar(container, btn.dataset.periodo);
    });
  });

  _setActivo(container, 'dia');
  await _cargar(container, 'dia');
}

function _setActivo(container, periodo) {
  container.querySelectorAll('#dash-periodo .btn').forEach(btn => {
    const activo = btn.dataset.periodo === periodo;
    btn.classList.toggle('btn-primary', activo);
    btn.classList.toggle('btn-secondary', !activo);
  });
}

// ══════════════════════════════════════════════════════════
// CARGA Y AGREGACIÓN
// ══════════════════════════════════════════════════════════

async function _cargar(container, periodo) {
  const { inicio, fin } = rangoDePeriodo(periodo);
  const ventas    = await getVentasPorFecha(inicio, fin);
  const vigentes  = ventas.filter(v => v.estado !== 'cancelada');

  // Consultar detalles en paralelo
  const detallesAll = await Promise.all(
    vigentes.map(v => getDetallesByVentaId(v.id))
  );

  const porProducto = new Map(); // productoId -> { nombre, cantidad, ingresos }
  let ingresos        = 0;
  let sinIngresoCount = 0;
  let sinIngresoMonto = 0;
  let fiadasCount     = 0;
  let fiadasMonto     = 0;

  vigentes.forEach((v, i) => {
    const detalles    = detallesAll[i] || [];
    const esNoIngreso = v.tipo === 'noIngreso';
    const esFiada     = v.tipo !== 'noIngreso' && v.estadoPago === 'pendiente';
    const esIngreso   = v.tipo !== 'noIngreso' && v.estadoPago === 'pagada';

    if (esIngreso)   ingresos += (v.total || 0);
    if (esNoIngreso) { sinIngresoCount++; sinIngresoMonto += (v.total || 0); }
    if (esFiada)     { fiadasCount++;     fiadasMonto     += (v.total || 0); }

    for (const d of detalles) {
      let agg = porProducto.get(d.productoId);
      if (!agg) {
        agg = { nombre: d.nombreProducto, cantidad: 0, ingresos: 0 };
        porProducto.set(d.productoId, agg);
      }
      agg.cantidad += d.cantidad;
      if (esIngreso) agg.ingresos += d.subtotalLinea;
    }
  });

  // Resumen
  const resumen = container.querySelector('#dash-resumen');
  resumen.innerHTML = `
    <div class="summary-card">
      <span class="summary-card__value" style="color: var(--color-success);">${formatMXN(ingresos)}</span>
      <span class="summary-card__label">Ingresos</span>
    </div>
    <div class="summary-card">
      <span class="summary-card__value" style="color: var(--color-warning);">${formatMXN(sinIngresoMonto)}</span>
      <span class="summary-card__label">${sinIngresoCount} sin ingreso</span>
    </div>
    <div class="summary-card">
      <span class="summary-card__value" style="color: var(--color-pending);">${formatMXN(fiadasMonto)}</span>
      <span class="summary-card__label">${fiadasCount} fiadas</span>
    </div>
  `;

  // Gráfica
  _renderPie(container.querySelector('#dash-pie'), [...porProducto.values()]);
}

// ══════════════════════════════════════════════════════════
// GRÁFICA DE PASTEL (SVG vanilla)
// ══════════════════════════════════════════════════════════

function _renderPie(wrap, productos) {
  const data = productos
    .filter(p => p.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);

  if (data.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📊</div>
        <p class="empty-state__title">Sin ventas en el período</p>
        <p class="empty-state__desc">No hay productos vendidos para este período.</p>
      </div>`;
    return;
  }

  const total  = data.reduce((s, d) => s + d.cantidad, 0);
  const slices = data.map((d, i) => ({
    ...d,
    color: COLORES[i % COLORES.length],
    pct:   (d.cantidad / total) * 100,
  }));

  const paths = _buildPiePaths(slices, 120, 120, 100);

  wrap.innerHTML = `
    <div class="dash-pie-wrap">
      <svg width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="Venta por producto">
        ${paths}
      </svg>
      <div class="dash-legend">
        ${slices.map(s => `
          <div class="dash-legend-item">
            <span class="dash-legend-swatch" style="background-color: ${s.color};"></span>
            <span class="dash-legend-name">${esc(s.nombre)}</span>
            <span class="dash-legend-pct">${formatCantidad(s.cantidad)} · ${s.pct.toFixed(1)}%</span>
            <span class="dash-legend-ingreso">${formatMXN(s.ingresos)}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function _buildPiePaths(slices, cx, cy, r) {
  const total = slices.reduce((s, d) => s + d.cantidad, 0);
  let angle = -Math.PI / 2; // iniciar arriba

  return slices.map(s => {
    const frac = s.cantidad / total;
    const a0 = angle;
    const a1 = angle + frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(a0);
    const y1 = cy + r * Math.sin(a0);
    const x2 = cx + r * Math.cos(a1);
    const y2 = cy + r * Math.sin(a1);
    const large = frac > 0.5 ? 1 : 0;
    angle = a1;

    return `<path d="M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z" fill="${s.color}" stroke="var(--color-bg)" stroke-width="2"></path>`;
  }).join('');
}
