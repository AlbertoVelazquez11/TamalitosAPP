/**
 * utilidad.js — Cálculo del ciclo de utilidad.
 *
 * El ciclo es fijo: viernes a jueves, el que está en curso. Nada se guarda ni se crea:
 * el rango se calcula a partir de una fecha.
 *
 * Definiciones (ver odd/tasks/utilidad-ciclo.md):
 *   Invertido  = costo de producción + costos del ciclo (los ligados a producto y los generales)
 *   Recuperado = ventas cobradas del ciclo, sin contar cortesías (tipo 'noIngreso')
 *   Saldo      = Recuperado - Invertido  → negativo: aún no se recupera. Positivo: ganancia.
 *
 * La caja NO entra aquí: es efectivo del día, no margen.
 */

import { hoy } from './utils.js';

const DIA_VIERNES = 5;
const MS_DIA = 86400000;

/** Convierte 'YYYY-MM-DD' a Date a medianoche local. */
function _fecha(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Formatea un Date como 'YYYY-MM-DD' local. */
function _iso(fecha) {
  const d = new Date(fecha);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Día de la semana en que arranca el ciclo que contiene la fecha dada.
 * Si es viernes, el ciclo empieza ese mismo día.
 */
export function inicioDeCiclo(fechaISO = hoy()) {
  const fecha = _fecha(fechaISO);
  const dia = fecha.getDay();          // 0 domingo … 6 sábado
  const atras = (dia - DIA_VIERNES + 7) % 7;
  const inicio = new Date(fecha);
  inicio.setDate(inicio.getDate() - atras);
  return _iso(inicio);
}

/** Rango del ciclo que contiene la fecha: viernes (inicio) a jueves (fin), ambos incluidos. */
export function rangoCiclo(fechaISO = hoy()) {
  const inicio = inicioDeCiclo(fechaISO);
  const fin = new Date(_fecha(inicio).getTime() + 6 * MS_DIA);
  return { inicio, fin: _iso(fin) };
}

/** ¿La fecha cae dentro del rango? Comparación de texto porque el formato es ISO. */
export function enRango(fecha, { inicio, fin }) {
  const f = String(fecha || '');
  return f >= inicio && f <= fin;
}

/**
 * Calcula el saldo del ciclo.
 *
 * @param {Object} datos
 * @param {Array} datos.ventas       — registros de 'ventas'
 * @param {Array} datos.detalleVenta — registros de 'detalleVenta'
 * @param {Array} datos.producciones — registros de 'producciones'
 * @param {Array} datos.costos       — registros de 'costos'
 * @param {Object} rango             — { inicio, fin }
 */
export function calcularCiclo({ ventas = [], detalleVenta = [], producciones = [], costos = [] } = {}, rango) {
  const ventasDelCiclo = ventas.filter(v =>
    enRango(v.fecha, rango) && v.estado === 'cobrada' && v.tipo !== 'noIngreso'
  );
  const idsCobradas = new Set(ventasDelCiclo.map(v => v.id));

  const recuperado = ventasDelCiclo.reduce((suma, v) => suma + (Number(v.total) || 0), 0);

  const produccionesDelCiclo = producciones.filter(p => enRango(p.fecha, rango));
  const costosDelCiclo = costos.filter(c => enRango(c.fecha, rango));

  const invertidoProduccion = produccionesDelCiclo.reduce((s, p) => s + (Number(p.costoTotal) || 0), 0);
  const invertidoCostos = costosDelCiclo.reduce((s, c) => s + (Number(c.monto) || 0), 0);
  const invertido = invertidoProduccion + invertidoCostos;

  // Desglose por producto: ventas cobradas del ciclo (por línea) contra lo invertido en ese producto.
  const porProducto = new Map();
  const producto = (id, nombre) => {
    if (!porProducto.has(id)) {
      porProducto.set(id, { productoId: id, nombre: nombre || '', recuperado: 0, invertido: 0, saldo: 0 });
    }
    const actual = porProducto.get(id);
    if (!actual.nombre && nombre) actual.nombre = nombre;
    return actual;
  };

  detalleVenta.forEach(d => {
    if (!idsCobradas.has(d.ventaId)) return;
    const fila = producto(d.productoId, d.nombreProducto);
    fila.recuperado += Number(d.subtotalLinea) || 0;
  });

  produccionesDelCiclo.forEach(p => {
    producto(p.productoId, p.nombreProducto).invertido += Number(p.costoTotal) || 0;
  });

  costosDelCiclo.forEach(c => {
    if (!c.productoId) return; // gasto general: sólo cuenta en el saldo global
    producto(c.productoId, c.productoNombre).invertido += Number(c.monto) || 0;
  });

  const productos = [...porProducto.values()]
    .map(p => ({ ...p, saldo: p.recuperado - p.invertido }))
    .sort((a, b) => a.saldo - b.saldo);

  const generales = costosDelCiclo
    .filter(c => !c.productoId)
    .reduce((s, c) => s + (Number(c.monto) || 0), 0);

  return {
    rango,
    ventas: ventasDelCiclo.length,
    recuperado,
    invertidoProduccion,
    invertidoCostos,
    gastosGenerales: generales,
    invertido,
    saldo: recuperado - invertido,
    recuperadoPct: invertido > 0 ? recuperado / invertido : (recuperado > 0 ? 1 : 0),
    productos,
  };
}

/** Atajo: ciclo en curso a partir de los datos completos. */
export function cicloActual(datos = {}, fechaISO = hoy()) {
  return calcularCiclo(datos, rangoCiclo(fechaISO));
}
