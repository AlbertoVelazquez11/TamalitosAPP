/**
 * perfiles.js — Perfiles de Venta (PDV Activo / Sucursal) (v3 · Sprint 3)
 *
 * - CRUD de perfiles.
 * - Selección del perfil activo (persiste en localStorage).
 * - No se elimina el perfil activo ni perfiles con ventas.
 */

import { getAll, put, remove } from '../db.js';
import { store, guardarConfig } from '../store.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { esc, generarId } from '../utils.js';
import { navegarAtras } from '../router.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Perfiles</h1>
        <div class="view-header__actions">
          <button class="btn btn-primary btn-sm" id="btn-nuevo">+ Nuevo</button>
        </div>
      </div>

      <p class="text-sm text-muted" style="margin-bottom: var(--space-4);">
        El perfil activo es donde se registran las ventas. Toca un perfil para elegir, editar o eliminar.
      </p>

      <div id="perfiles-lista" class="list"></div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-nuevo').addEventListener('click', () => _abrirNuevo(container));

  await _renderLista(container);
}

// ══════════════════════════════════════════════════════════
// LISTA
// ══════════════════════════════════════════════════════════

async function _renderLista(container) {
  const lista = container.querySelector('#perfiles-lista');
  if (!lista) return;

  const [perfiles, ventas] = await Promise.all([
    getAll('perfiles'),
    getAll('ventas'),
  ]);
  perfiles.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const { config } = store.getState();
  const activoId = config.perfilActivoId;

  if (perfiles.length === 0) {
    lista.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🏪</div>
        <p class="empty-state__title">Sin perfiles</p>
        <p class="empty-state__desc">Toca "+ Nuevo" para crear el primer perfil de venta.</p>
      </div>`;
    return;
  }

  lista.innerHTML = '';

  for (const perfil of perfiles) {
    const esActivo    = perfil.id === activoId;
    const tieneVentas = ventas.some(v => v.perfilId === perfil.id);

    const card = document.createElement('div');
    card.className = 'list-item';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    card.innerHTML = `
      <div class="list-item__icon">🏪</div>
      <div class="list-item__content">
        <div class="list-item__title">${esc(perfil.nombre)}</div>
        <div class="list-item__subtitle">
          ${esActivo ? 'Perfil activo' : (tieneVentas ? 'Con ventas registradas' : 'Sin ventas')}
        </div>
      </div>
      <div class="list-item__trailing">
        ${esActivo ? '<span class="badge badge-success">Activo</span>' : ''}
        <span style="color: var(--color-text-muted); font-size: 1.1rem;">›</span>
      </div>`;

    card.addEventListener('click', () => _abrirAcciones(perfil, container));
    lista.appendChild(card);
  }
}

// ══════════════════════════════════════════════════════════
// ACCIONES
// ══════════════════════════════════════════════════════════

async function _abrirAcciones(perfil, container) {
  const { config } = store.getState();
  const esActivo = perfil.id === config.perfilActivoId;

  const ventas = await getAll('ventas');
  const tieneVentas = ventas.some(v => v.perfilId === perfil.id);

  const cerrar = modal.abrir({
    titulo: perfil.nombre,
    contenido: `
      <p class="text-sm text-muted">
        ${esActivo ? 'Este es el perfil activo.' : 'Elige una acción para este perfil.'}
      </p>
    `,
    botones: [
      {
        texto: esActivo ? 'Perfil activo' : 'Seleccionar',
        clase: 'btn-primary',
        accion: () => {
          if (!esActivo) {
            guardarConfig({ perfilActivoId: perfil.id });
            toast.success(`Perfil activo: ${perfil.nombre}`);
          }
          cerrar();
          _renderLista(container);
        },
      },
      {
        texto: 'Editar',
        clase: 'btn-secondary',
        accion: () => { cerrar(); _abrirEditar(perfil, container); },
      },
      {
        texto: 'Eliminar',
        clase: 'btn-danger',
        accion: () => { cerrar(); _eliminar(perfil, container, tieneVentas, esActivo); },
      },
    ],
  });
}

function _abrirEditar(perfil, container) {
  const cerrar = modal.abrir({
    titulo: 'Editar Perfil',
    contenido: `
      <div class="form-group">
        <label class="form-label" for="p-nombre">Nombre</label>
        <input id="p-nombre" type="text" class="form-input"
               value="${esc(perfil.nombre)}" maxlength="40" autocomplete="off">
      </div>`,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      {
        texto: 'Guardar',
        clase: 'btn-primary',
        accion: async () => {
          const nombre = document.getElementById('p-nombre')?.value.trim();
          if (!nombre) {
            toast.error('El nombre es obligatorio.');
            return;
          }
          await put('perfiles', { ...perfil, nombre, actualizadoEn: new Date().toISOString() });
          toast.success('Perfil actualizado.');
          cerrar();
          await _renderLista(container);
        },
      },
    ],
  });
}

async function _eliminar(perfil, container, tieneVentas, esActivo) {
  if (esActivo) {
    toast.error('No se puede eliminar el perfil activo.');
    return;
  }
  if (tieneVentas) {
    toast.error('Este perfil tiene ventas registradas y no se puede eliminar.');
    return;
  }

  const ok = await modal.confirmar(
    'Eliminar Perfil',
    `¿Eliminar el perfil "${perfil.nombre}"?`,
    'Eliminar',
    'btn-danger'
  );
  if (!ok) return;

  await remove('perfiles', perfil.id);
  toast.success('Perfil eliminado.');
  await _renderLista(container);
}

// ══════════════════════════════════════════════════════════
// NUEVO
// ══════════════════════════════════════════════════════════

function _abrirNuevo(container) {
  const cerrar = modal.abrir({
    titulo: 'Nuevo Perfil',
    contenido: `
      <div class="form-group">
        <label class="form-label" for="p-nombre">Nombre</label>
        <input id="p-nombre" type="text" class="form-input"
               placeholder="Ej. Sucursal Centro" maxlength="40" autocomplete="off">
      </div>`,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      {
        texto: 'Crear',
        clase: 'btn-primary',
        accion: async () => {
          const nombre = document.getElementById('p-nombre')?.value.trim();
          if (!nombre) {
            toast.error('El nombre es obligatorio.');
            return;
          }

          const perfiles = await getAll('perfiles');
          if (perfiles.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
            toast.error('Ya existe un perfil con ese nombre.');
            return;
          }

          const ahora = new Date().toISOString();
          const nuevo = { id: generarId('perfil'), nombre, creadoEn: ahora, actualizadoEn: ahora };
          await put('perfiles', nuevo);

          // Si no hay un activo válido, este pasa a ser activo
          const { config } = store.getState();
          const existeActivo = perfiles.some(p => p.id === config.perfilActivoId);
          if (!existeActivo) {
            guardarConfig({ perfilActivoId: nuevo.id });
          }

          toast.success('Perfil creado.');
          cerrar();
          await _renderLista(container);
        },
      },
    ],
  });
}
