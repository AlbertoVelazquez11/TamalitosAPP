import test from 'node:test';
import assert from 'node:assert/strict';

import { calcularCacheName } from '../scripts/cache-name.js';

test('con el sha de un commit, el cache lleva los primeros 7 caracteres', () => {
  const sha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
  assert.equal(calcularCacheName({ sha }), 'tamalitos-a1b2c3d');
});

test('el mismo commit siempre produce el mismo nombre (deploy repetido no rompe)', () => {
  const sha = 'deadbeefcafe1234567890';
  assert.equal(calcularCacheName({ sha }), calcularCacheName({ sha }));
});

test('un sha corto se usa completo en lugar de inventar caracteres', () => {
  assert.equal(calcularCacheName({ sha: 'abc123' }), 'tamalitos-abc123');
});

test('sin sha, incrementa BUILD como antes', () => {
  assert.equal(calcularCacheName({ build: 25 }), 'tamalitos-v26');
  assert.equal(calcularCacheName({ build: 0 }), 'tamalitos-v1');
});

test('un build inválido no produce NaN en el nombre', () => {
  assert.equal(calcularCacheName({ build: 'no-es-numero' }), 'tamalitos-v1');
  assert.equal(calcularCacheName({}), 'tamalitos-v1');
});

test('el sha gana sobre BUILD cuando están los dos', () => {
  assert.equal(calcularCacheName({ sha: 'abcdef1234', build: 99 }), 'tamalitos-abcdef1');
});

test('espacios en el sha no ensucian el nombre', () => {
  assert.equal(calcularCacheName({ sha: '  abcdef1234  ' }), 'tamalitos-abcdef1');
});
