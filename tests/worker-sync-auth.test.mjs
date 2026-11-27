import test from 'node:test';
import assert from 'node:assert/strict';

import worker, { checkAuth, checkSyncAuth } from '../telegram-worker/worker.js';

const BASE = 'https://worker.test';

function request(ruta, { metodo = 'GET', clave, cuerpo } = {}) {
  const headers = {};
  if (clave !== undefined) headers['X-API-Key'] = clave;
  return new Request(BASE + ruta, { method: metodo, headers, body: cuerpo });
}

function fakeEnv(extra = {}) {
  return {
    BACKUPS: {
      put: async () => {},
      get: async () => null,
      list: async () => ({ objects: [] }),
      delete: async () => {},
    },
    ...extra,
  };
}

test('checkSyncAuth cierra el endpoint cuando no hay API_KEY', () => {
  assert.equal(checkSyncAuth(request('/sync'), {}), false);
  assert.equal(checkSyncAuth(request('/sync', { clave: 'algo' }), { API_KEY: '' }), false);
});

test('checkSyncAuth acepta sólo la clave correcta', () => {
  const env = { API_KEY: 'secreta' };
  assert.equal(checkSyncAuth(request('/sync', { clave: 'secreta' }), env), true);
  assert.equal(checkSyncAuth(request('/sync', { clave: 'otra' }), env), false);
  assert.equal(checkSyncAuth(request('/sync'), env), false);
});

test('checkAuth conserva su comportamiento abierto para /backup', () => {
  assert.equal(checkAuth(request('/backup'), {}), true);
  assert.equal(checkAuth(request('/backup', { clave: 'x' }), { API_KEY: 'secreta' }), false);
});

test('sin API_KEY, PUT /sync responde 401', async () => {
  const resp = await worker.fetch(request('/sync', { metodo: 'PUT', cuerpo: '{}' }), fakeEnv());
  assert.equal(resp.status, 401);
  assert.equal((await resp.json()).error, 'unauthorized');
});

test('sin API_KEY, GET /sync y /sync/list responden 401', async () => {
  const get = await worker.fetch(request('/sync'), fakeEnv());
  assert.equal(get.status, 401);
  const lista = await worker.fetch(request('/sync/list'), fakeEnv());
  assert.equal(lista.status, 401);
});

test('con API_KEY, una clave incorrecta responde 401', async () => {
  const env = fakeEnv({ API_KEY: 'secreta' });
  const resp = await worker.fetch(request('/sync', { metodo: 'PUT', clave: 'mala', cuerpo: '{}' }), env);
  assert.equal(resp.status, 401);
});

test('con API_KEY correcta, PUT /sync guarda el snapshot', async () => {
  const guardados = [];
  const env = fakeEnv({ API_KEY: 'secreta', BACKUPS: { put: async (k) => guardados.push(k), get: async () => null, list: async () => ({ objects: [] }) } });
  const resp = await worker.fetch(request('/sync', { metodo: 'PUT', clave: 'secreta', cuerpo: '{"ventas":[]}' }), env);
  assert.equal(resp.status, 200);
  assert.equal((await resp.json()).ok, true);
  assert.ok(guardados.includes('backups/latest.json'));
});

test('/backup sigue respondiendo sin API_KEY (no lo cierra la regla nueva)', async () => {
  const env = fakeEnv({ TELEGRAM_BOT_TOKEN: 'token' });
  const resp = await worker.fetch(request('/backup', { metodo: 'POST', cuerpo: '' }), env);
  // Pasa la autorización y falla al leer el formulario: 400, no 401.
  assert.equal(resp.status, 400);
  assert.equal((await resp.json()).error, 'invalid_form_data');
});

test('/health sigue abierto', async () => {
  const resp = await worker.fetch(request('/health'), fakeEnv());
  assert.equal(resp.status, 200);
});
