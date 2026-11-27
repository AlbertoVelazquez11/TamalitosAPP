/**
 * transacciones.js — Ventas completas, producción y cancelaciones.
 *
 * Parte del módulo db (ver db.js, que reexporta la API pública).
 */
import { openDB } from './schema.js';
import { aplicarMovimiento } from './finanzas.js';
import { hoy } from '../utils.js';

/**
 * Guarda una venta completa (cabecera + detalles) en una
 * transacción atómica para garantizar consistencia.
 *
 * @param {Object} venta       — Objeto de cabecera sin 'id'
 * @param {Array}  detalles    — Array de líneas sin 'id' ni 'ventaId'
 */
export async function guardarVentaCompleta(venta, detalles) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['ventas', 'detalleVenta', 'productos'], 'readwrite');
    tx.onerror = () => reject(tx.error);

    const ahora    = new Date();
    const ventaId  = `venta_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    const ventaRecord = {
      ...venta,
      id:        ventaId,
      creadoEn:  ahora.toISOString(),
    };

    // Guardar cabecera
    tx.objectStore('ventas').put(ventaRecord);

    // Guardar cada línea del pedido + descontar stock del producto
    const storeProductos = tx.objectStore('productos');
    detalles.forEach((det, idx) => {
      const detRecord = {
        ...det,
        id:      `det_${ventaId}_${idx}`,
        ventaId: ventaId,
      };
      tx.objectStore('detalleVenta').put(detRecord);

      // Descontar stock (permite quedar en negativo)
      const req = storeProductos.get(det.productoId);
      req.onsuccess = () => {
        const prod = req.result;
        if (prod) {
          prod.cantidad = (prod.cantidad ?? 0) - det.cantidad;
          storeProductos.put(prod);
        }
      };
    });

    tx.oncomplete = () => resolve(ventaId);
  });
}

/**
 * Guarda una producción en una transacción atómica:
 *   - Suma la cantidad producida al producto.
 *   - Guarda el histórico en 'producciones'.
 *
 * @param {Object} produccion
 * @param {string} produccion.productoId
 * @param {string} produccion.nombreProducto
 * @param {number} produccion.cantidadProducida
 * @returns {Promise<string>} — id de la producción creada
 */
export async function guardarProduccion({ productoId, nombreProducto, cantidadProducida }) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['productos', 'producciones'], 'readwrite');
    tx.onerror = () => reject(tx.error);

    const ahora    = new Date();
    const id       = `produccion_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const storeProductos = tx.objectStore('productos');

    // Sumar producto
    const reqProd = storeProductos.get(productoId);
    reqProd.onsuccess = () => {
      const prod = reqProd.result;
      if (prod) {
        prod.cantidad = (prod.cantidad ?? 0) + cantidadProducida;
        storeProductos.put(prod);
      }
    };

    // Guardar histórico
    tx.objectStore('producciones').put({
      id,
      productoId,
      nombreProducto,
      cantidadProducida,
      insumosUsados: [],
      costoTotal: 0,
      fecha:     hoy(),
      creadoEn:  ahora.toISOString(),
    });

    tx.oncomplete = () => resolve(id);
  });
}

/**
 * Cancela una venta (soft-delete) y restaura el stock de los productos vendidos.
 * @param {string} ventaId
 * @param {string} motivo
 * @returns {Promise<void>}
 */
export async function cancelarVenta(ventaId, motivo) {
  const db = await openDB();

  let restarCaja = 0; // monto a descontar de Caja si la venta estaba pagada

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['ventas', 'detalleVenta', 'productos'], 'readwrite');
    tx.onerror = () => reject(tx.error);

    // Marcar venta como cancelada
    const storeVentas = tx.objectStore('ventas');
    const reqVenta = storeVentas.get(ventaId);
    reqVenta.onsuccess = () => {
      const venta = reqVenta.result;
      if (!venta) return;

      // Si era una venta realmente cobrada (no fiada, no sin-ingreso),
      // el dinero ya se sumó a Caja y hay que restarlo.
      if (venta.tipo !== 'noIngreso' && venta.estadoPago === 'pagada') {
        restarCaja = venta.total || 0;
      }

      venta.estado            = 'cancelada';
      venta.motivoCancelacion = motivo;
      venta.actualizadoEn     = new Date().toISOString();
      storeVentas.put(venta);
    };

    // Restaurar stock de los productos vendidos
    const storeDetalles = tx.objectStore('detalleVenta');
    const reqDetalles   = storeDetalles.index('ventaId').getAll(ventaId);
    reqDetalles.onsuccess = () => {
      const detalles       = reqDetalles.result || [];
      const storeProductos = tx.objectStore('productos');
      for (const d of detalles) {
        const reqProd = storeProductos.get(d.productoId);
        reqProd.onsuccess = () => {
          const prod = reqProd.result;
          if (prod) {
            prod.cantidad = (prod.cantidad ?? 0) + d.cantidad;
            storeProductos.put(prod);
          }
        };
      }
    };

    tx.oncomplete = () => resolve();
  });

  // Descontar de Caja si la venta cancelada había sumado dinero
  if (restarCaja > 0) {
    await aplicarMovimiento({
      tipo:     'cancelacionVenta',
      monto:    restarCaja,
      origen:   'caja',
      concepto: 'Cancelación de venta',
      refId:    ventaId,
    });
  }
}
