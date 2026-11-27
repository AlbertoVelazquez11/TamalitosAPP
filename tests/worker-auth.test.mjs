import test from 'node:test';
import assert from 'node:assert/strict';

import worker, { checkAuth } from '../telegram-worker/worker.js';

function requestConClave(valor) {
  const headers = new Map();
  if (valor !== undefined) headers.set('X-API-Key', valor);
  return { headers: { get: (nombre) => headers.get(nombre) ?? null } };
}

test('sin API_KEY configurada el endpoint queda abierto', () => {
  assert.equal(checkAuth(requestConClave(), {}), true);
  assert.equal(checkAuth(requestConClave('lo-que-sea'), { API_KEY: '' }), true);
});

test('con API_KEY configurada sólo pasa la clave correcta', () => {
  const env = { API_KEY: 'secreta' };
  assert.equal(checkAuth(requestConClave('secreta'), env), true);
  assert.equal(checkAuth(requestConClave('otra'), env), false);
  assert.equal(checkAuth(requestConClave(''), env), false);
  assert.equal(checkAuth(requestConClave(undefined), env), false);
});

test('el módulo exporta un handler fetch', () => {
  assert.equal(typeof worker.fetch, 'function');
});

test('una ruta desconocida responde 404 y no toca servicios externos', async () => {
  const resp = await worker.fetch({ method: 'GET', url: 'https://worker.test/desconocida', headers: requestConClave().headers }, {});
  assert.equal(resp.status, 404);
});
