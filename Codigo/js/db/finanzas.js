/**
 * finanzas.js — Caja, fondo y libro de movimientos.
 *
 * Parte del módulo db (ver db.js, que reexporta la API pública).
 */
import { openDB } from './schema.js';
import { getAll, getById, put } from './core.js';
import { hoy } from '../utils.js';

// ══════════════════════════════════════════════════════════
// API PÚBLICA — FINANZAS (v3.1)
// ══════════════════════════════════════════════════════════

const FINANZAS_ID = 'actual';

/**
 * Devuelve el saldo actual de Finanzas { caja, fondo }.
 * Si aún no existe, devuelve ceros sin persistir.
 */
export async function getFinanzas() {
  const fin = await getById('finanzas', FINANZAS_ID);
  return fin ?? { id: FINANZAS_ID, caja: 0, fondo: 0 };
}

/**
 * Ajusta manualmente el saldo de Caja a un valor absoluto.
 * Deja registro en el ledger (tipo 'ajusteCaja').
 * @param {number} nuevoValor — valor absoluto de Caja (>= 0)
 */
export async function ajustarCaja(nuevoValor) {
  const fin = await getFinanzas();
  fin.caja = nuevoValor;
  fin.actualizadoEn = new Date().toISOString();
  await put('finanzas', fin);
  await _registrarMovimiento({
    tipo:     'ajusteCaja',
    monto:    nuevoValor,
    concepto: 'Ajuste manual de Caja',
  });
  return fin;
}

/**
 * Registra un movimiento en el ledger sin alterar saldos
 * (usado para el ajuste manual de Caja).
 */
async function _registrarMovimiento({ tipo, monto, concepto = '', origen = null, destino = null, refId = null }) {
  await put('movimientosFinanzas', {
    id:       `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tipo,
    monto,
    origen:   origen ?? null,
    destino:  destino ?? null,
    concepto,
    refId:    refId ?? null,
    fecha:    hoy(),
    creadoEn: new Date().toISOString(),
  });
}

/**
 * Aplica un movimiento de dinero actualizando Caja/Fondo de forma atómica
 * y dejando registro en el ledger (movimientosFinanzas).
 *
 * @param {Object} params
 * @param {string} params.tipo    — venta | pagoFiado | cancelacionVenta | costo | costoEliminado | aporteFondo
 * @param {number} params.monto   — monto positivo (> 0)
 * @param {'caja'|'fondo'|null} [params.origen]  — cuenta que se descuenta
 * @param {'caja'|'fondo'|null} [params.destino] — cuenta que se suma
 * @param {string} [params.concepto]
 * @param {string} [params.refId]  — id de la venta/costo relacionado
 */
export async function aplicarMovimiento({ tipo, monto, origen = null, destino = null, concepto = '', refId = null }) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['finanzas', 'movimientosFinanzas'], 'readwrite');
    tx.onerror = () => reject(tx.error);

    const storeFin = tx.objectStore('finanzas');
    const storeMov = tx.objectStore('movimientosFinanzas');

    const reqFin = storeFin.get(FINANZAS_ID);
    reqFin.onsuccess = () => {
      const fin = reqFin.result ?? { id: FINANZAS_ID, caja: 0, fondo: 0 };

      if (origen === 'caja')  fin.caja  = (fin.caja  ?? 0) - monto;
      if (origen === 'fondo') fin.fondo = (fin.fondo ?? 0) - monto;
      if (destino === 'caja') fin.caja  = (fin.caja  ?? 0) + monto;
      if (destino === 'fondo') fin.fondo = (fin.fondo ?? 0) + monto;
      fin.actualizadoEn = new Date().toISOString();

      storeFin.put(fin);
      storeMov.put({
        id:       `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tipo,
        monto,
        origen:   origen ?? null,
        destino:  destino ?? null,
        concepto,
        refId:    refId ?? null,
        fecha:    hoy(),
        creadoEn: new Date().toISOString(),
      });
    };

    tx.oncomplete = () => resolve();
  });
}

/**
 * Devuelve el ledger de movimientos de Finanzas, más recientes primero.
 */
export async function getMovimientosFinanzas() {
  const movs = await getAll('movimientosFinanzas');
  return movs.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
}
