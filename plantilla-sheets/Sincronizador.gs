/**
 * Sincronizador.gs — Receptor de datos de TamalitosAPP para la plantilla de Google Sheets
 *
 * Requiere haber ejecutado antes `crearPlantilla()` de CrearPlantilla.gs.
 *
 * Puesta en marcha (una sola vez):
 *  1. Pega este archivo en el mismo proyecto de Apps Script.
 *  2. En Configuración del proyecto → Propiedades de la secuencia de comandos, agrega:
 *       SYNC_TOKEN = <una cadena larga y secreta, por ejemplo 40 caracteres al azar>
 *  3. Implementar → Nueva implementación → Tipo: Aplicación web.
 *       Ejecutar como: Yo
 *       Quién tiene acceso: Cualquier persona
 *     Copia la URL que termina en /exec y pégala en la app junto con el token.
 *
 * Contrato del cuerpo (JSON):
 *   {
 *     "token": "...",
 *     "origen": "TamalitosAPP",
 *     "version": "4.0.0",
 *     "dispositivo": "dev_...",
 *     "hojas": { "Ventas": [ { "venta_id": "...", ... }, ... ], ... }
 *   }
 *
 * Idempotente: cada fila se identifica por su primera columna (id). Si el id ya existe se
 * reescribe esa fila; si no, se agrega al final. Repetir el mismo envío no duplica nada.
 */

const LIMITE_FILAS_POR_ENVIO = 20000;
const COLUMNA_ID = 1;

function doPost(e) {
  try {
    const cuerpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const esperado = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');

    if (!esperado) {
      return _respuesta({ ok: false, error: 'token_no_configurado' });
    }
    if (String(cuerpo.token || '') !== esperado) {
      return _respuesta({ ok: false, error: 'no_autorizado' });
    }
    if (!cuerpo.hojas || typeof cuerpo.hojas !== 'object') {
      return _respuesta({ ok: false, error: 'payload_invalido' });
    }

    const libro = _libro();
    const resultado = { ok: true, hojas: {}, totalInsertados: 0, totalActualizados: 0 };

    Object.keys(cuerpo.hojas).forEach(nombre => {
      const filas = cuerpo.hojas[nombre];
      if (!Array.isArray(filas) || filas.length === 0) return;
      if (filas.length > LIMITE_FILAS_POR_ENVIO) {
        throw new Error(`La hoja ${nombre} excede ${LIMITE_FILAS_POR_ENVIO} filas en un envío`);
      }
      resultado.hojas[nombre] = _upsertHoja(libro, nombre, filas);
      resultado.totalInsertados += resultado.hojas[nombre].insertados;
      resultado.totalActualizados += resultado.hojas[nombre].actualizados;
    });

    _marcarSync(libro, cuerpo, resultado);
    return _respuesta(resultado);
  } catch (error) {
    return _respuesta({ ok: false, error: 'fallo', detalle: String(error && error.message || error) });
  }
}

/** GET de diagnóstico: dice si el token está configurado y qué encabezados ve. */
function doGet() {
  const token = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  return _respuesta({
    ok: true,
    servicio: 'tamalitos-sheets-sync',
    tokenConfigurado: !!token,
    hojas: firmaDeHojas(),
  });
}

/**
 * Escribe las filas en la hoja haciendo upsert por la columna A.
 * @returns {{insertados: number, actualizados: number}}
 */
function _upsertHoja(libro, nombre, filas) {
  const hoja = libro.getSheetByName(nombre);
  if (!hoja) throw new Error(`No existe la hoja ${nombre} en la plantilla`);

  _aflojarValidacion(hoja);

  const encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const ancho = encabezados.length;

  // Valida el contrato: cada fila trae campos que existen como columna.
  filas.forEach((fila, i) => {
    Object.keys(fila).forEach(campo => {
      if (encabezados.indexOf(campo) === -1) {
        throw new Error(`La hoja ${nombre} no tiene la columna "${campo}" (fila ${i + 1})`);
      }
    });
  });

  // Lee la hoja completa una sola vez y trabaja en memoria.
  const ultimaFila = Math.max(hoja.getLastRow(), 1);
  const actuales = ultimaFila > 1
    ? hoja.getRange(2, 1, ultimaFila - 1, ancho).getValues()
    : [];

  const indicePorId = {};
  actuales.forEach((fila, i) => {
    const id = String(fila[0]);
    if (id) indicePorId[id] = i;
  });

  let insertados = 0;
  let actualizados = 0;
  const nuevas = [];

  filas.forEach(obj => {
    const id = String(obj[encabezados[0]] ?? '');
    if (!id) return; // sin id no se puede hacer upsert: se ignora en lugar de duplicar
    const valores = encabezados.map(col => {
      const v = obj[col];
      return v === undefined || v === null ? '' : v;
    });

    if (Object.prototype.hasOwnProperty.call(indicePorId, id)) {
      actuales[indicePorId[id]] = valores;
      actualizados++;
    } else {
      nuevas.push(valores);
      indicePorId[id] = actuales.length + nuevas.length - 1;
      insertados++;
    }
  });

  const salida = actuales.concat(nuevas);
  if (salida.length > 0) {
    hoja.getRange(2, 1, salida.length, ancho).setValues(salida);
  }

  return { insertados, actualizados };
}

function _marcarSync(libro, cuerpo, resultado) {
  const hoja = libro.getSheetByName('_Sync');
  if (!hoja) return;

  const filas = [
    ['ultima_sync', new Date().toISOString()],
    ['dispositivo', cuerpo.dispositivo || ''],
    ['version_app', cuerpo.version || ''],
    ['origen', cuerpo.origen || ''],
    ['hojas_enviadas', Object.keys(cuerpo.hojas || {}).length],
    ['filas_insertadas', resultado.totalInsertados],
    ['filas_actualizadas', resultado.totalActualizados],
  ];

  // Reescribe el bloque completo: primero limpia lo viejo, luego escribe.
  hoja.getRange(2, 1, Math.max(hoja.getLastRow() - 1, 1), 2).clearContent();
  hoja.getRange(2, 1, filas.length, 2).setValues(filas);
}

function _libro() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Falta SPREADSHEET_ID: ejecuta crearPlantilla() primero');
  return SpreadsheetApp.openById(id);
}

/**
 * Afloja las reglas de validación antes de escribir.
 * Las listas quedan como ayuda visual, pero un envío del script nunca debe fallar
 * porque un valor no está en la lista (por ejemplo origen/destino vacíos en caja).
 */
function _aflojarValidacion(hoja) {
  const ancho = hoja.getLastColumn();
  if (ancho < 1) return;
  const reglas = hoja.getRange(2, 1, Math.max(hoja.getMaxRows() - 1, 1), ancho).getDataValidations();
  let cambiado = false;
  const nuevas = reglas.map(fila => fila.map(regla => {
    if (regla && !regla.getAllowInvalid()) {
      cambiado = true;
      return regla.copy().setAllowInvalid(true).build();
    }
    return regla;
  }));
  if (cambiado) {
    hoja.getRange(2, 1, nuevas.length, ancho).setDataValidations(nuevas);
  }
}

function _respuesta(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
