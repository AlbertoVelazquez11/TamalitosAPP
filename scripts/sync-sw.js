#!/usr/bin/env node
/**
 * sync-sw.js — Sincroniza el sello de caché del Service Worker.
 *
 * Uso:
 *   node scripts/sync-sw.js           incrementa BUILD y reescribe CACHE_NAME
 *                                     en Codigo/js/version.js y Codigo/sw.js
 *   node scripts/sync-sw.js --check   sólo verifica que ambos archivos coincidan
 *
 * Corre en dos caminos:
 *   - Build de Vercel (push a GitHub): VERCEL_GIT_COMMIT_SHA existe, así que el
 *     cache se nombra con el sha del commit y NO se toca version.js.
 *   - Local / deploy.cjs: sin sha, incrementa BUILD como siempre.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularCacheName } from './cache-name.js';

const raiz      = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION   = path.join(raiz, 'Codigo', 'js', 'version.js');
const SW        = path.join(raiz, 'Codigo', 'sw.js');
const SOLO_CHECK = process.argv.includes('--check');

const RE_BUILD      = /export const BUILD = (\d+);/;
const RE_CACHE_JS   = /export const CACHE_NAME = `tamalitos-v\$\{BUILD\}`;/;
const RE_CACHE_SW   = /const CACHE_NAME = 'tamalitos-([a-z0-9]+)';/i;

function leer(archivo) {
  if (!fs.existsSync(archivo)) {
    throw new Error(`No existe ${archivo}`);
  }
  return fs.readFileSync(archivo, 'utf8');
}

function fallar(mensaje) {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

const js = leer(VERSION);
const sw = leer(SW);

const mBuild = js.match(RE_BUILD);
if (!mBuild) fallar('No pude leer BUILD en Codigo/js/version.js');
if (!RE_CACHE_JS.test(js)) fallar('CACHE_NAME de version.js debe derivarse de BUILD');

const mCacheSw = sw.match(RE_CACHE_SW);
if (!mCacheSw) fallar("No pude leer CACHE_NAME en Codigo/sw.js");

const build          = Number(mBuild[1]);
const cacheEnSw      = mCacheSw[1];
const shaCommit      = String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim();

if (SOLO_CHECK) {
  if (shaCommit) {
    console.log(`✔ Build de Vercel (${shaCommit.slice(0, 7)}): el cache se sella en el build`);
    process.exit(0);
  }
  if (`v${build}` !== cacheEnSw) {
    console.error(`✖ Desfasado: version.js BUILD=${build} vs sw.js cache=tamalitos-${cacheEnSw}. Corré sin --check.`);
    process.exit(1);
  }
  console.log(`✔ Cache sincronizado en tamalitos-${cacheEnSw}`);
  process.exit(0);
}

if (shaCommit) {
  const nuevo = calcularCacheName({ sha: shaCommit });
  fs.writeFileSync(SW, sw.replace(RE_CACHE_SW, `const CACHE_NAME = '${nuevo}';`), 'utf8');
  console.log(`✔ Cache del Service Worker sellado con el commit: ${nuevo}`);
  process.exit(0);
}

const nuevo = calcularCacheName({ build });
fs.writeFileSync(VERSION, js.replace(RE_BUILD, `export const BUILD = ${build + 1};`), 'utf8');
fs.writeFileSync(SW, sw.replace(RE_CACHE_SW, `const CACHE_NAME = '${nuevo}';`), 'utf8');

