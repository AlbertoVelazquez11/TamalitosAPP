/**
 * gestures.js — Manejo de Gestos Táctiles para iOS WebKit
 *
 * Implementa el gesto Swipe-to-Delete optimizado para pantallas táctiles de iPhone/iPad.
 *
 * Comportamiento:
 *  - Swipe horizontal izquierda → revela botón de acción (rojo, atrás del item)
 *  - El gesto se cancela si el movimiento es mayoritariamente vertical (scroll normal)
 *  - Auto-complete si se desliza > 40% del ancho del elemento
 *  - Cierra cualquier otro swipe abierto al abrir uno nuevo
 *
 * Uso:
 *   import { aplicarSwipe } from '../gestures.js';
 *
 *   const cleanup = aplicarSwipe(elemento, {
 *     anchoAccion: 80,         // px del botón revelado
 *     onComplete: () => { ... } // callback al completar el swipe
 *   });
 *
 *   cleanup(); // quitar listeners cuando el elemento se desmonta
 */

// Referencia al elemento actualmente con swipe abierto (para cerrar al abrir otro)
let _elementoActivo = null;
let _cerrarActivo = null;

/**
 * Aplica el comportamiento de swipe-to-delete a un elemento.
 *
 * @param {HTMLElement} itemContent  — Elemento que se desliza (el "frente")
 * @param {Object}      opciones
 * @param {number}      opciones.anchoAccion  — Ancho en px del botón oculto (default: 80)
 * @param {Function}    opciones.onReveal     — Callback cuando se revela el botón
 * @param {Function}    opciones.onClose      — Callback cuando se cierra el swipe
 * @returns {Function}  cleanup               — Función para remover todos los listeners
 */
export function aplicarSwipe(itemContent, { anchoAccion = 80, onReveal, onClose } = {}) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let direccionDeterminada = false;
  let esSwipeHorizontal = false;
  let swipeAbierto = false;

  // ── Umbral mínimo de movimiento antes de determinar dirección ──
  const UMBRAL_INICIO = 10; // px

  function _traducir(px) {
    itemContent.style.transform = `translateX(${Math.min(0, Math.max(-anchoAccion * 1.5, px))}px)`;
  }

  function _animar(px, duracion = 200) {
    itemContent.style.transition = `transform ${duracion}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    itemContent.style.transform = `translateX(${px}px)`;
    setTimeout(() => {
      itemContent.style.transition = '';
    }, duracion);
  }

  function cerrar() {
    _animar(0);
    swipeAbierto = false;
    if (_elementoActivo === itemContent) {
      _elementoActivo = null;
      _cerrarActivo = null;
    }
    if (typeof onClose === 'function') onClose();
  }

  function revelar() {
    _animar(-anchoAccion);
    swipeAbierto = true;
    _elementoActivo = itemContent;
    _cerrarActivo = cerrar;
    if (typeof onReveal === 'function') onReveal();
  }

  // ── Touch Start ──────────────────────────────────────────
  function onTouchStart(e) {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    currentX = swipeAbierto ? -anchoAccion : 0;
    direccionDeterminada = false;
    esSwipeHorizontal = false;
    itemContent.style.transition = '';

    // Cerrar otro swipe abierto si existe
    if (_elementoActivo && _elementoActivo !== itemContent && _cerrarActivo) {
      _cerrarActivo();
    }
  }

  // ── Touch Move ───────────────────────────────────────────
  function onTouchMove(e) {
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    // Determinar dirección del gesto una sola vez
    if (!direccionDeterminada && (Math.abs(deltaX) > UMBRAL_INICIO || Math.abs(deltaY) > UMBRAL_INICIO)) {
      esSwipeHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
      direccionDeterminada = true;
    }

    // Solo procesar si el gesto es horizontal
    if (!esSwipeHorizontal) return;

    // Prevenir scroll vertical mientras se procesa el swipe horizontal
    e.preventDefault();

    const nuevoX = currentX + deltaX;

    // Solo permitir swipe hacia la izquierda (negativo)
    // Si ya está abierto, también permitir cerrar (moviéndose hacia la derecha)
    if (nuevoX > 0) {
      _traducir(0);
    } else {
      _traducir(nuevoX);
    }
  }

  // ── Touch End ────────────────────────────────────────────
  function onTouchEnd(e) {
    if (!direccionDeterminada || !esSwipeHorizontal) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const totalX = currentX + deltaX;

    // Si estaba cerrado:
    if (!swipeAbierto) {
      // Auto-revelar si pasó el 40% del ancho del botón
      if (totalX < -(anchoAccion * 0.40)) {
        revelar();
      } else {
        cerrar();
      }
    } else {
      // Si estaba abierto:
      // Cerrar si se movió más de 20px hacia la derecha
      if (deltaX > 20) {
        cerrar();
      } else {
        revelar(); // Mantener abierto
      }
    }
  }

  // Usar passive: false para poder llamar preventDefault en touchmove
  itemContent.addEventListener('touchstart', onTouchStart, { passive: true });
  itemContent.addEventListener('touchmove',  onTouchMove,  { passive: false });
  itemContent.addEventListener('touchend',   onTouchEnd,   { passive: true });

  // Cerrar al tocar en otro lugar del documento
  function onDocumentTap(e) {
    if (swipeAbierto && !itemContent.parentElement?.contains(e.target)) {
      cerrar();
    }
  }
  document.addEventListener('touchstart', onDocumentTap, { passive: true });

  // ── Exponer cerrar en el elemento para poder cerrarlo desde fuera ──
  itemContent._swipeCerrar = cerrar;

  // Retornar función de limpieza
  return function cleanup() {
    itemContent.removeEventListener('touchstart', onTouchStart);
    itemContent.removeEventListener('touchmove',  onTouchMove);
    itemContent.removeEventListener('touchend',   onTouchEnd);
    document.removeEventListener('touchstart', onDocumentTap);
    if (_elementoActivo === itemContent) {
      _elementoActivo = null;
      _cerrarActivo = null;
    }
  };
}

