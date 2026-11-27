import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APP_VERSION, BUILD, CACHE_NAME } from '../Codigo/js/version.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...partes) => fs.readFileSync(path.join(raiz, ...partes), 'utf8');

test('APP_VERSION es semver', () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
});

test('CACHE_NAME se deriva de BUILD', () => {
  assert.equal(CACHE_NAME, `tamalitos-v${BUILD}`);
});

test('sw.js usa el mismo sello de caché que version.js', () => {
  const sw = leer('Codigo', 'sw.js');
  const declarado = sw.match(/const CACHE_NAME = '([^']+)';/);
  assert.ok(declarado, 'sw.js debe declarar CACHE_NAME');
  assert.equal(declarado[1], CACHE_NAME);
});

test('sw.js precachea version.js para que el shell funcione offline', () => {
  const sw = leer('Codigo', 'sw.js');
  assert.match(sw, /'\.\/js\/version\.js'/, 'version.js debe estar en ASSETS_TO_CACHE');
});

test('ningún módulo repite la versión a mano', () => {
  for (const archivo of ['store.js', 'export.js', 'app.js', 'router.js']) {
    const fuente = leer('Codigo', 'js', archivo);
    const literal = fuente.match(/['"`]\d+\.\d+\.\d+['"`]/);
    assert.equal(literal, null, `${archivo} no debe contener la versión literal`);
  }
});

test('store.js importa APP_VERSION y lo usa en la migración de config', () => {
  const store = leer('Codigo', 'js', 'store.js');
  assert.match(store, /import \{ APP_VERSION \} from '\.\/version\.js';/);
  assert.match(store, /config\.version !== APP_VERSION/);
  assert.match(store, /version:\s+APP_VERSION,/);
});

test('el script de sincronización deja todo consistente', () => {
  const check = fs.existsSync(path.join(raiz, 'scripts', 'sync-sw.js'));
  assert.ok(check, 'debe existir scripts/sync-sw.js');
  const deploy = leer('deploy.cjs');
  assert.match(deploy, /scripts\/sync-sw\.js/, 'deploy.cjs debe sellar el caché antes de publicar');
});
