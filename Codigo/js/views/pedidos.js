/**
 * pedidos.js — Pedidos (encargos) de TamalitosAPP
 *
 * Flujo de la vista:
 *  - Lista de pedidos ordenada por fecha de entrega, con filtro por estado.
 *  - Swipe izquierda → eliminar (con confirmación).
 *  - Tap en un pedido activo → edición.
 *  - Botón "Nuevo pedido" → alta.
 *  - Estados: solicitado → anticipo → entregado / cancelado.
 *  - Al entregar se registra una venta completa (cabecera + detalle + movimiento a Caja).
 */

import { getAll, put, remove, getById, getProductosActivos, guardarVentaCompleta, aplicarMovimiento } from '../db.js';
import { modal }               from '../components/modal.js';
import { toast }               from '../components/toast.js';
import { crearSwipeItem }      from '../components/swipe-item.js';
import { esc, formatMXN, formatFecha, hoy, ahoraHora, generarId } from '../utils.js';
import { navegarAtras }        from '../router.js';
import { icon }                from '../components/icons.js';
import { store }               from '../store.js';

// Filtro activo del listado (estado del pedido).
let _filtroEstado = 'todos';

let _swipeCleanups = [];

const FILTROS = [
  { id: 'todos',      label: 'Todos' },
  { id: 'solicitado', label: 'Solicitado' },
  { id: 'anticipo',   label: 'Anticipo' },
  { id: 'entregado',  label: 'Entregado' },
  { id: 'cancelado',  label: 'Cancelado' },
];

const ESTADO_BADGE = {
  solicitado: 'badge-warning',
  anticipo:   'badge-pending',
  entregado:  'badge-success',
  cancelado:  'badge-danger',
};

const ESTADO_LABEL = {
  solicitado: 'Solicitado',
  anticipo:   'Anticipo',
  entregado:  'Entregado',
  cancelado:  'Cancelado',
};

export async function render(container) {
  _swipeCleanups = [];

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">${icon('arrow-left', 20)}</button>
        <h1 class="view-header__title">Pedidos</h1>
      </div>

      <button class="btn btn-primary btn-block" id="btn-nuevo-pedido">${icon('plus', 18)} Nuevo pedido</button>

      <div style="display:flex; flex-wrap:wrap; gap: var(--space-2); margin: var(--space-4) 0;">
        ${FILTROS.map(f => `
          <button type="button" class="btn btn-sm ${_filtroEstado === f.id ? 'btn-primary' : 'btn-ghost'}"
                  id="filtro-${f.id}">${f.label}</button>`).join('')}
      </div>

      <div id="lista-pedidos" class="list"></div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-nuevo-pedido').addEventListener('click', () => _abrirFormulario(null, container));

  for (const f of FILTROS) {
    container.querySelector(`#filtro-${f.id}`).addEventListener('click', async () => {
      _filtroEstado = f.id;
      _aplicarFiltroActivo(container);
      await _renderLista(container);
    });
  }

  await _renderLista(container);

  return () => {
    _swipeCleanups.forEach(fn => fn());
    _swipeCleanups = [];
  };
}

// ══════════════════════════════════════════════════════════
// FILTRO POR ESTADO
// ══════════════════════════════════════════════════════════

function _aplicarFiltroActivo(container) {
  for (const f of FILTROS) {
    const btn = container.querySelector(`#filtro-${f.id}`);
    if (!btn) continue;
    btn.classList.toggle('btn-primary', _filtroEstado === f.id);
    btn.classList.toggle('btn-ghost',    _filtroEstado !== f.id);
  }
}

// ══════════════════════════════════════════════════════════
// RENDERIZADO DE LA LISTA
// ══════════════════════════════════════════════════════════

async function _renderLista(container) {
  const lista = container.querySelector('#lista-pedidos');
  if (!lista) return;

  _swipeCleanups.forEach(fn => fn());
  _swipeCleanups = [];

  const pedidos = await getAll('pedidos');
  // Ordenar por fecha de entrega ascendente.
  pedidos.sort((a, b) => (a.fechaEntrega || '').localeCompare(b.fechaEntrega || ''));

  const filtrados = _filtroEstado === 'todos'
    ? pedidos
    : pedidos.filter(p => p.estado === _filtroEstado);

  if (filtrados.length === 0) {
    lista.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🛒</div>
        <p class="empty-state__title">Sin pedidos</p>
        <p class="empty-state__desc">Toca "Nuevo pedido" para registrar tu primer pedido.</p>
      </div>`;
    return;
  }

  lista.innerHTML = '';

  for (const pedido of filtrados) {
    const estadoLabel  = ESTADO_LABEL[pedido.estado] ?? 'Solicitado';
    const badgeClase   = ESTADO_BADGE[pedido.estado] ?? 'badge-warning';
    const puedeAccionar = pedido.estado === 'solicitado' || pedido.estado === 'anticipo';
    const esFinal       = pedido.estado === 'entregado' || pedido.estado === 'cancelado';

    const lineaMontos = formatMXN(pedido.total)
      + (Number(pedido.anticipo) > 0 ? ` · Anticipo ${formatMXN(pedido.anticipo)}` : '')
      + (Number(pedido.descuento) > 0 ? ` · Desc. ${formatMXN(pedido.descuento)}` : '');

    const itemHTML = `
      <div class="list-item pedido-list-item" role="button" tabindex="0"
           aria-label="${esFinal ? 'Pedido' : 'Editar pedido'} de ${esc(pedido.clienteNombre)}">
        <div class="list-item__content">
          <div class="list-item__title">${esc(pedido.clienteNombre)}</div>
          <div class="list-item__subtitle">Entrega ${formatFecha(pedido.fechaEntrega)}</div>
          <div class="list-item__subtitle" style="color: var(--color-text);">${lineaMontos}</div>
          ${puedeAccionar ? `
            <div style="display:flex; gap: var(--space-2); margin-top: var(--space-2);">
              <button type="button" class="btn btn-sm btn-primary pedido-accion-entregar">Entregar</button>
              <button type="button" class="btn btn-sm btn-ghost pedido-accion-cancelar"
                      style="color: var(--color-danger);">Cancelar</button>
            </div>` : ''}
        </div>
        <div class="list-item__trailing">
          <span class="badge ${badgeClase}">${estadoLabel}</span>
          <span style="color: var(--color-text-muted);">${icon('chevron-right', 20)}</span>
        </div>
      </div>`;

    const { elemento, cleanup } = crearSwipeItem({
      contenidoHTML: itemHTML,
      accionIcono:   icon('trash', 20),
      accionTexto:   'Eliminar',
      accionClase:   'swipe-action-btn--delete',
      anchoAccion:   90,
      onAccion:      () => _confirmarEliminar(pedido, container),
    });

    // Tap en el contenido del item → abrir formulario de edición
    if (!esFinal) {
      elemento.querySelector('.pedido-list-item').addEventListener('click', () => {
        _abrirFormulario(pedido, container);
      });
    }

    elemento.querySelector('.pedido-accion-entregar')?.addEventListener('click', (e) => {
      e.stopPropagation();
      _marcarEntregado(pedido, container);
    });

    elemento.querySelector('.pedido-accion-cancelar')?.addEventListener('click', (e) => {
      e.stopPropagation();
      _marcarCancelado(pedido, container);
    });

    lista.appendChild(elemento);
    _swipeCleanups.push(cleanup);
  }
}

// ══════════════════════════════════════════════════════════
// FORMULARIO — CREAR Y EDITAR
// ══════════════════════════════════════════════════════════

async function _abrirFormulario(pedido, container) {
  const esNuevo = !pedido;
  const titulo  = esNuevo ? 'Nuevo Pedido' : 'Editar Pedido';

  const [clientes, productos] = await Promise.all([
    getAll('clientes'),
    getProductosActivos(),
  ]);

  const clienteOptions = clientes
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('');

  const productoOptions = productos
    .map(p => `<option value="${esc(p.id)}" data-nombre="${esc(p.nombre)}" data-precio="${p.precio}">${esc(p.nombre)} — ${formatMXN(p.precio)}</option>`).join('');

  const contenidoHTML = `
    <div class="form-group">
      <label class="form-label" for="p-cliente">Cliente *</label>
      <select id="p-cliente" class="form-select">
        <option value="">Selecciona cliente…</option>
        ${clienteOptions}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label" for="p-fecha-entrega">Fecha de entrega *</label>
      <input type="date" id="p-fecha-entrega" class="form-input"
             value="${esc(pedido?.fechaEntrega ?? hoy())}">
    </div>

    <div class="form-group">
      <span class="form-label">Productos *</span>
      <div id="p-items"></div>
      <button type="button" class="btn btn-secondary btn-block" id="p-agregar-producto"
              style="margin-top: var(--space-2);">
        ${icon('plus', 18)} Agregar producto
      </button>
    </div>

    <div class="form-group">
      <label class="form-label" for="p-anticipo">Anticipo <span class="text-muted">(opcional)</span></label>
      <input type="number" id="p-anticipo" class="form-input" min="0" step="0.01"
             inputmode="decimal" autocomplete="off" value="${pedido?.anticipo ?? 0}">
    </div>

    <div class="form-group">
      <label class="form-label" for="p-descuento">Descuento <span class="text-muted">(opcional, en pesos)</span></label>
      <input type="number" id="p-descuento" class="form-input" min="0" step="0.01"
             inputmode="decimal" autocomplete="off" value="${pedido?.descuento ?? 0}">
    </div>

    <div class="form-group">
      <label class="form-label" for="p-nota">Nota <span class="text-muted">(opcional)</span></label>
      <textarea id="p-nota" class="form-textarea"
                placeholder="Ej. sin cebolla, entregar antes de las 2pm"
                maxlength="240">${esc(pedido?.nota ?? '')}</textarea>
    </div>

    <div class="cobro-total-row" style="margin-top: var(--space-4);">
      <span class="cobro-total-label">Total</span>
      <span class="cobro-total-amount" id="p-total-display">${formatMXN(0)}</span>
    </div>`;

  const cerrar = modal.abrir({
    titulo,
    contenido: contenidoHTML,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      {
        texto: esNuevo ? 'Registrar pedido' : 'Guardar cambios',
        clase: 'btn-primary',
        accion: () => _guardarPedido(pedido, container, cerrar, clientes),
      },
    ],
  });

  // Filas de productos (select + cantidad + quitar)
  const listaItems = document.getElementById('p-items');
  const filasIniciales = pedido && pedido.items?.length
    ? pedido.items
    : [{ productoId: '', cantidad: '' }];
  filasIniciales.forEach(it => listaItems.appendChild(_crearFilaProducto(productos, it)));

  document.getElementById('p-agregar-producto').addEventListener('click', () => {
    listaItems.appendChild(_crearFilaProducto(productos, null));
  });

  document.getElementById('p-descuento').addEventListener('input', _recalcular);

  // Valor inicial
  _recalcular();

  setTimeout(() => document.getElementById('p-cliente')?.focus(), 100);
}

function _crearFilaProducto(productos, valor = null) {
  const fila = document.createElement('div');
  fila.className = 'pedido-item-row';
  fila.style.cssText = 'display:grid; grid-template-columns:1fr 90px 40px; gap:var(--space-2); align-items:center; margin-bottom:var(--space-2);';

  fila.innerHTML = `
    <select class="form-select p-item-producto">
      <option value="">Producto…</option>
      ${productos.map(p => `
        <option value="${esc(p.id)}" data-nombre="${esc(p.nombre)}" data-precio="${p.precio}">
          ${esc(p.nombre)} — ${formatMXN(p.precio)}
        </option>`).join('')}
    </select>
    <input class="form-input p-item-cantidad" type="number" min="1" step="1"
           inputmode="numeric" autocomplete="off" placeholder="1"
           value="${valor?.cantidad ?? ''}">
    <button type="button" class="btn btn-icon btn-ghost p-item-remove" aria-label="Quitar producto">${icon('x', 18)}</button>
  `;

  if (valor?.productoId) {
    fila.querySelector('.p-item-producto').value = valor.productoId;
  }

  fila.querySelector('.p-item-remove').addEventListener('click', () => {
    fila.remove();
    _recalcular();
  });
  fila.querySelector('.p-item-producto').addEventListener('change', _recalcular);
  fila.querySelector('.p-item-cantidad').addEventListener('input', _recalcular);

  return fila;
}

/**
 * Lee las filas de productos válidas (con producto y cantidad > 0).
 * @returns {Array<{productoId, nombreProducto, precioUnitario, cantidad}>}
 */
function _leerItems() {
  const items = [];
  const filas = document.querySelectorAll('#p-items .pedido-item-row');

  for (const fila of filas) {
    const sel = fila.querySelector('.p-item-producto');
    const productoId = sel?.value;
    const cantidad   = Number(fila.querySelector('.p-item-cantidad')?.value);
    if (!productoId || !Number.isFinite(cantidad) || cantidad <= 0) continue;

    const opt = sel.selectedOptions?.[0];
    items.push({
      productoId,
      nombreProducto:  opt?.dataset?.nombre ?? '',
      precioUnitario:  Number(opt?.dataset?.precio) || 0,
      cantidad,
    });
  }

  return items;
}

/**
 * Recalcula el total mostrado en el modal.
 * subtotal = Σ(cantidad × precioUnitario); total = max(0, subtotal - descuento).
 */
function _recalcular() {
  const items = _leerItems();
  const subtotal = items.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0);
  const descuento = Math.max(0, parseFloat(document.getElementById('p-descuento')?.value) || 0);
  const total = Math.max(0, subtotal - descuento);

  const disp = document.getElementById('p-total-display');
  if (disp) disp.textContent = formatMXN(total);
}

async function _guardarPedido(pedidoExistente, container, cerrar, clientes) {
  const clienteId    = document.getElementById('p-cliente')?.value;
  const fechaEntrega = document.getElementById('p-fecha-entrega')?.value;
  const anticipo     = Math.max(0, parseFloat(document.getElementById('p-anticipo')?.value) || 0);
  const descuento    = Math.max(0, parseFloat(document.getElementById('p-descuento')?.value) || 0);
  const nota         = (document.getElementById('p-nota')?.value ?? '').trim();

  if (!clienteId) {
    toast.error('Selecciona el cliente.');
    return;
  }
  if (!fechaEntrega) {
    toast.error('La fecha de entrega es obligatoria.');
    return;
  }

  const items = _leerItems();
  if (items.length === 0) {
    toast.error('Agrega al menos un producto con cantidad mayor a 0.');
    return;
  }

  const subtotal = items.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0);
  const total    = Math.max(0, subtotal - descuento);

  const cliente = clientes.find(c => c.id === clienteId);

  const base = pedidoExistente ? { ...pedidoExistente } : {};

  const record = {
    ...base,
    clienteId,
    clienteNombre: cliente?.nombre ?? '',
    fechaEntrega,
    items,
    subtotal,
    descuento,
    total,
    anticipo,
    nota,
  };

  if (!pedidoExistente) {
    record.id        = generarId('pedido');
    record.estado    = anticipo > 0 ? 'anticipo' : 'solicitado';
    record.ventaId   = null;
    record.creadoEn  = new Date().toISOString();
  }

  await put('pedidos', record);
  toast.success(pedidoExistente ? 'Pedido actualizado.' : 'Pedido registrado.');

  cerrar();
  await _renderLista(container);
}

// ══════════════════════════════════════════════════════════
// TRANSICIONES DE ESTADO
// ══════════════════════════════════════════════════════════

async function _marcarCancelado(pedido, container) {
  const confirmado = await modal.confirmar(
    'Cancelar Pedido',
    `¿Cancelar el pedido de "${pedido.clienteNombre}"?`,
    'Cancelar pedido',
    'btn-danger',
  );

  if (!confirmado) return;

  await put('pedidos', { ...pedido, estado: 'cancelado' });
  toast.success('Pedido cancelado.');
  await _renderLista(container);
}

async function _marcarEntregado(pedido, container) {
  if (pedido.estado === 'entregado') return;

  const confirmado = await modal.confirmar(
    'Entregar Pedido',
    '¿Marcar como entregado? Se registrará una venta.',
    'Entregar',
    'btn-primary',
  );

  if (!confirmado) return;

  try {
    // 1. Resolver perfil activo (PDV)
    const { config } = store.getState();
    const perfil = await getById('perfiles', config.perfilActivoId);

    // 2. Construir la venta (cabecera)
    const venta = {
      fecha:             hoy(),
      hora:              ahoraHora(),
      subtotal:          pedido.subtotal,
      descuento:         pedido.descuento,
      total:             pedido.total,
      tipo:              'venta',
      motivoNoIngreso:   null,
      estadoPago:        'pagada',
      estado:            'cobrada',
      motivoCancelacion: null,
      perfilId:          perfil?.id ?? null,
      perfilNombre:      perfil?.nombre ?? '',
    };

    // 3. Detalles (snapshot de precios del pedido)
    const detalles = pedido.items.map(it => ({
      productoId:     it.productoId,
      nombreProducto: it.nombreProducto,
      precioUnitario: it.precioUnitario,
      cantidad:       it.cantidad,
      subtotalLinea:  it.precioUnitario * it.cantidad,
    }));

    // 4. Guardar venta completa (cabecera + detalle + descuento de stock)
    const ventaId = await guardarVentaCompleta(venta, detalles);

    // 5. Sumar a Caja
    await aplicarMovimiento({
      tipo:     'venta',
      monto:    pedido.total,
      destino:  'caja',
      concepto: 'Pedido entregado',
      refId:    ventaId,
    });

    // 6. Marcar pedido como entregado (idempotente)
    await put('pedidos', { ...pedido, estado: 'entregado', ventaId });

    toast.success('Pedido entregado y venta registrada.');
    await _renderLista(container);

  } catch (e) {
    console.error('[Pedidos] Error al entregar:', e);
    toast.error('Error al entregar el pedido. Intenta de nuevo.');
  }
}

// ══════════════════════════════════════════════════════════
// ELIMINAR
// ══════════════════════════════════════════════════════════

async function _confirmarEliminar(pedido, container) {
  const confirmado = await modal.confirmar(
    'Eliminar Pedido',
    `¿Eliminar el pedido de "${pedido.clienteNombre}"? Esta acción no se puede deshacer.`,
    'Eliminar',
    'btn-danger',
  );

  if (!confirmado) return;

  await remove('pedidos', pedido.id);
  toast.success(`Pedido de "${pedido.clienteNombre}" eliminado.`);
  await _renderLista(container);
}
