import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

// Globals ANTES de importar el módulo: db.js los usa al abrir.
const fabrica = new IDBFactory();
globalThis.indexedDB = fabrica;
globalThis.IDBKeyRange = IDBKeyRange;

const NOMBRE = 'TamalitosAPP';

/** Deja la base tal como la tiene un dispositivo con la app v4.0.0 (esquema 5, sin índices nuevos). */
function sembrarBaseV5() {
  return new Promise((resolve, reject) => {
    const req = fabrica.open(NOMBRE, 5);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('ventas', { keyPath: 'id' }).createIndex('fecha', 'fecha');
      db.createObjectStore('clientes', { keyPath: 'id' });
      db.createObjectStore('pedidos', { keyPath: 'id' });
      db.createObjectStore('costos', { keyPath: 'id' }).createIndex('fecha', 'fecha');
      db.createObjectStore('insumos', { keyPath: 'id' });
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['clientes', 'pedidos', 'costos', 'insumos'], 'readwrite');
      tx.objectStore('clientes').put({ id: 'cli_1', nombre: 'Ana' });
      tx.objectStore('clientes').put({ id: 'cli_2', nombre: 'Beto' });
      tx.objectStore('pedidos').put({ id: 'ped_1', clienteId: 'cli_1', fechaEntrega: '2026-12-01', estado: 'pendiente' });
      tx.objectStore('pedidos').put({ id: 'ped_2', clienteId: 'cli_2', fechaEntrega: '2026-12-05', estado: 'entregado' });
      tx.objectStore('costos').put({ id: 'cos_1', fecha: '2026-11-27', concepto: 'Gas', monto: 90, fuente: 'caja' });
      tx.objectStore('insumos').put({ id: 'ins_1', nombre: 'Maseca', unidad: 'kg', cantidad: 9, costoUnitario: 22 });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
}

test('la base sembrada está en la versión 5 sin los índices nuevos', async () => {
  await sembrarBaseV5();
  const db = await new Promise((res, rej) => {
    const req = fabrica.open(NOMBRE, 5);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  assert.equal(db.version, 5);
  const tx = db.transaction(['clientes', 'pedidos'], 'readonly');
  assert.equal(tx.objectStore('clientes').indexNames.contains('nombre'), false);
  assert.equal(tx.objectStore('pedidos').indexNames.contains('estado'), false);
  db.close();
});

test('abrir con la app nueva migra a la última versión conservando los datos', async () => {
  const mod = await import('../Codigo/js/db.js');
  const db = await mod.openDB();

  assert.equal(db.version, 9, 'DB_VERSION debe subir a 9');

  const clientes = await mod.getAll('clientes');
  assert.equal(clientes.length, 2, 'no se deben perder clientes en la migración');
  const pedidos = await mod.getAll('pedidos');
  assert.equal(pedidos.length, 2, 'no se deben perder pedidos en la migración');
});

test('los índices nuevos existen y sirven para consultar', async () => {
  const mod = await import('../Codigo/js/db.js');
  const db = await mod.openDB();
  const tx = db.transaction(['clientes', 'pedidos'], 'readonly');
  assert.ok(tx.objectStore('clientes').indexNames.contains('nombre'));
  assert.ok(tx.objectStore('pedidos').indexNames.contains('estado'));
  assert.ok(tx.objectStore('pedidos').indexNames.contains('fechaEntrega'));

  const pendientes = await mod.getAll('pedidos', 'estado', 'pendiente');
  assert.equal(pendientes.length, 1);
  assert.equal(pendientes[0].id, 'ped_1');

  const porNombre = await mod.getAll('clientes', 'nombre', 'Beto');
  assert.equal(porNombre.length, 1);
  assert.equal(porNombre[0].id, 'cli_2');
});

test('los costos viejos quedan como gasto general y con índice por producto', async () => {
  const mod = await import('../Codigo/js/db.js');
  const db = await mod.openDB();

  const tx = db.transaction('costos', 'readonly');
  assert.ok(tx.objectStore('costos').indexNames.contains('productoId'));

  const costos = await mod.getAll('costos');
  assert.equal(costos.length, 1, 'no se debe perder ningún costo');
  assert.equal(costos[0].alcance, 'general');
  assert.equal(costos[0].productoId ?? null, null);
});

test('la bitácora de insumos por ciclo se crea con sus índices al migrar', async () => {
  const mod = await import('../Codigo/js/db.js');
  const db = await mod.openDB();

  assert.ok(Array.from(db.objectStoreNames).includes('comprasInsumos'));
  const tx = db.transaction('comprasInsumos', 'readonly');
  const store = tx.objectStore('comprasInsumos');
  assert.ok(store.indexNames.contains('cicloInicio'));
  assert.ok(store.indexNames.contains('insumoId'));
});

test('los insumos viejos se homologan: sin inventario ni costo unitario', async () => {
  const mod = await import('../Codigo/js/db.js');
  await mod.openDB();

  const insumos = await mod.getAll('insumos');
  assert.equal(insumos.length, 1, 'no se debe perder ningún insumo');
  assert.equal(insumos[0].nombre, 'Maseca');
  assert.equal(insumos[0].unidad, 'kg');
  assert.equal('cantidad' in insumos[0], false);
  assert.equal('costoUnitario' in insumos[0], false);
});

test('los stores que no existían se crean completos en la base migrada', async () => {
  const mod = await import('../Codigo/js/db.js');
  const db = await mod.openDB();
  const nombres = Array.from(db.objectStoreNames);
  for (const esperado of ['productos', 'insumos', 'costos', 'ventas', 'detalleVenta', 'producciones',
                          'recetas', 'perfiles', 'finanzas', 'movimientosFinanzas', 'clientes', 'pedidos']) {
    assert.ok(nombres.includes(esperado), `falta el store ${esperado}`);
  }
});
