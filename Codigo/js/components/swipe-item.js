/**
 * swipe-item.js — Componente de lista con gesto Swipe-to-Action
 *
 * Crea un elemento de lista con un botón oculto que se revela al deslizar
 * hacia la izquierda. El botón de acción (ej. Eliminar, Desactivar) queda
 * detrás del contenido y se revela con la animación de swipe de iOS.
 *
 * Estructura HTML generada:
 *
 *   <div class="swipe-item">
 *     <div class="swipe-item__actions">
 *       <button class="swipe-action-btn swipe-action-btn--delete">
 *         <span>🗑</span><span>Eliminar</span>
 *       </button>
 *     </div>
 *     <div class="swipe-item__content"> ← Este se desliza
 *       { contenidoHTML }
 *     </div>
 *   </div>
 *
 * Uso:
 *   import { crearSwipeItem } from '../components/swipe-item.js';
 *
 *   const { elemento, cleanup } = crearSwipeItem({
 *     contenidoHTML: '<div class="list-item">...</div>',
 *     accionIcono:  '🗑',
 *     accionTexto:  'Eliminar',
 *     accionClase:  'swipe-action-btn--delete',
 *     anchoAccion:  80,
 *     onAccion:     () => eliminarItem(id),
 *   });
 *
 *   lista.appendChild(elemento);
 *   // Al desmontar la vista:
 *   cleanup();
 */

import { aplicarSwipe } from '../gestures.js';

/**
 * @param {Object} opciones
 * @param {string}   opciones.contenidoHTML  — HTML del frente del item
 * @param {string}   opciones.accionIcono    — Emoji/texto del ícono de la acción
 * @param {string}   opciones.accionTexto    — Etiqueta del botón (Ej: "Eliminar")
 * @param {string}   opciones.accionClase    — Clase CSS del botón de acción
 * @param {number}   opciones.anchoAccion    — Ancho en px del área revelada (default 80)
 * @param {Function} opciones.onAccion       — Callback cuando se toca el botón de acción
 *
 * @returns {{ elemento: HTMLElement, cleanup: Function }}
 */
export function crearSwipeItem({
  contenidoHTML = '',
  accionIcono   = '🗑',
  accionTexto   = 'Eliminar',
  accionClase   = 'swipe-action-btn--delete',
  anchoAccion   = 80,
  onAccion      = () => {},
} = {}) {
  // Wrapper externo (overflow hidden para ocultar el botón)
  const wrapper = document.createElement('div');
  wrapper.className = 'swipe-item';

  // Botón de acción (queda detrás, se muestra al deslizar)
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'swipe-item__actions';
  actionsDiv.style.width = `${anchoAccion}px`;

  const actionBtn = document.createElement('button');
  actionBtn.className = `swipe-action-btn ${accionClase}`;
  actionBtn.type = 'button';
  actionBtn.innerHTML = `
    <span class="swipe-action-btn__icon">${accionIcono}</span>
    <span>${accionTexto}</span>
  `;
  actionsDiv.appendChild(actionBtn);

  // Contenido frontal (el que se desliza)
  const contentDiv = document.createElement('div');
  contentDiv.className = 'swipe-item__content';
  contentDiv.innerHTML = contenidoHTML;

  wrapper.appendChild(actionsDiv);
  wrapper.appendChild(contentDiv);

  // Aplicar el handler de swipe al contenido frontal
  const cleanupSwipe = aplicarSwipe(contentDiv, { anchoAccion });

  // Al tocar el botón de acción, ejecutar callback
  actionBtn.addEventListener('click', () => {
    // Primero cerrar el swipe, luego ejecutar la acción
    if (typeof contentDiv._swipeCerrar === 'function') {
      contentDiv._swipeCerrar();
    }
    onAccion();
  });

  return {
    elemento: wrapper,
    cleanup: cleanupSwipe,
  };
}
