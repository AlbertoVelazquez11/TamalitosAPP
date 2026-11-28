/**
 * insumos-ciclo.js (vista) — Bitácora de compras de insumos por ciclo.
 *
 * Registra cuánto costaba cada insumo en cada ciclo (viernes a jueves) para
 * comparar entre ciclos. No calcula costo de producción ni toca la caja.
 *
 * Sólo el ciclo actual y el siguiente se pueden capturar; los pasados se consultan.
 */

import { getAll, put, remove } from '../db.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';
import { icon } from '../components/icons.js';
import { esc, formatMXN, formatFecha } from '../utils.js';
import { navegarAtras } from '../router.js';
import {
  UNIDADES, ciclosDisponibles, comprasDelCiclo, resumenCiclo, compararPrecios,
  totalCompra, esEditable,
} from '../insumos-ciclo.js';

let _cicloSeleccionado = null;

export async function render(container) {
  const [insumos, compras] = await Promise.all([
    getAll('insumos'),
    getAll('comprasInsumos'),
  ]);
  insumos.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));

  const ciclos = ciclosDisponibles(compras);
  if (!_cicloSeleccionado || !ciclos.some(c => c.inicio === _cicloSeleccionado)) {
    _cicloSeleccionado = ciclos.find(c => c.actual)?.inicio ?? ciclos[0]?.inicio ?? null;
  }
  const ciclo = ciclos.find(c => c.inicio === _cicloSeleccionado) ?? ciclos[0];
  const editable = ciclo ? esEditable(ciclo.inicio) : false;

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">${icon('arrow-left', 20)}</button>
        <h1 class="view-header__title">Insumos del ciclo</h1>
      </div>

      <div class="form-group" style="margin-bottom: var(--space-4);">
        <label class="form-label" for="ciclo-sel">Ciclo</label>
        <select id="ciclo-sel" class="form-select">
          ${ciclos.map(c => `
            <option value="${esc(c.inicio)}" ${c.inicio === ciclo?.inicio ? 'selected' : ''}>
              ${c.actual ? 'Ciclo actual · ' : c.siguiente ? 'Ciclo siguiente · ' : ''}${esc(formatFecha(c.inicio))} → ${esc(formatFecha(c.fin))}${c.editable ? '' : ' (sólo consulta)'}
            </option>`).join('')}
        </select>
      </div>

      ${editable ? `
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="form-group">
          <label class="form-label" for="ic-insumo">Insumo *</label>
          <select id="ic-insumo" class="form-select">
            <option value="">Selecciona insumo del catálogo…</option>
            ${insumos.map(i => `<option value="${esc(i.id)}" data-unidad="${esc(i.unidad || '')}">${esc(i.nombre)}</option>`).join('')}
          </select>
          ${insumos.length === 0 ? '<p class="text-sm text-muted" style="margin-top: var(--space-1);">No hay insumos en el catálogo. Créalos primero en Administración → Insumos.</p>' : ''}
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label" for="ic-cantidad">Cantidad *</label>
            <input id="ic-cantidad" type="number" class="form-input" placeholder="3" min="0" step="0.01" inputmode="decimal">
          </div>
          <div class="form-group">
            <label class="form-label" for="ic-unidad">Unidad</label>
            <select id="ic-unidad" class="form-select">
              ${UNIDADES.map(u => `<option value="${u}">${u}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label" for="ic-precio">Precio por unidad *</label>
          <input id="ic-precio" type="number" class="form-input" placeholder="22.00" min="0" step="0.01" inputmode="decimal">
        </div>

        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label" for="ic-nota">Nota <span class="text-muted">(opcional)</span></label>
          <input id="ic-nota" type="text" class="form-input" placeholder="Subió 2 pesos, compré en la bodega…" maxlength="120">
        </div>

        <div class="text-sm text-muted" id="ic-total" style="margin-top: var(--space-2);">Total: ${formatMXN(0)}</div>

        <button class="btn btn-primary btn-block" id="btn-guardar-compra" style="margin-top: var(--space-4);">
          🧾 Registrar en este ciclo
        </button>
      </div>` : `
      <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid var(--color-warning, #b45309);">
        <p class="text-sm">Este ciclo ya cerró: se puede consultar, no editar. Para capturar, elige el ciclo actual o el siguiente.</p>
      </div>`}

      <div id="resumen-compra" style="margin-bottom: var(--space-4);"></div>
      <div id="lista-compras"></div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);

  container.querySelector('#ciclo-sel').addEventListener('change', (e) => {
    _cicloSeleccionado = e.target.value;
    render(container);
  });

  if (editable) {
    const sel = container.querySelector('#ic-insumo');
    const precio = container.querySelector('#ic-precio');
    const cantidad = container.querySelector('#ic-cantidad');
    const totalEl = container.querySelector('#ic-total');

    const refrescarTotal = () => {
      const t = totalCompra({ precioUnitario: precio.value, cantidad: cantidad.value });
      totalEl.textContent = `Total: ${formatMXN(t)}`;
    };
    precio.addEventListener('input', refrescarTotal);
    cantidad.addEventListener('input', refrescarTotal);

    // La unidad sugerida viene del catálogo, pero se puede cambiar por compra.
    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex];
      const unidad = opt?.dataset?.unidad;
      if (unidad) container.querySelector('#ic-unidad').value = unidad;
    });

    container.querySelector('#btn-guardar-compra')
      .addEventListener('click', () => _guardar(container, insumos, ciclo));
  }

  _renderResumenYCcompras(container, compras, ciclo);
}

function _renderResumenYCcompras(container, compras, ciclo) {
  const resumenEl = container.querySelector('#resumen-compra');
  const listaEl = container.querySelector('#lista-compras');

  if (!ciclo) {
    resumenEl.innerHTML = '';
    listaEl.innerHTML = '<p class="text-sm text-muted">Sin ciclos disponibles.</p>';
    return;
  }

  const resumen = resumenCiclo(compras, ciclo.inicio);
  resumenEl.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-card__label">Total del ciclo</div>
        <div class="summary-card__value">${formatMXN(resumen.total)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-card__label">Insumos registrados</div>
        <div class="summary-card__value">${resumen.insumos}</div>
      </div>
    </div>
  `;

  const filas = comprasDelCiclo(compras, ciclo.inicio);
  if (filas.length === 0) {
    listaEl.innerHTML = '<p class="text-sm text-muted" style="padding: var(--space-3) 0;">Todavía no hay compras registradas en este ciclo.</p>';
    return;
  }

  const comparacion = new Map(
    compararPrecios(compras, ciclo.inicio).map(f => [`${f.insumoId || f.nombre}`, f])
  );

  listaEl.innerHTML = `
    <div class="list-date-separator">Compras del ciclo</div>
    ${filas.map(c => {
      const comp = comparacion.get(`${c.insumoId || c.nombre}`);
      const dif = comp && comp.diferencia !== null
        ? `<span class="text-sm" style="color:${comp.diferencia > 0 ? 'var(--color-danger, #b91c1c)' : 'var(--color-success, #15803d)'};">
             ${comp.diferencia > 0 ? '▲' : '▼'} ${formatMXN(Math.abs(comp.diferencia))} vs ciclo anterior
           </span>`
        : '<span class="text-sm text-muted">sin comparación previa</span>';

      return `
        <div class="list-item" style="align-items:flex-start;">
          <div style="flex:1;">
            <div class="list-item__title">${esc(c.nombre)}</div>
            <div class="list-item__subtitle">
              ${esc(String(c.cantidad))} ${esc(c.unidad || '')} · ${formatMXN(c.precioUnitario)} por ${esc(c.unidad || 'unidad')}
              · total ${formatMXN(c.total)}
            </div>
            ${c.nota ? `<div class="text-sm text-muted">${esc(c.nota)}</div>` : ''}
            <div style="margin-top: 2px;">${dif}</div>
          </div>
          ${esEditable(c.cicloInicio) ? `
            <button class="btn btn-icon" data-borrar="${esc(c.id)}" aria-label="Borrar">
              ${icon('trash', 18)}
            </button>` : ''}
        </div>
      `;
    }).join('')}
  `;

  listaEl.querySelectorAll('[data-borrar]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await modal.confirmar({
        titulo: 'Borrar registro',
        mensaje: 'Se eliminará esta compra del ciclo. No afecta caja ni utilidad.',
        textoConfirmar: 'Borrar',
      });
      if (!ok) return;
      await remove('comprasInsumos', btn.dataset.borrar);
      toast.success('Registro borrado.');
      render(container);
    });
  });
}

async function _guardar(container, insumos, ciclo) {
  const insumoId = container.querySelector('#ic-insumo')?.value;
  const cantidad = Number(container.querySelector('#ic-cantidad')?.value);
  const unidad = container.querySelector('#ic-unidad')?.value || 'kg';
  const precioUnitario = Number(container.querySelector('#ic-precio')?.value);
  const nota = container.querySelector('#ic-nota')?.value.trim() || '';

  if (!insumoId) {
    toast.error('Elige el insumo del catálogo.');
    return;
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    toast.error('La cantidad debe ser mayor a 0.');
    return;
  }
  if (!Number.isFinite(precioUnitario) || precioUnitario <= 0) {
    toast.error('El precio por unidad debe ser mayor a 0.');
    return;
  }

  const insumo = insumos.find(i => i.id === insumoId);
  const ahora = new Date().toISOString();

  await put('comprasInsumos', {
    id: `compra_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    insumoId,
    nombre: insumo?.nombre ?? '',
    cantidad,
    unidad,
    precioUnitario,
    total: totalCompra({ precioUnitario, cantidad }),
    nota,
    cicloInicio: ciclo.inicio,
    cicloFin: ciclo.fin,
    creadoEn: ahora,
    actualizadoEn: ahora,
  });

  toast.success(`Registrado: ${insumo?.nombre ?? 'insumo'} en el ciclo.`);
  render(container);
}
