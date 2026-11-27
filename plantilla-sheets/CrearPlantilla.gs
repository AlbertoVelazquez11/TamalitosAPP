/**
 * CrearPlantilla.gs — Plantilla de Google Sheets para TamalitosAPP
 *
 * Uso: abre una hoja de cálculo nueva (o una existente) → Extensiones → Apps Script,
 * pega este archivo, guarda y ejecuta `crearPlantilla`. La primera vez pedirá permisos.
 *
 * Reglas de diseño (no las rompas al agregar columnas):
 *  - Una fila = un hecho. Nunca filas de totales ni filas en blanco dentro de las hojas de datos.
 *  - Las columnas se identifican por su encabezado, no por su posición: agrega columnas nuevas
 *    al final, nunca en medio.
 *  - Las hojas de datos no se editan a mano; se escriben desde la app. Si algo está mal,
 *    se corrige en la app y se vuelve a sincronizar.
 *  - Los IDs y las fechas van como texto (`venta_1764...`, `2026-11-27`) para que Sheets no
 *    los convierta a número ni a fecha con hora.
 *  - Los montos van como número puro, sin $ ni comas; el formato se aplica a la columna.
 *  - Los booleanos van como 1/0 para que SUMIFS y las tablas dinámicas funcionen.
 */

const HOJAS = {
  Ventas: {
    encabezados: ['venta_id', 'fecha', 'hora', 'perfil', 'tipo', 'estado_pago', 'cliente',
                  'subtotal', 'descuento', 'total', 'estado', 'motivo_cancelacion',
                  'motivo_no_ingreso', 'creado_en'],
    tipos: { fecha: 'texto', hora: 'texto', subtotal: 'moneda', descuento: 'moneda', total: 'moneda' },
    validacion: { tipo: ['venta', 'noIngreso'], estado_pago: ['pagada', 'pendiente'], estado: ['cobrada', 'cancelada'] },
  },
  Ventas_Lineas: {
    encabezados: ['linea_id', 'venta_id', 'fecha', 'producto_id', 'producto', 'cantidad',
                  'precio_unitario', 'subtotal_linea'],
    tipos: { fecha: 'texto', cantidad: 'numero', precio_unitario: 'moneda', subtotal_linea: 'moneda' },
  },
  Productos: {
    encabezados: ['producto_id', 'nombre', 'precio', 'stock', 'activo', 'orden', 'actualizado_en'],
    tipos: { precio: 'moneda', stock: 'numero', activo: 'entero' },
  },
  Perfiles: {
    encabezados: ['perfil_id', 'nombre', 'creado_en', 'actualizado_en'],
    tipos: {},
  },
  Insumos: {
    encabezados: ['insumo_id', 'nombre', 'stock', 'costo_unitario', 'actualizado_en'],
    tipos: { stock: 'numero', costo_unitario: 'moneda' },
  },
  Costos: {
    encabezados: ['costo_id', 'fecha', 'categoria', 'insumo_id', 'concepto', 'monto', 'fuente',
                  'cantidad', 'creado_en'],
    tipos: { fecha: 'texto', monto: 'moneda', cantidad: 'numero' },
    validacion: { fuente: ['caja', 'fondo'] },
  },
  Producciones: {
    encabezados: ['produccion_id', 'fecha', 'producto_id', 'producto', 'cantidad', 'costo_total', 'creado_en'],
    tipos: { fecha: 'texto', cantidad: 'numero', costo_total: 'moneda' },
  },
  Clientes: {
    encabezados: ['cliente_id', 'nombre', 'descripcion', 'domicilio', 'notas', 'creado_en'],
    tipos: {},
  },
  Pedidos: {
    encabezados: ['pedido_id', 'cliente_id', 'cliente', 'fecha_entrega', 'total', 'anticipo',
                  'descuento', 'estado', 'nota', 'creado_en'],
    tipos: { fecha_entrega: 'texto', total: 'moneda', anticipo: 'moneda', descuento: 'moneda' },
    validacion: { estado: ['solicitado', 'anticipo', 'entregado', 'cancelado'] },
  },
  Pedidos_Lineas: {
    encabezados: ['linea_id', 'pedido_id', 'producto_id', 'producto', 'cantidad', 'precio_unitario', 'subtotal_linea'],
    tipos: { cantidad: 'numero', precio_unitario: 'moneda', subtotal_linea: 'moneda' },
  },
  Caja_Movimientos: {
    encabezados: ['movimiento_id', 'fecha', 'tipo', 'monto', 'origen', 'destino', 'concepto', 'ref_id', 'creado_en'],
    tipos: { fecha: 'texto', monto: 'moneda' },
    validacion: { origen: ['caja', 'fondo'], destino: ['caja', 'fondo'] },
  },
  _Sync: {
    encabezados: ['campo', 'valor'],
    tipos: {},
  },
};

const NOTAS_LEEME = [
  ['TamalitosAPP — plantilla de Google Sheets'],
  [''],
  ['Qué es esto:'],
  ['  Las hojas con datos (Ventas, Ventas_Lineas, Costos, etc.) las escribe la app. No las edites a mano:'],
  ['  si un dato está mal, corrígelo en la app y vuelve a sincronizar.'],
  [''],
  ['Cómo se leen los datos:'],
  ['  Ventas — una fila por venta (cabecera). Aquí sumas dinero: total, descuento, subtotal.'],
  ['  Ventas_Lineas — una fila por producto vendido. Aquí sacas "qué se vende más" y "cuántas piezas".'],
  ['  No sumes total en Ventas_Lineas: repite la venta en cada línea y multiplicaría el resultado.'],
  ['  Caja_Movimientos — el libro de la caja: ventas, gastos y ajustes.'],
  [''],
  ['Hojas pendientes (vacías a propósito):'],
  ['  Costos y Producciones existen pero la app todavía no registra esos datos completos,'],
  ['  así que no se envían. El Tablero tampoco calcula gastos ni utilidad por eso.'],
  [''],
  ['Reglas para que el sync no rompa nada:'],
  ['  · No insertes ni reordenes columnas: agrega las nuevas al final.'],
  ['  · No metas filas de totales ni filas vacías en medio de una hoja de datos.'],
  ['  · No combines celdas ni uses dos filas de encabezado.'],
  ['  · Una fila = un hecho, con su id en la primera columna.'],
  [''],
  ['El Tablero se calcula solo con fórmulas; no escribas ahí.'],
];

function crearPlantilla() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SPREADSHEET_ID');
  let libro;

  if (id) {
    libro = SpreadsheetApp.openById(id);
  } else {
    libro = SpreadsheetApp.create('TamalitosAPP — Datos');
    props.setProperty('SPREADSHEET_ID', libro.getId());
  }

  _hojaLeeme(libro);
  Object.keys(HOJAS).forEach(nombre => _hojaDatos(libro, nombre, HOJAS[nombre]));
  _hojaTablero(libro);

  // Deja las hojas de datos en el orden lógico y el LEEME primero.
  const orden = ['LEEME', 'Tablero'].concat(Object.keys(HOJAS));
  orden.forEach((nombre, i) => {
    const hoja = libro.getSheetByName(nombre);
    if (hoja) { libro.setActiveSheet(hoja); libro.moveActiveSheet(i + 1); }
  });

  const primera = libro.getSheetByName('Sheet1') || libro.getSheetByName('Hoja 1');
  if (primera && libro.getNumSheets() > 1) {
    try { libro.deleteSheet(primera); } catch (e) { /* la hoja por defecto se queda */ }
  }

  Logger.log('Plantilla lista: ' + libro.getUrl());
  return libro.getUrl();
}

function _hojaLeeme(libro) {
  const hoja = libro.getSheetByName('LEEME') || libro.insertSheet('LEEME');
  hoja.clear();
  hoja.getRange(1, 1, NOTAS_LEEME.length, 1).setValues(NOTAS_LEEME);
  hoja.getRange('A1').setFontWeight('bold').setFontSize(14);
  hoja.setColumnWidth(1, 720);
  hoja.getRange(1, 1, NOTAS_LEEME.length, 1).setWrap(true).setVerticalAlignment('top');
  hoja.setHiddenGridlines(true);
}

function _hojaDatos(libro, nombre, def) {
  const hoja = libro.getSheetByName(nombre) || libro.insertSheet(nombre);
  const ancho = def.encabezados.length;

  const vacia = hoja.getLastRow() <= 1;
  const actuales = hoja.getLastColumn() > 0
    ? hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(String)
    : [];

  if (vacia) {
    hoja.getRange(1, 1, 1, ancho).setValues([def.encabezados]);
  } else if (actuales.join('|') !== def.encabezados.join('|')) {
    Logger.log(`⚠ ${nombre}: los encabezados de la plantilla cambiaron pero la hoja tiene datos. No se tocó nada; revisa a mano.`);
  }

  const encabezado = hoja.getRange(1, 1, 1, ancho);
  encabezado
    .setFontWeight('bold')
    .setBackground('#1f2937')
    .setFontColor('#ffffff')
    .setVerticalAlignment('middle');
  hoja.setFrozenRows(1);

  // Formatos por columna: se aplican a toda la columna, no sólo a las filas de hoy.
  def.encabezados.forEach((col, i) => {
    const rango = hoja.getRange(2, i + 1, hoja.getMaxRows() - 1, 1);
    const tipo = (def.tipos && def.tipos[col]) || null;
    if (tipo === 'moneda') rango.setNumberFormat('"$"#,##0.00');
    else if (tipo === 'numero') rango.setNumberFormat('#,##0.###');
    else if (tipo === 'entero') rango.setNumberFormat('0');
    else rango.setNumberFormat('@'); // texto: ids, fechas ISO, horas
  });

  // Validación de listas: evita que un typo rompa las tablas dinámicas.
  if (def.validacion) {
    Object.keys(def.validacion).forEach(col => {
      const i = def.encabezados.indexOf(col);
      if (i < 0) return;
      // Las hojas de datos las escribe la app: la lista es una ayuda, no una reja.
      const regla = SpreadsheetApp.newDataValidation()
        .requireValueInList(def.validacion[col], true)
        .setAllowInvalid(true)
        .build();
      hoja.getRange(2, i + 1, hoja.getMaxRows() - 1, 1).setDataValidation(regla);
    });
  }

  // Idempotente: una hoja no puede tener dos filtros, y re-ejecutar es normal.
  // Si el filtro viejo no cubre las columnas nuevas, se rehace.
  const filtro = hoja.getFilter();
  if (filtro && filtro.getRange().getNumColumns() !== ancho) {
    filtro.remove();
  }
  if (!hoja.getFilter()) {
    hoja.getRange(1, 1, 1, ancho).createFilter();
  }
  return hoja;
}

function _hojaTablero(libro) {
  const hoja = libro.getSheetByName('Tablero') || libro.insertSheet('Tablero');
  hoja.clear();

  hoja.getRange('A1').setValue('Tablero').setFontWeight('bold').setFontSize(14);
  hoja.getRange('A2').setValue('Se calcula solo con fórmulas sobre las hojas de datos. No escribas aquí.');

  const hoyISO   = 'TEXT(TODAY(),"yyyy-mm-dd")';
  const mesDesde = 'TEXT(EOMONTH(TODAY(),-1)+1,"yyyy-mm-dd")';
  const mesHasta = 'TEXT(EOMONTH(TODAY(),0),"yyyy-mm-dd")';

  // [etiqueta, fórmula, formato] — el número de fila se calcula al escribir.
  const filas = [
    ['Hoy',                          `=TODAY()`, 'fecha'],
    ['Ventas de hoy (piezas)',       `=SUMIFS(Ventas_Lineas!F:F, Ventas_Lineas!C:C, ${hoyISO})`, 'entero'],
    ['Ingreso de hoy',               `=SUMIFS(Ventas!J:J, Ventas!B:B, ${hoyISO}, Ventas!K:K, "cobrada")`, 'moneda'],
    // Gastos y utilidad quedan fuera a propósito: la app no registró costos completos.
    ['Nota: gastos y utilidad',      'Pendientes — la app aún no registra costos completos', 'texto'],
    ['',                             '', 'texto'],
    ['Ingreso del mes',              `=SUMIFS(Ventas!J:J, Ventas!B:B, ">="&${mesDesde}, Ventas!B:B, "<="&${mesHasta}, Ventas!K:K, "cobrada")`, 'moneda'],

    ['Ticket promedio del mes',      null, 'moneda'],
    ['',                             '', 'texto'],
    ['Fiado pendiente',              `=SUMIFS(Ventas!J:J, Ventas!F:F, "pendiente", Ventas!K:K, "cobrada")`, 'moneda'],
    ['Pedidos por entregar',         '=COUNTIFS(Pedidos!H:H,"solicitado")+COUNTIFS(Pedidos!H:H,"anticipo")', 'entero'],
    ['Anticipos cobrados',           '=SUMIFS(Pedidos!F:F, Pedidos!H:H,"solicitado")+SUMIFS(Pedidos!F:F, Pedidos!H:H,"anticipo")', 'moneda'],
    ['',                             '', 'texto'],
    ['Movimientos de caja registrados', '=COUNTA(Caja_Movimientos!A:A)-1', 'entero'],
    ['Última sincronización',        '=IFERROR(VLOOKUP("ultima_sync", _Sync!A:B, 2, FALSE), "sin sincronizar")', 'texto'],
  ];

  const base = 4; // A4 en adelante
  const etiquetas = filas.map(([etiqueta, formula]) => [etiqueta, formula]);
  hoja.getRange(base, 1, filas.length, 2).setValues(etiquetas);
  hoja.getRange(base, 1, filas.length, 1).setFontWeight('bold');

  // Las dos fórmulas derivadas se arman sabiendo su propia fila.
  const filaDe = (etiqueta) => base + filas.findIndex(f => f[0] === etiqueta);
  hoja.getRange(filaDe('Ticket promedio del mes'), 2)
    .setFormula(`=IFERROR(B${filaDe('Ingreso del mes')}/COUNTIFS(Ventas!B:B,">="&${mesDesde},Ventas!B:B,"<="&${mesHasta},Ventas!K:K,"cobrada"),0)`);

  filas.forEach(([, , fmt], i) => {
    const celda = hoja.getRange(base + i, 2);
    if (fmt === 'moneda') celda.setNumberFormat('"$"#,##0.00');
    else if (fmt === 'entero') celda.setNumberFormat('#,##0');
    else if (fmt === 'fecha') celda.setNumberFormat('yyyy-mm-dd');
    else celda.setNumberFormat('@');
  });

  // Ventas por perfil: tabla dinámica sin mantenimiento, se expande sola.
  const filaPerfiles = base + filas.length + 1;
  hoja.getRange(filaPerfiles, 1).setValue('Ventas por perfil (sólo cobradas)').setFontWeight('bold');
  hoja.getRange(filaPerfiles + 1, 1).setFormula(
    `=IFERROR(QUERY(Ventas!D2:K, "select A, sum(G) where H = 'cobrada' group by A label sum(G) 'Total'", 0), "sin ventas")`
  );

  hoja.setColumnWidth(1, 260);
  hoja.setColumnWidth(2, 220);
  hoja.setHiddenGridlines(true);
  return hoja;
}

/**
 * Revisa el Tablero y escribe en el registro qué fórmula hay en cada celda y qué valor
 * muestra. Sirve para compartir los errores sin adivinar: Ejecutar → revisarTablero →
 * Ver → Registros (Ctrl+Enter) → copiar todo.
 */
function revisarTablero() {
  const libro = _libroParaDiagnostico();
  const hoja = libro.getSheetByName('Tablero');
  if (!hoja) { Logger.log('No existe la hoja Tablero'); return; }

  const ultima = Math.max(hoja.getLastRow(), 2);
  const formulas = hoja.getRange(2, 1, ultima - 1, 2).getFormulas();
  const valores  = hoja.getRange(2, 1, ultima - 1, 2).getDisplayValues();
  const errores  = hoja.getRange(2, 1, ultima - 1, 2).getValues();

  let conError = 0;
  for (let i = 0; i < formulas.length; i++) {
    const etiqueta = valores[i][0];
    const formula  = formulas[i][1];
    const mostrado = valores[i][1];
    const crudo    = errores[i][1];
    const esError  = typeof crudo === 'string' && crudo.charAt(0) === '#';
    if (esError) conError++;
    if (!formula && !etiqueta) continue;
    Logger.log([etiqueta || '(vacío)', esError ? 'ERROR' : 'ok', mostrado, formula || '(sin fórmula)'].join(' | '));
  }
  Logger.log(`Celdas con error: ${conError}`);
}

/**
 * Escribe el estado de cada fórmula del Tablero en una pestaña "Diagnóstico".
 * Es lo más fácil de compartir: abres la pestaña, copias o tomas captura y listo.
 */
function diagnosticoEnHoja() {
  const libro = _libroParaDiagnostico();
  const tablero = libro.getSheetByName('Tablero');
  if (!tablero) { throw new Error('No existe la hoja Tablero. Ejecuta crearPlantilla() primero.'); }

  let hoja = libro.getSheetByName('Diagnóstico') || libro.insertSheet('Diagnóstico');
  hoja.clear();

  const ultima = Math.max(tablero.getLastRow(), 2);
  const formulas = tablero.getRange(2, 1, ultima - 1, 2).getFormulas();
  const valores  = tablero.getRange(2, 1, ultima - 1, 2).getDisplayValues();
  const crudos   = tablero.getRange(2, 1, ultima - 1, 2).getValues();

  const filas = [['Etiqueta', 'Estado', 'Valor que muestra', 'Fórmula']];
  let conError = 0;

  for (let i = 0; i < formulas.length; i++) {
    const etiqueta = valores[i][0];
    const formula  = formulas[i][1];
    if (!etiqueta && !formula) continue;
    const crudo    = crudos[i][1];
    const esError  = typeof crudo === 'string' && crudo.charAt(0) === '#';
    if (esError) conError++;
    filas.push([etiqueta, esError ? 'ERROR' : 'ok', valores[i][1], formula || '(sin fórmula)']);
  }

  filas.push([]);
  filas.push(['Celdas con error', conError, '', '']);
  filas.push(['Revisado en', new Date().toISOString(), '', '']);

  hoja.getRange(1, 1, filas.length, 4).setValues(filas);
  hoja.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1f2937').setFontColor('#ffffff');
  hoja.getRange(2, 2, filas.length - 1, 1).setFontWeight('bold');
  hoja.setColumnWidth(1, 260);
  hoja.setColumnWidth(2, 90);
  hoja.setColumnWidth(3, 200);
  hoja.setColumnWidth(4, 420);
  hoja.setFrozenRows(1);

  Logger.log('Diagnóstico escrito en la pestaña "Diagnóstico". Errores: ' + conError);
  return 'Diagnóstico listo. Errores: ' + conError;
}

function _libroParaDiagnostico() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Firma de las hojas: el sincronizador la compara antes de escribir y aborta si
 * alguien movió o renombró columnas. Devuelve { hoja: [encabezados...] }.
 */
function firmaDeHojas() {
  const libro = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  const firma = {};
  Object.keys(HOJAS).forEach(nombre => {
    const hoja = libro.getSheetByName(nombre);
    if (!hoja) { firma[nombre] = null; return; }
    const ancho = HOJAS[nombre].encabezados.length;
    firma[nombre] = hoja.getRange(1, 1, 1, ancho).getValues()[0];
  });
  return firma;
}
