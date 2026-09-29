# Sprint 5 — Auditoría iOS, QA y Lanzamiento

**Fecha:** 2026-09-29  
**Objetivo:** Pulido final de la experiencia en iOS, verificación de rendimiento, respaldo de assets, actualización de documentación y preparación de la versión 1.0.0.

---

## Resumen Ejecutivo

| # | Tarea | Estado |
|---|---|---|
| 5.1 | Auditoría Safe Area Insets | ✅ Verificado |
| 5.2 | Auditoría de gestos táctiles | ✅ Verificado |
| 5.3 | Rendimiento de listas largas (paginación) | ✅ Implementado |
| 5.4 | Prevención de zoom en inputs | ✅ Verificado |
| 5.5 | Persistencia ante purga WebKit | 📝 Documentado |
| 5.6 | Prueba E2E manual | 📋 Checklist |
| 5.7 | `ASSETS_TO_CACHE` completo | ✅ Verificado |
| 5.8 | README y documentación | ✅ Actualizado |
| 5.9 | Desplegar v1.0.0 en Vercel | ⏳ A ejecutar |
| 5.10 | Verificación Lighthouse PWA | ⏳ Manual / CI |

---

## 5.1 — Auditoría de Safe Area Insets

**Conclusión:** ✅ Los insets ya están cubiertos correctamente.

| Punto | Manejo |
|---|---|
| Padding global | `#app` aplica `max(var(--space-N), var(--safe-*))` en los 4 lados (`base.css`) |
| POS | `#app.pos-active` elimina el padding y `.pos-header` restaura `padding-top: max(var(--space-4), var(--safe-top))` (fix BUG-002) |
| Panel de comanda | `.order-panel__footer` usa `padding-bottom: max(var(--space-4), var(--safe-bottom))` |
| Modales | `.modal` usa `padding-bottom: max(var(--space-6), var(--safe-bottom))` |
| Toasts | `.toast-container` usa `bottom: max(var(--space-6), var(--safe-bottom))` |
| iPhone SE (sin notch) | `env(safe-area-inset-*) = 0` → cae al `max()` con espaciado mínimo |

**Pendiente (manual):** prueba visual en iPhone SE, iPhone 14+ (Dynamic Island) y iPad.

---

## 5.2 — Auditoría de Gestos Táctiles

**Conclusión:** ✅ Swipe-to-delete y scroll vertical no interfieren entre sí.

| Punto | Manejo |
|---|---|
| Dirección del gesto | `gestures.js` determina el eje una sola vez con umbral de 10px; solo horizontal activa `preventDefault()` |
| Scroll vertical | `.swipe-item { touch-action: pan-y }` permite el scroll nativo |
| Pull-to-refresh | `html { overscroll-behavior-y: contain }` + `body { position: fixed }` |
| Swipe-back iOS | Se reserva a los primeros ~20px del borde izquierdo; los items están dentro de un contenedor con padding lateral, por lo que no compiten |

**Pendiente (manual):** verificar que el swipe-back del sistema no se dispare al deslizar un item cerca del borde.

---

## 5.3 — Rendimiento de Listas Largas

**Cambio implementado en `js/views/historial.js`:**

- Paginación **"Cargar más"** con `PAGE_SIZE = 50`.
- Los detalles de cada página se consultan con `Promise.all()` (paralelo) en lugar de transacciones secuenciales (N+1).
- El DOM solo contiene las tarjetas visibles hasta el momento, manteniendo 60fps en iPhone.

---

## 5.4 — Prevención de Zoom en Inputs

**Conclusión:** ✅ Cubierto.

- `base.css`: `input, select, textarea, button { font-size: var(--font-size-base) }` → 16px (mínimo para evitar zoom en iOS).
- `index.html`: viewport con `maximum-scale=1.0, user-scalable=no, viewport-fit=cover`.

---

## 5.5 — Persistencia ante Purga de WebKit

**Comportamiento documentado (fase1 §6.5):**

- iOS WebKit asigna hasta ~1 GB a IndexedDB por origen, pero puede purgar orígenes no usados en 7+ días (ITP).
- Al ser una PWA instalada en Home Screen y de uso diario, iOS la trata como app activa y **no purga** su almacenamiento.
- Mitigación: botón **Exportar Respaldo Completo** (JSON) disponible en Configuración.

---

## 5.6 — Prueba E2E Manual (Checklist)

Escenario completo a validar en dispositivo físico:

- [ ] Configurar nombre del negocio y logo.
- [ ] Crear productos (activos e inactivos).
- [ ] Crear insumos y registrar gastos.
- [ ] Vender productos (comanda, descuento, cobro y fiado).
- [ ] Ver historial con resumen de utilidad.
- [ ] Cancelar una venta < 24h y verificar que no se pueda cancelar una > 24h.
- [ ] Exportar CSV de ventas y gastos (día/semana/mes/año).
- [ ] Exportar respaldo JSON y restaurarlo (en este u otro dispositivo).
- [ ] Verificar funcionamiento 100% offline (Modo Avión).

---

## 5.7 — `ASSETS_TO_CACHE` del Service Worker

**Conclusión:** ✅ Completo.

Se verificó contra el árbol real de `Codigo/`:

- 4 CSS, 1 HTML, 1 manifest, 21 módulos JS (core + componentes + vistas), y 5 iconos usados por `index.html`.
- Nota: `Codigo/icons/icon.svg` existe pero no se referencia en `index.html` ni en `manifest.json`; no afecta el modo offline. Puede eliminarse o enlazarse en el futuro.

---

## 5.8 — Documentación

- `README.md`: agregada la sección **Estado del Proyecto** con el progreso por sprint y la descripción de exportación/respaldo.
- Este documento (`sprint5_qa.md`) registra la auditoría de QA.

---

## 5.9 — Despliegue v1.0.0 en Vercel

Ejecutar `node deploy.js` (usa la sesión CLI de Vercel y, como fallback, el token de `auth.json`).

---

## 5.10 — Verificación Lighthouse PWA

Ejecutar Lighthouse en Chrome DevTools sobre la URL de producción.

**Target:** PWA score = 100, Performance > 90.

**Pendiente:** requiere navegador con Chrome/Lighthouse o CI.
