/**
 * date-filter.js — Componente de filtro por fecha (Sprint 4)
 *
 * HU-051: Filtrar ventas por fecha usando un input date nativo
 * (bien soportado en iOS Safari). Default: hoy.
 *
 * Uso:
 *   import { crearDateFilter } from '../components/date-filter.js';
 *
 *   const filtro = crearDateFilter({
 *     value: hoy(),
 *     onChange: (fecha) => console.log(fecha),
 *   });
 *   contenedor.appendChild(filtro.elemento);
 */

import { hoy } from '../utils.js';

/**
 * Crea un input de fecha reutilizable.
 *
 * @param {Object} opciones
 * @param {string}   opciones.value    — Fecha inicial (YYYY-MM-DD). Default: hoy.
 * @param {string}   opciones.max      — Fecha máxima permitida. Default: hoy.
 * @param {Function} opciones.onChange — Callback(fecha) al cambiar el valor.
 * @returns {{ elemento: HTMLElement, value: string, set value(v: string) }}
 */
export function crearDateFilter({ value = hoy(), max = hoy(), onChange } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'date-filter';

  wrapper.innerHTML = `
    <input type="date" class="form-input date-filter__input"
           value="${value}" max="${max}" aria-label="Filtrar por fecha">
  `;

  const input = wrapper.querySelector('.date-filter__input');
  input.addEventListener('change', () => {
    if (typeof onChange === 'function') onChange(input.value);
  });

  return {
    elemento: wrapper,
    get value() {
      return input.value;
    },
    set value(v) {
      input.value = v;
    },
  };
}
