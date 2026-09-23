/**
 * productos.js — CRUD completo de Productos (Sprint 2)
 *
 * HU-021: Agregar producto
 * HU-022: Editar producto
 * HU-023: Desactivar/Activar producto
 *
 * Flujo de la vista:
 *  - Carga todos los productos de IndexedDB (activos e inactivos)
 *  - Muestra lista con: nombre, precio, badge estado, botón editar
 *  - Swipe izquierda → revela botón Activar/Desactivar
 *  - Botón "+" abre modal de creación
 *  - Tap en un producto abre modal de edición
 */

import { getAll, put }           from '../db.js';
import { modal }                  from '../components/modal.js';
import { toast }                  from '../components/toast.js';
import { crearSwipeItem }         from '../components/swipe-item.js';
import { esc, formatMXN, generarId, hoy } from '../utils.js';
import { navegarAtras }           from '../router.js';

// Registro de funciones de cleanup de los swipe handlers activos
let _swipeCleanups = [];

export async function render(container) {
  _swipeCleanups = [];

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Productos</h1>
        <div class="view-header__actions">
          <button class="btn btn-primary btn-sm" id="btn-nuevo">+ Nuevo</button>
        </div>
      </div>

      <p class="text-sm text-muted" style="margin-bottom: var(--space-4);">
        Los productos activos aparecen en la pantalla de venta.
        Desliza un producto hacia la izquierda para activarlo o desactivarlo.
      </p>

      <div id="lista-productos" class="list"></div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-nuevo').addEventListener('click', () => _abrirFormulario(null, container));

  await _renderLista(container);

  return () => {
    // Limpiar todos los swipe listeners al desmontar la vista
    _swipeCleanups.forEach(fn => fn());
    _swipeCleanups = [];
  };
}

// ══════════════════════════════════════════════════════════
// RENDERIZADO DE LA LISTA
// ══════════════════════════════════════════════════════════

async function _renderLista(container) {
  const lista = container.querySelector('#lista-productos');
  if (!lista) return;

  // Limpiar swipe cleanups anteriores
  _swipeCleanups.forEach(fn => fn());
  _swipeCleanups = [];

  const productos = await getAll('productos');
  // Ordenar: activos primero, luego por orden de creación (más reciente abajo)
  productos.sort((a, b) => {
    if (a.activo !== b.activo) return b.activo - a.activo; // activos primero
    return (a.orden ?? 0) - (b.orden ?? 0);
  });

  if (productos.length === 0) {
    lista.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📦</div>
        <p class="empty-state__title">Sin productos</p>
        <p class="empty-state__desc">Toca "+ Nuevo" para agregar tu primer producto al catálogo.</p>
      </div>`;
    return;
  }

  lista.innerHTML = '';

  for (const prod of productos) {
    const estaActivo  = prod.activo !== false;
    const accionTexto = estaActivo ? 'Desactivar' : 'Activar';
    const accionIcono = estaActivo ? '🚫' : '✅';
    const accionClase = estaActivo ? 'swipe-action-btn--delete' : 'swipe-action-btn--activate';

    const itemHTML = `
      <div class="list-item product-list-item" data-id="${esc(prod.id)}" role="button" tabindex="0"
           aria-label="Editar ${esc(prod.nombre)}">
        <div class="list-item__content">
          <div class="list-item__title">${esc(prod.nombre)}</div>
          ${prod.descripcion
            ? `<div class="list-item__subtitle">${esc(prod.descripcion)}</div>`
            : ''}
        </div>
        <div class="list-item__trailing">
          <span class="font-bold" style="color: var(--color-primary)">${formatMXN(prod.precio)}</span>
          <span class="badge ${estaActivo ? 'badge-success' : 'badge-warning'}">
            ${estaActivo ? 'Activo' : 'Inactivo'}
          </span>
          <span style="color: var(--color-text-muted); font-size: 1.1rem;">›</span>
        </div>
      </div>`;

    const { elemento, cleanup } = crearSwipeItem({
      contenidoHTML: itemHTML,
      accionIcono,
      accionTexto,
      accionClase,
      anchoAccion: 90,
      onAccion: () => _toggleActivar(prod, container),
    });

    // Tap en el contenido del item → abrir formulario de edición
    elemento.querySelector('.product-list-item').addEventListener('click', () => {
      _abrirFormulario(prod, container);
    });

    lista.appendChild(elemento);
    _swipeCleanups.push(cleanup);
  }
}

// ══════════════════════════════════════════════════════════
// FORMULARIO — CREAR Y EDITAR
// ══════════════════════════════════════════════════════════

function _abrirFormulario(producto, container) {
  const esNuevo = !producto;
  const titulo  = esNuevo ? 'Nuevo Producto' : 'Editar Producto';

  const contenidoHTML = `
    <div class="form-group">
      <label class="form-label" for="f-nombre">Nombre del producto *</label>
      <input id="f-nombre" type="text" class="form-input"
             value="${esc(producto?.nombre ?? '')}"
             placeholder="Ej. Tamal Verde"
             maxlength="60" autocomplete="off">
    </div>
    <div class="form-group">
      <label class="form-label" for="f-precio">Precio de venta (MXN) *</label>
      <input id="f-precio" type="number" class="form-input"
             value="${producto?.precio ?? ''}"
             placeholder="25.00"
             min="0.01" step="0.50" inputmode="decimal">
    </div>
    <div class="form-group">
      <label class="form-label" for="f-desc">Descripción <span class="text-muted">(opcional)</span></label>
      <textarea id="f-desc" class="form-textarea"
                placeholder="Ej. Con salsa verde y pollo"
                maxlength="120">${esc(producto?.descripcion ?? '')}</textarea>
    </div>`;

  const cerrar = modal.abrir({
    titulo,
    contenido: contenidoHTML,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      {
        texto: esNuevo ? 'Agregar' : 'Guardar Cambios',
        clase: 'btn-primary',
        accion: () => _guardarProducto(producto, container, cerrar),
      },
    ],
  });

  // Enfocar el campo de nombre al abrir el modal
  setTimeout(() => {
    document.getElementById('f-nombre')?.focus();
  }, 100);
}

async function _guardarProducto(productoExistente, container, cerrar) {
  const nombre = document.getElementById('f-nombre')?.value.trim();
  const precio = parseFloat(document.getElementById('f-precio')?.value);
  const desc   = document.getElementById('f-desc')?.value.trim();

  // Validación
  if (!nombre) {
    toast.error('El nombre del producto es obligatorio.');
    return;
  }
  if (!precio || precio <= 0) {
    toast.error('El precio debe ser mayor a $0.');
    return;
  }

  const ahora = new Date().toISOString();

  if (productoExistente) {
    // Edición: mantener id, activo y orden originales
    const actualizado = {
      ...productoExistente,
      nombre,
      precio,
      descripcion:    desc || '',
      actualizadoEn:  ahora,
    };
    await put('productos', actualizado);
    toast.success(`"${nombre}" actualizado.`);
  } else {
    // Creación: calcular el siguiente orden
    const todos = await getAll('productos');
    const maxOrden = todos.reduce((max, p) => Math.max(max, p.orden ?? 0), 0);

    const nuevo = {
      id:           generarId('prod'),
      nombre,
      precio,
      descripcion:  desc || '',
      activo:       true,
      orden:        maxOrden + 1,
      creadoEn:     ahora,
      actualizadoEn: ahora,
    };
    await put('productos', nuevo);
    toast.success(`"${nombre}" agregado al catálogo.`);
  }

  cerrar();
  await _renderLista(container);
}

// ══════════════════════════════════════════════════════════
// ACTIVAR / DESACTIVAR
// ══════════════════════════════════════════════════════════

async function _toggleActivar(producto, container) {
  const nuevoEstado = producto.activo === false ? true : false;
  const accion      = nuevoEstado ? 'activado' : 'desactivado';

  const confirmado = await modal.confirmar(
    nuevoEstado ? 'Activar Producto' : 'Desactivar Producto',
    nuevoEstado
      ? `"${producto.nombre}" volverá a aparecer en la pantalla de venta.`
      : `"${producto.nombre}" se ocultará de la pantalla de venta. Sus ventas previas se conservan.`,
    nuevoEstado ? 'Activar' : 'Desactivar',
    nuevoEstado ? 'btn-primary' : 'btn-danger',
  );

  if (!confirmado) return;

  await put('productos', {
    ...producto,
    activo:        nuevoEstado,
    actualizadoEn: new Date().toISOString(),
  });

  toast.success(`"${producto.nombre}" ${accion}.`);
  await _renderLista(container);
}
