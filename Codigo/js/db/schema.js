/**
 * schema.js — Nombre/versión de la base, apertura de la conexión y migraciones de IndexedDB.
 *
 * Parte del módulo db (ver db.js, que reexporta la API pública).
 * Versión de esquema: 7
 * Object Stores: productos, insumos, costos, ventas, detalleVenta, producciones,
 *                recetas, perfiles, finanzas, movimientosFinanzas, clientes, pedidos
 */

const DB_NAME    = 'TamalitosAPP';
const DB_VERSION = 7;

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
    store.createIndex('productoId','productoId',{ unique: false });
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

  // ── Clientes ────────────────────────────────────────────────
  // { id, nombre, descripcion, domicilio, notas, creadoEn }
  if (!db.objectStoreNames.contains('clientes')) {
    const store = db.createObjectStore('clientes', { keyPath: 'id' });
    store.createIndex('nombre', 'nombre', { unique: false });
  }

  // ── Pedidos ─────────────────────────────────────────────────
  // { id, clienteId, clienteNombre, fechaEntrega, items: [], total, anticipo, descuento, nota, estado, creadoEn }
  if (!db.objectStoreNames.contains('pedidos')) {
    const store = db.createObjectStore('pedidos', { keyPath: 'id' });
    store.createIndex('estado',       'estado',       { unique: false });
    store.createIndex('fechaEntrega', 'fechaEntrega', { unique: false });
  }

  // Migración v2 → v3: perfil "General" + backfill de ventas
  if (oldVersion < 3 && tx) {
    _migrarV3(tx);
  }

  // Migración v3 → v4: seed del saldo de Finanzas
  if (oldVersion < 4 && tx) {
    _migrarV4(tx);
  }

  // Migración v5 → v6: índices de clientes y pedidos
  if (oldVersion < 6 && tx) {
    _migrarV6(tx);
  }

  // Migración v6 → v7: costos relacionados con un producto
  if (oldVersion < 7 && tx) {
    _migrarV7(tx);
  }

  console.log('[DB] Esquema creado/actualizado correctamente.');
}

/**
 * Migración v6 → v7:
 *  - Índice para relacionar un costo con un producto (utilidad del ciclo).
 *  - Los costos que ya existen quedan como gasto general.
 */
function _migrarV7(tx) {
  const costos = tx.objectStore('costos');
  if (!costos.indexNames.contains('productoId')) {
    costos.createIndex('productoId', 'productoId', { unique: false });
  }
  const req = costos.openCursor();
  req.onsuccess = () => {
    const cursor = req.result;
    if (cursor) {
      const costo = cursor.value;
      if (costo.alcance === undefined) {
        costo.alcance = costo.productoId ? 'producto' : 'general';
        cursor.update(costo);
      }
      cursor.continue();
    }
  };
}

/**
 * Migración v5 → v6:
 *  - Agrega los índices de búsqueda a los stores que ya existían sin ellos.
 *  - Sólo crea el índice si falta, para poder correr también en bases nuevas.
 */
function _migrarV6(tx) {
  const agregar = (storeName, nombre, campo) => {
    if (!tx.objectStore(storeName).indexNames.contains(nombre)) {
      tx.objectStore(storeName).createIndex(nombre, campo, { unique: false });
    }
  };
  agregar('clientes', 'nombre',       'nombre');
  agregar('pedidos',  'estado',       'estado');
  agregar('pedidos',  'fechaEntrega', 'fechaEntrega');
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
