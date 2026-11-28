import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cicloSiguiente,
  esEditable,
  totalCompra,
  ciclosDisponibles,
  comprasDelCiclo,
  resumenCiclo,
  compararPrecios,
  UNIDADES,
} from '../Codigo/js/insumos-ciclo.js';

// 2026-11-27 es viernes: ciclo actual vie 27 nov → jue 3 dic; siguiente vie 4 dic → jue 10 dic.
const VIERNES = '2026-11-27';
const CICLO_ACTUAL = '2026-11-27';
const CICLO_SIGUIENTE = '2026-12-04';
const CICLO_PASADO = '2026-11-20';

const maseca = {
  id: 'compra_1', insumoId: 'ins_maseca', nombre: 'Maseca', cantidad: 3, unidad: 'kg',
  precioUnitario: 22, total: 66, nota: '', cicloInicio: CICLO_ACTUAL, cicloFin: '2026-12-03',
};

test('el total es siempre precio unitario por cantidad', () => {
  assert.equal(totalCompra({ precioUnitario: 22, cantidad: 3 }), 66);
  assert.equal(totalCompra({ precioUnitario: 22.5, cantidad: 2 }), 45);
  assert.equal(totalCompra({ precioUnitario: '18.9', cantidad: '1.5' }), 28.35);
  assert.equal(totalCompra({}), 0);
});

test('el total no arrastra errores de punto flotante', () => {
  assert.equal(totalCompra({ precioUnitario: 0.1, cantidad: 3 }), 0.3);
  assert.equal(totalCompra({ precioUnitario: 19.99, cantidad: 3 }), 59.97);
});

test('el ciclo siguiente empieza siete días después del actual', () => {
  assert.equal(cicloSiguiente(VIERNES), CICLO_SIGUIENTE);
  assert.equal(cicloSiguiente('2026-12-01'), CICLO_SIGUIENTE, 'desde un martes el siguiente también es el 4');
});

test('sólo el ciclo actual y el siguiente son editables', () => {
  assert.equal(esEditable(CICLO_ACTUAL, VIERNES), true);
  assert.equal(esEditable(CICLO_SIGUIENTE, VIERNES), true);
  assert.equal(esEditable(CICLO_PASADO, VIERNES), false, 'un ciclo pasado es sólo consulta');
  assert.equal(esEditable('2026-12-11', VIERNES), false, 'más allá del siguiente no se captura');
});

test('la lista de ciclos incluye actual, siguiente y los que ya tienen compras', () => {
  const compras = [{ ...maseca, id: 'c_pasada', cicloInicio: CICLO_PASADO }];
  const ciclos = ciclosDisponibles(compras, VIERNES);

  const inicios = ciclos.map(c => c.inicio);
  assert.ok(inicios.includes(CICLO_ACTUAL));
  assert.ok(inicios.includes(CICLO_SIGUIENTE));
  assert.ok(inicios.includes(CICLO_PASADO));

  const actual = ciclos.find(c => c.inicio === CICLO_ACTUAL);
  assert.equal(actual.actual, true);
  assert.equal(actual.editable, true);

  const pasado = ciclos.find(c => c.inicio === CICLO_PASADO);
  assert.equal(pasado.editable, false);
});

test('los ciclos se listan del más reciente al más viejo', () => {
  const compras = [{ ...maseca, cicloInicio: CICLO_PASADO }];
  const inicios = ciclosDisponibles(compras, VIERNES).map(c => c.inicio);
  assert.deepEqual(inicios, [CICLO_SIGUIENTE, CICLO_ACTUAL, CICLO_PASADO]);
});

test('las compras se filtran por ciclo y se ordenan por nombre', () => {
  const compras = [
    { ...maseca, id: 'a', nombre: 'Maseca' },
    { ...maseca, id: 'b', nombre: 'Aceite', insumoId: 'ins_aceite' },
    { ...maseca, id: 'c', nombre: 'Otra', cicloInicio: CICLO_PASADO },
  ];
  const delCiclo = comprasDelCiclo(compras, CICLO_ACTUAL);
  assert.deepEqual(delCiclo.map(c => c.nombre), ['Aceite', 'Maseca']);
});

test('el resumen del ciclo suma totales y cuenta insumos distintos', () => {
  const compras = [
    { ...maseca, id: 'a', total: 66 },
    { ...maseca, id: 'b', insumoId: 'ins_aceite', nombre: 'Aceite', total: 34 },
    { ...maseca, id: 'c', insumoId: 'ins_aceite', nombre: 'Aceite', total: 10 },
    { ...maseca, id: 'd', total: 999, cicloInicio: CICLO_PASADO },
  ];
  const r = resumenCiclo(compras, CICLO_ACTUAL);
  assert.equal(r.total, 110);
  assert.equal(r.compras, 3);
  assert.equal(r.insumos, 2);
});

test('la comparación muestra la diferencia contra el ciclo anterior del mismo insumo', () => {
  const compras = [
    { ...maseca, id: 'viejo', precioUnitario: 20, cicloInicio: CICLO_PASADO },
    { ...maseca, id: 'nuevo', precioUnitario: 22, cicloInicio: CICLO_ACTUAL },
  ];
  const [fila] = compararPrecios(compras, CICLO_ACTUAL);
  assert.equal(fila.precio, 22);
  assert.equal(fila.precioAnterior, 20);
  assert.equal(fila.diferencia, 2);
});

test('un insumo nuevo no tiene comparación y no inventa diferencias', () => {
  const compras = [{ ...maseca, id: 'nuevo', cicloInicio: CICLO_ACTUAL }];
  const [fila] = compararPrecios(compras, CICLO_ACTUAL);
  assert.equal(fila.precioAnterior, null);
  assert.equal(fila.diferencia, null);
});

test('la comparación empareja por insumoId aunque el nombre haya cambiado', () => {
  const compras = [
    { ...maseca, id: 'viejo', nombre: 'Maseca (marca A)', precioUnitario: 20, cicloInicio: CICLO_PASADO },
    { ...maseca, id: 'nuevo', nombre: 'Maseca (marca B)', precioUnitario: 26, cicloInicio: CICLO_ACTUAL },
  ];
  const [fila] = compararPrecios(compras, CICLO_ACTUAL);
  assert.equal(fila.precioAnterior, 20);
  assert.equal(fila.diferencia, 6);
});

test('las unidades disponibles son las que espera la pantalla', () => {
  assert.deepEqual(UNIDADES, ['kg', 'g', 'L', 'ml', 'pza', 'docena']);
});
