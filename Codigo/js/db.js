/**
 * db.js — Wrapper de IndexedDB para TamalitosAPP
 *
 * Proporciona una API async/await limpia sobre IndexedDB.
 * Versión de esquema: 4
 * Object Stores: productos, insumos, costos, ventas, detalleVenta, producciones,
 *                recetas, perfiles, finanzas, movimientosFinanzas
 */

import { hoy } from './utils.js';

const DB_NAME    = 'TamalitosAPP';
const DB_VERSION = 4;

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
      _crearEsquema(db, event.oldVersion, event.target.transaction);
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
function _crearEsquema(db, oldVersion, tx) {
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

  // ── Producciones (histórico de producción) ─────────────────
  if (!db.objectStoreNames.contains('producciones')) {
    const store = db.createObjectStore('producciones', { keyPath: 'id' });
    store.createIndex('fecha',      'fecha',      { unique: false });
    store.createIndex('productoId', 'productoId', { unique: false });
  }

  // ── Recetas (1:1 con producto) ─────────────────────────────
  if (!db.objectStoreNames.contains('recetas')) {
    const store = db.createObjectStore('recetas', { keyPath: 'id' });
    store.createIndex('productoId', 'productoId', { unique: true });
  }

  // ── Perfiles (PDV / Sucursal) ──────────────────────────────
  if (!db.objectStoreNames.contains('perfiles')) {
    const store = db.createObjectStore('perfiles', { keyPath: 'id' });
    store.createIndex('nombre', 'nombre', { unique: false });
  }

  // ── Finanzas (saldo único: caja + fondo) ───────────────────
  if (!db.objectStoreNames.contains('finanzas')) {
    db.createObjectStore('finanzas', { keyPath: 'id' });
  }

  // ── Movimientos de Finanzas (ledger) ───────────────────────
  if (!db.objectStoreNames.contains('movimientosFinanzas')) {
    const store = db.createObjectStore('movimientosFinanzas', { keyPath: 'id' });
    store.createIndex('fecha', 'fecha', { unique: false });
    store.createIndex('tipo',  'tipo',  { unique: false });
  }

  // Migración v2 → v3: perfil "General" + backfill de ventas
  if (oldVersion < 3 && tx) {
    _migrarV3(tx);
  }

  // Migración v3 → v4: seed del saldo de Finanzas
  if (oldVersion < 4 && tx) {
    _migrarV4(tx);
  }

  console.log('[DB] Esquema creado/actualizado correctamente.');
}

/**
 * Migración v2 → v3:
 *  - Crea el perfil por defecto "General".
 *  - Asigna "General" a las ventas existentes sin perfil.
 */
function _migrarV3(tx) {
  const ahora     = new Date().toISOString();
  const generalId = 'perfil_general';

  tx.objectStore('perfiles').put({
    id:           generalId,
    nombre:       'General',
    creadoEn:     ahora,
    actualizadoEn: ahora,
  });

  const ventasStore = tx.objectStore('ventas');
  const req = ventasStore.openCursor();
  req.onsuccess = () => {
    const cursor = req.result;
    if (cursor) {
      const venta = cursor.value;
      if (!venta.perfilId) {
        venta.perfilId      = generalId;
        venta.perfilNombre  = 'General';
        cursor.update(venta);
      }
      cursor.continue();
    }
  };
}

/**
 * Migración v3 → v4: seed del saldo de Finanzas (caja y fondo en 0).
 * El usuario ajusta la Caja manualmente desde la vista Finanzas.
 */
function _migrarV4(tx) {
  tx.objectStore('finanzas').put({
    id:            'actual',
    caja:          0,
    fondo:         0,
    actualizadoEn: new Date().toISOString(),
  });
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

// ══════════════════════════════════════════════════════════
// API PÚBLICA — FINANZAS (v3.1)
// ══════════════════════════════════════════════════════════

const FINANZAS_ID = 'actual';

/**
 * Devuelve el saldo actual de Finanzas { caja, fondo }.
 * Si aún no existe, devuelve ceros sin persistir.
 */
export async function getFinanzas() {
  const fin = await getById('finanzas', FINANZAS_ID);
  return fin ?? { id: FINANZAS_ID, caja: 0, fondo: 0 };
}

/**
 * Ajusta manualmente el saldo de Caja a un valor absoluto.
 * Deja registro en el ledger (tipo 'ajusteCaja').
 * @param {number} nuevoValor — valor absoluto de Caja (>= 0)
 */
export async function ajustarCaja(nuevoValor) {
  const fin = await getFinanzas();
  fin.caja = nuevoValor;
  fin.actualizadoEn = new Date().toISOString();
  await put('finanzas', fin);
  await _registrarMovimiento({
    tipo:     'ajusteCaja',
    monto:    nuevoValor,
    concepto: 'Ajuste manual de Caja',
  });
  return fin;
}

/**
 * Aplica un movimiento de dinero actualizando Caja/Fondo de forma atómica
 * y dejando registro en el ledger (movimientosFinanzas).
 *
 * @param {Object} params
 * @param {string} params.tipo    — venta | pagoFiado | cancelacionVenta | costo | costoEliminado | aporteFondo
 * @param {number} params.monto   — monto positivo (> 0)
 * @param {'caja'|'fondo'|null} [params.origen]  — cuenta que se descuenta
 * @param {'caja'|'fondo'|null} [params.destino] — cuenta que se suma
 * @param {string} [params.concepto]
 * @param {string} [params.refId]  — id de la venta/costo relacionado
 */
export async function aplicarMovimiento({ tipo, monto, origen = null, destino = null, concepto = '', refId = null }) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['finanzas', 'movimientosFinanzas'], 'readwrite');
    tx.onerror = () => reject(tx.error);

    const storeFin = tx.objectStore('finanzas');
    const storeMov = tx.objectStore('movimientosFinanzas');

    const reqFin = storeFin.get(FINANZAS_ID);
    reqFin.onsuccess = () => {
      const fin = reqFin.result ?? { id: FINANZAS_ID, caja: 0, fondo: 0 };

      if (origen === 'caja')  fin.caja  = (fin.caja  ?? 0) - monto;
      if (origen === 'fondo') fin.fondo = (fin.fondo ?? 0) - monto;
      if (destino === 'caja') fin.caja  = (fin.caja  ?? 0) + monto;
      if (destino === 'fondo') fin.fondo = (fin.fondo ?? 0) + monto;
      fin.actualizadoEn = new Date().toISOString();

      storeFin.put(fin);
      storeMov.put({
        id:       `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tipo,
        monto,
        origen:   origen ?? null,
        destino:  destino ?? null,
        concepto,
        refId:    refId ?? null,
        fecha:    hoy(),
        creadoEn: new Date().toISOString(),
      });
    };

    tx.oncomplete = () => resolve();
  });
}

/**
 * Registra un movimiento en el ledger sin alterar saldos
 * (usado para el ajuste manual de Caja).
 */
async function _registrarMovimiento({ tipo, monto, concepto = '', origen = null, destino = null, refId = null }) {
  await put('movimientosFinanzas', {
    id:       `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tipo,
    monto,
    origen:   origen ?? null,
    destino:  destino ?? null,
    concepto,
    refId:    refId ?? null,
    fecha:    hoy(),
    creadoEn: new Date().toISOString(),
  });
}

/**
 * Devuelve el ledger de movimientos de Finanzas, más recientes primero.
 */
export async function getMovimientosFinanzas() {
  const movs = await getAll('movimientosFinanzas');
  return movs.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
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
 *   - Resta del inventario cada insumo usado.
 *   - Suma la cantidad producida al producto.
 *   - Guarda el histórico en 'producciones'.
 *
 * @param {Object} produccion
 * @param {string} produccion.productoId
 * @param {string} produccion.nombreProducto
 * @param {number} produccion.cantidadProducida
 * @param {Array}  produccion.insumosUsados — [{ insumoId, nombreInsumo, cantidad }]
 * @returns {Promise<string>} — id de la producción creada
 */
export async function guardarProduccion({ productoId, nombreProducto, cantidadProducida, insumosUsados, costoTotal = 0 }) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['insumos', 'productos', 'producciones'], 'readwrite');
    tx.onerror = () => reject(tx.error);

    const ahora    = new Date();
    const id       = `produccion_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const storeInsumos   = tx.objectStore('insumos');
    const storeProductos = tx.objectStore('productos');

    // Restar insumos usados (permite quedar en negativo)
    for (const u of insumosUsados) {
      const req = storeInsumos.get(u.insumoId);
      req.onsuccess = () => {
        const insumo = req.result;
        if (insumo) {
          insumo.cantidad = (insumo.cantidad ?? 0) - u.cantidad;
          storeInsumos.put(insumo);
        }
      };
    }

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
      insumosUsados,
      costoTotal,
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

/**
 * Exporta todas las tablas de la base de datos como objeto JS.
 * Usado para generar el respaldo JSON completo.
 * @returns {Promise<Object>}
 */
export async function exportarTodo() {
  const [productos, insumos, costos, ventas, detalleVenta, producciones, recetas, perfiles, finanzas, movimientosFinanzas] = await Promise.all([
    getAll('productos'),
    getAll('insumos'),
    getAll('costos'),
    getAll('ventas'),
    getAll('detalleVenta'),
    getAll('producciones'),
    getAll('recetas'),
    getAll('perfiles'),
    getAll('finanzas'),
    getAll('movimientosFinanzas'),
  ]);

  return { productos, insumos, costos, ventas, detalleVenta, producciones, recetas, perfiles, finanzas, movimientosFinanzas };
}

/**
 * Importa un respaldo completo, reemplazando todos los datos.
 * ⚠️ Destructivo: borra los datos actuales antes de importar.
 * @param {Object} respaldo — Objeto con las 5 tablas
 */
export async function importarRespaldo(respaldo) {
  const stores = ['productos', 'insumos', 'costos', 'ventas', 'detalleVenta', 'producciones', 'recetas', 'perfiles', 'finanzas', 'movimientosFinanzas'];

  for (const storeName of stores) {
    await clearStore(storeName);
    const registros = respaldo[storeName] || [];
    for (const record of registros) {
      await put(storeName, record);
    }
  }

  // Garantizar que exista al menos el perfil "General"
  const perfiles = await getAll('perfiles');
  if (perfiles.length === 0) {
    const ahora = new Date().toISOString();
    await put('perfiles', { id: 'perfil_general', nombre: 'General', creadoEn: ahora, actualizadoEn: ahora });
  }

  // Garantizar saldo de Finanzas (respaldos v3.0 no lo incluyen)
  const fin = await getById('finanzas', 'actual');
  if (!fin) {
    await put('finanzas', { id: 'actual', caja: 0, fondo: 0, actualizadoEn: new Date().toISOString() });
  }
}

