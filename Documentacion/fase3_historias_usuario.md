# FASE 3: Épicas e Historias de Usuario

Todas las historias siguen el formato **INVEST** y los criterios de aceptación usan la notación **Gherkin**. Se agrupan por **Épica** (módulo funcional).

---

## Épica 1: Infraestructura PWA y Shell (EP-01)

### HU-001: Instalación en Pantalla de Inicio iOS
**Como** dueño de negocio de tamales con un iPhone,
**Quiero** instalar la app desde Safari a mi pantalla de inicio,
**Para** acceder con un solo toque sin abrir el navegador.

**Criterios de Aceptación:**
```gherkin
Dado que accedo a la URL de TamalitosAPP en Safari por HTTPS
Cuando selecciono Compartir > "Agregar al inicio"
Entonces se muestra el icono oficial con el nombre "TamalitosAPP"
Y al abrirla desde la pantalla de inicio se ejecuta sin barra de URL

Dado que la app está instalada y abierta en modo Standalone
Cuando consulto el diagnóstico de entorno
Entonces el modo de visualización indica "Standalone PWA"
```

### HU-002: Funcionamiento 100% Offline
**Como** vendedor que opera en un puesto sin Wi-Fi,
**Quiero** que la app funcione completamente sin internet,
**Para** no interrumpir la operación de venta en ningún momento.

**Criterios de Aceptación:**
```gherkin
Dado que la app se cargó con éxito al menos una vez con internet
Cuando activo el Modo Avión y abro la app
Entonces la interfaz carga en menos de 2 segundos sin errores
Y puedo registrar ventas, agregar productos y consultar el historial

Dado que estoy offline y registro una venta
Cuando cierro la app y la vuelvo a abrir (aún offline)
Entonces la venta registrada sigue visible en el historial
```

### HU-003: Navegación entre Pantallas
**Como** usuario de la app,
**Quiero** navegar entre las diferentes secciones sin recargas de página,
**Para** tener una experiencia fluida como la de una app nativa.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en la pantalla de Inicio
Cuando presiono el botón "Registrar Venta"
Entonces se muestra la pantalla del POS con una transición suave
Y la URL cambia a #/venta sin recargar la página

Dado que estoy en cualquier pantalla secundaria
Cuando presiono el botón "← Atrás"
Entonces regreso a la pantalla padre correspondiente
```

---

## Épica 2: Pantalla de Inicio (EP-02)

### HU-010: Visualización del Dashboard
**Como** dueño del negocio,
**Quiero** ver una pantalla inicial con el logo, la versión y accesos rápidos,
**Para** identificar mi negocio y acceder a las funciones principales.

**Criterios de Aceptación:**
```gherkin
Dado que abro la app
Cuando se carga la pantalla de Inicio
Entonces veo el logo del negocio centrado
Y el número de versión es visible en una esquina
Y hay un botón engrane (⚙️) que lleva a Configuración
Y hay un botón principal "Registrar Venta" claramente destacado
Y hay un botón secundario "Insumos y Costos" visible pero no prominente
```

---

## Épica 3: Configuración y Catálogo de Productos (EP-03)

### HU-020: Configurar Nombre del Negocio
**Como** dueño del negocio,
**Quiero** poder definir el nombre de mi establecimiento,
**Para** que aparezca en los tickets y la cabecera de la app.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en la pantalla de Configuración
Cuando modifico el campo "Nombre del Negocio" y guardo
Entonces el nuevo nombre persiste al cerrar y reabrir la app
Y el nombre actualizado se refleja en la pantalla de Inicio

Dado que estoy offline
Cuando modifico el nombre del negocio
Entonces el cambio se guarda correctamente en el almacenamiento local
```

### HU-021: Agregar un Producto Nuevo
**Como** dueño del negocio,
**Quiero** agregar nuevos productos al catálogo (ej. "Tamal de Rajas"),
**Para** que estén disponibles como botones en la pantalla de venta.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en la pantalla de Administración de Productos
Cuando presiono "Agregar Producto"
Y lleno el nombre ("Tamal de Rajas"), precio (25.00) y descripción
Y presiono "Guardar"
Entonces el producto aparece en la lista de productos activos
Y al ir a la pantalla de Venta, veo un nuevo botón "Tamal de Rajas"

Dado que intento guardar un producto sin nombre o con precio 0
Cuando presiono "Guardar"
Entonces se muestra un mensaje de validación indicando los campos faltantes
Y el producto NO se guarda
```

### HU-022: Editar un Producto Existente
**Como** dueño del negocio,
**Quiero** modificar el precio o nombre de un producto,
**Para** reflejar cambios de precios o correcciones.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en la lista de productos
Cuando presiono sobre un producto existente
Entonces se abre el formulario de edición con los datos actuales precargados
Y puedo modificar nombre, precio y/o descripción
Y al guardar, los cambios se reflejan inmediatamente en la lista y en el POS

Dado que cambio el precio de "Tamal Verde" de $25 a $30
Y ya existían ventas anteriores con precio $25
Cuando consulto el historial de ventas previas
Entonces las ventas anteriores siguen mostrando $25 (snapshot inmutable)
```

### HU-023: Desactivar / Eliminar un Producto
**Como** dueño del negocio,
**Quiero** desactivar un producto que ya no vendo,
**Para** que no aparezca en la pantalla de venta pero su historial se conserve.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en la lista de productos
Cuando deslizo un producto hacia la izquierda (swipe)
Entonces aparece el botón "Desactivar" en rojo
Y al confirmarlo, el producto se marca como inactivo

Dado que un producto está desactivado
Cuando voy a la pantalla de Venta (POS)
Entonces ese producto NO aparece en la grilla de botones
Pero las ventas históricas que lo incluyen siguen mostrando su nombre y precio
```

### HU-024: Exportar Información
**Como** dueño del negocio,
**Quiero** exportar mis ventas y gastos en un archivo CSV,
**Para** revisarlos en Excel o compartirlos con mi contador.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en Configuración > Exportar Información
Cuando selecciono un rango de fechas y presiono "Exportar Ventas"
Entonces se genera un archivo CSV con las columnas:
  Fecha, Hora, Productos, Cantidades, Subtotal, Descuento, Total, Método de Pago
Y se abre el panel de compartir de iOS (Web Share API)
Y puedo enviarlo por WhatsApp, Mail, AirDrop o guardarlo en Archivos

Dado que estoy offline
Cuando intento exportar
Entonces la exportación funciona correctamente (los datos son locales)
```

---

## Épica 4: Módulo de Insumos y Costos (EP-04)

### HU-030: Agregar un Insumo al Catálogo
**Como** dueño del negocio,
**Quiero** registrar los insumos que utilizo (masa, hojas, chile),
**Para** tener un catálogo organizado de mis conceptos de gasto.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en la pantalla de Catálogo de Insumos
Cuando presiono "Agregar Insumo"
Y escribo el nombre ("Hojas de maíz") y la unidad ("paquete")
Y presiono "Guardar"
Entonces el insumo aparece en la lista
Y está disponible como concepto al registrar un costo/gasto
```

### HU-031: Eliminar un Insumo con Gesto Swipe
**Como** usuario de la app,
**Quiero** eliminar un insumo deslizando hacia la izquierda,
**Para** hacerlo de forma rápida y natural en una pantalla táctil.

**Criterios de Aceptación:**
```gherkin
Dado que estoy viendo la lista de insumos
Cuando deslizo un insumo hacia la izquierda al menos un 40% del ancho
Entonces se revela un botón rojo "Eliminar"
Y al presionarlo aparece un modal de confirmación
Y al confirmar, el insumo desaparece de la lista con animación

Dado que deslizo un insumo menos del 40%
Cuando suelto el dedo
Entonces el item regresa a su posición original (se cancela el gesto)
```

### HU-032: Registrar un Costo o Gasto
**Como** dueño del negocio,
**Quiero** registrar lo que gasto en insumos, servicios o compras generales,
**Para** llevar un control de mis egresos y calcular la utilidad.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en la pantalla de Registro de Costos
Cuando lleno el formulario:
  - Concepto: "Compra de masa" (texto libre o seleccionado de insumos)
  - Categoría: "Insumo" (selector: Insumo / Servicio / Otro)
  - Monto: 350.00
  - Fecha: (hoy por default, editable)
  - Notas: "15 kg en el molino" (opcional)
Y presiono "Registrar Gasto"
Entonces el gasto se guarda y aparece en el historial cronológico de costos

Dado que estoy en el historial de costos
Cuando miro la lista
Entonces veo los gastos ordenados por fecha descendente
Y cada entrada muestra fecha, concepto, categoría y monto
```

---

## Épica 5: Punto de Venta — POS (EP-05)

### HU-040: Ver Grilla de Productos para Venta
**Como** vendedor,
**Quiero** ver todos mis productos activos como botones grandes,
**Para** seleccionarlos rápidamente al atender a un cliente.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en la pantalla de Venta (#/venta)
Cuando se carga la vista
Entonces veo una grilla de botones, uno por cada producto activo
Y cada botón muestra el nombre del producto y su precio
Y los botones tienen mínimo 48x48px de zona táctil
Y los productos desactivados NO aparecen
```

### HU-041: Agregar Productos al Pedido Actual
**Como** vendedor,
**Quiero** presionar un botón de producto para agregarlo a la comanda,
**Para** ir armando el pedido del cliente de forma rápida.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en la pantalla de Venta
Cuando presiono el botón "Tamal Verde" una vez
Entonces aparece en la lista inferior con cantidad = 1 y subtotal = $25
Y el total general del pedido se actualiza

Cuando presiono el mismo botón "Tamal Verde" dos veces más
Entonces la cantidad cambia a 3 y el subtotal de la línea es $75

Dado que tengo items en la comanda
Cuando presiono el botón "−" junto a un producto
Entonces la cantidad disminuye en 1
Y si la cantidad llega a 0, el producto se elimina de la comanda
```

### HU-042: Cobrar el Pedido
**Como** vendedor,
**Quiero** finalizar la venta presionando "Cobrar",
**Para** registrar la transacción y limpiar la comanda para el siguiente cliente.

**Criterios de Aceptación:**
```gherkin
Dado que tengo al menos 1 producto en la comanda
Cuando presiono el botón "Cobrar"
Entonces se muestra un modal de confirmación con:
  - Resumen del pedido (productos, cantidades, subtotales)
  - Total a cobrar
  - Selector de método de pago (Efectivo / Transferencia)
  - Campo opcional "Pagó con $___" (solo si es efectivo)
  - Campo opcional "Descuento $___"
  - Botón "Confirmar Cobro"

Dado que confirmo el cobro
Cuando se procesa la venta
Entonces la venta se guarda en IndexedDB con todos sus detalles
Y la comanda se limpia (queda vacía para el siguiente cliente)
Y se muestra un toast de confirmación "Venta registrada: $90.00"
Y opcionalmente se muestra un botón "Compartir Ticket"

Dado que la comanda está vacía (0 productos)
Cuando intento presionar "Cobrar"
Entonces el botón está deshabilitado o muestra un aviso
```

### HU-043: Cálculo Automático de Cambio
**Como** vendedor,
**Quiero** que la app calcule el cambio al ingresar el monto recibido,
**Para** no tener que calcularlo mentalmente.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en el modal de cobro con total = $85
Cuando selecciono método "Efectivo" e ingreso "Pagó con: 100"
Entonces se muestra automáticamente "Cambio: $15.00"

Dado que ingreso un monto menor al total (ej. $50 para un total de $85)
Cuando veo el campo de cambio
Entonces se muestra "Falta: $35.00" en color rojo de advertencia
Y el botón "Confirmar Cobro" se deshabilita
```

### HU-044: Compartir Ticket Digital
**Como** vendedor,
**Quiero** compartir un resumen de la venta con el cliente por WhatsApp,
**Para** dar un recibo digital sin necesidad de impresora.

**Criterios de Aceptación:**
```gherkin
Dado que acabo de confirmar un cobro exitoso
Cuando presiono "Compartir Ticket"
Entonces se abre el panel nativo de compartir de iOS
Y el ticket contiene: nombre del negocio, fecha/hora, productos, total
Y puedo enviarlo por WhatsApp, iMessage, AirDrop o copiarlo al portapapeles

Dado que cierro el panel sin compartir
Cuando regreso a la pantalla de venta
Entonces la comanda está limpia y lista para el siguiente cliente
```

---

## Épica 6: Historial de Ventas (EP-06)

### HU-050: Ver Ventas del Día Actual
**Como** dueño del negocio,
**Quiero** ver todas las ventas cobradas del día actual,
**Para** monitorear el avance de las ventas en tiempo real.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en la pantalla de Historial (#/historial)
Cuando se carga la vista
Entonces se muestran las ventas del día actual por defecto
Y cada venta muestra: hora, total, número de productos y estado
Y en la cabecera se muestra un resumen:
  - Número de ventas del día
  - Total vendido
  - Total de gastos del día
  - Diferencia (Utilidad bruta)

Dado que no hay ventas registradas hoy
Cuando veo el historial
Entonces se muestra un mensaje vacío: "Sin ventas registradas hoy"
```

### HU-051: Filtrar Ventas por Fecha
**Como** dueño del negocio,
**Quiero** consultar las ventas de un día o rango de fechas específico,
**Para** revisar el desempeño de fechas pasadas.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en el Historial de Ventas
Cuando presiono el selector de fecha
Y elijo una fecha pasada (ej. 20/Sep/2026)
Entonces la lista se actualiza mostrando solo las ventas de esa fecha
Y el resumen de cabecera recalcula los totales para ese día
```

### HU-052: Ver Detalle de una Venta
**Como** dueño del negocio,
**Quiero** ver el desglose completo de una venta específica,
**Para** verificar qué se vendió y a qué precio.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en el Historial y veo una venta en la lista
Cuando la presiono
Entonces se expande o abre un panel de detalle mostrando:
  - Fecha y hora
  - Lista de productos con cantidad y subtotal por línea
  - Descuento aplicado (si hubo)
  - Total cobrado
  - Método de pago
  - Estado (Cobrada / Cancelada)
```

### HU-053: Cancelar una Venta Reciente
**Como** dueño del negocio,
**Quiero** cancelar una venta registrada por error dentro de las últimas 24 horas,
**Para** corregir errores de captura sin afectar permanentemente el historial.

**Criterios de Aceptación:**
```gherkin
Dado que estoy viendo el detalle de una venta con estado "Cobrada"
Y la venta fue registrada hace menos de 24 horas
Cuando presiono "Cancelar Venta"
Entonces se solicita un motivo de cancelación (campo de texto obligatorio)
Y al confirmar, la venta cambia su estado a "Cancelada"
Y se muestra con un badge rojo "CANCELADA" en el historial
Y el total de esa venta se excluye del resumen diario

Dado que la venta fue registrada hace más de 24 horas
Cuando intento cancelarla
Entonces el botón "Cancelar Venta" no está disponible
Y se muestra un texto: "Solo se pueden cancelar ventas de las últimas 24 horas"
```

---

## Épica 7: Respaldo y Restauración de Datos (EP-07)

### HU-060: Exportar Respaldo Completo
**Como** dueño del negocio,
**Quiero** exportar un respaldo de toda la información de la app,
**Para** protegerme contra la pérdida de datos si se borra la app o el caché.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en Configuración
Cuando presiono "Exportar Respaldo Completo"
Entonces se genera un archivo JSON con todas las tablas de IndexedDB
Y se abre el panel de compartir de iOS para guardar o enviar el archivo
Y el nombre del archivo incluye la fecha: "respaldo_TamalitosAPP_20260922.json"
```

### HU-061: Importar Respaldo
**Como** dueño del negocio que cambió de dispositivo,
**Quiero** restaurar mis datos desde un archivo de respaldo,
**Para** no perder mi historial de ventas y catálogos.

**Criterios de Aceptación:**
```gherkin
Dado que estoy en Configuración
Cuando presiono "Importar Respaldo" y selecciono un archivo JSON válido
Entonces se muestra un resumen del contenido:
  "X productos, Y insumos, Z ventas, W gastos"
Y un botón "Restaurar" con advertencia de que reemplazará los datos actuales
Y al confirmar, los datos se cargan en IndexedDB
Y la app se reinicia mostrando la información restaurada

Dado que selecciono un archivo corrupto o con formato inválido
Cuando intento importar
Entonces se muestra un error: "El archivo seleccionado no es un respaldo válido"
Y los datos existentes NO se modifican
```

