/**
 * export.js — Exportación CSV, Respaldo JSON y Web Share API (Sprint 4)
 *
 * HU-024: Exportar ventas y gastos en CSV filtrados por período
 * HU-060: Exportar respaldo completo JSON
 * HU-061: Validar e importar respaldo JSON
 *
 * Filtros disponibles (fase1 §5.2): día, semana, mes, año.
 * Mecanismo de compartición: Web Share API con fallback a descarga directa.
 */

import {
  getVentasPorFecha,
  getCostosPorFecha,
  getDetallesByVentaId,
  exportarTodo,
  importarRespaldo as _importarRespaldoDB,
} from './db.js';
import { hoy } from './utils.js';

const BOM = '\uFEFF'; // BOM UTF-8 para compatibilidad con Excel/Numbers

// ══════════════════════════════════════════════════════════
// PERÍODOS DE EXPORTACIÓN
// ══════════════════════════════════════════════════════════

/**
 * Calcula el rango [inicio, fin] (YYYY-MM-DD) de un período.
 * @param {'dia'|'semana'|'mes'|'anio'} periodo
 * @returns {{ inicio: string, fin: string }}
 */
export function rangoDePeriodo(periodo) {
  const now = new Date();
  const fin = hoy();

  switch (periodo) {
    case 'semana': {
      // Semana de lunes a domingo
      const lunes = new Date(now);
      const dia   = lunes.getDay(); // 0 = domingo
      const diff  = dia === 0 ? 6 : dia - 1;
      lunes.setDate(lunes.getDate() - diff);
      return { inicio: _aISO(lunes), fin };
    }
    case 'mes':
      return { inicio: `${now.getFullYear()}-${_pad(now.getMonth() + 1)}-01`, fin };
    case 'anio':
      return { inicio: `${now.getFullYear()}-01-01`, fin };
    case 'dia':
    default:
      return { inicio: fin, fin };
  }
}

function _pad(n) {
  return String(n).padStart(2, '0');
}

function _aISO(d) {
  return `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
}

// ══════════════════════════════════════════════════════════
// CSV — GENERACIÓN
// ══════════════════════════════════════════════════════════

/**
 * Escapa un campo CSV: encierra entre comillas si contiene
 * coma, comilla, punto y coma o salto de línea.
 */
function _campo(v) {
  const s = String(v ?? '');
  if (/[",\n\r;]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function _fila(arr) {
  return arr.map(_campo).join(',') + '\r\n';
}

async function _csvVentas(inicio, fin) {
  const ventas = await getVentasPorFecha(inicio, fin);
  const lineas = [
    _fila(['Fecha', 'Hora', 'Productos', 'Cantidades', 'Subtotal', 'Descuento', 'Total', 'Método de Pago', 'Estado']),
  ];

  for (const v of ventas) {
    const detalles   = await getDetallesByVentaId(v.id);
    const productos  = detalles.map(d => `${d.nombreProducto} x${d.cantidad}`).join('; ');
    const cantidades = detalles.reduce((s, d) => s + d.cantidad, 0);
    const metodo     = v.estadoPago === 'pendiente' ? 'Efectivo (Fiado)' : 'Efectivo';
    const estado     = v.estado === 'cancelada' ? 'Cancelada' : 'Cobrada';

    lineas.push(_fila([
      v.fecha,
      v.hora ? v.hora.substring(0, 5) : '',
      productos,
      cantidades,
      (v.subtotal ?? 0).toFixed(2),
      (v.descuento ?? 0).toFixed(2),
      (v.total ?? 0).toFixed(2),
      metodo,
      estado,
    ]));
  }

  return { csv: BOM + lineas.join(''), registros: ventas.length };
}

async function _csvGastos(inicio, fin) {
  const costos = await getCostosPorFecha(inicio, fin);
  const lineas = [
    _fila(['Fecha', 'Concepto', 'Categoría', 'Monto', 'Notas']),
  ];

  for (const c of costos) {
    lineas.push(_fila([
      c.fecha,
      c.concepto,
      c.categoria,
      (c.monto ?? 0).toFixed(2),
      c.notas || '',
    ]));
  }

  return { csv: BOM + lineas.join(''), registros: costos.length };
}

// ══════════════════════════════════════════════════════════
// WEB SHARE API — COMPARTIR ARCHIVO
// ══════════════════════════════════════════════════════════

/**
 * Comparte un archivo usando la Web Share API (nativo en iOS).
 * Si no está disponible, fallback a descarga directa con <a download>.
 *
 * @param {Object} opciones
 * @param {string} opciones.nombre    — Nombre del archivo
 * @param {string} opciones.contenido — Contenido del archivo
 * @param {string} opciones.tipo      — MIME type
 * @returns {Promise<{compartido?: boolean, cancelado?: boolean}>}
 */
async function _compartirArchivo({ nombre, contenido, tipo }) {
  const blob = new Blob([contenido], { type: tipo });
  const file = new File([blob], nombre, { type: tipo });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nombre });
      return { compartido: true };
    } catch (e) {
      if (e?.name === 'AbortError') return { cancelado: true };
      // Cualquier otro error cae al fallback de descarga
    }
  }

  // Fallback: descarga directa (menos fiable en iOS Standalone, útil en desktop)
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { compartido: true };
}

/**
 * Exporta ventas o gastos en CSV para el período indicado y comparte el archivo.
 *
 * @param {'ventas'|'gastos'} tipo
 * @param {'dia'|'semana'|'mes'|'anio'} periodo
 * @returns {Promise<{vacio?: boolean, cancelado?: boolean, compartido?: boolean, registros?: number}>}
 */
export async function exportarCSV(tipo, periodo) {
  const { inicio, fin } = rangoDePeriodo(periodo);
  const esVentas = tipo === 'ventas';

  const { csv, registros } = esVentas
    ? await _csvVentas(inicio, fin)
    : await _csvGastos(inicio, fin);

  if (registros === 0) {
    return { vacio: true };
  }

  const fecha  = hoy().replace(/-/g, '');
  const nombre = `${esVentas ? 'ventas' : 'gastos'}_TamalitosAPP_${fecha}.csv`;
  const resultado = await _compartirArchivo({ nombre, contenido: csv, tipo: 'text/csv' });

  return { registros, ...resultado };
}

// ══════════════════════════════════════════════════════════
// RESPALDO JSON — EXPORTAR / VALIDAR / IMPORTAR
// ══════════════════════════════════════════════════════════

const TABLAS = ['productos', 'insumos', 'costos', 'ventas', 'detalleVenta', 'producciones'];

/**
 * Exporta todas las tablas de IndexedDB como archivo JSON y lo comparte.
 * @returns {Promise<{compartido?: boolean, cancelado?: boolean}>}
 */
export async function exportarRespaldoJSON() {
  const datos = await exportarTodo();
  const json  = JSON.stringify({
    _formato:     'tamalitos-respaldo',
    _version:     '1.0.0',
    _exportadoEn: new Date().toISOString(),
    ...datos,
  }, null, 2);

  const nombre = `respaldo_TamalitosAPP_${hoy().replace(/-/g, '')}.json`;
  return _compartirArchivo({ nombre, contenido: json, tipo: 'application/json' });
}

/**
 * Valida la estructura de un respaldo JSON.
 * @param {any} data
 * @returns {{ valido: boolean, error?: string, resumen?: Object }}
 */
export function validarRespaldo(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valido: false, error: 'El archivo seleccionado no es un respaldo válido.' };
  }

  const tieneTablas = TABLAS.some(t => Array.isArray(data[t]));
  if (!tieneTablas) {
    return { valido: false, error: 'El archivo no contiene las tablas de TamalitosAPP.' };
  }

  return {
    valido: true,
    resumen: {
      productos:    (data.productos || []).length,
      insumos:      (data.insumos || []).length,
      costos:       (data.costos || []).length,
      ventas:       (data.ventas || []).length,
      detalleVenta: (data.detalleVenta || []).length,
    },
  };
}

/**
 * Restaura un respaldo, reemplazando los datos actuales de IndexedDB.
 * ⚠️ Destructivo: valida antes con validarRespaldo().
 * @param {Object} data
 */
export async function restaurarRespaldo(data) {
  await _importarRespaldoDB(data);
}
