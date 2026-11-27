import test from 'node:test';
import assert from 'node:assert/strict';

import { inicioDeCiclo, rangoCiclo, enRango, calcularCiclo, cicloActual } from '../Codigo/js/utilidad.js';

// 2026-11-27 es viernes. La semana del ciclo va del viernes al jueves siguiente.
const VIERNES = '2026-11-27';
const SABADO = '2026-11-28';
const DOMINGO = '2026-11-29';
const LUNES = '2026-11-30';
const MARTES = '2026-12-01';
const MIERCOLES = '2026-12-02';
const JUEVES = '2026-12-03';
const VIERNES_SIGUIENTE = '2026-12-04';

test('el ciclo arranca el viernes de esa semana', () => {
  for (const dia of [VIERNES, SABADO, DOMINGO, LUNES, MARTES, MIERCOLES, JUEVES]) {
    assert.equal(inicioDeCiclo(dia), VIERNES, `el ciclo de ${dia} debe empezar el viernes`);
  }
});

test('un viernes abre ciclo nuevo', () => {
  assert.equal(inicioDeCiclo(VIERNES_SIGUIENTE), VIERNES_SIGUIENTE);
});

test('el ciclo termina el jueves siguiente', () => {
  assert.deepEqual(rangoCiclo(VIERNES), { inicio: VIERNES, fin: JUEVES });
  assert.deepEqual(rangoCiclo(JUEVES), { inicio: VIERNES, fin: JUEVES });
});

test('el jueves es el último día del ciclo y el viernes queda fuera', () => {
  const rango = rangoCiclo(JUEVES);
  assert.equal(enRango(JUEVES, rango), true);
  assert.equal(enRango(VIERNES_SIGUIENTE, rango), false);
  assert.equal(enRango('2026-11-26', rango), false);
});

test('el saldo es recuperado menos invertido y puede ser negativo', () => {
  const rango = rangoCiclo(VIERNES);
  const r = calcularCiclo({
    ventas: [{ id: 'v1', fecha: VIERNES, total: 200, estado: 'cobrada', tipo: 'venta' }],
    detalleVenta: [{ ventaId: 'v1', productoId: 'p1', nombreProducto: 'Verde', subtotalLinea: 200 }],
    producciones: [{ productoId: 'p1', nombreProducto: 'Verde', fecha: VIERNES, costoTotal: 500 }],
    costos: [],
  }, rango);

  assert.equal(r.recuperado, 200);
  assert.equal(r.invertido, 500);
  assert.equal(r.saldo, -300, 'aún no se recupera: debe ser negativo');
  assert.equal(r.recuperadoPct, 0.4);
});

test('cuando las ventas superan lo invertido el saldo es ganancia', () => {
  const rango = rangoCiclo(VIERNES);
  const r = calcularCiclo({
    ventas: [{ id: 'v1', fecha: MARTES, total: 900, estado: 'cobrada', tipo: 'venta' }],
    detalleVenta: [{ ventaId: 'v1', productoId: 'p1', subtotalLinea: 900 }],
    producciones: [{ productoId: 'p1', fecha: VIERNES, costoTotal: 500 }],
  }, rango);
  assert.equal(r.saldo, 400);
});

test('las cortesías y las ventas canceladas no cuentan como recuperado', () => {
  const rango = rangoCiclo(VIERNES);
  const r = calcularCiclo({
    ventas: [
      { id: 'ok', fecha: VIERNES, total: 100, estado: 'cobrada', tipo: 'venta' },
      { id: 'cortesia', fecha: VIERNES, total: 100, estado: 'cobrada', tipo: 'noIngreso' },
      { id: 'cancelada', fecha: VIERNES, total: 100, estado: 'cancelada', tipo: 'venta' },
    ],
    detalleVenta: [
      { ventaId: 'ok', productoId: 'p1', subtotalLinea: 100 },
      { ventaId: 'cortesia', productoId: 'p1', subtotalLinea: 100 },
      { ventaId: 'cancelada', productoId: 'p1', subtotalLinea: 100 },
    ],
  }, rango);

  assert.equal(r.recuperado, 100);
  assert.equal(r.productos[0].recuperado, 100);
});

test('lo que cae fuera del ciclo no se mezcla', () => {
  const rango = rangoCiclo(VIERNES);
  const r = calcularCiclo({
    ventas: [
      { id: 'fuera', fecha: '2026-11-26', total: 500, estado: 'cobrada', tipo: 'venta' },
      { id: 'dentro', fecha: SABADO, total: 100, estado: 'cobrada', tipo: 'venta' },
    ],
    producciones: [
      { productoId: 'p1', fecha: '2026-11-20', costoTotal: 999 },
      { productoId: 'p1', fecha: JUEVES, costoTotal: 50 },
    ],
  }, rango);

  assert.equal(r.recuperado, 100);
  assert.equal(r.invertido, 50);
});

test('los gastos generales bajan el saldo global pero no se reparten por producto', () => {
  const rango = rangoCiclo(VIERNES);
  const r = calcularCiclo({
    ventas: [{ id: 'v1', fecha: VIERNES, total: 300, estado: 'cobrada', tipo: 'venta' }],
    detalleVenta: [{ ventaId: 'v1', productoId: 'p1', subtotalLinea: 300 }],
    costos: [
      { id: 'c1', fecha: VIERNES, monto: 80, productoId: 'p1', productoNombre: 'Verde' },
      { id: 'c2', fecha: VIERNES, monto: 50 }, // general
    ],
  }, rango);

  assert.equal(r.gastosGenerales, 50);
  assert.equal(r.invertido, 130);
  assert.equal(r.saldo, 170);
  assert.equal(r.productos.length, 1);
  assert.equal(r.productos[0].saldo, 220, 'el general no debe restarse al producto');
});

test('el desglose por producto ordena del peor saldo al mejor', () => {
  const rango = rangoCiclo(VIERNES);
  const r = calcularCiclo({
    ventas: [{ id: 'v1', fecha: VIERNES, total: 300, estado: 'cobrada', tipo: 'venta' }],
    detalleVenta: [
      { ventaId: 'v1', productoId: 'rojo', nombreProducto: 'Rojo', subtotalLinea: 100 },
      { ventaId: 'v1', productoId: 'verde', nombreProducto: 'Verde', subtotalLinea: 200 },
    ],
    producciones: [
      { productoId: 'verde', nombreProducto: 'Verde', fecha: VIERNES, costoTotal: 100 },
      { productoId: 'rojo', nombreProducto: 'Rojo', fecha: VIERNES, costoTotal: 400 },
    ],
  }, rango);

  assert.deepEqual(r.productos.map(p => p.productoId), ['rojo', 'verde']);
  assert.equal(r.productos[0].saldo, -300);
  assert.equal(r.productos[1].saldo, 100);
});

test('sin datos el saldo es cero y el porcentaje no rompe', () => {
  const r = cicloActual({}, VIERNES);
  assert.equal(r.saldo, 0);
  assert.equal(r.recuperadoPct, 0);
  assert.deepEqual(r.productos, []);
});

test('una producción sin costo capturado cuenta como cero, no como NaN', () => {
  const rango = rangoCiclo(VIERNES);
  const r = calcularCiclo({ producciones: [{ productoId: 'p1', fecha: VIERNES }] }, rango);
  assert.equal(r.invertido, 0);
  assert.equal(Number.isNaN(r.saldo), false);
});
