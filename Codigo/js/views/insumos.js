/**
 * insumos.js — Catálogo de Insumos (Sprint 2)
 *
 * HU-030: Agregar insumo al catálogo
 * HU-031: Eliminar insumo con gesto swipe-to-delete
 *
 * Los insumos son un clasificador de conceptos de gasto,
 * NO están vinculados al inventario ni a las ventas.
 *
 * Flujo:
 *  - Lista de insumos desde IndexedDB
 *  - Botón "+" → modal de alta
 *  - Swipe izquierda → botón "Eliminar" con confirmación
 */

import { getAll, put, remove }    from '../db.js';
import { modal }                   from '../components/modal.js';
import { toast }                   from '../components/toast.js';
import { crearSwipeItem }          from '../components/swipe-item.js';
import { esc, generarId }          from '../utils.js';
import { navegarAtras }            from '../router.js';

let _swipeCleanups = [];

export async function render(container) {
  _swipeCleanups = [];

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Insumos</h1>
        <div class="view-header__actions">
          <button class="btn btn-primary btn-sm" id="btn-nuevo">+ Nuevo</button>
        </div>
      </div>

      <p class="text-sm text-muted" style="margin-bottom: var(--space-4);">
        Registra los insumos que usas en tu negocio. Los usarás como
        categorías al registrar un gasto.
        Desliza hacia la izquierda para eliminar.
      </p>

      <div id="lista-insumos" class="list"></div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-nuevo').addEventListener('click', () => _abrirFormulario(container));

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
    const unidad = insumo.unidad ? `<span class="badge badge-warning" style="font-size:0.7rem">${esc(insumo.unidad)}</span>` : '';

    const itemHTML = `
      <div class="list-item" aria-label="${esc(insumo.nombre)}">
        <div class="list-item__icon">🧾</div>
        <div class="list-item__content">
          <div class="list-item__title">${esc(insumo.nombre)}</div>
          ${insumo.descripcion
            ? `<div class="list-item__subtitle">${esc(insumo.descripcion)}</div>`
            : ''}
        </div>
        <div class="list-item__trailing">
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

    lista.appendChild(elemento);
    _swipeCleanups.push(cleanup);
  }
}

// ══════════════════════════════════════════════════════════
// FORMULARIO — CREAR
// ══════════════════════════════════════════════════════════

function _abrirFormulario(container) {
  const contenidoHTML = `
    <div class="form-group">
      <label class="form-label" for="i-nombre">Nombre del insumo *</label>
      <input id="i-nombre" type="text" class="form-input"
             placeholder="Ej. Masa para tamales"
             maxlength="60" autocomplete="off">
    </div>
    <div class="form-group">
      <label class="form-label" for="i-unidad">Unidad de medida <span class="text-muted">(opcional)</span></label>
      <input id="i-unidad" type="text" class="form-input"
             placeholder="Ej. kg, lt, pza, bolsa"
             maxlength="20" autocomplete="off">
    </div>
    <div class="form-group">
      <label class="form-label" for="i-desc">Descripción <span class="text-muted">(opcional)</span></label>
      <textarea id="i-desc" class="form-textarea"
                placeholder="Notas adicionales sobre este insumo"
                maxlength="120"></textarea>
    </div>`;

  const cerrar = modal.abrir({
    titulo:   'Nuevo Insumo',
    contenido: contenidoHTML,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost',   accion: () => cerrar() },
      { texto: 'Agregar',  clase: 'btn-primary',  accion: () => _guardarInsumo(container, cerrar) },
    ],
  });

  setTimeout(() => document.getElementById('i-nombre')?.focus(), 100);
}

async function _guardarInsumo(container, cerrar) {
  const nombre = document.getElementById('i-nombre')?.value.trim();
  const unidad = document.getElementById('i-unidad')?.value.trim();
  const desc   = document.getElementById('i-desc')?.value.trim();

  if (!nombre) {
    toast.error('El nombre del insumo es obligatorio.');
    return;
  }

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
    creadoEn:    new Date().toISOString(),
  };

  await put('insumos', nuevo);
  toast.success(`"${nombre}" agregado.`);
  cerrar();
  await _renderLista(container);
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
