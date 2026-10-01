/**
 * recetas.js — Recetas de Producción (v3 · Sprint 1)
 *
 * - Receta por producto (1:1). Solo productos activos sin receta se listan para crear.
 * - Cantidad base que produce + insumos (insumo + cantidad).
 * - Editar / eliminar. Si el producto se desactiva, la receta se oculta (no se borra).
 * - Calculadora de producción: cantidad → insumos proporcionales (ceil 1 decimal) + costo aproximado.
 */

import { getAll, put, remove } from '../db.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { crearSwipeItem } from '../components/swipe-item.js';
import { esc, generarId, formatCantidad, formatMXN, ceil1 } from '../utils.js';
import { navegarAtras } from '../router.js';

let _swipeCleanups = [];

export async function render(container) {
  _swipeCleanups = [];

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Recetas</h1>
        <div class="view-header__actions">
          <button class="btn btn-icon" id="btn-calculadora" aria-label="Calculadora de producción">🧮</button>
          <button class="btn btn-primary btn-sm" id="btn-nueva">+ Nueva</button>
        </div>
      </div>

      <p class="text-sm text-muted" style="margin-bottom: var(--space-4);">
        Cada producto puede tener una receta. La calculadora estima insumos y costo aproximado.
      </p>

      <div id="recetas-contenido"></div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-nueva').addEventListener('click', () => _abrirFormulario(null, container));
  container.querySelector('#btn-calculadora').addEventListener('click', () => _abrirCalculadora());

  await _renderLista(container);

  return () => {
    _swipeCleanups.forEach(fn => fn());
    _swipeCleanups = [];
  };
}

// ══════════════════════════════════════════════════════════
// LISTA
// ══════════════════════════════════════════════════════════

async function _renderLista(container) {
  const contenido = container.querySelector('#recetas-contenido');
  if (!contenido) return;

  _swipeCleanups.forEach(fn => fn());
  _swipeCleanups = [];

  const [recetas, insumos, productos] = await Promise.all([
    getAll('recetas'),
    getAll('insumos'),
    getAll('productos'),
  ]);

  const activos = productos.filter(p => p.activo !== false);

  // Ocultar recetas de productos inactivos (Q1)
  const visibles = recetas.filter(r => activos.some(p => p.id === r.productoId));

  if (visibles.length === 0) {
    contenido.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📖</div>
        <p class="empty-state__title">Sin recetas</p>
        <p class="empty-state__desc">Toca "+ Nueva" para registrar la receta de un producto.</p>
      </div>`;
    return;
  }

  contenido.innerHTML = '';

  for (const receta of visibles) {
    const costo = _costoReceta(receta, insumos);

    const itemHTML = `
      <div class="list-item receta-list-item" role="button" tabindex="0"
           aria-label="Editar receta de ${esc(receta.nombreProducto)}">
        <div class="list-item__icon">📖</div>
        <div class="list-item__content">
          <div class="list-item__title">${esc(receta.nombreProducto)}</div>
          <div class="list-item__subtitle">Rinde ${formatCantidad(receta.cantidadProducida)} · ${receta.insumos.length} insumos · Costo ${formatMXN(costo)}</div>
        </div>
        <div class="list-item__trailing">
          <span style="color: var(--color-text-muted); font-size: 1.1rem;">›</span>
        </div>
      </div>`;

    const { elemento, cleanup } = crearSwipeItem({
      contenidoHTML: itemHTML,
      accionIcono:   '🗑',
      accionTexto:   'Eliminar',
      accionClase:   'swipe-action-btn--delete',
      anchoAccion:   90,
      onAccion:      () => _confirmarEliminar(receta, container),
    });

    elemento.querySelector('.receta-list-item').addEventListener('click', () => {
      _abrirFormulario(receta, container);
    });

    contenido.appendChild(elemento);
    _swipeCleanups.push(cleanup);
  }
}

function _costoReceta(receta, insumos) {
  return receta.insumos.reduce((sum, r) => {
    const insumo = insumos.find(i => i.id === r.insumoId);
    return sum + ((insumo?.costoUnitario ?? 0) * (r.cantidad || 0));
  }, 0);
}

async function _confirmarEliminar(receta, container) {
  const confirmado = await modal.confirmar(
    'Eliminar Receta',
    `¿Eliminar la receta de "${receta.nombreProducto}"?`,
    'Eliminar',
    'btn-danger'
  );
  if (!confirmado) return;

  await remove('recetas', receta.id);
  toast.success('Receta eliminada.');
  await _renderLista(container);
}

// ══════════════════════════════════════════════════════════
// FORMULARIO — CREAR / EDITAR
// ══════════════════════════════════════════════════════════

async function _abrirFormulario(receta, container) {
  const [recetas, insumos, productos] = await Promise.all([
    getAll('recetas'),
    getAll('insumos'),
    getAll('productos'),
  ]);

  const esNuevo = !receta;
  const activos = productos.filter(p => p.activo !== false);
  const conReceta = new Set(recetas.map(r => r.productoId));
  const disponibles = activos.filter(p => !conReceta.has(p.id));

  const contenidoHTML = `
    ${esNuevo ? `
      <div class="form-group">
        <label class="form-label" for="r-producto">Producto *</label>
        <select id="r-producto" class="form-select">
          <option value="">Selecciona producto…</option>
          ${disponibles.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')}
        </select>
      </div>` : `
      <div class="form-group">
        <span class="form-label">Producto</span>
        <input type="text" class="form-input" disabled value="${esc(receta.nombreProducto)}">
      </div>`}

    <div class="form-group" style="margin-top: var(--space-3);">
      <label class="form-label" for="r-cantidad">Cantidad que produce *</label>
      <input id="r-cantidad" type="number" class="form-input"
             value="${receta?.cantidadProducida ?? ''}"
             placeholder="Ej. 50" min="1" step="1" inputmode="numeric" onfocus="this.select()">
    </div>

    <div class="form-group" style="margin-top: var(--space-3);">
      <span class="form-label">Insumos</span>
      <div id="r-insumos-lista"></div>
      <button type="button" class="btn btn-secondary btn-block" id="r-agregar-insumo" style="margin-top: var(--space-2);">
        + Agregar insumo
      </button>
    </div>

    ${receta ? `
      <button type="button" class="btn btn-danger btn-block" id="r-eliminar" style="margin-top: var(--space-4);">
        Eliminar receta
      </button>` : ''}
  `;

  const cerrar = modal.abrir({
    titulo: esNuevo ? 'Nueva Receta' : 'Editar Receta',
    contenido: contenidoHTML,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      { texto: esNuevo ? 'Crear receta' : 'Guardar cambios', clase: 'btn-primary', accion: () => _guardarReceta(receta, container, cerrar, insumos, productos) },
    ],
  });

  // Filas de insumos
  const listaEl = document.getElementById('r-insumos-lista');
  const filasIniciales = receta && receta.insumos.length
    ? receta.insumos
    : [{ insumoId: '', cantidad: '' }];
  filasIniciales.forEach(f => listaEl.appendChild(_crearFilaInsumo(insumos, f)));

  document.getElementById('r-agregar-insumo').addEventListener('click', () => {
    listaEl.appendChild(_crearFilaInsumo(insumos, null));
  });

  if (receta) {
    document.getElementById('r-eliminar').addEventListener('click', async () => {
      const ok = await modal.confirmar(
        'Eliminar Receta',
        `¿Eliminar la receta de "${receta.nombreProducto}"?`,
        'Eliminar',
        'btn-danger'
      );
      if (!ok) return;
      await remove('recetas', receta.id);
      toast.success('Receta eliminada.');
      cerrar();
      await _renderLista(container);
    });
  }

  setTimeout(() => {
    (esNuevo ? document.getElementById('r-producto') : document.getElementById('r-cantidad'))?.focus();
  }, 100);
}

function _crearFilaInsumo(insumos, valor) {
  const fila = document.createElement('div');
  fila.className = 'produccion-insumo-row';

  fila.innerHTML = `
    <select class="form-select r-insumo-select">
      <option value="">Selecciona insumo…</option>
      ${insumos.map(i => `<option value="${esc(i.id)}">${esc(i.nombre)}${i.unidad ? ' (' + esc(i.unidad) + ')' : ''}</option>`).join('')}
    </select>
    <input class="form-input r-insumo-cantidad" type="number"
           min="0" step="0.1" placeholder="0.0" inputmode="decimal" autocomplete="off"
           value="${valor?.cantidad ?? ''}">
    <button type="button" class="btn btn-icon btn-ghost r-insumo-remove" aria-label="Quitar insumo">✕</button>
  `;

  if (valor?.insumoId) {
    fila.querySelector('.r-insumo-select').value = valor.insumoId;
  }
  fila.querySelector('.r-insumo-remove').addEventListener('click', () => fila.remove());

  return fila;
}

async function _guardarReceta(recetaExistente, container, cerrar, insumos, productos) {
  const esNuevo = !recetaExistente;
  const productoId = esNuevo
    ? document.getElementById('r-producto')?.value
    : recetaExistente.productoId;
  const cantidadProducida = parseInt(document.getElementById('r-cantidad')?.value, 10);

  if (!productoId) {
    toast.error('Selecciona el producto.');
    return;
  }
  if (!cantidadProducida || cantidadProducida <= 0) {
    toast.error('La cantidad que produce debe ser mayor a 0.');
    return;
  }

  // Recolectar insumos
  const insumosReceta = [];
  const vistos = new Set();
  const filas = document.querySelectorAll('#r-insumos-lista .produccion-insumo-row');

  for (const fila of filas) {
    const insumoId = fila.querySelector('.r-insumo-select')?.value;
    const cantidad = Number(fila.querySelector('.r-insumo-cantidad')?.value);
    if (!insumoId) continue;
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error('Cada insumo debe tener una cantidad mayor a 0.');
      return;
    }
    if (vistos.has(insumoId)) {
      toast.error('No repitas el mismo insumo.');
      return;
    }
    vistos.add(insumoId);
    const insumo = insumos.find(i => i.id === insumoId);
    insumosReceta.push({ insumoId, nombreInsumo: insumo?.nombre ?? '', cantidad });
  }

  if (insumosReceta.length === 0) {
    toast.error('Agrega al menos un insumo.');
    return;
  }

  const nombreProducto = esNuevo
    ? (productos.find(p => p.id === productoId)?.nombre ?? '')
    : recetaExistente.nombreProducto;
  const ahora = new Date().toISOString();

  if (recetaExistente) {
    const actualizado = {
      ...recetaExistente,
      cantidadProducida,
      insumos: insumosReceta,
      actualizadoEn: ahora,
    };
    await put('recetas', actualizado);
    toast.success('Receta actualizada.');
  } else {
    const nuevo = {
      id: generarId('receta'),
      productoId,
      nombreProducto,
      cantidadProducida,
      insumos: insumosReceta,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
    await put('recetas', nuevo);
    toast.success('Receta creada.');
  }

  cerrar();
  await _renderLista(container);
}

// ══════════════════════════════════════════════════════════
// CALCULADORA DE PRODUCCIÓN
// ══════════════════════════════════════════════════════════

async function _abrirCalculadora() {
  const [recetas, insumos] = await Promise.all([
    getAll('recetas'),
    getAll('insumos'),
  ]);

  if (recetas.length === 0) {
    toast.info('No hay recetas registradas todavía.');
    return;
  }

  const cerrar = modal.abrir({
    titulo: 'Calculadora de Producción',
    contenido: `
      <div class="form-group">
        <label class="form-label" for="calc-receta">Receta</label>
        <select id="calc-receta" class="form-select">
          ${recetas.map(r => `<option value="${esc(r.id)}">${esc(r.nombreProducto)} (rinde ${formatCantidad(r.cantidadProducida)})</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-top: var(--space-3);">
        <label class="form-label" for="calc-cantidad">Cantidad a producir</label>
        <input id="calc-cantidad" type="number" class="form-input"
               placeholder="Ej. 100" min="1" step="1" inputmode="numeric">
      </div>
      <button type="button" class="btn btn-secondary btn-block" id="calc-btn" style="margin-top: var(--space-3);">
        Calcular
      </button>
      <div id="calc-resultado" style="margin-top: var(--space-3);"></div>
    `,
    botones: [
      { texto: 'Cerrar', clase: 'btn-ghost', accion: () => cerrar() },
    ],
  });

  document.getElementById('calc-btn').addEventListener('click', () => {
    const recetaId = document.getElementById('calc-receta')?.value;
    const Q = Number(document.getElementById('calc-cantidad')?.value);
    const receta = recetas.find(r => r.id === recetaId);
    const resultado = document.getElementById('calc-resultado');

    if (!receta || !resultado) return;
    if (!Number.isFinite(Q) || Q <= 0) {
      toast.error('Ingresa una cantidad a producir.');
      return;
    }

    const factor = Q / receta.cantidadProducida;
    let costoTotal = 0;

    const filas = receta.insumos.map(rI => {
      const insumo   = insumos.find(i => i.id === rI.insumoId);
      const cantidad = ceil1(rI.cantidad * factor);
      const costo    = (insumo?.costoUnitario ?? 0) * cantidad;
      costoTotal += costo;
      return `<div class="cobro-item-row"><span>${esc(rI.nombreInsumo)} × ${formatCantidad(cantidad)}</span><span>${formatMXN(costo)}</span></div>`;
    }).join('');

    resultado.innerHTML = `
      <div class="cobro-summary">${filas}</div>
      <div class="cobro-total-row">
        <span class="cobro-total-label">Costo aproximado</span>
        <span class="cobro-total-amount">${formatMXN(costoTotal)}</span>
      </div>`;
  });
}
