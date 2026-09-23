/**
 * config.js — Vista de Configuración General
 * Sprint 1: estructura básica con nombre del negocio y toggle de tema.
 * Los enlaces a Productos y Exportar se implementan en Sprint 2+.
 */
import { store, guardarConfig } from '../store.js';
import { navegar, navegarAtras } from '../router.js';
import { toast }                 from '../components/toast.js';
import { esc }                   from '../utils.js';

export async function render(container) {
  const { config } = store.getState();

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Configuración</h1>
      </div>

      <!-- Nombre del negocio -->
      <div class="config-section">
        <p class="config-section-title">Negocio</p>
        <div class="form-group">
          <label class="form-label" for="input-nombre">Nombre del Negocio</label>
          <input
            id="input-nombre"
            type="text"
            class="form-input"
            value="${esc(config?.nombreNegocio ?? '')}"
            placeholder="Nombre de tu negocio"
            maxlength="50"
          >
        </div>
        <button class="btn btn-primary btn-block" id="btn-guardar-nombre">
          Guardar Nombre
        </button>
      </div>

      <!-- Apariencia -->
      <div class="config-section">
        <p class="config-section-title">Apariencia</p>
        <div class="toggle-row">
          <label class="toggle-row__label" for="toggle-tema">
            🌙 Modo Oscuro
          </label>
          <label class="switch">
            <input type="checkbox" id="toggle-tema" ${config?.tema === 'dark' ? 'checked' : ''}>
            <span class="switch__track"></span>
          </label>
        </div>
      </div>

      <!-- Catálogos -->
      <div class="config-section">
        <p class="config-section-title">Catálogos</p>
        <button class="btn btn-secondary btn-block" id="btn-productos">
          📝 Administrar Productos
        </button>
      </div>

      <!-- Datos -->
      <div class="config-section">
        <p class="config-section-title">Datos</p>
        <p class="text-sm text-muted" style="padding: 0 var(--space-1); margin-bottom: var(--space-2);">
          Tus datos están almacenados localmente en este dispositivo.
          Exporta regularmente para tener un respaldo.
        </p>
        <button class="btn btn-secondary btn-block" id="btn-exportar" disabled>
          📤 Exportar Datos (Sprint 4)
        </button>
        <button class="btn btn-ghost btn-block" id="btn-respaldo" disabled>
          🔒 Exportar Respaldo Completo (Sprint 4)
        </button>
      </div>

      <!-- Versión -->
      <div style="text-align:center; padding: var(--space-4) 0;">
        <span class="version-badge">TamalitosAPP v${esc(config?.version ?? '1.0.0')}</span>
      </div>
    </div>
  `;

  // Guardar nombre del negocio
  container.querySelector('#btn-guardar-nombre').addEventListener('click', () => {
    const input = container.querySelector('#input-nombre');
    const nombre = input.value.trim();
    if (!nombre) {
      toast.error('El nombre no puede estar vacío.');
      return;
    }
    guardarConfig({ nombreNegocio: nombre });
    toast.success('Nombre guardado.');
  });

  // Toggle de tema
  container.querySelector('#toggle-tema').addEventListener('change', (e) => {
    const tema = e.target.checked ? 'dark' : 'light';
    guardarConfig({ tema });
    document.documentElement.setAttribute('data-theme', tema);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = tema === 'dark' ? '#0f172a' : '#ffffff';
    toast.info(`Tema ${tema === 'dark' ? 'oscuro' : 'claro'} activado.`);
  });

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-productos').addEventListener('click', () => navegar('productos'));
}
