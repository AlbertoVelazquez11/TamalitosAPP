# Finanzas v3.1.0 — Feature Tasks

**Rama:** `feat/finanzas-v3.1.0` (desde `main` = v3.0.0)
**Versión objetivo:** 3.1.0 (MINOR: nueva característica Finanzas + fixes de dashboard)
**Estado:** ✅ Completada (código + verificación estructural + docs). Pendiente: validación funcional manual en dispositivo iOS.

## Contexto

- Nuevo módulo **Finanzas**: 3 montos (Caja, Fondo, Capital Financiero = Caja + Fondo).
- Caja: monto inicial manual libre; cada venta pagada suma; pago de fiado suma; cancelación de venta cobrada resta; costos descuentan.
- Fondo: crece solo por movimientos (desde Caja o desde Inversión). Inversión es solo origen, sin saldo propio.
- Fixes de dashboard: quitar "tipo de ingreso"; "Costo por producción" con info visible (iOS no muestra tooltip SVG) y máx 5 últimas.
- Acceso rápido en POS: icono discreto a la izquierda de Historial → modal Caja + resumen del día.

## Decisiones (Q1–Q4 resueltas)

1. Fiado suma a Caja **recién al confirmarse el pago**; cancelar venta cobrada **resta** de Caja.
2. "Costo por producción" = **barras** (altura = cantidad), con $costo/producto visibles y eje Y con escala. Máx 5 últimas.
3. Fondo solo por movimientos; Inversión sin saldo propio.
4. Caja con monto inicial manual libre (sin registro de origen).

## Tareas

- [x] **1. Migración DB v4** — `db.js` v3→v4. Stores `finanzas` + `movimientosFinanzas`, seed `caja=0, fondo=0`, helpers `getFinanzas`, `ajustarCaja`, `aplicarMovimiento`, `getMovimientosFinanzas`.
- [x] **2. Vista Finanzas** — `js/views/finanzas.js` + ruta `#/finanzas` + card en Administración (hub).
- [x] **3. Venta suma a Caja** — POS: venta pagada (no fiada, no sin-ingreso) → `caja += total`.
- [x] **4. Pago de fiado suma a Caja** — `historial.js`: al pagar fiado → `caja += total`.
- [x] **5. Cancelación resta a Caja** — `db.cancelarVenta`: si era pagada → `caja -= total`.
- [x] **6. Costos con fuente** — `costos.js`: selector Caja/Fondo; descuenta al guardar, revierte al eliminar.
- [x] **7. Dashboard: quitar "tipo de ingreso"** — eliminada la gráfica de pastel y su agregación.
- [x] **8. Dashboard: fix "Costo por producción"** — máx 5 últimas, info visible, eje Y con escala.
- [x] **9. POS: icono acceso rápido** — icono 💰 → modal Caja + ingresos/gastos/utilidad del día.
- [x] **10. Respaldo + versión** — `finanzas`/`movimientosFinanzas` en export/import; versión `3.1.0`; `CACHE_NAME` v20.
- [x] **11. QA + documentación** — verificación estructural (sintaxis + imports), README + `Documentacion/v3.1.0_cambios.md`.

## Evidencia de commits

| Tarea | Commit |
|---|---|
| 1, 5 | `9c98d8a` feat(db): migración v4 con stores de finanzas y API de movimientos |
| 2 | `58ecab3` feat(finanzas): vista, ruta y acceso desde Administración |
| 3, 4, 5, 9 | `ab83430` feat(finanzas): venta, pago de fiado y cancelación actualizan Caja |
| 6 | `fc49e48` feat(costos): fuente de dinero Caja/Fondo |
| 7, 8 | `541f4ce` fix(dashboard): quitar tipo de ingreso y corregir costo por producción |
| 10 | `9c4117e` chore(release): bump v3.1.0 y respaldo incluye finanzas |
| 11 | `8673e36` docs(v3.1.0): documentación de Finanzas y mejoras de dashboard |

## Verificación realizada

- `node --check` sobre 11 archivos modificados → OK.
- Resolución de `import()` (Node ESM) sobre 13 módulos → OK (sin exportaciones faltantes).
- Sin suite de tests (app vanilla sin runner); validación funcional manual pendiente en iOS.
