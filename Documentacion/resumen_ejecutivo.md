# 🫔 TamalitosAPP — Resumen Ejecutivo, Funciones por Módulo y Oportunidades de Mejora

> Documento generado a partir del código fuente (`Codigo/`) y la especificación técnica (`Documentacion/`).
> Versión de referencia: **v3.0.0** (rama `develop-v3`), base v2.0.0 en `main`.

---

## 1. Resumen Ejecutivo

**TamalitosAPP** es una **Progressive Web App (PWA) 100% offline** para la operación diaria de un negocio de venta de tamales. Está optimizada para **iPhone e iPad** en modo Standalone (pantalla completa, sin barra de Safari) y no requiere conexión ni backend: todos los datos viven en el dispositivo.

| Dimensión | Descripción |
|---|---|
| **Propósito** | Administrar la operación completa del negocio: catálogo, producción, ventas (POS), gastos, inventario, recetas, perfiles de venta y métricas. |
| **Stack** | HTML5 + CSS3 + JavaScript ES6 (Vanilla, sin framework ni bundler). |
| **Persistencia** | IndexedDB (datos transaccionales) + `localStorage` (configuración y preferencias). |
| **Offline** | Service Worker con estrategia Cache-First / Stale-While-Revalidate. |
| **Exportación** | CSV (Web Share API) y respaldo/restauración JSON completo. |
| **Despliegue** | Vercel (HTTPS automático, requerido por iOS para Service Workers). |
| **Tamaño** | ~5.700 líneas de código fuente; 8 object stores; 12 vistas + 4 componentes + 6 módulos core. |
| **Estado** | v1.0.0 → v2.0.0 → **v3.0.0 completadas** (sprints 1–5 cerrados). |

### Arquitectura (patrón)

**SPA Vanilla con Hash Router, estado reactivo (Observer) y capa de persistencia async/await.**

```text
index.html (shell único)
   │
   ├── Router (hash)        #/ , #/venta , #/historial , #/insumos-costos ,
   │                        #/insumos , #/costos , #/produccion , #/recetas ,
   │                        #/perfiles , #/dashboard , #/config , #/productos
   ├── Store (Observer)     estado global reactivo: config, productos, insumos,
   │                        pedidoActual, vistaActual, modalAbierto
   └── DB (IndexedDB)       wrapper async/await con transacciones atómicas
```

**Decisiones clave de arquitectura:**
- **Cero dependencias** → sin riesgo de breaking changes de npm, sin build step, app < 200 KB (excluye iconos), precacheo directo del Service Worker.
- **Hash Router** (no History API) → URLs locales (`#/venta`) sin manejo de rutas artificiales en el SW; `hashchange` universal.
- **IndexedDB sobre localStorage** → ~1 GB de capacidad, índices, consultas por rango, transacciones ACID; necesario para 36K+ ventas/año.
- **Snapshots en históricos** → `nombreProducto`, `precioUnitario`, `costoTotal`, `perfilNombre` se guardan como copia al momento de la transacción para que editar un catálogo no reescriba el pasado.

### Modelo de datos (DB_VERSION = 3)

| Object Store | Índices | Rol |
|---|---|---|
| `productos` | `activo`, `nombre`, `orden` | Catálogo de venta (soft-delete por `activo`) |
| `insumos` | `nombre` | Catálogo de insumos + `costoUnitario` |
| `costos` | `fecha`, `categoria`, `insumoId` | Egresos/gastos (suman stock si `categoria === 'insumo'`) |
| `ventas` | `fecha`, `estado`, `estadoPago` | Cabecera de transacción + `perfilId`/`perfilNombre` |
| `detalleVenta` | `ventaId`, `productoId` | Líneas del pedido (snapshots de precio/nombre) |
| `producciones` | `fecha`, `productoId` | Histórico de producción + `costoTotal` (snapshot) |
| `recetas` | `productoId` (único) | Receta 1:1 con producto + insumos/cantidades |
| `perfiles` | `nombre` | Perfiles de venta (PDV / sucursal) |

**Migración v2→v3:** crea `recetas`/`perfiles`, seed del perfil **"General"**, backfill de ventas sin perfil y `config.perfilActivoId`.

---

## 2. Funciones Detalladas por Módulo

### 2.1 Módulos Core (`Codigo/js/`)

| Archivo | Funciones | Responsabilidad |
|---|---|---|
| `app.js` | `initDB()`, `aplicarTema(config)`, `registrarSW()`, `main()` | Bootstrap: abre DB, aplica tema, registra el Service Worker y arranca el router. |
| `router.js` | `navegar(ruta)`, `navegarAtras()`, `initRouter()` + tabla `ROUTES` | Hash router con import dinámico de vistas y limpieza al desmontar. |
| `store.js` | clase `Store` (`getState`, `setState`, `subscribe`); `agregarAlPedido()`, `cambiarCantidad()`, `eliminarDelPedido()`, `limpiarPedido()`, `calcularSubtotal()`, `cargarConfig()`, `guardarConfig()`, `importarConfig()` | Estado global reactivo (Observer) y helpers de la comanda del POS + configuración. |
| `db.js` | `openDB()`, `getAll()`, `getById()`, `put()`, `remove()`, `count()`, `clearStore()`, `getProductosActivos()`, `getVentasPorFecha()`, `getDetallesByVentaId()`, `getCostosPorFecha()`, `getUltimoCostoUnitario()`, `getProduccionesPorFecha()`, `getResumenDiario()`, `guardarVentaCompleta()`, `guardarProduccion()`, `cancelarVenta()`, `exportarTodo()`, `importarRespaldo()` | Wrapper IndexedDB async/await; CRUD genérico, consultas por fecha, transacciones compuestas (venta + detalle, producción + inventario, cancelación) y respaldo completo. |
| `export.js` | `rangoDePeriodo()`, `exportarCSV()`, `exportarRespaldoJSON()`, `validarRespaldo()`, `restaurarRespaldo()` | Exportación CSV por período (día/semana/mes/año) con Web Share API + fallback, y respaldo/restauración JSON con validación. |
| `gestures.js` | `aplicarSwipe(itemContent, {...})` | Gesto swipe-to-delete con umbrales iOS (eje único, reveal, auto-complete, cancelación). |
| `utils.js` | `esc()`, `formatMXN()`, `formatCantidad()`, `ceil1()`, `hoy()`, `formatFecha()`, `formatHora()`, `generarId()`, `ahoraHora()` | Utilidades: escape HTML, formato MXN, redondeo a 1 decimal, fechas/horas e IDs por prefijo + timestamp. |

### 2.2 Componentes Reutilizables (`Codigo/js/components/`)

| Archivo | API pública | Responsabilidad |
|---|---|---|
| `modal.js` | `modal.abrir()`, `modal.cerrar()`, `modal.confirmar()` | Modal reutilizable (título, contenido, botones, overlay). `confirmar()` devuelve `Promise<boolean>`. |
| `toast.js` | `toast.success()`, `toast.error()`, `toast.info()` | Notificaciones efímeras con auto-dismiss. |
| `swipe-item.js` | `crearSwipeItem({...})` | Lista con acción revelada por swipe (borrar/activar). |
| `date-filter.js` | `crearDateFilter({value, max, onChange})` | Selector de fecha para filtros. |

### 2.3 Vistas (`Codigo/js/views/`)

Cada vista expone `render(container)` (y opcionalmente un cleanup al desmontar).

| Módulo | Ruta | Archivo | Funciones principales |
|---|---|---|---|
| **Home** | `#/` | `home.js` | Inicio: logo, versión, accesos a venta, insumos/costos, dashboard y configuración; muestra el perfil activo dentro del botón "Registrar Venta". |
| **POS** | `#/venta` | `pos.js` | Grilla de productos con stock; comanda (agregar/quitar/cambiar cantidad); cobro con descuento, `pagoCon`/`cambio`; venta **fiada**; pedido **sin ingreso**; asociación al perfil activo. |
| **Historial** | `#/historial` | `historial.js` | Filtro por fecha, resumen (ingresos/gastos/utilidad), listado paginado (`PAGE_SIZE = 50`), **cancelación de venta < 24h** y **pago de fiados**. |
| **Producción** | `#/produccion` | `produccion.js` | Registrar producción: producto + cantidad; **precarga insumos proporcionales desde la receta** (editable); **alerta de faltantes** (informativa, permite negativo); guarda `costoTotal` snapshot y ajusta inventario. |
| **Recetas** | `#/recetas` | `recetas.js` | CRUD de recetas (1:1 con producto, solo productos activos sin receta); editar/eliminar; **calculadora de producción** (cantidad → insumos proporcionales con `ceil1` + costo aproximado). |
| **Perfiles** | `#/perfiles` | `perfiles.js` | CRUD de perfiles de venta; selección del **perfil activo** (persiste en `localStorage`); reglas: no eliminar el activo ni perfiles con ventas. |
| **Insumos** | `#/insumos` | `insumos.js` | Catálogo de insumos: nombre, unidad, stock, `costoUnitario` (con botón "tomar del último costo"); edición y **ajuste manual de inventario**. |
| **Insumos Hub** | `#/insumos-costos` | `insumos-hub.js` | Hub de navegación: Insumos, Costos, Producción, Recetas, Perfiles. |
| **Costos** | `#/costos` | `costos.js` | Registro de egresos con selector de insumo, cantidad y monto; suma stock cuando es de tipo insumo. |
| **Dashboard** | `#/dashboard` | `dashboard.js` | Gráficas con períodos unificados (día / 15 días / mes / 3 meses / anual): venta por producto, por tipo de ingreso, por perfil y **costo por producción** (barra, Y=producción, $costo como etiqueta). |
| **Config** | `#/config` | `config.js` | Nombre/logo del negocio, tema, acceso a productos, **exportar CSV** (ventas/gastos) y **respaldo/restauración JSON** completo. |
| **Productos** | `#/productos` | `productos.js` | CRUD de productos: alta, edición, **desactivación (soft-delete)**, reorden y stock. |

---

## 3. Oportunidades de Mejora

### 3.1 Prioridad alta

1. **Cobertura de pruebas automatizadas.** Hoy la validación es 100% manual (checklist E2E en `sprint5_qa.md`). No existe suite de tests. Oportunidad: tests unitarios para `store.js`, `db.js` y `utils.js` (lógica de cálculo de subtotales, redondeo, proporcionalidad de recetas), y E2E con Playwright (disponible como MCP) sobre los flujos críticos (venta, producción con receta, cancelación 24h, respaldo/restauración).
2. **Sincronización en la nube (v4).** Ya documentada como "fuera de alcance" con el contexto guardado. Implica backend, autenticación y **resolución de conflictos** (el modelo hoy es 100% local). Recomendación: empezar por sincronización **bajo demanda** (botón exportar/importar a un backend), no tiempo real.
3. **Resiliencia del respaldo.** El respaldo es manual y local (JSON descargable). Riesgo de pérdida de datos si el dispositivo se pierde/destruye. Oportunidad: recordatorio automático de respaldo y/o exportación automática a un destino seguro.

### 3.2 Prioridad media

4. **Herramientas de calidad de código.** Sin linter ni formateador. Añadir ESLint + Prettier (sin romper el principio de "cero dependencias en runtime", como devDependencies) y un script de verificación estática.
5. **Fragmentación de vistas grandes.** `db.js` (575 líneas), `recetas.js` (460), `pos.js` (424), `historial.js` (308) concentran demasiada responsabilidad. Oportunidad: extraer helpers de cálculo/render y dividir `db.js` en un módulo por dominio.
6. **Accesibilidad (a11y).** Verificar `aria-label`, foco de teclado, contraste y navegación por VoiceOver (crítico en iOS). Los targets táctiles de 48px ya están cubiertos por el design system.
7. **Telemetría / manejo de errores.** Solo `console.warn/error` dispersos. Añadir captura centralizada de errores (ej. `window.onerror`, `unhandledrejection`) para diagnóstico, aunque sea local.

### 3.3 Prioridad baja / deuda técnica

8. **Colisiones en generación de IDs.** `generarId(prefix)` usa timestamp (ms). Dos registros en el mismo milisegundo con el mismo prefijo podrían colisionar. Añadir un contador/random como sufijo.
9. **Gráficas del dashboard con muchos datos.** Con muchas producciones/ventas, las barras pueden saturarse. Añadir agregación o paginación visual por período.
10. **Asset huérfano.** `Codigo/icons/icon.svg` no se referencia en `index.html` ni `manifest.json` (nota de `sprint5_qa.md`). Eliminarlo o enlazarlo.
11. **Notificaciones push.** Para un negocio, alertas como "stock bajo de masa" vía notificaciones de la PWA agregarían valor operativo.
12. **Multi-idioma.** No aplica hoy (negocio único), pero si se escala el modelo de venta (perfiles/sucursales), considerar i18n.

---

## 4. Referencias Cruzadas

- [README](../README.md) — visión general y estructura.
- [Fase 1 — Análisis de Brechas](fase1_analisis_brechas.md)
- [Fase 2 — Arquitectura y Modelo de Datos](fase2_arquitectura.md)
- [Fase 3 — Historias de Usuario](fase3_historias_usuario.md)
- [Fase 4 — Plan de Trabajo](fase4_plan_trabajo.md)
- [Sprint 5 — QA](sprint5_qa.md)
- [v2.0.0 — Cambios](v2.0.0_cambios.md)
- [v3.0.0 — Cambios](v3.0.0_cambios.md)
