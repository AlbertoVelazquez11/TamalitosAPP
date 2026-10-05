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
 *  - Los pedidos "sin ingreso" se muestran como rebanada separada con leyenda "(Sin ingreso)".
 *  - Los "ingresos" por producto usan el precio de venta (snapshot), no el precio actual.
 */

import { getVentasPorFecha, getDetallesByVentaId, getProduccionesPorFecha } from '../db.js';
import { rangoDePeriodo } from '../export.js';
import { esc, formatMXN, formatCantidad } from '../utils.js';
import { navegarAtras } from '../router.js';

const COLORES = ['#FFAFCC', '#CDB4DB', '#A2D2FF', '#FFC8DD', '#b8a0e0', '#f0a855', '#2ecc8a', '#60b8ff', '#f06e85', '#7a8ab8'];

const PERIODOS = [
  { id: 'dia',    label: 'Hoy' },
  { id: '15dias', label: '15 días' },
  { id: 'mes',    label: 'Mes' },
  { id: '3meses', label: '3 meses' },
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

      <!-- Gráfica por producto -->
      <div class="section-title">Venta por producto</div>
      <div id="dash-pie-productos"></div>

      <!-- Ventas por perfil -->
      <div class="section-title" style="margin-top: var(--space-5);">Ventas por perfil</div>
      <div id="dash-pie-perfiles"></div>

      <!-- Costo por producción -->
      <div class="section-title" style="margin-top: var(--space-5);">Costo por producción</div>
      <div id="dash-costos"></div>
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
  const producciones = await getProduccionesPorFecha(inicio, fin);

  // Consultar detalles en paralelo
  const detallesAll = await Promise.all(
    vigentes.map(v => getDetallesByVentaId(v.id))
  );

  const porProducto = new Map(); // productoId -> { nombre, cantidad, ingresos }
  const porPerfil   = new Map(); // perfilId -> { nombre, cantidad, ingresos }
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

    // Agregación por perfil
    const perfilKey    = v.perfilId || 'perfil_general';
    const perfilNombre = v.perfilNombre || 'General';
    let aggPerfil = porPerfil.get(perfilKey);
    if (!aggPerfil) {
      aggPerfil = { nombre: perfilNombre, cantidad: 0, ingresos: 0 };
      porPerfil.set(perfilKey, aggPerfil);
    }

    for (const d of detalles) {
      // Separar "sin ingreso" en su propia rebanada con leyenda "(Sin ingreso)"
      const key    = esNoIngreso ? `${d.productoId}__sin_ingreso` : d.productoId;
      const nombre = esNoIngreso ? `${d.nombreProducto} (Sin ingreso)` : d.nombreProducto;

      let agg = porProducto.get(key);
      if (!agg) {
        agg = { nombre, cantidad: 0, ingresos: 0 };
        porProducto.set(key, agg);
      }
      agg.cantidad += d.cantidad;
      if (esIngreso) agg.ingresos += d.subtotalLinea;

      aggPerfil.cantidad += d.cantidad;
      if (esIngreso) aggPerfil.ingresos += d.subtotalLinea;
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

  // Gráfica por producto
  _renderPie(container.querySelector('#dash-pie-productos'), [...porProducto.values()]);

  // Ventas por perfil
  _renderPie(container.querySelector('#dash-pie-perfiles'), [...porPerfil.values()]);

  // Costo por producción
  _renderCostosBarras(container.querySelector('#dash-costos'), producciones);
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

// ══════════════════════════════════════════════════════════
// GRÁFICA DE BARRAS — COSTO POR PRODUCCIÓN
// ══════════════════════════════════════════════════════════

function _renderCostosBarras(wrap, producciones) {
  if (!producciones || producciones.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🏭</div>
        <p class="empty-state__title">Sin producciones</p>
        <p class="empty-state__desc">No hay producciones registradas en este período.</p>
      </div>`;
    return;
  }

  // Tomar las últimas 5 producciones (más recientes) y mostrarlas en orden cronológico
  const ultimas = [...producciones]
    .sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || '') || (b.fecha || '').localeCompare(a.fecha || ''))
    .slice(0, 5)
    .sort((a, b) => (a.creadoEn || '').localeCompare(a.creadoEn || '') || (a.fecha || '').localeCompare(a.fecha || ''));

  const maxAltura  = Math.max(...ultimas.map(p => p.cantidadProducida || 0), 1);
  const totalCosto = ultimas.reduce((s, p) => s + (p.costoTotal || 0), 0);

  const W = 320;
  const H = 260;
  const padX      = 42;   // espacio para etiquetas del eje Y (cantidad)
  const padTop    = 28;   // espacio para etiquetas de $costo sobre las barras
  const padBottom = 44;   // espacio para nombre del producto + cantidad bajo las barras
  const plotH     = H - padTop - padBottom;
  const anchoBarra = Math.max(24, Math.min(56, (W - padX - 12) / ultimas.length));

  const recortar = (s, n) => (s && s.length > n) ? s.slice(0, n - 1) + '…' : (s || '');

  // Barras con etiquetas visibles (iOS no muestra el <title> al tocar)
  const bars = ultimas.map((p, i) => {
    const h = ((p.cantidadProducida || 0) / maxAltura) * plotH;
    const x = padX + i * anchoBarra;
    const y = padTop + (plotH - h);
    const cx = (x + anchoBarra / 2).toFixed(1);
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(anchoBarra - 8).toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" rx="2" fill="var(--color-primary)">
        <title>${esc(p.nombreProducto)} — ${formatCantidad(p.cantidadProducida)} ud — ${formatMXN(p.costoTotal || 0)}</title>
      </rect>
      <text x="${cx}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--color-text-muted)">${formatMXN(p.costoTotal || 0)}</text>
      <text x="${cx}" y="${(padTop + plotH + 12).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--color-text)">${esc(recortar(p.nombreProducto, 14))}</text>
      <text x="${cx}" y="${(padTop + plotH + 24).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--color-text-muted)">${formatCantidad(p.cantidadProducida)}</text>`;
  }).join('');

  // Escala del eje Y (cantidad producida): 0, mitad y máximo
  const escala = [0, 0.5, 1].map(f => {
    const val = f * maxAltura;
    const y   = padTop + plotH - (f * plotH);
    return `
      <line x1="${padX}" y1="${y.toFixed(1)}" x2="${W - 8}" y2="${y.toFixed(1)}" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="2,2" />
      <text x="${(padX - 4).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--color-text-muted)">${formatCantidad(val)}</text>`;
  }).join('');

  wrap.innerHTML = `
    <div class="dash-pie-wrap">
      <svg width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Costo por producción">
        ${escala}
        ${bars}
      </svg>
      <p class="text-sm text-muted" style="text-align:center;">
        ${ultimas.length} producción${ultimas.length !== 1 ? 'es' : ''} · Costo total ${formatMXN(totalCosto)}
      </p>
    </div>`;
}
