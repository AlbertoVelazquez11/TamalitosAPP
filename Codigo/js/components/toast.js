/**
 * toast.js — Notificaciones efímeras
 *
 * Uso:
 *   import { toast } from './components/toast.js';
 *   toast.success('Venta registrada');
 *   toast.error('Ocurrió un error');
 *   toast.info('Información');
 */

let _container = null;

function getContainer() {
  if (!_container) {
    _container = document.createElement('div');
    _container.className = 'toast-container';
    document.body.appendChild(_container);
  }
  return _container;
}

/**
 * Muestra un toast.
 * @param {string} mensaje
 * @param {'success'|'danger'|'info'} tipo
 * @param {number} duracion — ms antes de desaparecer
 */
function mostrar(mensaje, tipo = 'info', duracion = 3000) {
  const container = getContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;

  const iconos = { success: '✓', danger: '✕', info: 'ℹ' };
  el.innerHTML = `<span>${iconos[tipo] ?? 'ℹ'}</span><span>${mensaje}</span>`;

  container.appendChild(el);

  // Auto-dismiss
  setTimeout(() => {
    el.style.transition = 'opacity 300ms ease, transform 300ms ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => el.remove(), 300);
  }, duracion);
}

export const toast = {
  success: (msg, dur)  => mostrar(msg, 'success', dur),
  error:   (msg, dur)  => mostrar(msg, 'danger',  dur),
  info:    (msg, dur)  => mostrar(msg, 'info',    dur),
};

