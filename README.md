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
