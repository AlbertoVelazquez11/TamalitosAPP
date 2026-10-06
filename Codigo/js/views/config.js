/**
 * config.js — Vista de Configuración General
 * Sprint 1: estructura básica con nombre del negocio y toggle de tema.
 * Los enlaces a Productos y Exportar se implementan en Sprint 2+.
 */
import { store, guardarConfig } from '../store.js';
import { navegar, navegarAtras } from '../router.js';
import { toast }                 from '../components/toast.js';
import { modal }                 from '../components/modal.js';
import { esc }                   from '../utils.js';
import {
  exportarCSV,
  exportarRespaldoJSON,
  validarRespaldo,
  restaurarRespaldo,
  enviarRespaldoTelegram,
  enviarCSVTelegram,
} from '../export.js';

export async function render(container) {
  const { config } = store.getState();

  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <button class="btn btn-icon view-header__back" id="btn-back" aria-label="Regresar">←</button>
        <h1 class="view-header__title">Configuración</h1>
      </div>

      <!-- Nombre y Logo del negocio -->
      <div class="config-section">
        <p class="config-section-title">Negocio</p>
        
        <div class="logo-upload-container">
           <div class="home-logo config-logo-preview" id="config-logo-preview" aria-hidden="true">
             ${config?.logo ? `<img src="${config.logo}" alt="Logo" class="custom-logo">` : '<img src="/icons/logo.png" alt="Logo" class="custom-logo">'}
           </div>
           <div class="logo-actions">
             <label for="input-logo" class="btn btn-secondary btn-sm" style="cursor: pointer; display: inline-block;">
               📸 Cambiar Logo
             </label>
             <input type="file" id="input-logo" accept="image/png, image/jpeg, image/webp" style="display: none;">
             ${config?.logo ? `<button class="btn btn-ghost btn-sm" id="btn-borrar-logo" style="color: var(--color-danger);">Borrar</button>` : ''}
           </div>
        </div>

        <div class="form-group" style="margin-top: var(--space-4);">
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
          Guardar Cambios
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
        <button class="btn btn-secondary btn-block" id="btn-exportar">
          📤 Exportar Datos (CSV)
        </button>
        <button class="btn btn-secondary btn-block" id="btn-respaldo">
          🔒 Exportar Respaldo Completo
        </button>
        <button class="btn btn-ghost btn-block" id="btn-importar">
          📥 Importar Respaldo
        </button>
        <input type="file" id="input-importar" accept=".json,application/json" style="display: none;">
      </div>

      <!-- Telegram -->
      <div class="config-section">
        <p class="config-section-title">Telegram</p>
        <button class="btn btn-secondary btn-block" id="btn-config-telegram">
          ${config?.telegramWorkerUrl ? '📲 Telegram: Configurado ✓' : '📲 Configurar respaldo a Telegram'}
        </button>
      </div>

      <!-- Versión -->
      <div style="text-align:center; padding: var(--space-4) 0;">
        <span class="version-badge">TamalitosAPP v${esc(config?.version ?? '1.0.0')}</span>
      </div>
    </div>
  `;

  // Manejar subida de logo
  const inputLogo = container.querySelector('#input-logo');
  if (inputLogo) {
    inputLogo.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Limitar tamaño a 2MB para IndexedDB/localStorage
      if (file.size > 2 * 1024 * 1024) {
        toast.error('El logo debe pesar menos de 2MB');
        inputLogo.value = '';
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        guardarConfig({ logo: base64 });
        
        // Actualizar preview local
        const preview = container.querySelector('#config-logo-preview');
        if (preview) {
           preview.innerHTML = `<img src="${base64}" alt="Logo" class="custom-logo">`;
        }
        toast.success('Logo actualizado');
        
        // Refrescar la vista para mostrar el botón de borrar si no estaba
        setTimeout(() => render(container), 300);
      };
      reader.readAsDataURL(file);
    });
  }

  // Manejar borrado de logo
  const btnBorrarLogo = container.querySelector('#btn-borrar-logo');
  if (btnBorrarLogo) {
    btnBorrarLogo.addEventListener('click', () => {
      guardarConfig({ logo: null });
      const preview = container.querySelector('#config-logo-preview');
      if (preview) {
         preview.innerHTML = '<img src="/icons/logo.png" alt="Logo" class="custom-logo">';
      }
      toast.info('Logo eliminado');
      setTimeout(() => render(container), 300);
    });
  }

  // Guardar nombre del negocio
  container.querySelector('#btn-guardar-nombre').addEventListener('click', () => {
    const input = container.querySelector('#input-nombre');
    const nombre = input.value.trim();
    if (!nombre) {
      toast.error('El nombre no puede estar vacío.');
      return;
    }
    guardarConfig({ nombreNegocio: nombre });
    toast.success('Cambios guardados.');
  });

  // Toggle de tema
  container.querySelector('#toggle-tema').addEventListener('change', (e) => {
    const tema = e.target.checked ? 'dark' : 'light';
    guardarConfig({ tema });
    document.documentElement.setAttribute('data-theme', tema);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = tema === 'dark' ? '#0f172a' : '#FFF4E4';
    toast.info(`Tema ${tema === 'dark' ? 'oscuro' : 'claro'} activado.`);
  });

  container.querySelector('#btn-back').addEventListener('click', navegarAtras);
  container.querySelector('#btn-productos').addEventListener('click', () => navegar('productos'));

  // ── Exportar Datos (CSV) ──────────────────────────────────
  container.querySelector('#btn-exportar').addEventListener('click', _abrirModalExportar);

  // ── Exportar Respaldo Completo (JSON) ─────────────────────
  container.querySelector('#btn-respaldo').addEventListener('click', _abrirModalRespaldo);

  // ── Importar Respaldo ─────────────────────────────────────
  const inputImportar = container.querySelector('#input-importar');
  container.querySelector('#btn-importar').addEventListener('click', () => inputImportar.click());
  inputImportar.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    inputImportar.value = '';
    if (file) _manejarImportarRespaldo(file);
  });

  // ── Configurar Telegram ───────────────────────────────────
  container.querySelector('#btn-config-telegram').addEventListener('click', () => {
    _abrirModalTelegram(container);
  });
}

// ══════════════════════════════════════════════════════════
// TELEGRAM — CONFIGURACIÓN Y ENVÍO
// ══════════════════════════════════════════════════════════

function _abrirModalTelegram(container) {
  const config = store.getState().config || {};
  const cerrar = modal.abrir({
    titulo: 'Respaldo a Telegram',
    contenido: `
      <p class="text-sm text-muted" style="margin-bottom: var(--space-3);">
        El Worker proxy reenvía el respaldo a tu Telegram. El token nunca sale del servidor.
      </p>
      <div class="form-group">
        <label class="form-label" for="tg-worker-url">URL del Worker</label>
        <input id="tg-worker-url" type="text" class="form-input"
               value="${esc(config.telegramWorkerUrl ?? '')}"
               placeholder="https://tu-worker.workers.dev" autocomplete="off">
      </div>
      <div class="form-group" style="margin-top: var(--space-3);">
        <label class="form-label" for="tg-chat-id">Chat ID <span class="text-muted">(opcional)</span></label>
        <input id="tg-chat-id" type="text" class="form-input"
               value="${esc(config.telegramChatId ?? '')}"
               placeholder="123456789" autocomplete="off">
      </div>
    `,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      { texto: 'Guardar', clase: 'btn-primary', accion: () => {
        const workerUrl = document.getElementById('tg-worker-url')?.value.trim();
        const chatId    = document.getElementById('tg-chat-id')?.value.trim();
        if (!workerUrl) {
          toast.error('Ingresa la URL del Worker de Telegram.');
          return;
        }
        guardarConfig({ telegramWorkerUrl: workerUrl, telegramChatId: chatId || null });
        toast.success('Telegram configurado.');
        cerrar();
        const btn = container.querySelector('#btn-config-telegram');
        if (btn) btn.textContent = '📲 Telegram: Configurado ✓';
      }},
    ],
  });
}

function _abrirModalRespaldo() {
  const teleConfigurado = !!(store.getState().config?.telegramWorkerUrl);
  const cerrar = modal.abrir({
    titulo: 'Exportar Respaldo Completo',
    contenido: `<p class="text-sm text-muted">¿Cómo querés exportar el respaldo?</p>`,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      { texto: '📤 Compartir/Descargar', clase: 'btn-secondary', accion: async () => {
        cerrar();
        try {
          const resultado = await exportarRespaldoJSON();
          if (resultado?.cancelado) return;
          toast.success('Respaldo generado y listo para compartir.');
        } catch (e) {
          console.error('[Config] Error al exportar respaldo:', e);
          toast.error('No se pudo generar el respaldo.');
        }
      }},
      { texto: '📲 Enviar a Telegram', clase: 'btn-primary', accion: async () => {
        if (!teleConfigurado) {
          toast.error('Configurá Telegram primero (Configuración → Telegram).');
          return;
        }
        cerrar();
        try {
          const resultado = await enviarRespaldoTelegram();
          if (resultado.ok) {
            toast.success('Respaldo enviado a Telegram.');
          } else {
            toast.error(_mensajeErrorTelegram(resultado.error, resultado.description));
          }
        } catch (e) {
          console.error('[Config] Error al enviar respaldo a Telegram:', e);
          toast.error('Error al enviar el respaldo a Telegram.');
        }
      }},
    ],
  });
}

// ══════════════════════════════════════════════════════════
// EXPORTACIÓN CSV
// ══════════════════════════════════════════════════════════

function _abrirModalExportar() {
  const cerrar = modal.abrir({
    titulo: 'Exportar Datos (CSV)',
    contenido: `
      <div class="form-group">
        <label class="form-label" for="export-periodo">Período</label>
        <select id="export-periodo" class="form-select">
          <option value="dia">Hoy</option>
          <option value="semana">Esta semana</option>
          <option value="mes" selected>Este mes</option>
          <option value="anio">Este año</option>
        </select>
      </div>
      <div class="form-group" style="margin-top: var(--space-3);">
        <label class="form-label" for="export-destino">Destino</label>
        <select id="export-destino" class="form-select">
          <option value="compartir" selected>📤 Compartir / Descargar</option>
          <option value="telegram">📲 Enviar a Telegram</option>
        </select>
      </div>
      <p class="text-sm text-muted">
        Se generará un archivo CSV compatible con Excel y Google Sheets.
      </p>
    `,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      { texto: '📊 Exportar Ventas', clase: 'btn-primary', accion: () => _exportar('ventas', cerrar) },
      { texto: '💸 Exportar Gastos', clase: 'btn-secondary', accion: () => _exportar('gastos', cerrar) },
    ],
  });
}

async function _exportar(tipo, cerrar) {
  const periodo = document.getElementById('export-periodo')?.value || 'mes';
  const destino = document.getElementById('export-destino')?.value || 'compartir';

  // ── Envío por Telegram ────────────────────────────────────
  if (destino === 'telegram') {
    if (!(store.getState().config?.telegramWorkerUrl)) {
      toast.error('Configurá Telegram primero (Configuración → Telegram).');
      return;
    }
    const resultado = await enviarCSVTelegram(tipo, periodo);
    if (resultado.vacio) {
      toast.info('No hay datos para exportar en este período.');
      return;
    }
    if (resultado.ok) {
      cerrar();
      toast.success('Exportado a Telegram.');
    } else {
      toast.error(_mensajeErrorTelegram(resultado.error, resultado.description));
    }
    return;
  }

  // ── Compartir / Descargar (como hasta ahora) ──────────────
  const resultado = await exportarCSV(tipo, periodo);
  if (resultado.vacio) {
    toast.info('No hay datos para exportar en este período.');
    return;
  }
  if (resultado.cancelado) return;

  cerrar();
  const etiqueta = tipo === 'ventas' ? 'Ventas' : 'Gastos';
  toast.success(`${etiqueta} exportado${resultado.registros ? ` (${resultado.registros} registros)` : ''}.`);
}

// ══════════════════════════════════════════════════════════
// IMPORTACIÓN DE RESPALDO
// ══════════════════════════════════════════════════════════

/**
 * Traduce un código de error del Worker/Telegram a un mensaje claro.
 */
function _mensajeErrorTelegram(error, description) {
  if (error === 'telegram_error' && description) {
    return `Telegram rechazó el envío: ${description}`;
  }
  const mensajes = {
    sin_worker_url:      'Falta la URL del Worker.',
    bot_token_missing:   'El Worker no tiene el token del bot (TELEGRAM_BOT_TOKEN).',
    chat_id_missing:     'Falta el Chat ID. Ponelo en Configuración o en el Worker (TELEGRAM_CHAT_ID).',
    document_missing:    'Error interno: no se generó el archivo de respaldo.',
    unauthorized:        'El Worker rechazó la solicitud (API key inválida).',
    not_found:           'La URL del Worker no responde en /backup. Revisá que sea la URL base.',
    method_not_allowed:  'El Worker no acepta el método POST.',
    telegram_unreachable: 'El Worker no pudo contactar a Telegram.',
    sin_conexion:        'Sin conexión. Conectate a internet e intentá de nuevo.',
  };
  return mensajes[error] || description || `Error: ${error || 'desconocido'}`;
}

async function _manejarImportarRespaldo(file) {
  let data;
  try {
    const texto = await file.text();
    try {
      data = JSON.parse(texto);
    } catch {
      toast.error('El archivo seleccionado no es un JSON válido.');
      return;
    }
  } catch (e) {
    console.error('[Config] Error al leer el archivo de respaldo:', e);
    toast.error('No se pudo leer el archivo seleccionado.');
    return;
  }

  const validacion = validarRespaldo(data);
  if (!validacion.valido) {
    toast.error(validacion.error);
    return;
  }

  const r = validacion.resumen;
  const cerrar = modal.abrir({
    titulo: 'Importar Respaldo',
    contenido: `
      <p class="text-sm text-muted">El respaldo contiene:</p>
      <div class="cobro-summary" style="margin-top: var(--space-2);">
        <div class="cobro-item-row"><span>Productos</span><span>${r.productos}</span></div>
        <div class="cobro-item-row"><span>Insumos</span><span>${r.insumos}</span></div>
        <div class="cobro-item-row"><span>Ventas</span><span>${r.ventas}</span></div>
        <div class="cobro-item-row"><span>Gastos</span><span>${r.costos}</span></div>
        <div class="cobro-item-row"><span>Producciones</span><span>${r.producciones}</span></div>
        <div class="cobro-item-row"><span>Recetas</span><span>${r.recetas}</span></div>
        <div class="cobro-item-row"><span>Perfiles</span><span>${r.perfiles}</span></div>
        <div class="cobro-item-row"><span>Configuración (nombre/logo/tema)</span><span>${r.incluyeConfig ? 'Sí' : 'No'}</span></div>
      </div>
      ${r.incluyeConfig ? '' : `
      <p class="text-sm" style="color: var(--color-warning, #b45309); margin-top: var(--space-2);">
        Este respaldo es de una versión anterior: no incluye el nombre, logo ni tema,
        que deberás configurar manualmente.
      </p>`}
      <p class="text-sm" style="color: var(--color-danger); margin-top: var(--space-3);">
        ⚠️ Se reemplazarán los datos actuales de este dispositivo.
      </p>
    `,
    botones: [
      { texto: 'Cancelar', clase: 'btn-ghost', accion: () => cerrar() },
      {
        texto: 'Restaurar',
        clase: 'btn-danger',
        accion: async () => {
          try {
            await restaurarRespaldo(data);
            cerrar();
            toast.success('Respaldo restaurado. Recargando la app…');
            // Recargar para que el estado en memoria (store) refleje
            // los datos y la configuración restaurados.
            setTimeout(() => location.reload(), 900);
          } catch (e) {
            console.error('[Config] Error al restaurar respaldo:', e);
            toast.error('No se pudo restaurar el respaldo.');
          }
        },
      },
    ],
  });
}
