/**
 * sheets.js — Sincronización con la plantilla de Google Sheets.
 *
 * La hoja vive en el Apps Script (plantilla-sheets/Sincronizador.gs). Aquí sólo se arma
 * el payload y se envía. El contrato de columnas es el mismo de CrearPlantilla.gs: si
 * cambia un encabezado allá, hay que cambiarlo aquí.
 *
 * Reglas:
 * - Idempotente: cada fila lleva su id en la primera columna; la hoja hace upsert.
 * - Montos y cantidades como número; ids, fechas y horas como texto.
 * - Las líneas repiten la fecha de su venta para no necesitar BUSCARV en la hoja.
 */

import { exportarTodo } from './db.js';
import { store, guardarConfig, getDeviceId } from './store.js';
import { APP_VERSION } from './version.js';

/** Mismo orden de columnas que la plantilla. No reordenar. */
export const HOJAS = {
  Ventas: ['venta_id', 'fecha', 'hora', 'perfil', 'tipo', 'estado_pago', 'cliente',
           'subtotal', 'descuento', 'total', 'estado', 'motivo_cancelacion',
           'motivo_no_ingreso', 'creado_en'],
  Ventas_Lineas: ['linea_id', 'venta_id', 'fecha', 'producto_id', 'producto', 'cantidad',
                  'precio_unitario', 'subtotal_linea'],
  Productos: ['producto_id', 'nombre', 'precio', 'stock', 'activo', 'orden', 'actualizado_en'],
  Perfiles: ['perfil_id', 'nombre', 'creado_en', 'actualizado_en'],
  Insumos: ['insumo_id', 'nombre', 'unidad', 'descripcion'],
  Insumos_Ciclo: ['compra_id', 'ciclo_inicio', 'ciclo_fin', 'insumo_id', 'insumo',
                  'cantidad', 'unidad', 'precio_unitario', 'total', 'nota', 'creado_en'],
  Costos: ['costo_id', 'fecha', 'categoria', 'insumo_id', 'concepto', 'monto', 'fuente',
           'cantidad', 'creado_en'],
  Producciones: ['produccion_id', 'fecha', 'producto_id', 'producto', 'cantidad', 'costo_total', 'creado_en'],
  Clientes: ['cliente_id', 'nombre', 'descripcion', 'domicilio', 'notas', 'creado_en'],
  Pedidos: ['pedido_id', 'cliente_id', 'cliente', 'fecha_entrega', 'total', 'anticipo',
            'descuento', 'estado', 'nota', 'creado_en'],
  Pedidos_Lineas: ['linea_id', 'pedido_id', 'producto_id', 'producto', 'cantidad',
                   'precio_unitario', 'subtotal_linea'],
  Caja_Movimientos: ['movimiento_id', 'fecha', 'tipo', 'monto', 'origen', 'destino',
                     'concepto', 'ref_id', 'creado_en'],
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const texto = (v) => (v === undefined || v === null ? '' : String(v));

const activo = (v) => (v === false ? 0 : 1);

/** Ventas: una fila por venta. */
export function filasDeVentas(ventas = []) {
  return ventas.map(v => ({
    venta_id:          texto(v.id),
    fecha:             texto(v.fecha),
    hora:              texto(v.hora),
    perfil:            texto(v.perfilNombre),
    tipo:              texto(v.tipo || 'venta'),
    estado_pago:       texto(v.estadoPago || 'pagada'),
    cliente:           texto(v.clienteNombre),
    subtotal:          num(v.subtotal),
    descuento:         num(v.descuento),
    total:             num(v.total),
    estado:            texto(v.estado || 'cobrada'),
    motivo_cancelacion: texto(v.motivoCancelacion),
    motivo_no_ingreso:  texto(v.motivoNoIngreso),
    creado_en:         texto(v.creadoEn),
  }));
}

/** Ventas_Lineas: una fila por producto vendido, con la fecha de su venta repetida. */
export function filasDeLineas(detalles = [], ventas = []) {
  const fechaPorVenta = {};
  ventas.forEach(v => { fechaPorVenta[v.id] = texto(v.fecha); });

  return detalles.map(d => ({
    linea_id:        texto(d.id),
    venta_id:        texto(d.ventaId),
    fecha:           texto(fechaPorVenta[d.ventaId]),
    producto_id:     texto(d.productoId),
    producto:        texto(d.nombreProducto),
    cantidad:        num(d.cantidad),
    precio_unitario: num(d.precioUnitario),
    subtotal_linea:  num(d.subtotalLinea ?? num(d.cantidad) * num(d.precioUnitario)),
  }));
}

export function filasDeProductos(productos = []) {
  return productos.map(p => ({
    producto_id:   texto(p.id),
    nombre:        texto(p.nombre),
    precio:        num(p.precio),
    stock:         num(p.cantidad),
    activo:        activo(p.activo),
    orden:         num(p.orden),
    actualizado_en: texto(p.actualizadoEn || p.creadoEn),
  }));
}

export function filasDePerfiles(perfiles = []) {
  return perfiles.map(p => ({
    perfil_id:      texto(p.id),
    nombre:         texto(p.nombre),
    creado_en:      texto(p.creadoEn),
    actualizado_en: texto(p.actualizadoEn),
  }));
}

export function filasDeInsumos(insumos = []) {
  // Sin inventario ni costo unitario: el precio por ciclo vive en Insumos_Ciclo.
  return insumos.map(i => ({
    insumo_id:   texto(i.id),
    nombre:      texto(i.nombre),
    unidad:      texto(i.unidad),
    descripcion: texto(i.descripcion),
  }));
}

export function filasDeComprasInsumos(compras = []) {
  return compras.map(c => ({
    compra_id:       texto(c.id),
    ciclo_inicio:    texto(c.cicloInicio),
    ciclo_fin:       texto(c.cicloFin),
    insumo_id:       texto(c.insumoId),
    insumo:          texto(c.nombre),
    cantidad:        num(c.cantidad),
    unidad:          texto(c.unidad),
    precio_unitario: num(c.precioUnitario),
    total:           num(c.total),
    nota:            texto(c.nota),
    creado_en:       texto(c.creadoEn),
  }));
}

export function filasDeCostos(costos = []) {
  return costos.map(c => ({
    costo_id:  texto(c.id),
    fecha:     texto(c.fecha),
    categoria: texto(c.categoria),
    insumo_id: texto(c.insumoId),
    concepto:  texto(c.concepto),
    monto:     num(c.monto),
    fuente:    texto(c.fuente),
    cantidad:  num(c.cantidad),
    creado_en: texto(c.creadoEn),
  }));
}

export function filasDeProducciones(producciones = []) {
  return producciones.map(p => ({
    produccion_id: texto(p.id),
    fecha:         texto(p.fecha),
    producto_id:   texto(p.productoId),
    producto:      texto(p.nombreProducto),
    cantidad:      num(p.cantidadProducida),
    costo_total:   num(p.costoTotal),
    creado_en:     texto(p.creadoEn),
  }));
}

export function filasDeClientes(clientes = []) {
  return clientes.map(c => ({
    cliente_id:  texto(c.id),
    nombre:      texto(c.nombre),
    descripcion: texto(c.descripcion),
    domicilio:   texto(c.domicilio),
    notas:       texto(c.notas),
    creado_en:   texto(c.creadoEn),
  }));
}

export function filasDePedidos(pedidos = []) {
  return pedidos.map(p => ({
    pedido_id:     texto(p.id),
    cliente_id:    texto(p.clienteId),
    cliente:       texto(p.clienteNombre),
    fecha_entrega: texto(p.fechaEntrega),
    total:         num(p.total),
    anticipo:      num(p.anticipo),
    descuento:     num(p.descuento),
    estado:        texto(p.estado || 'solicitado'),
    nota:          texto(p.nota),
    creado_en:     texto(p.creadoEn),
  }));
}

/** Pedidos_Lineas: aplana el arreglo `items` de cada pedido. */
export function filasDePedidosLineas(pedidos = []) {
  const filas = [];
  pedidos.forEach(p => {
    const items = Array.isArray(p.items) ? p.items : [];
    items.forEach((item, i) => {
      filas.push({
        linea_id:        `${texto(p.id)}_${i}`,
        pedido_id:       texto(p.id),
        producto_id:     texto(item.productoId),
        producto:        texto(item.nombre),
        cantidad:        num(item.cantidad),
        precio_unitario: num(item.precioUnitario),
        subtotal_linea:  num(item.cantidad) * num(item.precioUnitario),
      });
    });
  });
  return filas;
}

export function filasDeCaja(movimientos = []) {
  return movimientos.map(m => ({
    movimiento_id: texto(m.id),
    fecha:         texto(m.fecha),
    tipo:          texto(m.tipo),
    monto:         num(m.monto),
    origen:        texto(m.origen),
    destino:       texto(m.destino),
    concepto:      texto(m.concepto),
    ref_id:        texto(m.refId),
    creado_en:     texto(m.creadoEn),
  }));
}

/**
 * Arma el cuerpo que espera el Apps Script.
 * @param {Object} datos — salida de exportarTodo() (arrays por nombre de store)
 */
/**
 * Costos y Producciones NO se envían: la app todavía no registra esos datos de forma
 * completa, así que llenarían la hoja con información engañosa. Sus columnas quedan
 * definidas en HOJAS para cuando se activen.
 */
export function construirPayload(datos = {}, { dispositivo = '', version = APP_VERSION } = {}) {
  return {
    origen: 'TamalitosAPP',
    version,
    dispositivo,
    hojas: {
      Ventas:            filasDeVentas(datos.ventas),
      Ventas_Lineas:     filasDeLineas(datos.detalleVenta, datos.ventas),
      Productos:         filasDeProductos(datos.productos),
      Perfiles:          filasDePerfiles(datos.perfiles),
      Insumos:           filasDeInsumos(datos.insumos),
      Insumos_Ciclo:     filasDeComprasInsumos(datos.comprasInsumos),
      Clientes:          filasDeClientes(datos.clientes),
      Pedidos:           filasDePedidos(datos.pedidos),
      Pedidos_Lineas:    filasDePedidosLineas(datos.pedidos),
      Caja_Movimientos:  filasDeCaja(datos.movimientosFinanzas),
    },
  };
}

/** Revisa que cada fila tenga exactamente las columnas del contrato. */
export function validarPayload(payload) {
  const errores = [];
  Object.keys(HOJAS).forEach(hoja => {
    const filas = (payload.hojas && payload.hojas[hoja]) || [];
    const columnas = HOJAS[hoja];
    filas.forEach((fila, i) => {
      const faltan = columnas.filter(c => !(c in fila));
      const sobran = Object.keys(fila).filter(k => columnas.indexOf(k) === -1);
      if (faltan.length) errores.push(`${hoja}[${i}] le faltan: ${faltan.join(', ')}`);
      if (sobran.length) errores.push(`${hoja}[${i}] sobran: ${sobran.join(', ')}`);
    });
  });
  return errores;
}

/**
 * Envía el respaldo completo a la hoja configurada.
 * @returns {Promise<{ok:boolean, insertados?:number, actualizados?:number, error?:string}>}
 */
export async function sincronizarSheets() {
  const config = store.getState().config || {};
  const url = String(config.sheetsUrl || '').trim();
  const token = String(config.sheetsToken || '').trim();

  if (!url) return { ok: false, error: 'sin_url' };
  if (!token) return { ok: false, error: 'sin_token' };

  let datos;
  try {
    datos = await exportarTodo();
  } catch (e) {
    return { ok: false, error: 'lectura_local', detalle: e.message };
  }

  const payload = construirPayload(datos, { dispositivo: getDeviceId() });
  const malformadas = validarPayload(payload);
  if (malformadas.length) {
    return { ok: false, error: 'payload_invalido', detalle: malformadas.slice(0, 3).join(' | ') };
  }
  payload.token = token;

  try {
    // text/plain evita el preflight CORS, que Apps Script no responde.
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      return { ok: false, error: data.error || 'envio_fallido', detalle: data.detalle || '' };
    }
    guardarConfig({ ultimaSyncSheets: new Date().toISOString() });
    return {
      ok: true,
      insertados: data.totalInsertados || 0,
      actualizados: data.totalActualizados || 0,
    };
  } catch (e) {
    return { ok: false, error: 'sin_conexion', detalle: e.message };
  }
}
