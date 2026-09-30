/**
 * insumos.js — Catálogo de Insumos (v2 · Sprint 1)
 *
 * Cambios v2:
 *  - Insumos con cantidad (hasta 1 decimal).
 *  - Edición completa (nombre, unidad, descripción) excepto la cantidad.
 *  - "Ajustar inventario" manual para corregir el stock.
 *  - La cantidad se mueve por costos (+) y producciones (−).
 *
 * Flujo:
 *  - Lista de insumos con cantidad y unidad.
 *  - "+ Nuevo" → alta (nombre, unidad, descripción, cantidad inicial).
 *  - Tap en un insumo → edición (cantidad solo lectura).
 *  - Swipe izquierda → eliminar (con confirmación).
 */

import { getAll, put, remove } from '../db.js';
import { modal }               from '../components/modal.js';
import { toast }               from '../components/toast.js';
import { crearSwipeItem }      from '../components/swipe-item.js';
import { esc, generarId, formatCantidad } from '../utils.js';
import { navegarAtras }        from '../router.js';

let _swipeCleanups = [];

export async function render(container) {
  _swipeCleanups = [];

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Inventario de Insumos</h1>
        <div class="view-header__actions">
          <button class="btn btn-primary btn-sm" id="btn-nuevo">+ Nuevo</button>
        </div>
      </div>

      <p class="text-sm text-muted" style="margin-bottom: var(--space-4);">
        Registra los insumos con su cantidad actual. La cantidad se actualiza
        con compras (costos) y producciones. Toca un insumo para editarlo.
        Desliza hacia la izquierda para eliminarlo.
      </p>

      <div id="lista-insumos" class="list"></div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-nuevo').addEventListener('click', () => _abrirFormulario(null, container));

  await _renderLista(container);

  return () => {
    _swipeCleanups.forEach(fn => fn());
    _swipeCleanups = [];
  };
}

// ══════════════════════════════════════════════════════════
// RENDERIZADO DE LA LISTA
// ══════════════════════════════════════════════════════════

async function _renderLista(container) {
  const lista = container.querySelector('#lista-insumos');
  if (!lista) return;

  _swipeCleanups.forEach(fn => fn());
  _swipeCleanups = [];

  const insumos = await getAll('insumos');
  // Ordenar alfabéticamente por nombre
  insumos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  if (insumos.length === 0) {
    lista.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🧾</div>
        <p class="empty-state__title">Sin insumos</p>
        <p class="empty-state__desc">Toca "+ Nuevo" para agregar un insumo al catálogo. Por ejemplo: Masa, Hojas de maíz, Gas LP, etc.</p>
      </div>`;
    return;
  }

  lista.innerHTML = '';

  for (const insumo of insumos) {
    const unidad   = insumo.unidad ? `<span class="badge badge-warning" style="font-size:0.7rem">${esc(insumo.unidad)}</span>` : '';
    const cantidad = formatCantidad(insumo.cantidad);

    const itemHTML = `
      <div class="list-item insumo-list-item" role="button" tabindex="0"
           aria-label="Editar ${esc(insumo.nombre)}">
        <div class="list-item__icon">🧾</div>
        <div class="list-item__content">
          <div class="list-item__title">${esc(insumo.nombre)}</div>
          ${insumo.descripcion
            ? `<div class="list-item__subtitle">${esc(insumo.descripcion)}</div>`
            : ''}
        </div>
        <div class="list-item__trailing">
          <span class="font-bold" style="color: var(--color-text);">${cantidad}</span>
          ${unidad}
        </div>
      </div>`;

    const { elemento, cleanup } = crearSwipeItem({
      contenidoHTML: itemHTML,
      accionIcono:   '🗑',
      accionTexto:   'Eliminar',
      accionClase:   'swipe-action-btn--delete',
      anchoAccion:   90,
      onAccion:      () => _confirmarEliminar(insumo, container),
    });

    // Tap en el contenido del item → abrir formulario de edición
    elemento.querySelector('.insumo-list-item').addEventListener('click', () => {
      _abrirFormulario(insumo, container);
    });

    lista.appendChild(elemento);
    _swipeCleanups.push(cleanup);
  }
}

// ══════════════════════════════════════════════════════════
// FORMULARIO — CREAR Y EDITAR
// ══════════════════════════════════════════════════════════

function _abrirFormulario(insumo, container) {
  const esNuevo = !insumo;
  const titulo  = esNuevo ? 'Nuevo Insumo' : 'Editar Insumo';

  const contenidoHTML = `
    <div class="form-group">
      <label class="form-label" for="i-nombre">Nombre *</label>
      <input id="i-nombre" type="text" class="form-input"
             value="${esc(insumo?.nombre ?? '')}"
             placeholder="Ej. Masa para tamales"
             maxlength="60" autocomplete="off">
    </div>

    <div class="form-group">
      <label class="form-label" for="i-unidad">Unidad <span class="text-muted">(opcional)</span></label>
      <input id="i-unidad" type="text" class="form-input"
             value="${esc(insumo?.unidad ?? '')}"
             placeholder="Ej. kg, lt, pza, bolsa"
             maxlength="20" autocomplete="off">
    </div>

    ${esNuevo ? `
    <div class="form-group">
      <label class="form-label" for="i-cantidad">Cantidad inicial</label>
      <input id="i-cantidad" type="number" class="form-input"
             value="0" placeholder="0.0" min="0" step="0.1"
             inputmode="decimal" autocomplete="off">
    </div>` : `
    <div class="form-group">
      <span class="form-label">Inventario actual</span>
      <div style="display:flex; align-items:center; gap: var(--space-2);">
        <input type="text" class="form-input" disabled style="flex:1;"
               value="${formatCantidad(insumo.cantidad)}${insumo.unidad ? ' ' + esc(insumo.unidad) : ''}">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-ajustar-inventario">Ajustar</button>
      </div>
      <span class="text-xs text-muted">La cantidad cambia por compras y producciones.</span>
    </div>`}

    <div class="form-group">
      <label class="form-label" for="i-desc">Descripción <span class="text-muted">(opcional)</span></label>
      <textarea id="i-desc" class="form-textarea"
                placeholder="Notas adicionales sobre este insumo"
                maxlength="120">${esc(insumo?.descripcion ?? '')}</textarea>
    </div>`;

  const cerrar = modal.abrir({
    titulo,
    contenido: contenidoHTML,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      { texto: esNuevo ? 'Agregar' : 'Guardar Cambios', clase: 'btn-primary', accion: () => _guardarInsumo(insumo, container, cerrar) },
    ],
  });

  // Acción de ajuste manual de inventario (solo en edición)
  if (insumo) {
    document.getElementById('btn-ajustar-inventario')?.addEventListener('click', () => {
      cerrar();
      _abrirAjusteInventario(insumo, container);
    });
  }

  setTimeout(() => document.getElementById('i-nombre')?.focus(), 100);
}

async function _guardarInsumo(insumoExistente, container, cerrar) {
  const nombre = document.getElementById('i-nombre')?.value.trim();
  const unidad = document.getElementById('i-unidad')?.value.trim();
  const desc   = document.getElementById('i-desc')?.value.trim();

  if (!nombre) {
    toast.error('El nombre del insumo es obligatorio.');
    return;
  }

  if (insumoExistente) {
    // Edición: NO se modifica la cantidad (solo nombre, unidad y descripción)
    const actualizado = {
      ...insumoExistente,
      nombre,
      unidad:      unidad || '',
      descripcion: desc   || '',
    };
    await put('insumos', actualizado);
    toast.success(`"${nombre}" actualizado.`);
  } else {
    const cantidad = parseFloat(document.getElementById('i-cantidad')?.value) || 0;

    // Verificar que no exista uno con el mismo nombre
    const existentes = await getAll('insumos');
    const duplicado  = existentes.find(
      i => i.nombre.toLowerCase() === nombre.toLowerCase()
    );
    if (duplicado) {
      toast.error(`Ya existe un insumo llamado "${nombre}".`);
      return;
    }

    const nuevo = {
      id:          generarId('ins'),
      nombre,
      unidad:      unidad || '',
      descripcion: desc   || '',
      cantidad,
      creadoEn:    new Date().toISOString(),
    };
    await put('insumos', nuevo);
    toast.success(`"${nombre}" agregado.`);
  }

  cerrar();
  await _renderLista(container);
}

// ══════════════════════════════════════════════════════════
// AJUSTE MANUAL DE INVENTARIO
// ══════════════════════════════════════════════════════════

function _abrirAjusteInventario(insumo, container) {
  const cerrar = modal.abrir({
    titulo: 'Ajustar Inventario',
    contenido: `
      <p class="text-sm text-muted" style="margin-bottom: var(--space-3);">
        Inventario actual de <strong>${esc(insumo.nombre)}</strong>:
        ${formatCantidad(insumo.cantidad)}${insumo.unidad ? ' ' + esc(insumo.unidad) : ''}.
      </p>
      <div class="form-group">
        <label class="form-label" for="aj-nueva-cantidad">Nueva cantidad</label>
        <input id="aj-nueva-cantidad" type="number" class="form-input"
               value="${insumo.cantidad ?? 0}" step="0.1"
               inputmode="decimal" autocomplete="off">
        <span class="text-xs text-muted">Puede ser negativa si el inventario estaba mal registrado.</span>
      </div>
    `,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      {
        texto: 'Guardar',
        clase: 'btn-primary',
        accion: async () => {
          const valor = parseFloat(document.getElementById('aj-nueva-cantidad')?.value);
          if (Number.isNaN(valor)) {
            toast.error('Ingresa una cantidad válida.');
            return;
          }
          await put('insumos', { ...insumo, cantidad: valor });
          toast.success('Inventario ajustado.');
          cerrar();
          await _renderLista(container);
        },
      },
    ],
  });
}

// ══════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════

async function _confirmarEliminar(insumo, container) {
  const confirmado = await modal.confirmar(
    'Eliminar Insumo',
    `¿Eliminar "${insumo.nombre}" del catálogo? Esta acción no se puede deshacer.`,
    'Eliminar',
    'btn-danger',
  );

  if (!confirmado) return;

  await remove('insumos', insumo.id);
  toast.success(`"${insumo.nombre}" eliminado.`);
  await _renderLista(container);
}
