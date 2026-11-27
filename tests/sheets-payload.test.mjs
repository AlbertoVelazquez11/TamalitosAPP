import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOJAS,
  filasDeVentas,
  filasDeLineas,
  filasDeProductos,
  filasDeCostos,
  filasDePedidos,
  filasDePedidosLineas,
  filasDeCaja,
  construirPayload,
  validarPayload,
} from '../Codigo/js/sheets.js';

const VENTA = {
  id: 'venta_1',
  fecha: '2026-11-27',
  hora: '09:14:22',
  subtotal: 120,
  descuento: 0,
  total: 120,
  tipo: 'venta',
  estadoPago: 'pagada',
  perfilNombre: 'General',
  estado: 'activa',
  creadoEn: '2026-11-27T15:14:22.000Z',
};

const DETALLE = {
  id: 'det_venta_1_0',
  ventaId: 'venta_1',
  productoId: 'prod_1',
  nombreProducto: 'Tamal verde',
  cantidad: 6,
  precioUnitario: 20,
  subtotalLinea: 120,
};

test('cada hoja del payload tiene las mismas columnas que la plantilla', () => {
  const esperado = {
    Ventas: 13, Ventas_Lineas: 8, Productos: 7, Insumos: 5, Costos: 9, Producciones: 7,
    Clientes: 6, Pedidos: 10, Pedidos_Lineas: 7, Caja_Movimientos: 9,
  };
  for (const [hoja, largo] of Object.entries(esperado)) {
    assert.equal(HOJAS[hoja].length, largo, `la hoja ${hoja} cambió de ancho`);
  }
});

test('una venta produce una fila con la primera columna como id', () => {
  const [fila] = filasDeVentas([VENTA]);
  assert.equal(HOJAS.Ventas[0], 'venta_id');
  assert.equal(fila.venta_id, 'venta_1');
  assert.equal(fila.fecha, '2026-11-27');
  assert.equal(fila.total, 120);
  assert.equal(fila.estado_pago, 'pagada');
});

test('las líneas repiten la fecha de su venta para no necesitar BUSCARV', () => {
  const [fila] = filasDeLineas([DETALLE], [VENTA]);
  assert.equal(fila.fecha, '2026-11-27');
  assert.equal(fila.subtotal_linea, 120);
});

test('una línea sin venta conocida queda con fecha vacía, no con undefined', () => {
  const [fila] = filasDeLineas([{ ...DETALLE, ventaId: 'no_existe' }], [VENTA]);
  assert.equal(fila.fecha, '');
});

test('los montos siempre son números y los textos siempre cadenas', () => {
  const [fila] = filasDeCostos([{ id: 'c1', fecha: '2026-11-27', monto: '185.50', categoria: 'Insumos' }]);
  assert.equal(typeof fila.monto, 'number');
  assert.equal(fila.monto, 185.5);
  assert.equal(typeof fila.concepto, 'string');
  assert.equal(fila.concepto, '');
});

test('activo se escribe como 1 o 0 para que SUMIFS funcione', () => {
  const filas = filasDeProductos([
    { id: 'p1', nombre: 'Verde', precio: 20, cantidad: 4, activo: true, orden: 1 },
    { id: 'p2', nombre: 'Rajas', precio: 22, cantidad: 0, activo: false, orden: 2 },
  ]);
  assert.equal(filas[0].activo, 1);
  assert.equal(filas[1].activo, 0);
  assert.equal(filas[0].stock, 4);
});

test('los pedidos se aplanan en Pedidos y Pedidos_Lineas', () => {
  const pedidos = [{
    id: 'ped_1', clienteId: 'cli_1', clienteNombre: 'Doña Lupe', fechaEntrega: '2026-12-01',
    total: 300, anticipo: 100, descuento: 0, estado: 'anticipo', nota: 'sin cebolla',
    items: [{ productoId: 'p1', nombre: 'Verde', cantidad: 10, precioUnitario: 20 }],
  }];
  const [pedido] = filasDePedidos(pedidos);
  assert.equal(pedido.pedido_id, 'ped_1');
  assert.equal(pedido.anticipo, 100);

  const [linea] = filasDePedidosLineas(pedidos);
  assert.equal(linea.linea_id, 'ped_1_0');
  assert.equal(linea.subtotal_linea, 200);
});

test('un pedido sin items no rompe el aplanado', () => {
  assert.deepEqual(filasDePedidosLineas([{ id: 'ped_2' }]), []);
});

test('los movimientos de caja llenan origen y destino con cadena vacía', () => {
  const [fila] = filasDeCaja([{ id: 'm1', fecha: '2026-11-27', tipo: 'venta', monto: 120, destino: 'caja' }]);
  assert.equal(fila.origen, '');
  assert.equal(fila.destino, 'caja');
});

test('el payload completo valida contra el contrato', () => {
  const payload = construirPayload({
    ventas: [VENTA],
    detalleVenta: [DETALLE],
    productos: [{ id: 'p1', nombre: 'Verde', precio: 20 }],
    insumos: [{ id: 'i1', nombre: 'Masa', cantidad: 3 }],
    costos: [{ id: 'c1', fecha: '2026-11-27', monto: 100 }],
    producciones: [{ id: 'pr1', fecha: '2026-11-27', productoId: 'p1', cantidadProducida: 50 }],
    clientes: [{ id: 'cli1', nombre: 'Lupe' }],
    pedidos: [{ id: 'ped1', items: [] }],
    movimientosFinanzas: [{ id: 'm1', fecha: '2026-11-27', monto: 10, tipo: 'venta' }],
  }, { dispositivo: 'dev_1', version: '4.0.0' });

  assert.equal(payload.origen, 'TamalitosAPP');
  assert.equal(payload.dispositivo, 'dev_1');
  assert.deepEqual(validarPayload(payload), []);
  assert.equal(payload.hojas.Ventas.length, 1);
  assert.equal(payload.hojas.Ventas_Lineas.length, 1);
});

test('un payload vacío también es válido (no se inventan filas)', () => {
  const payload = construirPayload({});
  assert.deepEqual(validarPayload(payload), []);
  Object.keys(HOJAS).forEach(hoja => {
    assert.deepEqual(payload.hojas[hoja], [], `la hoja ${hoja} debía venir vacía`);
  });
});

test('validarPayload detecta una columna que no existe en la plantilla', () => {
  const payload = construirPayload({ ventas: [VENTA] });
  payload.hojas.Ventas[0].campo_inventado = 'x';
  const errores = validarPayload(payload);
  assert.equal(errores.length, 1);
  assert.match(errores[0], /campo_inventado/);
});
