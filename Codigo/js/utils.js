/**
 * utils.js — Utilidades compartidas de TamalitosAPP
 *
 * Funciones puras reutilizables entre todas las vistas y componentes.
 */

/**
 * Escapa caracteres HTML especiales para evitar XSS al insertar
 * texto de usuario dentro de innerHTML.
 * @param {any} str
 * @returns {string}
 */
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formatea un número como moneda en pesos mexicanos.
 * @param {number} n
 * @returns {string} Ej: "$25.00"
 */
export function formatMXN(n) {
  const num = Number(n) || 0;
  return '$' + num.toFixed(2);
}

/**
 * Formatea una cantidad de inventario (hasta 1 decimal).
 * @param {number} n
 * @returns {string} Ej: "12" o "12.5"
 */
export function formatCantidad(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

/**
 * Redondea hacia arriba a 1 decimal (ej. 2.55 → 2.6).
 * @param {number} n
 * @returns {number}
 */
export function ceil1(n) {
  return Math.ceil((Number(n) || 0) * 10) / 10;
}

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD (zona local del dispositivo).
 * Compatible con <input type="date"> y con los índices de IndexedDB.
 * @returns {string}
 */
export function hoy() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Formatea una fecha YYYY-MM-DD a formato legible en español.
 * @param {string} fechaISO — "2026-09-22"
 * @returns {string} — "22 sep 2026"
 */
export function formatFecha(fechaISO) {
  if (!fechaISO) return '';
  const [y, m, d] = fechaISO.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

/**
 * Formatea una hora HH:mm:ss a formato corto HH:mm.
 * @param {string} hora — "17:35:22"
 * @returns {string} — "17:35"
 */
export function formatHora(hora) {
  if (!hora) return '';
  return hora.substring(0, 5);
}

/**
 * Genera un ID único con prefijo.
 * @param {string} prefix — Ej: "prod", "ins", "venta"
 * @returns {string}
 */
export function generarId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Devuelve la hora actual en formato HH:mm:ss.
 * @returns {string}
 */
export function ahoraHora() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

