# Sprint 3 — Reporte de Bugs y Correcciones

**Fecha de detección:** 2026-09-23  
**Detectados por:** Prueba en dispositivo físico (iPhone)  
**Estado:** ✅ Todos corregidos y desplegados (SW v6)

---

## Bugs Identificados

### 🔴 BUG-001 — CRÍTICO: POS no renderiza (pantalla en blanco al entrar a Ventas)

| Campo | Detalle |
|---|---|
| **Archivo afectado** | `Codigo/css/views.css` |
| **Síntoma** | Al navegar a `#/venta`, la pantalla quedaba en blanco |
| **Causa raíz** | El router crea un `<div class="view view-enter">` como contenedor de cada vista. El CSS define `.view { min-height: 100%; }`. Cuando `pos.js` añade `#app.pos-active { overflow: hidden }` al `#app`, el layout de dos paneles del POS requiere que el div `.view` tenga `height: 100%` (no `min-height: 100%`). Sin esto, `.pos-view { height: 100% }` no puede calcular su altura y el layout colapsa |
| **Corrección** | Agregar selector `#app.pos-active > .view { height: 100%; min-height: unset; padding: 0; }` que sobreescribe el comportamiento del wrapper del router solo cuando el POS está activo |
| **Impacto** | Toda la vista del POS (pantalla de Ventas) era inaccesible |

---

### 🔴 BUG-002 — ALTO: Header del POS oculto detrás del Notch / Dynamic Island

| Campo | Detalle |
|---|---|
| **Archivos afectados** | `Codigo/js/views/pos.js`, `Codigo/css/views.css` |
| **Síntoma** | El header del POS aparecería cortado o detrás del notch en iPhone |
| **Causa raíz** | El `#app` normalmente aplica `padding-top: max(var(--space-4), var(--safe-top))` para respetar el safe area del notch. Al activar `#app.pos-active { padding-bottom: 0 }` (y con el fix del BUG-001 que también elimina el padding del `.view`), el header del POS pierde ese padding superior |
| **Corrección** | Añadir clase `.pos-header` al `view-header` del POS y definir `.pos-header { padding-top: max(var(--space-4), var(--safe-top)) }` para restaurar el espaciado del safe-area independientemente de `#app` |
| **Impacto** | El header (botones de navegación) quedaba cortado por el notch en iPhone X/XS/11/12/13/14/15 |

---

### 🟡 BUG-003 — MEDIO: CSS `.product-btn--added` inexistente

| Campo | Detalle |
|---|---|
| **Archivo afectado** | `Codigo/css/views.css` |
| **Síntoma** | No había feedback visual al tocar un producto en la grilla. El JS intentaba añadir la clase `.product-btn--added` pero no tenía estilos definidos (error silencioso) |
| **Causa raíz** | La clase fue referenciada en `pos.js` durante la redacción del Sprint 3 pero se olvidó definirla en el CSS |
| **Corrección** | Agregar `.product-btn--added { background-color: var(--color-primary-light) !important; border-color: var(--color-primary) !important; transform: scale(0.94); }` |
| **Impacto** | UX degradada: el usuario no tenía confirmación visual de que el producto fue agregado al pedido |

---

### 🟡 BUG-004 — MEDIO: `pos-products-section` sin padding lateral

| Campo | Detalle |
|---|---|
| **Archivos afectados** | `Codigo/css/views.css` |
| **Síntoma** | Los botones de producto en la grilla pegaban a los bordes de la pantalla sin margen |
| **Causa raíz** | Al quitar el padding de `#app` y el `.view` wrapper, `.pos-products-section` ya no heredaba el `padding-left/right` de `#app`. El padding estaba definido como `padding: var(--space-1) 0 var(--space-3)` (sin laterales) |
| **Corrección** | Cambiar a `padding: var(--space-2) var(--space-4) var(--space-3)` para agregar el padding lateral de `var(--space-4)` (16px) |
| **Impacto** | Visual: la grilla de productos no tenía márgenes laterales |

---

## Resumen de Archivos Modificados

| Archivo | Tipo de cambio |
|---|---|
| [`Codigo/css/views.css`](file:///c:/Users/Azrael/Documents/ProyectosApps/PWA%20AdminNegocio/Codigo/css/views.css) | BUG-001, BUG-002, BUG-003, BUG-004 |
| [`Codigo/js/views/pos.js`](file:///c:/Users/Azrael/Documents/ProyectosApps/PWA%20AdminNegocio/Codigo/js/views/pos.js) | BUG-002 (clase `.pos-header`) |
| [`Codigo/sw.js`](file:///c:/Users/Azrael/Documents/ProyectosApps/PWA%20AdminNegocio/Codigo/sw.js) | Bumped a `tamalitos-v6` |

---

## Verificación Pre-Deploy

| Check | Resultado |
|---|---|
| Syntax check (`node -c`) en pos.js, costos.js, historial.js | ✅ Sin errores |
| Todos los `import { ... }` vs exports reales de db.js, store.js, utils.js, router.js | ✅ Sin imports inválidos |
| Clases CSS usadas en pos.js existen en views.css | ✅ Todas presentes tras correcciones |
| Clases CSS usadas en historial.js existen en components.css | ✅ summary-grid, summary-card, card, badge-danger |
| SW v6 con nuevo CACHE_NAME | ✅ |

---

## Deploy Final

| Campo | Detalle |
|---|---|
| **Commit** | `fix(sprint-3): corregir layout POS dos-paneles, safe-area-top header, product-btn feedback y SW v6` |
| **Hash Git** | `3278274` |
| **URL producción** | https://pwa-admin-negocio.vercel.app |
| **Deployment ID** | `dpl_8yrFZ9p3tzFcDZKPjXhHFV9H1UkA` |
| **Service Worker** | `tamalitos-v6` |

