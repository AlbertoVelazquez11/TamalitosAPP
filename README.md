# 🫔 TamalitosAPP - Offline PWA (iOS WebKit Standalone)

Progressive Web App (PWA) optimizada y validada para funcionar en **iPhone / iOS Safari** en modo pantalla completa (**Standalone**) y con soporte **100% Offline** mediante Service Workers y LocalStorage.

---

## 📂 Estructura del Proyecto

```text
TamalitosAPP/
├── Codigo/                     # Código fuente de la Progressive Web App
│   ├── icons/                  # Iconos generados para iOS y Android
│   │   ├── apple-touch-icon.png# Icono estándar 180x180 para iOS Safari
│   │   ├── icon-192.png        # Icono 192x192
│   │   ├── icon-512.png        # Icono 512x512
│   │   └── icon.svg            # Vectorial SVG
│   ├── generate-icons.js       # Script generador de iconos
│   ├── index.html              # UI, App Shell, Safe Area y controladores
│   ├── manifest.json           # Web App Manifest (standalone, colores)
│   └── sw.js                   # Service Worker puro (v2) con estrategia Offline-First
│
├── Documentacion/              # Documentación de ingeniería y producto
│   ├── arquitectura.md         # Diagrama de capas, ciclo de vida del SW y WebKit
│   ├── flujo.md                # Flujos de instalación, interceptación de caché y offline
│   └── historias_usuario.md    # Historias de usuario y criterios de aceptación (Gherkin)
│
├── .gitignore                  # Exclusiones de control de versiones
├── .vercelignore               # Exclusiones para despliegue
├── vercel.json                 # Enrutamiento automático hacia Codigo/
└── README.md                   # Resumen del proyecto
```

---

## 🚀 Características Principales

- **Soporte iOS WebKit Completo:**
  - Metaetiquetas específicas para Safari (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`).
  - Ajuste de pantalla para Dynamic Island y Notch (`viewport-fit=cover` con safe-area insets).
  - Iconos PNG estándar generados específicamente para `apple-touch-icon`.
- **Modo Standalone Nativo:**
  - Detección en tiempo real de si la aplicación se ejecuta dentro del navegador Safari o instalada en la pantalla de inicio (`navigator.standalone`).
- **100% Offline (Service Worker v2):**
  - Precacheo de la App Shell (`install`).
  - Limpieza automática de versiones obsoletas (`activate`).
  - Estrategia Cache-First con Stale-While-Revalidate y fallback de navegación garantizado para carga sin internet.
- **Persistencia Local:**
  - Almacenamiento y recuperación de datos con `localStorage`.
- **Diagnóstico en Pantalla:**
  - Indicador de conectividad de red en tiempo real (`online` / `offline`).
  - Consola de logs visual en la propia UI para depuración directa en dispositivos móviles.

---

## 📱 Instalación en iPhone

1. Abre la URL del proyecto en **Safari** (por HTTPS).
2. Toca el botón **Compartir** (icono de cuadrado con flecha hacia arriba).
3. Selecciona **"Agregar al inicio"** (*Add to Home Screen*).
4. Confirma el nombre `TamalitosAPP` y presiona **Agregar**.
5. Abre la aplicación desde el nuevo icono en tu pantalla de inicio.
6. Activa el **Modo Avión** para comprobar que la app carga y opera sin conexión.

---

## 📖 Documentación Adicional
- [Arquitectura del Sistema](Documentacion/arquitectura.md)
- [Diagramas de Flujo de Datos y Usuario](Documentacion/flujo.md)
- [Historias de Usuario](Documentacion/historias_usuario.md)
