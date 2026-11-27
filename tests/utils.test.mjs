import test from 'node:test';
import assert from 'node:assert/strict';

import {
  esc,
  formatMXN,
  formatCantidad,
  ceil1,
  hoy,
  formatFecha,
  formatHora,
  generarId,
  ahoraHora,
} from '../Codigo/js/utils.js';

test('esc neutraliza los cinco caracteres peligrosos de HTML', () => {
  assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('esc convierte null y undefined en cadena vacía', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(0), '0');
});

test('formatMXN siempre muestra dos decimales y tolera valores no numéricos', () => {
  assert.equal(formatMXN(25), '$25.00');
  assert.equal(formatMXN(25.5), '$25.50');
  assert.equal(formatMXN('abc'), '$0.00');
  assert.equal(formatMXN(null), '$0.00');
});

test('formatCantidad omite el decimal en enteros y redondea a uno cuando no lo es', () => {
  assert.equal(formatCantidad(12), '12');
  assert.equal(formatCantidad(12.5), '12.5');
  assert.equal(formatCantidad('7.25'), '7.3');
  assert.equal(formatCantidad(Number.NaN), '0');
});

test('ceil1 redondea hacia arriba a un decimal', () => {
  assert.equal(ceil1(2.55), 2.6);
  assert.equal(ceil1(2), 2);
  assert.equal(ceil1('1.01'), 1.1);
  assert.equal(ceil1(null), 0);
});

test('hoy devuelve la fecha local en formato YYYY-MM-DD', () => {
  assert.match(hoy(), /^\d{4}-\d{2}-\d{2}$/);
  const esperado = new Date();
  const iso = `${esperado.getFullYear()}-${String(esperado.getMonth() + 1).padStart(2, '0')}-${String(esperado.getDate()).padStart(2, '0')}`;
  assert.equal(hoy(), iso);
});

test('formatFecha traduce YYYY-MM-DD a día mes año en español', () => {
  assert.equal(formatFecha('2026-09-22'), '22 sep 2026');
  assert.equal(formatFecha('2026-01-01'), '1 ene 2026');
  assert.equal(formatFecha(''), '');
  assert.equal(formatFecha(null), '');
});

test('formatHora recorta los segundos', () => {
  assert.equal(formatHora('17:35:22'), '17:35');
  assert.equal(formatHora(''), '');
  assert.equal(formatHora(null), '');
});

test('generarId usa el prefijo pedido y produce valores distintos', () => {
  const a = generarId('prod');
  const b = generarId('prod');
  assert.match(a, /^prod_\d+_[a-z0-9]+$/);
  assert.notEqual(a, b);
});

test('ahoraHora devuelve HH:mm:ss', () => {
  assert.match(ahoraHora(), /^\d{2}:\d{2}:\d{2}$/);
});
