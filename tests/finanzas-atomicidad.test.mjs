import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

const fabrica = new IDBFactory();
globalThis.indexedDB = fabrica;
globalThis.IDBKeyRange = IDBKeyRange;

const db = await import('../Codigo/js/db.js');

/** Rompe a propósito la escritura del ledger para comprobar que la caja no queda a medias. */
function romperLedger(conn) {
  const original = conn.transaction.bind(conn);
  conn.transaction = (nombres, modo) => {
    const tx = original(nombres, modo);
    const objectStoreOriginal = tx.objectStore.bind(tx);
    tx.objectStore = (nombre) => {
      const store = objectStoreOriginal(nombre);
      if (nombre === 'movimientosFinanzas') {
        store.put = () => { throw new Error('fallo inyectado en el ledger'); };
      }
      return store;
    };
    return tx;
  };
  return () => { conn.transaction = original; };
}

test('ajustarCaja escribe el saldo y deja un movimiento en el ledger', async () => {
  await db.openDB();
  const fin = await db.ajustarCaja(500);

  assert.equal(fin.caja, 500);
  assert.equal((await db.getFinanzas()).caja, 500);

  const movs = await db.getMovimientosFinanzas();
  assert.equal(movs.length, 1);
  assert.equal(movs[0].tipo, 'ajusteCaja');
  assert.equal(movs[0].monto, 500);
});

test('si el movimiento no se puede registrar, la caja no cambia', async () => {
  const conn = await db.openDB();
  const antes = (await db.getFinanzas()).caja;
  const movimientosAntes = (await db.getMovimientosFinanzas()).length;

  const restaurar = romperLedger(conn);
  try {
    await assert.rejects(() => db.ajustarCaja(999), /fallo inyectado|abort/i);
  } finally {
    restaurar();
  }

  assert.equal((await db.getFinanzas()).caja, antes, 'la caja no debe quedar con el valor a medias');
  assert.equal((await db.getMovimientosFinanzas()).length, movimientosAntes, 'no debe quedar un movimiento huérfano');
});

test('tras el fallo, un ajuste válido sigue funcionando y queda consistente', async () => {
  const fin = await db.ajustarCaja(750);
  assert.equal(fin.caja, 750);
  assert.equal((await db.getFinanzas()).caja, 750);

  const movs = await db.getMovimientosFinanzas();
  assert.equal(movs.length, 2, 'sólo los ajustes exitosos dejan movimiento');
  assert.ok(movs.every(m => m.tipo === 'ajusteCaja'));
});
