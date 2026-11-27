/**
 * core.js — Helpers de transacción, CRUD genérico y consultas de catálogo.
 *
 * Parte del módulo db (ver db.js, que reexporta la API pública).
 */
import { openDB } from './schema.js';

// ══════════════════════════════════════════════════════════
// HELPERS INTERNOS
// ══════════════════════════════════════════════════════════

/**
 * Ejecuta una transacción de solo lectura.
 * @param {string} storeName
 * @returns {Promise<IDBObjectStore>}
 */
async function _readStore(storeName) {
  const db = await openDB();
  return db.transaction(storeName, 'readonly').objectStore(storeName);
}

/**
 * Ejecuta una transacción de lectura/escritura.
 * @param {string} storeName
 * @returns {Promise<IDBObjectStore>}
 */
async function _writeStore(storeName) {
  const db = await openDB();
  return db.transaction(storeName, 'readwrite').objectStore(storeName);
}

/**
 * Envuelve un IDBRequest en una Promise.
 * @param {IDBRequest} req
 * @returns {Promise<any>}
 */
function _promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ══════════════════════════════════════════════════════════
// API PÚBLICA — CRUD GENÉRICO
// ══════════════════════════════════════════════════════════

/**
 * Obtiene todos los registros de un Object Store.
 * Opcionalmente filtra por índice y rango de valores.
 *
 * @param {string} storeName
 * @param {string|null} indexName  - Nombre del índice (o null)
 * @param {IDBKeyRange|any|null} range - Valor o rango para el índice
 * @returns {Promise<Array>}
 */
export async function getAll(storeName, indexName = null, range = null) {
  const store = await _readStore(storeName);
  const target = indexName ? store.index(indexName) : store;
  const query  = range !== null ? range : undefined;
  return _promisify(target.getAll(query));
}

/**
 * Obtiene un registro por su clave primaria (id).
 * @param {string} storeName
 * @param {string} id
 * @returns {Promise<Object|undefined>}
 */
export async function getById(storeName, id) {
  const store = await _readStore(storeName);
  return _promisify(store.get(id));
}

/**
 * Inserta o actualiza un registro (upsert).
 * Si el registro no tiene 'id', genera uno automáticamente.
 * @param {string} storeName
 * @param {Object} record
 * @returns {Promise<string>} — id del registro guardado
 */
export async function put(storeName, record) {
  if (!record.id) {
    record.id = `${storeName.slice(0, 4)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }
  const store = await _writeStore(storeName);
  await _promisify(store.put(record));
  return record.id;
}

/**
 * Elimina un registro por su clave primaria.
 * @param {string} storeName
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function remove(storeName, id) {
  const store = await _writeStore(storeName);
  return _promisify(store.delete(id));
}

/**
 * Cuenta los registros totales de un Object Store.
 * @param {string} storeName
 * @returns {Promise<number>}
 */
export async function count(storeName) {
  const store = await _readStore(storeName);
  return _promisify(store.count());
}

/**
 * Limpia TODOS los registros de un Object Store.
 * ⚠️  Usar solo al importar respaldos.
 * @param {string} storeName
 */
export async function clearStore(storeName) {
  const store = await _writeStore(storeName);
  return _promisify(store.clear());
}

// ══════════════════════════════════════════════════════════
// API PÚBLICA — CONSULTAS ESPECIALIZADAS
// ══════════════════════════════════════════════════════════

/**
 * Devuelve todos los productos con activo !== false,
 * ordenados por su campo 'orden'.
 *
 * FIX BUG-005: IDBKeyRange no acepta booleanos como clave válida (solo
 * string, number, Date, Array). Safari/WebKit iOS lanza
 * "Provided data is inadequate" con IDBKeyRange.only(true).
 * Se reemplaza por filtro JS puro sobre todos los productos.
 */
export async function getProductosActivos() {
  const todos = await getAll('productos');
  return todos
    .filter(p => p.activo !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

/**
 * Devuelve ventas dentro de un rango de fechas (YYYY-MM-DD).
 * @param {string} fechaInicio
 * @param {string} fechaFin
 * @returns {Promise<Array>}
 */
export async function getVentasPorFecha(fechaInicio, fechaFin) {
  const range = IDBKeyRange.bound(fechaInicio, fechaFin);
  const ventas = await getAll('ventas', 'fecha', range);
  // Ordenar descendente (más recientes primero)
  return ventas.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

/**
 * Devuelve todos los detalles de una venta específica.
 * @param {string} ventaId
 * @returns {Promise<Array>}
 */
export async function getDetallesByVentaId(ventaId) {
  return getAll('detalleVenta', 'ventaId', IDBKeyRange.only(ventaId));
}

/**
 * Devuelve costos dentro de un rango de fechas (YYYY-MM-DD).
 * @param {string} fechaInicio
 * @param {string} fechaFin
 * @returns {Promise<Array>}
 */
export async function getCostosPorFecha(fechaInicio, fechaFin) {
  const range = IDBKeyRange.bound(fechaInicio, fechaFin);
  const costos = await getAll('costos', 'fecha', range);
  return costos.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

/**
 * Devuelve el costo unitario del último costo registrado de un insumo
 * (monto / cantidad). Útil para autocompletar el costoUnitario.
 * @param {string} insumoId
 * @returns {Promise<number|null>}
 */
export async function getUltimoCostoUnitario(insumoId) {
  const costos = await getAll('costos');
  const delInsumo = costos
    .filter(c => c.insumoId === insumoId && c.cantidad > 0)
    .sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
  const ultimo = delInsumo[0];
  return ultimo ? (ultimo.monto / ultimo.cantidad) : null;
}

/**
 * Devuelve producciones dentro de un rango de fechas (YYYY-MM-DD),
 * ordenadas de más reciente a más antigua.
 */
export async function getProduccionesPorFecha(fechaInicio, fechaFin) {
  const range = IDBKeyRange.bound(fechaInicio, fechaFin);
  const producciones = await getAll('producciones', 'fecha', range);
  return producciones.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
}

/**
 * Calcula el resumen financiero de un día específico.
 * @param {string} fecha  — formato YYYY-MM-DD
 * @returns {Promise<{totalVentas: number, numVentas: number, totalGastos: number, utilidad: number}>}
 */
export async function getResumenDiario(fecha) {
  const [ventas, costos] = await Promise.all([
    getVentasPorFecha(fecha, fecha),
    getCostosPorFecha(fecha, fecha),
  ]);

  const ventasCobradas = ventas.filter(v => v.estado === 'cobrada');
  const totalVentas    = ventasCobradas.reduce((sum, v) => sum + (v.total || 0), 0);
  const totalGastos    = costos.reduce((sum, c) => sum + (c.monto || 0), 0);

  return {
    numVentas:    ventasCobradas.length,
    totalVentas,
    totalGastos,
    utilidad:     totalVentas - totalGastos,
  };
}
