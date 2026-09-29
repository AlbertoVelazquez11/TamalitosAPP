# 🫔 TamalitosAPP — PWA Offline para Administración de Negocio de Tamales

Progressive Web App (PWA) **100% Offline** diseñada para la operación diaria de un negocio de venta de tamales. Optimizada para **iPhone e iPad** en modo Standalone (pantalla completa, sin barra de Safari).

---

## 📂 Estructura del Proyecto

```text
TamalitosAPP/
├── Codigo/                                    # Código fuente de la PWA
│   ├── icons/                                 # Iconos (PNG + SVG)
│   ├── css/                                   # (Sprint 1) Design System
│   ├── js/                                    # (Sprint 1) Lógica SPA modular
│   ├── index.html                             # Shell HTML único
│   ├── manifest.json                          # Web App Manifest
│   ├── sw.js                                  # Service Worker Offline-First
│   └── generate-icons.js                      # Generador de iconos
│
├── Documentacion/                             # Especificación técnica completa
│   ├── fase1_analisis_brechas.md              # Análisis de vacíos y recomendaciones MVP
│   ├── fase2_arquitectura.md                  # Arquitectura, modelo de datos y design system
│   ├── fase3_historias_usuario.md             # Épicas, HUs y criterios de aceptación (Gherkin)
│   └── fase4_plan_trabajo.md                  # Plan de 5 sprints con WBS y trazabilidad
│
├── .gitignore
├── .vercelignore
├── vercel.json
└── README.md
```

---

## 🧩 Módulos Funcionales

| Módulo | Pantalla | Ruta | Descripción |
|---|---|---|---|
| Home | Dashboard | `#/` | Logo, versión, accesos a venta, insumos y configuración |
| POS | Terminal de Venta | `#/venta` | Grilla de productos, comanda, cobro y ticket digital |
| Historial | Ventas del Día | `#/historial` | Lista cronológica con filtro, resumen diario y cancelación |
| Insumos | Hub + Catálogo | `#/insumos-costos` `#/insumos` | Catálogo de insumos con swipe-to-delete |
| Costos | Registro de Gastos | `#/costos` | Formulario de egresos con historial por fecha |
| Config | Configuración | `#/config` | Nombre del negocio, admin productos, exportar datos |
| Productos | CRUD Productos | `#/productos` | Alta, edición, desactivación del catálogo de venta |

---

## 📖 Documentación Técnica

- [Fase 1 — Análisis de Brechas y Flujos Inconclusos](Documentacion/fase1_analisis_brechas.md)
- [Fase 2 — Arquitectura, Modelo de Datos y Design System](Documentacion/fase2_arquitectura.md)
- [Fase 3 — Épicas e Historias de Usuario (Gherkin)](Documentacion/fase3_historias_usuario.md)
- [Fase 4 — Plan de Trabajo en 5 Sprints](Documentacion/fase4_plan_trabajo.md)
- [Sprint 5 — Auditoría iOS, QA y Lanzamiento](Documentacion/sprint5_qa.md)

---

## ✅ Estado del Proyecto

| Sprint | Alcance | Estado |
|---|---|---|
| 1 | Core PWA: shell, IndexedDB, router, store, Home | ✅ |
| 2 | Catálogos: productos, insumos, swipe-to-delete | ✅ |
| 3 | POS, costos, historial básico | ✅ |
| 4 | Historial (filtros, utilidad, cancelación 24h), exportación CSV y respaldo JSON | ✅ |
| 5 | Pulido iOS, QA y lanzamiento v1.0.0 | ✅ |

> **v1.0.0 finalizada.** El desarrollo de nuevas funciones y ajustes continúa
> en la rama `develop` (versión **2.0.0**).

### 📤 Exportación y respaldo (Sprint 4)
- **CSV** de ventas y gastos filtrado por día, semana, mes o año (Web Share API + fallback de descarga).
- **Respaldo completo** en JSON con todas las tablas de IndexedDB.
- **Importación** de respaldo validado, con resumen previo y confirmación.

---

## 🚀 Stack Técnico

- **Frontend:** HTML5 + CSS3 + JavaScript ES6 (Vanilla, sin framework)
- **Persistencia:** IndexedDB (datos transaccionales) + localStorage (configuración)
- **Offline:** Service Worker con estrategia Cache-First / Stale-While-Revalidate
- **Exportación:** Web Share API (iOS nativo) + CSV con BOM UTF-8
- **Despliegue:** Vercel (HTTPS automático, requerido por iOS para Service Workers)

---

## 📱 Instalación en iPhone / iPad

1. Abre la URL del proyecto en **Safari** (por HTTPS).
2. Toca el botón **Compartir** (icono de cuadrado con flecha arriba).
3. Selecciona **"Agregar al inicio"**.
4. Abre la app desde el icono en tu pantalla de inicio.
5. Activa el **Modo Avión** para comprobar el funcionamiento offline.
