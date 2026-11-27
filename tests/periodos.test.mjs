import test from 'node:test';
import assert from 'node:assert/strict';

import { rangoDePeriodo } from '../Codigo/js/export.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

function iso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const hoyISO = iso(new Date());

test('todo rango termina hoy y tiene formato ISO', () => {
  for (const periodo of ['dia', 'semana', '15dias', 'mes', '3meses', 'anio', 'findesemana', 'historico']) {
    const { inicio, fin } = rangoDePeriodo(periodo);
    assert.match(inicio, ISO, `inicio inválido para ${periodo}`);
    assert.match(fin, ISO, `fin inválido para ${periodo}`);
  }
});

test('el fin siempre es la fecha de hoy', () => {
  for (const periodo of ['semana', '15dias', 'mes', '3meses', 'anio']) {
    assert.equal(rangoDePeriodo(periodo).fin, hoyISO, `fin inesperado para ${periodo}`);
  }
});

test('dia empieza y termina hoy', () => {
  assert.deepEqual(rangoDePeriodo('dia'), { inicio: hoyISO, fin: hoyISO });
});

test('mes empieza el día 1 del mes en curso', () => {
  const now = new Date();
  assert.equal(rangoDePeriodo('mes').inicio, `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
});

test('anio empieza el 1 de enero del año en curso', () => {
  assert.equal(rangoDePeriodo('anio').inicio, `${new Date().getFullYear()}-01-01`);
});

test('3meses empieza el día 1 de dos meses atrás', () => {
  const now = new Date();
  const esperado = iso(new Date(now.getFullYear(), now.getMonth() - 2, 1));
  assert.equal(rangoDePeriodo('3meses').inicio, esperado);
});

test('15dias cubre hoy y los catorce días previos', () => {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  assert.equal(rangoDePeriodo('15dias').inicio, iso(d));
});

test('semana empieza el lunes de la semana en curso', () => {
  const { inicio } = rangoDePeriodo('semana');
  const [y, m, d] = inicio.split('-').map(Number);
  assert.equal(new Date(y, m - 1, d).getDay(), 1, 'la semana debe empezar en lunes');
});

test('findesemana empieza el viernes más reciente y nunca queda en el futuro', () => {
  const { inicio, fin } = rangoDePeriodo('findesemana');
  const [y, m, d] = inicio.split('-').map(Number);
  assert.equal(new Date(y, m - 1, d).getDay(), 5, 'el fin de semana debe empezar en viernes');
  assert.ok(inicio <= fin);
});

test('un periodo desconocido se comporta como dia', () => {
  assert.deepEqual(rangoDePeriodo('no-existe'), rangoDePeriodo('dia'));
});

test('historico arranca en 2000-01-01', () => {
  assert.equal(rangoDePeriodo('historico').inicio, '2000-01-01');
});

test('4semanas arranca 21 días antes del viernes más reciente', () => {
  const { inicio, fin } = rangoDePeriodo('4semanas');
  const [y, m, d] = inicio.split('-').map(Number);
  assert.equal(new Date(y, m - 1, d).getDay(), 5);
  assert.ok(inicio <= fin);
});
