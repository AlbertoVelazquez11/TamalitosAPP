/**
 * backup.js — Exportación e importación del respaldo completo de IndexedDB.
 *
 * Parte del módulo db (ver db.js, que reexporta la API pública).
 */
import { getAll, getById, put, clearStore } from './core.js';

/**
 * Exporta todas las tablas de la base de datos como objeto JS.
 * Usado para generar el respaldo JSON completo.
 * @returns {Promise<Object>}
 */
export async function exportarTodo() {
  const [productos, insumos, costos, ventas, detalleVenta, producciones, recetas, perfiles, finanzas, movimientosFinanzas, clientes, pedidos] = await Promise.all([
    getAll('productos'),
    getAll('insumos'),
    getAll('costos'),
    getAll('ventas'),
    getAll('detalleVenta'),
    getAll('producciones'),
    getAll('recetas'),
    getAll('perfiles'),
    getAll('finanzas'),
    getAll('movimientosFinanzas'),
    getAll('clientes'),
    getAll('pedidos'),
  ]);

  return { productos, insumos, costos, ventas, detalleVenta, producciones, recetas, perfiles, finanzas, movimientosFinanzas, clientes, pedidos };
}

/**
 * Importa un respaldo completo, reemplazando todos los datos.
 * ⚠️ Destructivo: borra los datos actuales antes de importar.
 * @param {Object} respaldo — Objeto con las 5 tablas
 */
export async function importarRespaldo(respaldo) {
  const stores = ['productos', 'insumos', 'costos', 'ventas', 'detalleVenta', 'producciones', 'recetas', 'perfiles', 'finanzas', 'movimientosFinanzas', 'clientes', 'pedidos'];

  for (const storeName of stores) {
    await clearStore(storeName);
    const registros = respaldo[storeName] || [];
    for (const record of registros) {
      await put(storeName, record);
    }
  }

  // Garantizar que exista al menos el perfil "General"
  const perfiles = await getAll('perfiles');
  if (perfiles.length === 0) {
    const ahora = new Date().toISOString();
    await put('perfiles', { id: 'perfil_general', nombre: 'General', creadoEn: ahora, actualizadoEn: ahora });
  }

  // Garantizar saldo de Finanzas (respaldos v3.0 no lo incluyen)
  const fin = await getById('finanzas', 'actual');
  if (!fin) {
    await put('finanzas', { id: 'actual', caja: 0, fondo: 0, actualizadoEn: new Date().toISOString() });
  }
}

