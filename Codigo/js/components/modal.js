/**
 * modal.js — Modal / Bottom Sheet reutilizable
 *
 * Uso:
 *   import { modal } from './components/modal.js';
 *
 *   const cerrar = modal.abrir({
 *     titulo: 'Confirmar',
 *     contenido: '<p>¿Estás seguro?</p>',
 *     botones: [
 *       { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
 *       { texto: 'Confirmar', clase: 'btn-primary', accion: () => { ... cerrar(); } },
 *     ]
 *   });
 *
 *   // También hay un shortcut para confirmaciones simples:
 *   modal.confirmar('¿Eliminar?', '¿Seguro?').then(ok => {
 *     if (ok) { ... }
 *   });
 */

import { store } from '../store.js';

let _overlayEl = null;

function _limpiar() {
  if (_overlayEl) {
    _overlayEl.remove();
    _overlayEl = null;
    store.setState({ modalAbierto: false });
  }
}

/**
 * Abre un bottom sheet modal.
 *
 * @param {Object} opciones
 * @param {string}  opciones.titulo
 * @param {string}  opciones.contenido   — HTML string
 * @param {Array}   opciones.botones     — [{ texto, clase, accion }]
 * @param {boolean} opciones.cerrarAlTocarOverlay
 * @returns {Function} — Función para cerrar el modal programáticamente
 */
function abrir({ titulo, contenido = '', botones = [], cerrarAlTocarOverlay = true }) {
  // Cerrar modal anterior si hay uno abierto
  _limpiar();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'modal';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  // Handle decorativo de arrastre
  const handleHTML = `<div class="modal__handle" aria-hidden="true"></div>`;

  // Botones
  const botonesHTML = botones.map(btn => `
    <button class="btn ${btn.clase || 'btn-secondary'} btn-block"
            data-accion="${btn._id || ''}"
            type="button">
      ${btn.texto}
    </button>`).join('');

  sheet.innerHTML = `
    ${handleHTML}
    <h2 class="modal__title">${titulo}</h2>
    <div class="modal__body">${contenido}</div>
    <div class="modal__footer">${botonesHTML}</div>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  _overlayEl = overlay;
  store.setState({ modalAbierto: true });

  // Cerrar al tocar el overlay (fuera del sheet)
  if (cerrarAlTocarOverlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) _limpiar();
    });
  }

  // Vincular acciones a los botones
  const btnEls = sheet.querySelectorAll('.modal__footer button');
  botones.forEach((btn, i) => {
    if (btnEls[i] && typeof btn.accion === 'function') {
      btnEls[i].addEventListener('click', () => btn.accion());
    }
  });

  // Devolver función para cerrar
  return _limpiar;
}

/**
 * Shortcut para diálogos de confirmación binarios.
 * Devuelve una promesa que resuelve a true (confirmar) o false (cancelar).
 *
 * @param {string} titulo
 * @param {string} descripcion
 * @param {string} textoBtnConfirmar
 * @param {string} claseConfirmar — clase del botón de confirmación
 * @returns {Promise<boolean>}
 */
function confirmar(
  titulo,
  descripcion = '',
  textoBtnConfirmar = 'Confirmar',
  claseConfirmar = 'btn-primary'
) {
  return new Promise((resolve) => {
    const cerrar = abrir({
      titulo,
      contenido: descripcion ? `<p style="color: var(--color-text-muted)">${descripcion}</p>` : '',
      botones: [
        {
          texto: 'Cancelar',
          clase: 'btn-ghost',
          accion: () => { cerrar(); resolve(false); },
        },
        {
          texto: textoBtnConfirmar,
          clase: claseConfirmar,
          accion: () => { cerrar(); resolve(true); },
        },
      ],
      cerrarAlTocarOverlay: false,
    });
  });
}

export const modal = { abrir, cerrar: _limpiar, confirmar };

