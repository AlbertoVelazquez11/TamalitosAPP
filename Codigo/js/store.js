/**
 * store.js — Estado Reactivo Global de TamalitosAPP
 *
 * Patrón Observer: los componentes se suscriben a claves del estado
 * y son notificados únicamente cuando esa clave cambia.
 *
 * Uso:
 *   import { store } from './store.js';
 *
 *   // Leer estado actual
 *   const { productos } = store.getState();
 *
 *   // Actualizar (notifica a suscriptores de 'productos')
 *   store.setState({ productos: lista });
 *
 *   // Suscribirse a cambios de una clave
 *   const unsub = store.subscribe('productos', (nuevos, anteriores) => {
 *     renderLista(nuevos);
 *   });
 *
 *   // Desuscribirse cuando el componente se desmonta
 *   unsub();
 */

class Store {
  /**
   * @param {Object} estadoInicial
   */
  constructor(estadoInicial) {
    // Estado privado — se accede solo via getState() / setState()
    this._state     = { ...estadoInicial };
    // Map<string, Set<Function>>
    this._listeners = new Map();
  }

  /**
   * Devuelve una copia superficial del estado completo.
   * Las mutaciones directas sobre el objeto retornado
   * no afectan al estado interno.
   * @returns {Object}
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Actualiza el estado con los campos del objeto `patch`
   * y notifica a los suscriptores de las claves modificadas.
   *
   * @param {Object} patch — Solo los campos que cambian
   */
  setState(patch) {
    const prev = { ...this._state };
    Object.assign(this._state, patch);

    // Notificar suscriptores solo de las claves que realmente cambiaron
    for (const key of Object.keys(patch)) {
      if (this._listeners.has(key)) {
        const valor     = this._state[key];
        const valorPrev = prev[key];
        // Referencia diferente = cambio (evitar notificaciones innecesarias)
        if (valor !== valorPrev) {
          this._listeners.get(key).forEach(fn => {
            try { fn(valor, valorPrev); } catch (e) {
              console.error(`[Store] Error en listener de '${key}':`, e);
            }
          });
        }
      }
    }
  }

  /**
   * Suscribe una función a los cambios de una clave del estado.
   *
   * @param {string}   key — Clave del estado a observar
   * @param {Function} fn  — Callback(nuevoValor, valorAnterior)
   * @returns {Function}   — Función para desuscribirse
   */
  subscribe(key, fn) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(fn);

    // Retorna una función de limpieza (patrón de React/Svelte)
    return () => {
      const set = this._listeners.get(key);
      if (set) set.delete(fn);
    };
  }

  /**
   * Elimina TODOS los suscriptores de una clave.
   * Útil al desmontar una vista completa.
   * @param {string} key
   */
  clearListeners(key) {
    this._listeners.delete(key);
  }
}

// ══════════════════════════════════════════════════════════
// ESTADO INICIAL DE LA APLICACIÓN
// ══════════════════════════════════════════════════════════

export const store = new Store({
  /**
   * Configuración del negocio (cargada de localStorage al iniciar)
   * @type {{ nombreNegocio: string, version: string, tema: 'light'|'dark' } | null}
   */
  config: null,

  /**
   * Lista de todos los productos (activos e inactivos)
   * @type {Array}
   */
  productos: [],

  /**
   * Lista de insumos del catálogo
   * @type {Array}
   */
  insumos: [],

  /**
   * Pedido en construcción en la pantalla del POS.
   * Cada elemento: { productoId, nombre, precioUnitario, cantidad }
   * @type {Array}
   */
  pedidoActual: [],

  /**
   * Ruta/hash activa del router
   * @type {string}
   */
  vistaActual: '',

  /**
   * Si true, se está mostrando algún modal/overlay
   * @type {boolean}
   */
  modalAbierto: false,
});

// ══════════════════════════════════════════════════════════
// HELPERS PARA EL PEDIDO (usados por pos.js)
// ══════════════════════════════════════════════════════════

/**
 * Agrega un producto al pedido o incrementa su cantidad si ya existe.
 * @param {{ id: string, nombre: string, precio: number }} producto
 */
export function agregarAlPedido(producto) {
  const pedido = [...store.getState().pedidoActual];
  const idx    = pedido.findIndex(item => item.productoId === producto.id);

  if (idx >= 0) {
    pedido[idx] = { ...pedido[idx], cantidad: pedido[idx].cantidad + 1 };
  } else {
    pedido.push({
      productoId:    producto.id,
      nombre:        producto.nombre,
      precioUnitario: producto.precio,
      cantidad:      1,
    });
  }

  store.setState({ pedidoActual: pedido });
}

/**
 * Cambia la cantidad de un item del pedido.
 * Si la nueva cantidad llega a 0 o menos, elimina el item.
 * @param {string} productoId
 * @param {number} delta — +1 o -1
 */
export function cambiarCantidad(productoId, delta) {
  const pedido = [...store.getState().pedidoActual];
  const idx    = pedido.findIndex(item => item.productoId === productoId);
  if (idx < 0) return;

  const nuevaCantidad = pedido[idx].cantidad + delta;
  if (nuevaCantidad <= 0) {
    pedido.splice(idx, 1);
  } else {
    pedido[idx] = { ...pedido[idx], cantidad: nuevaCantidad };
  }

  store.setState({ pedidoActual: pedido });
}

/**
 * Elimina un item del pedido por su productoId.
 * @param {string} productoId
 */
export function eliminarDelPedido(productoId) {
  const pedido = store.getState().pedidoActual.filter(
    item => item.productoId !== productoId
  );
  store.setState({ pedidoActual: pedido });
}

/**
 * Limpia completamente el pedido (post-cobro).
 */
export function limpiarPedido() {
  store.setState({ pedidoActual: [] });
}

/**
 * Calcula el subtotal del pedido actual.
 * @returns {number}
 */
export function calcularSubtotal() {
  return store.getState().pedidoActual.reduce(
    (sum, item) => sum + item.precioUnitario * item.cantidad,
    0
  );
}

// ══════════════════════════════════════════════════════════
// HELPERS DE CONFIGURACIÓN
// ══════════════════════════════════════════════════════════

const CONFIG_KEY = 'tamalitos_config';

/**
 * Carga la configuración desde localStorage e inicializa el store.
 */
export function cargarConfig() {
  try {
    const raw    = localStorage.getItem(CONFIG_KEY);
    const config = raw ? JSON.parse(raw) : _configDefault();
    store.setState({ config });
    return config;
  } catch (e) {
    console.error('[Store] Error al cargar config:', e);
    const config = _configDefault();
    store.setState({ config });
    return config;
  }
}

/**
 * Guarda la configuración en localStorage y actualiza el store.
 * @param {Object} patch — Campos a actualizar en la config
 */
export function guardarConfig(patch) {
  const config = { ...store.getState().config, ...patch };
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('[Store] Error al guardar config:', e);
  }
  store.setState({ config });
  return config;
}

function _configDefault() {
  return {
    nombreNegocio:    'Mi Negocio',
    version:          '1.0.0',
    tema:             'light',      // 'light' | 'dark'
    ultimaExportacion: null,
    logo:             null,         // Base64 string para el logo
  };
}

