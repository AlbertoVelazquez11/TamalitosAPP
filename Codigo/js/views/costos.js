/**
 * costos.js — Registro de Costos y Gastos (Sprint 3)
 *
 * HU-032: Registrar egreso (surtido de inventario, servicio, gasto operativo)
 *
 * Estructura:
 *  - Formulario de alta rápido en la parte superior
 *  - Historial del mes actual debajo (lista cronológica descendente)
 *  - Concepto: texto libre + datalist de insumos para autocompletado
 */

import { getAll, put, getCostosPorFecha } from '../db.js';
import { toast }                           from '../components/toast.js';
import { modal }                           from '../components/modal.js';
import { esc, formatMXN, hoy, generarId, formatFecha } from '../utils.js';
import { navegarAtras }                    from '../router.js';

export async function render(container) {
  // Cargar insumos para el datalist de autocompletado
  const insumos = await getAll('insumos');

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Registrar Costo</h1>
      </div>

      <!-- Formulario de registro de gasto -->
      <div class="card" style="margin-bottom: var(--space-5);">
        <datalist id="insumos-list">
          ${insumos.map(i => `<option value="${esc(i.nombre)}">`).join('')}
        </datalist>

        <div class="form-group">
          <label class="form-label" for="c-concepto">Concepto *</label>
          <input id="c-concepto" type="text" class="form-input"
                 list="insumos-list"
                 placeholder="Ej. Masa de maíz, Gas LP, Servicio de luz…"
                 maxlength="80" autocomplete="off">
        </div>

        <div class="form-group">
          <label class="form-label" for="c-categoria">Categoría</label>
          <select id="c-categoria" class="form-select">
            <option value="Insumo">🛒 Insumo / Materia prima</option>
            <option value="Servicio">🔧 Servicio (luz, gas, agua…)</option>
            <option value="Operativo">📦 Gasto Operativo</option>
            <option value="Otro">📝 Otro</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="c-monto">Monto (MXN) *</label>
          <input id="c-monto" type="number" class="form-input"
                 placeholder="0.00" min="0.01" step="0.50"
                 inputmode="decimal" autocomplete="off">
        </div>

        <div class="form-group">
          <label class="form-label" for="c-fecha">Fecha</label>
          <input id="c-fecha" type="date" class="form-input"
                 value="${hoy()}" max="${hoy()}">
        </div>

        <div class="form-group">
          <label class="form-label" for="c-notas">Notas <span class="text-muted">(opcional)</span></label>
          <textarea id="c-notas" class="form-textarea"
                    placeholder="Información adicional…"
                    maxlength="120"></textarea>
        </div>

        <button class="btn btn-primary btn-block" id="btn-guardar-costo" style="margin-top: var(--space-2);">
          💸 Registrar Gasto
        </button>
      </div>

      <!-- Historial del mes -->
      <div class="list-date-separator" id="historial-titulo">
        Gastos de este mes
      </div>
      <div id="lista-costos"></div>

    </div>
  `;

  // Botón regresar
  container.querySelector('#btn-back').addEventListener('click', navegarAtras);

  // Botón guardar
  container.querySelector('#btn-guardar-costo').addEventListener('click', () => {
    _guardarCosto(container);
  });

  // Render historial del mes actual
  await _renderHistorial(container);

  return undefined;
}

// ══════════════════════════════════════════════════════════
// GUARDAR COSTO
// ══════════════════════════════════════════════════════════

async function _guardarCosto(container) {
  const concepto  = container.querySelector('#c-concepto')?.value.trim();
  const categoria = container.querySelector('#c-categoria')?.value;
  const montoStr  = container.querySelector('#c-monto')?.value;
  const fecha     = container.querySelector('#c-fecha')?.value;
  const notas     = container.querySelector('#c-notas')?.value.trim();

  // Validaciones
  if (!concepto) {
    toast.error('El concepto es obligatorio.');
    container.querySelector('#c-concepto')?.focus();
    return;
  }

  const monto = parseFloat(montoStr);
  if (!monto || monto <= 0) {
    toast.error('El monto debe ser mayor a $0.');
    container.querySelector('#c-monto')?.focus();
    return;
  }

  if (!fecha) {
    toast.error('La fecha es requerida.');
    return;
  }

  const nuevo = {
    id:          generarId('costo'),
    concepto,
    categoria:   categoria || 'Otro',
    monto,
    fecha,
    notas:       notas || '',
    creadoEn:    new Date().toISOString(),
  };

  await put('costos', nuevo);
  toast.success(`Gasto "${concepto}" registrado — ${formatMXN(monto)}`);

  // Limpiar el formulario (mantener fecha y categoría)
  container.querySelector('#c-concepto').value = '';
  container.querySelector('#c-monto').value    = '';
  container.querySelector('#c-notas').value    = '';
  container.querySelector('#c-concepto').focus();

  // Actualizar historial
  await _renderHistorial(container);
}

// ══════════════════════════════════════════════════════════
// HISTORIAL DEL MES
// ══════════════════════════════════════════════════════════

async function _renderHistorial(container) {
  const lista = container.querySelector('#lista-costos');
  if (!lista) return;

  // Calcular el primer y último día del mes actual
  const ahora   = new Date();
  const inicio  = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`;
  const fin     = hoy();

  const costos = await getCostosPorFecha(inicio, fin);
  // Ya vienen ordenados descendente desde db.js

  if (costos.length === 0) {
    lista.innerHTML = `
      <div class="empty-state" style="padding: var(--space-6) 0;">
        <div class="empty-state__icon">📋</div>
        <p class="empty-state__title">Sin gastos este mes</p>
        <p class="empty-state__desc">Los gastos que registres este mes aparecerán aquí.</p>
      </div>`;
    return;
  }

  // Calcular total del mes
  const totalMes = costos.reduce((sum, c) => sum + (c.monto || 0), 0);

  lista.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-3);">
      <span class="text-sm text-muted">${costos.length} registro${costos.length !== 1 ? 's' : ''}</span>
      <span style="font-weight: var(--font-weight-bold); color: var(--color-danger);">${formatMXN(totalMes)} total</span>
    </div>
    ${costos.map(c => _tarjetaCosto(c)).join('')}
  `;

  // Eventos de eliminación
  lista.querySelectorAll('.btn-eliminar-costo').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id      = btn.dataset.id;
      const costo   = costos.find(c => c.id === id);
      if (!costo) return;

      const ok = await modal.confirmar(
        'Eliminar Gasto',
        `¿Eliminar el gasto "${costo.concepto}" de ${formatMXN(costo.monto)}?`,
        'Eliminar',
        'btn-danger'
      );
      if (!ok) return;

      const { remove } = await import('../db.js');
      await remove('costos', id);
      toast.success('Gasto eliminado.');
      await _renderHistorial(container);
    });
  });
}

// ── Iconos por categoría ──────────────────────────────────
const ICONOS_CATEGORIA = {
  'Insumo':    '🛒',
  'Servicio':  '🔧',
  'Operativo': '📦',
  'Otro':      '📝',
};

function _tarjetaCosto(c) {
  const icono = ICONOS_CATEGORIA[c.categoria] ?? '💸';
  return `
    <div class="costo-card">
      <div class="costo-card__icon">${icono}</div>
      <div class="costo-card__body">
        <div class="costo-card__concepto">${esc(c.concepto)}</div>
        <div class="costo-card__meta">
          <span>${formatFecha(c.fecha)}</span>
          <span>·</span>
          <span>${esc(c.categoria)}</span>
          ${c.notas ? `<span>· ${esc(c.notas)}</span>` : ''}
        </div>
      </div>
      <span class="costo-card__monto">−${formatMXN(c.monto)}</span>
      <button class="btn btn-icon btn-sm btn-ghost btn-eliminar-costo"
              data-id="${esc(c.id)}"
              aria-label="Eliminar gasto"
              style="color: var(--color-text-muted); font-size: 1rem; min-height: 36px; width: 36px;">
        ✕
      </button>
    </div>
  `;
}
