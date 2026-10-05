/**
 * finanzas.js — Vista de Finanzas (v3.1)
 *
 * Muestra los 3 montos:
 *  - Capital Financiero (Caja + Fondo, calculado)
 *  - Caja  (editable manualmente)
 *  - Fondo (solo crece por movimientos desde Caja o Inversión)
 * Y el historial de movimientos (ledger).
 */

import {
  getFinanzas,
  ajustarCaja,
  aplicarMovimiento,
  getMovimientosFinanzas,
} from '../db.js';
import { modal }           from '../components/modal.js';
import { toast }           from '../components/toast.js';
import { esc, formatMXN, formatFecha } from '../utils.js';
import { navegarAtras }    from '../router.js';

const ICONO_MOV = {
  venta:            '💰',
  pagoFiado:        '💵',
  cancelacionVenta: '↩️',
  costo:            '💸',
  costoEliminado:   '♻️',
  aporteFondo:      '🏦',
  ajusteCaja:       '✏️',
};

export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Finanzas</h1>
      </div>

      <!-- Capital Financiero -->
      <div id="fin-resumen" style="margin-bottom: var(--space-4);"></div>

      <!-- Caja -->
      <div class="card" style="margin-bottom: var(--space-3);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="text-sm text-muted">Caja</div>
            <div id="fin-caja" style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold);"></div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-ajustar-caja">✏️ Ajustar Caja</button>
        </div>
      </div>

      <!-- Fondo -->
      <div class="card" style="margin-bottom: var(--space-3);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="text-sm text-muted">Fondo</div>
            <div id="fin-fondo" style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold);"></div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-aportar-fondo">➕ Aportar a Fondo</button>
        </div>
      </div>

      <!-- Movimientos -->
      <div class="list-date-separator" style="margin-top: var(--space-4);">Movimientos</div>
      <div id="fin-movimientos"></div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-ajustar-caja').addEventListener('click', () => _abrirAjustarCaja(container));
  container.querySelector('#btn-aportar-fondo').addEventListener('click', () => _abrirAportarFondo(container));

  await _cargar(container);
}

// ══════════════════════════════════════════════════════════
// CARGA Y RENDER
// ══════════════════════════════════════════════════════════

async function _cargar(container) {
  const fin     = await getFinanzas();
  const caja    = fin.caja ?? 0;
  const fondo   = fin.fondo ?? 0;
  const capital = caja + fondo;

  container.querySelector('#fin-resumen').innerHTML = `
    <div class="summary-grid" style="grid-template-columns: 1fr;">
      <div class="summary-card summary-card--profit">
        <span class="summary-card__value">${formatMXN(capital)}</span>
        <span class="summary-card__label">Capital Financiero (Caja + Fondo)</span>
      </div>
    </div>
  `;
  container.querySelector('#fin-caja').textContent  = formatMXN(caja);
  container.querySelector('#fin-fondo').textContent = formatMXN(fondo);

  const movs = await getMovimientosFinanzas();
  const cont = container.querySelector('#fin-movimientos');
  if (!movs || movs.length === 0) {
    cont.innerHTML = `
      <div class="empty-state" style="padding: var(--space-6) 0;">
        <div class="empty-state__icon">💰</div>
        <p class="empty-state__title">Sin movimientos</p>
        <p class="empty-state__desc">Los ingresos y gastos que muevan Caja o Fondo aparecerán aquí.</p>
      </div>`;
    return;
  }

  cont.innerHTML = movs.slice(0, 50).map(_tarjetaMovimiento).join('');
}

function _tarjetaMovimiento(m) {
  const esTransfer = !!(m.origen && m.destino);
  const esSalida   = !esTransfer && !!m.origen;
  const esEntrada  = !esTransfer && !!m.destino;
  const signo      = esSalida ? '−' : (esEntrada ? '+' : '');
  const color      = esSalida ? 'var(--color-danger)' : (esEntrada ? 'var(--color-success)' : 'var(--color-text-muted)');

  return `
    <div class="costo-card">
      <div class="costo-card__icon">${ICONO_MOV[m.tipo] ?? '💰'}</div>
      <div class="costo-card__body">
        <div class="costo-card__concepto">${esc(m.concepto || m.tipo)}</div>
        <div class="costo-card__meta">
          <span>${formatFecha(m.fecha)}${m.creadoEn ? ' · ' + esc(m.creadoEn.slice(11, 16)) : ''}</span>
        </div>
      </div>
      <span class="costo-card__monto" style="color: ${color};">${signo}${formatMXN(m.monto)}</span>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════
// ACCIONES
// ══════════════════════════════════════════════════════════

function _abrirAjustarCaja(container) {
  const cerrar = modal.abrir({
    titulo: 'Ajustar Caja',
    contenido: `
      <p class="text-sm text-muted" style="margin-bottom: var(--space-3);">
        Indica la cantidad actual de dinero en Caja. Reemplaza el valor anterior.
      </p>
      <div class="form-group">
        <label class="form-label" for="aj-caja">Cantidad actual en Caja *</label>
        <input id="aj-caja" type="number" class="form-input"
               placeholder="0.00" min="0" step="0.50" inputmode="decimal" autocomplete="off">
      </div>
    `,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      { texto: 'Guardar', clase: 'btn-primary', accion: async () => {
        const val = parseFloat(document.getElementById('aj-caja')?.value);
        if (!Number.isFinite(val) || val < 0) {
          toast.error('Ingresa una cantidad válida (mayor o igual a 0).');
          return;
        }
        try {
          await ajustarCaja(val);
          toast.success('Caja actualizada.');
          cerrar();
          await _cargar(container);
        } catch (e) {
          console.error('[Finanzas] Error al ajustar Caja:', e);
          toast.error('Error al ajustar Caja.');
        }
      }},
    ],
  });
}

function _abrirAportarFondo(container) {
  const cerrar = modal.abrir({
    titulo: 'Aportar a Fondo',
    contenido: `
      <div class="form-group">
        <label class="form-label" for="af-monto">Monto *</label>
        <input id="af-monto" type="number" class="form-input"
               placeholder="0.00" min="0.01" step="0.50" inputmode="decimal" autocomplete="off">
      </div>
      <div class="form-group" style="margin-top: var(--space-3);">
        <label class="form-label" for="af-origen">Origen del dinero</label>
        <select id="af-origen" class="form-select">
          <option value="caja">💵 Desde Caja (resta de Caja)</option>
          <option value="inversion">💼 Inversión (entrada externa, no resta)</option>
        </select>
      </div>
    `,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      { texto: 'Aportar', clase: 'btn-primary', accion: async () => {
        const monto  = parseFloat(document.getElementById('af-monto')?.value);
        const origen = document.getElementById('af-origen')?.value;
        if (!Number.isFinite(monto) || monto <= 0) {
          toast.error('Ingresa un monto mayor a $0.');
          return;
        }
        try {
          if (origen === 'caja') {
            await aplicarMovimiento({
              tipo:     'aporteFondo',
              monto,
              origen:   'caja',
              destino:  'fondo',
              concepto: 'Aporte a Fondo desde Caja',
            });
          } else {
            await aplicarMovimiento({
              tipo:     'aporteFondo',
              monto,
              destino:  'fondo',
              concepto: 'Aporte a Fondo (Inversión)',
            });
          }
          toast.success('Fondo actualizado.');
          cerrar();
          await _cargar(container);
        } catch (e) {
          console.error('[Finanzas] Error al aportar a Fondo:', e);
          toast.error('Error al aportar a Fondo.');
        }
      }},
    ],
  });
}
