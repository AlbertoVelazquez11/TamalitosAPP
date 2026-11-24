/**
 * clientes.js — CRUD completo de Clientes
 *
 * Flujo de la vista:
 *  - Carga todos los clientes de IndexedDB.
 *  - Lista ordenada alfabéticamente por nombre.
 *  - Swipe izquierda → eliminar (con confirmación).
 *  - Tap en un cliente → edición.
 *  - Botón "Nuevo cliente" → alta.
 */

import { getAll, put, remove } from '../db.js';
import { modal }               from '../components/modal.js';
import { toast }               from '../components/toast.js';
import { crearSwipeItem }      from '../components/swipe-item.js';
import { esc }                 from '../utils.js';
import { navegarAtras }        from '../router.js';
import { icon }                from '../components/icons.js';

let _swipeCleanups = [];

export async function render(container) {
  _swipeCleanups = [];

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">${icon('arrow-left', 20)}</button>
        <h1 class="view-header__title">Clientes</h1>
      </div>

      <button class="btn btn-primary btn-block" id="btn-nuevo-cliente">${icon('plus', 18)} Nuevo cliente</button>

      <div id="lista-clientes" class="list"></div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-nuevo-cliente').addEventListener('click', () => _abrirFormulario(null, container));

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
  const lista = container.querySelector('#lista-clientes');
  if (!lista) return;

  _swipeCleanups.forEach(fn => fn());
  _swipeCleanups = [];

  const clientes = await getAll('clientes');
  // Ordenar alfabéticamente por nombre
  clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  if (clientes.length === 0) {
    lista.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">👥</div>
        <p class="empty-state__title">Sin clientes</p>
        <p class="empty-state__desc">Toca "Nuevo cliente" para agregar tu primer cliente a la lista.</p>
      </div>`;
    return;
  }

  lista.innerHTML = '';

  for (const cliente of clientes) {
    const subtitulo = cliente.domicilio || cliente.descripcion || '';

    const itemHTML = `
      <div class="list-item cliente-list-item" role="button" tabindex="0"
           aria-label="Editar ${esc(cliente.nombre)}">
        <div class="list-item__content">
          <div class="list-item__title">${esc(cliente.nombre)}</div>
          ${subtitulo ? `
            <div class="list-item__subtitle">${esc(subtitulo)}</div>` : ''}
        </div>
        <div class="list-item__trailing">
          <span style="color: var(--color-text-muted);">${icon('chevron-right', 20)}</span>
        </div>
      </div>`;

    const { elemento, cleanup } = crearSwipeItem({
      contenidoHTML: itemHTML,
      accionIcono:   icon('trash', 20),
      accionTexto:   'Eliminar',
      accionClase:   'swipe-action-btn--delete',
      anchoAccion:   90,
      onAccion:      () => _confirmarEliminar(cliente, container),
    });

    // Tap en el contenido del item → abrir formulario de edición
    elemento.querySelector('.cliente-list-item').addEventListener('click', () => {
      _abrirFormulario(cliente, container);
    });

    lista.appendChild(elemento);
    _swipeCleanups.push(cleanup);
  }
}

// ══════════════════════════════════════════════════════════
// FORMULARIO — CREAR Y EDITAR
// ══════════════════════════════════════════════════════════

function _abrirFormulario(cliente, container) {
  const esNuevo = !cliente;
  const titulo  = esNuevo ? 'Nuevo Cliente' : 'Editar Cliente';

  const contenidoHTML = `
    <div class="form-group">
      <label class="form-label" for="c-nombre">Nombre *</label>
      <input id="c-nombre" type="text" class="form-input"
             value="${esc(cliente?.nombre ?? '')}"
             placeholder="Ej. María López"
             maxlength="60" autocomplete="off">
    </div>

    <div class="form-group">
      <label class="form-label" for="c-domicilio">Domicilio <span class="text-muted">(opcional)</span></label>
      <input id="c-domicilio" type="text" class="form-input"
             value="${esc(cliente?.domicilio ?? '')}"
             placeholder="Ej. Av. Juárez 123, Col. Centro"
             maxlength="120" autocomplete="off">
    </div>

    <div class="form-group">
      <label class="form-label" for="c-descripcion">Descripción <span class="text-muted">(opcional)</span></label>
      <input id="c-descripcion" type="text" class="form-input"
             value="${esc(cliente?.descripcion ?? '')}"
             placeholder="Ej. Cliente frecuente"
             maxlength="120" autocomplete="off">
    </div>

    <div class="form-group">
      <label class="form-label" for="c-notas">Notas <span class="text-muted">(opcional)</span></label>
      <textarea id="c-notas" class="form-textarea"
                placeholder="Notas adicionales sobre este cliente"
                maxlength="240">${esc(cliente?.notas ?? '')}</textarea>
    </div>`;

  const cerrar = modal.abrir({
    titulo,
    contenido: contenidoHTML,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      {
        texto: esNuevo ? 'Agregar' : 'Guardar Cambios',
        clase: 'btn-primary',
        accion: () => _guardarCliente(cliente, container, cerrar),
      },
    ],
  });

  setTimeout(() => document.getElementById('c-nombre')?.focus(), 100);
}

async function _guardarCliente(clienteExistente, container, cerrar) {
  const nombre      = document.getElementById('c-nombre')?.value.trim();
  const domicilio   = document.getElementById('c-domicilio')?.value.trim();
  const descripcion = document.getElementById('c-descripcion')?.value.trim();
  const notas       = document.getElementById('c-notas')?.value.trim();

  if (!nombre) {
    toast.error('El nombre del cliente es obligatorio.');
    return;
  }

  if (clienteExistente) {
    // Edición: mantener id y creadoEn originales
    const actualizado = {
      ...clienteExistente,
      nombre,
      domicilio:   domicilio   || '',
      descripcion: descripcion || '',
      notas:       notas       || '',
    };
    await put('clientes', actualizado);
    toast.success(`"${nombre}" actualizado.`);
  } else {
    const nuevo = {
      id:          `cliente_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      nombre,
      domicilio:   domicilio   || '',
      descripcion: descripcion || '',
      notas:       notas       || '',
      creadoEn:    new Date().toISOString(),
    };
    await put('clientes', nuevo);
    toast.success(`"${nombre}" agregado.`);
  }

  cerrar();
  await _renderLista(container);
}

// ══════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════

async function _confirmarEliminar(cliente, container) {
  const confirmado = await modal.confirmar(
    'Eliminar Cliente',
    `¿Eliminar "${cliente.nombre}" de la lista de clientes? Esta acción no se puede deshacer.`,
    'Eliminar',
    'btn-danger',
  );

  if (!confirmado) return;

  await remove('clientes', cliente.id);
  toast.success(`"${cliente.nombre}" eliminado.`);
  await _renderLista(container);
}
