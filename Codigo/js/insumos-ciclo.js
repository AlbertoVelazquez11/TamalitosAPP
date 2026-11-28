/**
 * insumos-ciclo.js — Bitácora de compras de insumos por ciclo.
 *
 * No es un cálculo de costos: no entra en la utilidad del ciclo ni toca la caja.
 * Sirve para comparar precios entre ciclos.
 *
 * Reglas:
 * - Cada compra apunta a un insumo del catálogo por su ID (el nombre puede cambiar).
 * - El total siempre es precioUnitario × cantidad.
 * - Sólo el ciclo actual y el siguiente se pueden capturar; los pasados son de consulta.
 */

import { hoy } from './utils.js';
import { inicioDeCiclo, rangoCiclo } from './utilidad.js';

const MS_DIA = 86400000;
const UNIDADES = ['kg', 'g', 'L', 'ml', 'pza', 'docena'];

export { UNIDADES };

function _fecha(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function _iso(fecha) {
  const d = new Date(fecha);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Ciclo siguiente al que contiene la fecha dada. */
export function cicloSiguiente(fechaISO = hoy()) {
  const inicio = _fecha(inicioDeCiclo(fechaISO));
  return _iso(new Date(inicio.getTime() + 7 * MS_DIA));
}

/** ¿La compra cae en el ciclo actual o en el siguiente? Sólo esos se capturan. */
export function esEditable(cicloInicio, fechaISO = hoy()) {
  const inicio = String(cicloInicio || '');
  return inicio === inicioDeCiclo(fechaISO) || inicio === cicloSiguiente(fechaISO);
}

/** Total de una compra: siempre precio unitario por cantidad, redondeado a centavos. */
export function totalCompra({ precioUnitario = 0, cantidad = 0 } = {}) {
  const precio = Number(precioUnitario) || 0;
  const cant = Number(cantidad) || 0;
  return Math.round(precio * cant * 100) / 100;
}

/**
 * Ciclos que se pueden consultar: actual, siguiente y todos los que tengan compras
 * registradas (los pasados vienen marcados como no editables).
 */
export function ciclosDisponibles(compras = [], fechaISO = hoy()) {
  const actual = inicioDeCiclo(fechaISO);
  const siguiente = cicloSiguiente(fechaISO);

  const inicios = new Set([actual, siguiente]);
  compras.forEach(c => { if (c.cicloInicio) inicios.add(String(c.cicloInicio)); });

  return [...inicios]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)) // más reciente primero
    .map(inicio => ({
      inicio,
      ...rangoCiclo(inicio),
      editable: inicio === actual || inicio === siguiente,
      actual: inicio === actual,
      siguiente: inicio === siguiente,
    }));
}

/** Compras de un ciclo, ordenadas por nombre de insumo. */
export function comprasDelCiclo(compras = [], cicloInicio) {
  return compras
    .filter(c => String(c.cicloInicio) === String(cicloInicio))
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
}

/** Resumen informativo del ciclo: total gastado y cuántos insumos distintos. */
export function resumenCiclo(compras = [], cicloInicio) {
  const delCiclo = comprasDelCiclo(compras, cicloInicio);
  const total = delCiclo.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const insumos = new Set(delCiclo.map(c => c.insumoId || c.nombre));
  return { total: Math.round(total * 100) / 100, compras: delCiclo.length, insumos: insumos.size, items: delCiclo };
}

/**
 * Comparación de precios contra el ciclo anterior de cada insumo.
 * Devuelve una fila por insumo del ciclo pedido con el precio previo y la diferencia.
 */
export function compararPrecios(compras = [], cicloInicio) {
  const delCiclo = comprasDelCiclo(compras, cicloInicio);
  const anteriores = compras
    .filter(c => String(c.cicloInicio) < String(cicloInicio))
    .sort((a, b) => (a.cicloInicio < b.cicloInicio ? 1 : -1));

  return delCiclo.map(c => {
    const llave = c.insumoId || c.nombre;
    const previa = anteriores.find(a => (a.insumoId || a.nombre) === llave);
    const anterior = previa ? Number(previa.precioUnitario) || 0 : null;
    const actual = Number(c.precioUnitario) || 0;
    return {
      insumoId: c.insumoId || null,
      nombre: c.nombre || '',
      unidad: c.unidad || '',
      precio: actual,
      precioAnterior: anterior,
      diferencia: anterior === null ? null : Math.round((actual - anterior) * 100) / 100,
      cicloAnterior: previa ? String(previa.cicloInicio) : null,
    };
  });
}
