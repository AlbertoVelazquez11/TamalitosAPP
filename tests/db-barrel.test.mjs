import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as db from '../Codigo/js/db.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');

// Superficie pública de db.js congelada antes del split: no debe cambiar.
const PUBLICAS = [
  'openDB',
  'getAll',
  'getById',
  'put',
  'remove',
  'count',
  'clearStore',
  'getProductosActivos',
  'getVentasPorFecha',
  'getDetallesByVentaId',
  'getCostosPorFecha',
  'getUltimoCostoUnitario',
  'getProduccionesPorFecha',
  'getResumenDiario',
  'getFinanzas',
  'ajustarCaja',
  'aplicarMovimiento',
  'getMovimientosFinanzas',
  'guardarVentaCompleta',
  'guardarProduccion',
  'cancelarVenta',
  'exportarTodo',
  'importarRespaldo',
];

const MODULOS = ['schema.js', 'core.js', 'finanzas.js', 'transacciones.js', 'backup.js'];

test('db.js reexporta exactamente la API pública esperada', () => {
  assert.deepEqual(Object.keys(db).sort(), [...PUBLICAS].sort());
});

test('cada función pública sigue siendo una función', () => {
  for (const nombre of PUBLICAS) {
    assert.equal(typeof db[nombre], 'function', `${nombre} ya no es una función`);
  }
});

test('la implementación vive en Codigo/js/db y db.js sólo reexporta', () => {
  for (const m of MODULOS) {
    assert.ok(fs.existsSync(path.join(raiz, 'Codigo', 'js', 'db', m)), `falta Codigo/js/db/${m}`);
  }
  const barrel = leer('Codigo', 'js', 'db.js');
  assert.doesNotMatch(barrel, /^(export )?(async )?function /m, 'db.js no debe contener implementación');
  assert.doesNotMatch(barrel, /indexedDB/, 'db.js no debe tocar IndexedDB directamente');
});

test('el Service Worker precachea cada submódulo de db', () => {
  const sw = leer('Codigo', 'sw.js');
  for (const m of MODULOS) {
    assert.match(sw, new RegExp(`'\\./js/db/${m.replace('.', '\\.')}'`), `falta ./js/db/${m} en ASSETS_TO_CACHE`);
  }
});
