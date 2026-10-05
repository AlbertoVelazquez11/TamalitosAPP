/**
 * costos.js — Registro de Costos y Gastos (v2 · Sprint 2)
 *
 * Cambios v2:
 *  - Selector de insumo real (insumoId).
 *  - Si se selecciona un insumo → campo cantidad; al guardar aumenta su inventario.
 *  - Si no es insumo → sin cantidad.
 *  - Al eliminar un costo de insumo se revierte la cantidad.
 *
 * Estructura:
 *  - Formulario de alta en la parte superior.
 *  - Historial del mes actual debajo (lista cronológica descendente).
 */

import { getAll, put, remove, getById, getCostosPorFecha, aplicarMovimiento, getFinanzas } from '../db.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';
import { esc, formatMXN, hoy, generarId, formatFecha, formatCantidad } from '../utils.js';
import { navegarAtras } from '../router.js';

export async function render(container) {
  // Cargar insumos para el selector
  const insumos = await getAll('insumos');
  insumos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Registrar Costo</h1>
      </div>

      <!-- Formulario de registro de gasto -->
      <div class="card" style="margin-bottom: var(--space-5);">
        <div class="form-group">
          <label class="form-label" for="c-insumo">Insumo <span class="text-muted">(opcional)</span></label>
          <select id="c-insumo" class="form-select">
            <option value="">— Sin insumo —</option>
            ${insumos.map(i => `<option value="${esc(i.id)}">${esc(i.nombre)}${i.unidad ? ' (' + esc(i.unidad) + ')' : ''}</option>`).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label" for="c-concepto">Concepto *</label>
          <input id="c-concepto" type="text" class="form-input"
                 placeholder="Ej. Masa de maíz, Gas LP, Servicio de luz…"
                 maxlength="80" autocomplete="off">
        </div>

        <div class="form-group" id="c-cantidad-group" style="display:none; margin-top: var(--space-3);">
          <label class="form-label" for="c-cantidad">Cantidad</label>
          <input id="c-cantidad" type="number" class="form-input"
                 placeholder="0.0" min="0" step="0.1" inputmode="decimal" autocomplete="off">
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label" for="c-categoria">Categoría</label>
          <select id="c-categoria" class="form-select">
            <option value="Insumo">🛒 Insumo / Materia prima</option>
            <option value="Servicio">🔧 Servicio (luz, gas, agua…)</option>
            <option value="Operativo">📦 Gasto Operativo</option>
            <option value="Otro">📝 Otro</option>
          </select>
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label" for="c-monto">Monto (MXN) *</label>
          <input id="c-monto" type="number" class="form-input"
                 placeholder="0.00" min="0.01" step="0.50"
                 inputmode="decimal" autocomplete="off">
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label" for="c-fuente">Fuente del dinero</label>
          <select id="c-fuente" class="form-select">
            <option value="caja" selected>💵 Caja</option>
            <option value="fondo">🏦 Fondo</option>
          </select>
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label" for="c-fecha">Fecha</label>
          <input id="c-fecha" type="date" class="form-input" value="${hoy()}" max="${hoy()}">
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label" for="c-notas">Notas <span class="text-muted">(opcional)</span></label>
          <textarea id="c-notas" class="form-textarea"
                    placeholder="Información adicional…"
                    maxlength="120"></textarea>
        </div>

        <button class="btn btn-primary btn-block" id="btn-guardar-costo" style="margin-top: var(--space-4);">
          💸 Registrar Gasto
        </button>
      </div>

      <!-- Historial del mes -->
      <div class="list-date-separator" id="historial-titulo">Gastos de este mes</div>
      <div id="lista-costos"></div>
    </div>
  `;

  // Selector de insumo → mostrar/ocultar cantidad y autocompletar
  const insumoSelect  = container.querySelector('#c-insumo');
  const conceptoInput = container.querySelector('#c-concepto');
  const categoriaSel  = container.querySelector('#c-categoria');
  const cantidadGroup = container.querySelector('#c-cantidad-group');

  insumoSelect.addEventListener('change', () => {
    const insumo = insumos.find(i => i.id === insumoSelect.value);
    if (insumo) {
      conceptoInput.value = insumo.nombre;
      categoriaSel.value  = 'Insumo';
      cantidadGroup.style.display = '';
    } else {
      cantidadGroup.style.display = 'none';
    }
  });

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-guardar-costo').addEventListener('click', () => _guardarCosto(container, insumos));

  await _renderHistorial(container);

  return undefined;
}

// ══════════════════════════════════════════════════════════
// GUARDAR COSTO
// ══════════════════════════════════════════════════════════

async function _guardarCosto(container, insumos) {
  const insumoId   = container.querySelector('#c-insumo')?.value;
  const concepto   = container.querySelector('#c-concepto')?.value.trim();
  const categoria  = container.querySelector('#c-categoria')?.value;
  const montoStr   = container.querySelector('#c-monto')?.value;
  const fecha      = container.querySelector('#c-fecha')?.value;
  const notas      = container.querySelector('#c-notas')?.value.trim();
  const cantidadStr = container.querySelector('#c-cantidad')?.value;
  const fuente      = container.querySelector('#c-fuente')?.value || 'caja';

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

  let cantidad = null;
  if (insumoId) {
    cantidad = parseFloat(cantidadStr);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error('Ingresa la cantidad del insumo.');
      container.querySelector('#c-cantidad')?.focus();
      return;
    }
  }

  const nuevo = {
    id:        generarId('costo'),
    concepto,
    categoria: categoria || 'Otro',
    insumoId:  insumoId || null,
    cantidad,
    monto,
    fuente,
    fecha,
    notas:     notas || '',
    creadoEn:  new Date().toISOString(),
  };

  // Si es un insumo, aumentar su inventario
  if (insumoId) {
    let insumo = insumos.find(i => i.id === insumoId);
    if (!insumo) insumo = await getById('insumos', insumoId);
    if (insumo) {
      await put('insumos', { ...insumo, cantidad: (insumo.cantidad ?? 0) + cantidad });
    }
  }

  await put('costos', nuevo);

  // Descontar de la fuente (Caja/Fondo) y registrar movimiento
  const fin   = await getFinanzas();
  const saldo = fuente === 'caja' ? (fin.caja ?? 0) : (fin.fondo ?? 0);
  if (saldo - monto < 0) {
    toast.info(`Aviso: ${fuente === 'caja' ? 'Caja' : 'Fondo'} quedará en negativo.`);
  }
  await aplicarMovimiento({
    tipo:     'costo',
    monto,
    origen:   fuente,
    concepto: concepto,
    refId:    nuevo.id,
  });

  toast.success(`Gasto "${concepto}" registrado — ${formatMXN(monto)}`);

  // Limpiar el formulario (mantener fecha)
  container.querySelector('#c-concepto').value = '';
  container.querySelector('#c-monto').value    = '';
  container.querySelector('#c-notas').value    = '';
  container.querySelector('#c-cantidad').value = '';
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
  const ahora  = new Date();
  const inicio = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`;
  const fin    = hoy();

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
      const id    = btn.dataset.id;
      const costo = costos.find(c => c.id === id);
      if (!costo) return;

      const ok = await modal.confirmar(
        'Eliminar Gasto',
        `¿Eliminar el gasto "${costo.concepto}" de ${formatMXN(costo.monto)}?`,
        'Eliminar',
        'btn-danger'
      );
      if (!ok) return;

      // Revertir inventario si fue un costo de insumo
      if (costo.insumoId && costo.cantidad) {
        const insumo = await getById('insumos', costo.insumoId);
        if (insumo) {
          await put('insumos', { ...insumo, cantidad: (insumo.cantidad ?? 0) - costo.cantidad });
        }
      }

      // Revertir el dinero a su fuente (solo costos con Finanzas)
      if (costo.fuente && (costo.monto || 0) > 0) {
        await aplicarMovimiento({
          tipo:     'costoEliminado',
          monto:    costo.monto,
          destino:  costo.fuente,
          concepto: `Eliminado: ${costo.concepto}`,
          refId:    costo.id,
        });
      }

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
  const cantidadInfo = (c.insumoId && c.cantidad)
    ? `<span>· +${formatCantidad(c.cantidad)}</span>`
    : '';

  return `
    <div class="costo-card">
      <div class="costo-card__icon">${icono}</div>
      <div class="costo-card__body">
        <div class="costo-card__concepto">${esc(c.concepto)}</div>
        <div class="costo-card__meta">
          <span>${formatFecha(c.fecha)}</span>
          <span>·</span>
          <span>${esc(c.categoria)}</span>
          ${c.fuente ? `<span>· ${c.fuente === 'fondo' ? '🏦 Fondo' : '💵 Caja'}</span>` : ''}
          ${cantidadInfo}
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
