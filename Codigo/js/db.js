/**
 * db.js — Wrapper de IndexedDB para TamalitosAPP
 *
 * Proporciona una API async/await limpia sobre IndexedDB.
 * Versión de esquema: 1
 * Object Stores: productos, insumos, costos, ventas, detalleVenta
 */

const DB_NAME    = 'TamalitosAPP';
const DB_VERSION = 1;

// Singleton de la conexión a la base de datos
let _db = null;

/**
 * Abre (o reutiliza) la conexión a IndexedDB.
 * Crea el esquema en el primer acceso.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      _crearEsquema(db, event.oldVersion);
    };

    request.onsuccess = (event) => {
      _db = event.target.result;

      // Reconectar si la BD fue cerrada externamente
      _db.onclose = () => { _db = null; };

      resolve(_db);
    };

    request.onerror = (event) => {
      console.error('[DB] Error al abrir la base de datos:', event.target.error);
      reject(event.target.error);
    };

    request.onblocked = () => {
      console.warn('[DB] Conexión bloqueada. Cierra otras pestañas de la app.');
    };
  });
}

/**
 * Crea el esquema de Object Stores e índices.
 * Solo se ejecuta durante onupgradeneeded.
 */
function _crearEsquema(db, oldVersion) {
  // ── Productos (catálogo de venta) ────────────────────────
  if (!db.objectStoreNames.contains('productos')) {
    const store = db.createObjectStore('productos', { keyPath: 'id' });
    store.createIndex('activo', 'activo', { unique: false });
    store.createIndex('nombre', 'nombre', { unique: false });
    store.createIndex('orden',  'orden',  { unique: false });
  }

  // ── Insumos (catálogo de conceptos de gasto) ─────────────
  if (!db.objectStoreNames.contains('insumos')) {
    const store = db.createObjectStore('insumos', { keyPath: 'id' });
    store.createIndex('nombre', 'nombre', { unique: false });
  }

  // ── Costos y Gastos (egresos) ─────────────────────────────
  if (!db.objectStoreNames.contains('costos')) {
    const store = db.createObjectStore('costos', { keyPath: 'id' });
    store.createIndex('fecha',     'fecha',     { unique: false });
    store.createIndex('categoria', 'categoria', { unique: false });
    store.createIndex('insumoId',  'insumoId',  { unique: false });
  }

  // ── Ventas (cabecera de transacción) ──────────────────────
  if (!db.objectStoreNames.contains('ventas')) {
    const store = db.createObjectStore('ventas', { keyPath: 'id' });
    store.createIndex('fecha',      'fecha',      { unique: false });
    store.createIndex('estado',     'estado',     { unique: false });
    store.createIndex('estadoPago', 'estadoPago', { unique: false });
  }

  // ── Detalle de Venta (líneas del pedido) ──────────────────
  if (!db.objectStoreNames.contains('detalleVenta')) {
    const store = db.createObjectStore('detalleVenta', { keyPath: 'id' });
    store.createIndex('ventaId',   'ventaId',   { unique: false });
    store.createIndex('productoId','productoId',{ unique: false });
  }

  console.log('[DB] Esquema creado/actualizado correctamente.');
}

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
 * Devuelve todos los productos con activo === true,
 * ordenados por su campo 'orden'.
 */
export async function getProductosActivos() {
  const todos = await getAll('productos', 'activo', IDBKeyRange.only(true));
  return todos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
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

/**
 * Guarda una venta completa (cabecera + detalles) en una
 * transacción atómica para garantizar consistencia.
 *
 * @param {Object} venta       — Objeto de cabecera sin 'id'
 * @param {Array}  detalles    — Array de líneas sin 'id' ni 'ventaId'
 * @returns {Promise<string>}  — id de la venta creada
 */
export async function guardarVentaCompleta(venta, detalles) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['ventas', 'detalleVenta'], 'readwrite');
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

    // Guardar cada línea del pedido
    detalles.forEach((det, idx) => {
      const detRecord = {
        ...det,
        id:      `det_${ventaId}_${idx}`,
        ventaId: ventaId,
      };
      tx.objectStore('detalleVenta').put(detRecord);
    });

    tx.oncomplete = () => resolve(ventaId);
  });
}

/**
 * Exporta todas las tablas de la base de datos como objeto JS.
 * Usado para generar el respaldo JSON completo.
 * @returns {Promise<Object>}
 */
export async function exportarTodo() {
  const [productos, insumos, costos, ventas, detalleVenta] = await Promise.all([
    getAll('productos'),
    getAll('insumos'),
    getAll('costos'),
    getAll('ventas'),
    getAll('detalleVenta'),
  ]);

  return { productos, insumos, costos, ventas, detalleVenta };
}

/**
 * Importa un respaldo completo, reemplazando todos los datos.
 * ⚠️ Destructivo: borra los datos actuales antes de importar.
 * @param {Object} respaldo — Objeto con las 5 tablas
 */
export async function importarRespaldo(respaldo) {
  const stores = ['productos', 'insumos', 'costos', 'ventas', 'detalleVenta'];

  for (const storeName of stores) {
    await clearStore(storeName);
    const registros = respaldo[storeName] || [];
    for (const record of registros) {
      await put(storeName, record);
    }
  }
}

