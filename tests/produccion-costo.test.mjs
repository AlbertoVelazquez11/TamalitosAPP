import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

globalThis.indexedDB = new IDBFactory();
globalThis.IDBKeyRange = IDBKeyRange;

const db = await import('../Codigo/js/db.js');

async function productoDePrueba(id, cantidad = 0) {
  await db.put('productos', { id, nombre: 'Verde', precio: 20, cantidad, activo: true, orden: 1 });
}

test('una producción guarda el costo total manual', async () => {
  await db.openDB();
  await productoDePrueba('prod_costo');

  await db.guardarProduccion({ productoId: 'prod_costo', nombreProducto: 'Verde', cantidadProducida: 30, costoTotal: 450 });

  const producciones = await db.getAll('producciones');
  assert.equal(producciones.length, 1);
  assert.equal(producciones[0].costoTotal, 450);
  assert.equal(producciones[0].cantidadProducida, 30);
});

test('el costo no mueve la caja: finanzas sigue en cero', async () => {
  const fin = await db.getFinanzas();
  assert.equal(fin.caja, 0);
  assert.equal(fin.fondo, 0);
  assert.equal((await db.getMovimientosFinanzas()).length, 0);
});

test('la producción sube el stock del producto', async () => {
  const prod = await db.getById('productos', 'prod_costo');
  assert.equal(prod.cantidad, 30);
});

test('sin costo capturado se guarda cero, nunca NaN ni undefined', async () => {
  await productoDePrueba('prod_sin_costo');
  await db.guardarProduccion({ productoId: 'prod_sin_costo', nombreProducto: 'Verde', cantidadProducida: 5 });

  const todas = await db.getAll('producciones');
  const ultima = todas.find(p => p.productoId === 'prod_sin_costo');
  assert.equal(ultima.costoTotal, 0);
});

test('un costo negativo se normaliza a cero', async () => {
  await productoDePrueba('prod_negativo');
  await db.guardarProduccion({ productoId: 'prod_negativo', nombreProducto: 'Verde', cantidadProducida: 2, costoTotal: -50 });

  const todas = await db.getAll('producciones');
  const ultima = todas.find(p => p.productoId === 'prod_negativo');
  assert.equal(ultima.costoTotal, 0);
});
