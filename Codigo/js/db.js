/**
 * db.js — API pública de IndexedDB para TamalitosAPP.
 *
 * La implementación vive en Codigo/js/db/. Este archivo sólo reexporta,
 * para que todos los `import { ... } from './db.js'` sigan funcionando.
 */

export {
  openDB
} from './db/schema.js';

export {
  getAll,
  getById,
  put,
  remove,
  count,
  clearStore,
  getProductosActivos,
  getVentasPorFecha,
  getDetallesByVentaId,
  getCostosPorFecha,
  getUltimoCostoUnitario,
  getProduccionesPorFecha,
  getResumenDiario
} from './db/core.js';

export {
  getFinanzas,
  ajustarCaja,
  aplicarMovimiento,
  getMovimientosFinanzas
} from './db/finanzas.js';

export {
  guardarVentaCompleta,
  guardarProduccion,
  cancelarVenta
} from './db/transacciones.js';

export {
  exportarTodo,
  importarRespaldo
} from './db/backup.js';
