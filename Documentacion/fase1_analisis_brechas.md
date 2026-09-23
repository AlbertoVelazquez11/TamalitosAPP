# FASE 1: Análisis de Brechas y Detección de Flujos Inconclusos

Este documento identifica los vacíos de diseño y lógica de negocio detectados en los requerimientos iniciales de TamalitosAPP. Cada brecha incluye una **pregunta de clarificación** y una **recomendación MVP** para desbloquear el desarrollo sin depender de respuestas inmediatas.

---

## 1. Reglas de Venta y Cobro

### 1.1 Métodos de Pago
**Pregunta:** ¿Se necesita registrar si el cliente pagó en efectivo, transferencia bancaria o tarjeta? ¿Se necesita calcular el cambio (ej. "pagó con $200, cambio $35")?

**Recomendación MVP:** Registrar un campo opcional `metodoPago` con los valores `efectivo` (default) y `transferencia`. No se implementa integración con terminales de pago. Se añade un campo numérico `pagoCon` para que el vendedor introduzca el monto recibido y la app calcule el cambio automáticamente antes de confirmar el cobro. Si el usuario no llena el campo, se asume pago exacto.

**R.** Solo se aceptan pagos en efectivo, no agregues la opción de cálculo de cambio.
### 1.2 Descuentos y Promociones
**Pregunta:** ¿Se aplican descuentos por volumen, promociones especiales o precios diferenciados por cliente?

**Recomendación MVP:** No incluir motor de descuentos. Se permite únicamente un campo opcional `descuento` (monto fijo en pesos) a nivel de la venta total, no por producto individual. Esto cubre el escenario de "le hice descuento al cliente" sin añadir complejidad.

**R.** Sí, agrega la opción de aplicar un descuento manual, no existe una regla para aplicarlo automático.
### 1.3 Cancelación y Devoluciones
**Pregunta:** ¿Se puede cancelar o anular una venta ya cobrada? ¿Existe el concepto de devolución parcial?

**Recomendación MVP:** Permitir marcar una venta como `cancelada` (soft-delete con motivo) dentro de las primeras 24 horas. No se implementan devoluciones parciales. La venta cancelada sigue apareciendo en el historial con un badge visual diferenciado y no se contabiliza en los totales de ventas del día.

**R.** Sí, agrega la opción de cancelar la venta realizada para que no impacte en los ingresos.
### 1.4 Venta a Crédito / Fiado
**Pregunta:** ¿Existe el escenario de "fiar" a un cliente conocido y registrar el cobro posterior?

**Recomendación MVP:** No incluir en el MVP. Si se requiere, se puede registrar como nota en la descripción de la venta. Se evalúa para una fase posterior como módulo de "Cuentas por Cobrar".

**R.** Sí, no tan visible para que no cause ruido visual en cada compra, pero si poder de marcar la venta como "pendiente de pago"

---

## 2. Relación entre Insumos y Productos

### 2.1 Recetas / Escandallos
**Pregunta:** ¿Cada producto terminado (ej. Tamal Verde) tiene una receta que indica cuántos gramos de masa, hojas, salsa verde consume? ¿Al vender un tamal se debe descontar automáticamente el inventario de insumos?

**Recomendación MVP:** **No vincular insumos con productos mediante recetas.** El módulo de Insumos opera como un **catálogo clasificador de gastos**, no como un sistema de inventario con descuento automático. Razón: un sistema de escandallos requiere pesaje preciso, manejo de unidades de medida compuestas y mermas, lo cual excede ampliamente un MVP para un negocio de tamales. El flujo es:
1. El dueño registra insumos como categorías de gasto (ej. "Masa para tamales", "Hojas de maíz", "Chile verde").
2. Cuando compra insumos, va al módulo de Costos y registra el egreso asociando el concepto (insumo o texto libre) con su monto y fecha.
3. El historial de costos permite ver cuánto se ha gastado en qué concepto por período.

**R.** Aplica la recomendación MVP
### 2.2 Unidades de Medida
**Pregunta:** ¿Los insumos se miden en kilogramos, piezas, litros, paquetes?

**Recomendación MVP:** Campo de texto libre `unidad` en el catálogo de insumos (ej. "kg", "pza", "lt", "bolsa"). No se implementa conversión de unidades.

**R.** Aplica la recomendación MVP

---

## 3. Corte de Caja / Resumen Financiero

### 3.1 Balance Diario
**Pregunta:** ¿Se requiere un reporte tipo "corte de caja" que muestre `Total Ventas del Día - Total Gastos del Día = Utilidad Bruta`?

**Recomendación MVP:** **Sí, incluir un resumen básico en la pantalla de Historial de Ventas.** Al filtrar por el día actual (default), se muestra un encabezado con:
- Total de ventas cobradas del día (count y suma)
- Total de costos/gastos registrados del día
- Diferencia (Utilidad bruta estimada)

Esto no requiere una pantalla dedicada; se integra como un componente `<ResumenDia>` en la cabecera del Historial.

**R.** Aplica la recomendación MVP
### 3.2 Fondo de Caja Inicial
**Pregunta:** ¿Se requiere registrar un monto de "fondo de caja" al inicio del día para calcular el efectivo esperado al cierre?

**Recomendación MVP:** No incluir. El resumen diario se limita a ventas vs. gastos.

**R.** Aplica la recomendación MVP

---

## 4. Comprobante / Ticket Digital

### 4.1 Generación de Ticket
**Pregunta:** ¿El vendedor necesita compartir un ticket o recibo al cliente después de cobrar?

**Recomendación MVP:** Implementar un **ticket digital minimalista** usando la `Web Share API` de iOS. Al completar una venta, se muestra un botón "Compartir Ticket" que genera un texto plano formateado con:
```
🫔 TamalitosAPP
Negocio: [Nombre del Negocio]
Fecha: 22/Sep/2026 17:30
─────────────────
2x Tamal Verde     $40.00
1x Tamal Oaxaqueño $25.00
1x Atole Champurrado $20.00
─────────────────
TOTAL:             $85.00
Método: Efectivo
¡Gracias por su compra!
```
La `Web Share API` está soportada nativamente en Safari iOS y permite enviar el texto por WhatsApp, iMessage, AirDrop, etc. Sin dependencia de librerías.

**No se genera PDF en el MVP** (renderizar PDF en cliente puro sin librerías pesadas es frágil en WebKit).

**R.** No, no se generará ticket

---

## 5. Exportación de Datos

### 5.1 Formato y Mecanismo de Descarga
**Pregunta:** ¿En qué formato se exportan los datos? ¿Solo ventas o también gastos? ¿Se envía por correo, se descarga como archivo o se comparte?

**Recomendación MVP:** Exportar en **formato CSV** (máxima compatibilidad con Excel, Google Sheets y Numbers de Apple). Se generan dos archivos separados:
- `ventas_TamalitosAPP_YYYYMMDD.csv`
- `gastos_TamalitosAPP_YYYYMMDD.csv`

**Mecanismo de descarga en iOS Safari/WebKit:**
- En modo Standalone (PWA instalada), `URL.createObjectURL()` + `<a download>` **no funciona de forma fiable** en WebKit.
- **Solución:** Usar la `Web Share API` con un `File` object:
```javascript
const blob = new Blob([csvContent], { type: 'text/csv' });
const file = new File([blob], 'ventas.csv', { type: 'text/csv' });
navigator.share({ files: [file], title: 'Exportar Ventas' });
```
- Fallback: Si `navigator.canShare({ files })` retorna `false`, abrir el CSV como data URI en una nueva ventana.

**R.** Se puede exportar en CSV y compartir, aplica ventas y gastos filtrado por día, mes o año
### 5.2 Filtrado de Exportación
**Pregunta:** ¿Se exporta todo el historial o por rango de fechas?

**Recomendación MVP:** Se exporta por rango de fechas seleccionado en la configuración al momento de exportar (fecha inicio / fecha fin). Default: mes en curso.

**R.** Por día, semana, mes o año

---

## 6. Flujos Inconclusos Detectados Adicionales

### 6.1 Productos sin Precio
**Pregunta:** ¿Qué sucede si se intenta registrar una venta con un producto que tiene precio $0 o sin precio asignado?

**Recomendación MVP:** Validar al guardar producto que el precio sea mayor a 0. Productos con precio 0 no aparecen en la grilla del POS.

**R.** Aplica la recomendación MVP
### 6.2 Orden de Productos en el POS
**Pregunta:** ¿Los botones de productos en la pantalla de venta siguen algún orden específico (más vendido, alfabético, personalizado)?

**Recomendación MVP:** Orden de creación (más reciente primero). En una fase posterior se puede añadir drag-and-drop para ordenar manualmente.

**R.** Aplica la recomendación MVP
### 6.3 Multi-usuario / Multi-dispositivo
**Pregunta:** ¿Existe más de un vendedor operando la app simultáneamente en diferentes dispositivos? ¿Se requiere sincronización?

**Recomendación MVP:** **No.** La app opera en un solo dispositivo (el iPhone/iPad del dueño). No hay sincronización remota, autenticación de usuarios ni backend. Los datos viven exclusivamente en el dispositivo.

**R.** Aplica la recomendación MVP
### 6.4 Respaldo de Seguridad
**Pregunta:** Si el usuario borra la app o limpia Safari, ¿pierde toda la información?

**Recomendación MVP:** **Sí, existe ese riesgo con IndexedDB en WebKit.** Mitigación:
1. Mostrar un aviso claro en Configuración: *"Tus datos están almacenados localmente. Exporta tus ventas regularmente para tener un respaldo."*
2. El botón de exportación CSV también sirve como mecanismo de backup manual.
3. En la pantalla de Configuración, incluir una opción "Exportar Respaldo Completo" que genere un archivo JSON con todas las tablas de IndexedDB, y su correspondiente "Importar Respaldo" que restaure los datos.

**R.** Aplica la recomendación MVP
### 6.5 Límites de Almacenamiento en iOS
**Pregunta:** ¿Cuántas transacciones se esperan al día/mes?

**Recomendación MVP:** iOS WebKit asigna hasta ~1 GB de almacenamiento por origen a IndexedDB, pero puede purgar datos de orígenes que no se han usado en 7+ días (política de Intelligent Tracking Prevention). Para un negocio de tamales con ~50-100 ventas diarias y ~5-10 gastos diarios, el volumen de datos en un año (~36K registros) no superará los 50 MB. **El riesgo de purga automática se mitiga** porque al ser una PWA instalada en Home Screen que se usa diariamente, iOS la considera "app activa" y no purga su almacenamiento.

**R.** Aplica la recomendación MVP
### 6.6 Accesibilidad y Contraste
**Pregunta:** ¿Se requiere modo claro/oscuro? ¿Algún requerimiento de accesibilidad (tamaño de fuente, daltonismo)?

**Recomendación MVP:** Una sola paleta de colores (tema oscuro, ya implementado en el MVP actual). Textos con contraste mínimo WCAG AA (4.5:1). Botones de mínimo 48x48px. No se implementa modo claro.

**R.** Agrega la opción de ambos modo, claro y oscuro, por default el claro, posteriormente definiré una paleta de colores

