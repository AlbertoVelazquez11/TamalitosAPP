import test from 'node:test';
import assert from 'node:assert/strict';

import { validarRespaldo } from '../Codigo/js/export.js';

const TABLAS = [
  'productos',
  'insumos',
  'costos',
  'ventas',
  'detalleVenta',
  'producciones',
  'recetas',
  'perfiles',
  'finanzas',
  'movimientosFinanzas',
  'clientes',
  'pedidos',
  'comprasInsumos',
];

function respaldoCompleto() {
  const data = { _formato: 'tamalitos-respaldo', _version: '4.0.0', _config: { nombreNegocio: 'Tamalitos' } };
  TABLAS.forEach((tabla, i) => {
    // Cada tabla lleva un número distinto de registros para detectar conteos cruzados.
    data[tabla] = Array.from({ length: i + 1 }, (_, n) => ({ id: `${tabla}_${n}` }));
  });
  return data;
}

test('un respaldo completo es válido', () => {
  const r = validarRespaldo(respaldoCompleto());
  assert.equal(r.valido, true);
  assert.equal(r.error, undefined);
});

test('el resumen reporta todas las tablas con su conteo', () => {
  const { resumen } = validarRespaldo(respaldoCompleto());
  TABLAS.forEach((tabla, i) => {
    assert.equal(resumen[tabla], i + 1, `falta o está mal el conteo de ${tabla}`);
  });
});

test('el resumen indica si el respaldo trae configuración', () => {
  assert.equal(validarRespaldo(respaldoCompleto()).resumen.incluyeConfig, true);
  const sinConfig = respaldoCompleto();
  delete sinConfig._config;
  assert.equal(validarRespaldo(sinConfig).resumen.incluyeConfig, false);
});

test('un respaldo sin tablas se rechaza', () => {
  const r = validarRespaldo({ _config: {} });
  assert.equal(r.valido, false);
  assert.match(r.error, /tablas/);
});

test('un respaldo que no es objeto se rechaza', () => {
  for (const basura of [null, undefined, 'texto', 42, []]) {
    const r = validarRespaldo(basura);
    assert.equal(r.valido, false, `debió rechazar ${JSON.stringify(basura)}`);
  }
});

test('las tablas ausentes cuentan como cero sin romper el resumen', () => {
  const parcial = respaldoCompleto();
  delete parcial.clientes;
  delete parcial.pedidos;
  const { valido, resumen } = validarRespaldo(parcial);
  assert.equal(valido, true);
  assert.equal(resumen.clientes, 0);
  assert.equal(resumen.pedidos, 0);
});
