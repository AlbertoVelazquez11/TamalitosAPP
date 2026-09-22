# 🫔 TamalitosAPP - Offline PWA (iOS WebKit Standalone)

Progressive Web App (PWA) optimizada y validada para funcionar en **iPhone / iOS Safari** en modo pantalla completa (**Standalone**) y con soporte **100% Offline** mediante Service Workers y LocalStorage.

---

## 🚀 Características

- **Soporte iOS WebKit Completo:**
  - Metaetiquetas específicas para Safari (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`).
  - Ajuste de pantalla para Dynamic Island y Notch (`viewport-fit=cover` con safe-area insets).
  - Iconos PNG estándar generados específicamente para `apple-touch-icon`.
- **Modo Standalone Nativo:**
  - Detección en tiempo real de si la aplicación se ejecuta dentro del navegador Safari o instalada en la pantalla de inicio (`navigator.standalone`).
- **100% Offline (Service Worker puro):**
  - Precacheo de la App Shell (`install`).
  - Limpieza automática de versiones obsoletas (`activate`).
  - Estrategia Cache-First con Stale-While-Revalidate y fallback de navegación para carga sin internet.
- **Persistencia Local:**
  - Almacenamiento y recuperación de datos con `localStorage`.
- **Diagnóstico en Pantalla:**
  - Indicador de estado de red en tiempo real (`online` / `offline`).
  - Consola de logs visual en la propia UI para depurar en dispositivos móviles.

---

## 📂 Estructura del Proyecto

```text
TamalitosAPP/
├── icons/
│   ├── apple-touch-icon.png  # Icono 180x180 para iOS Home Screen
│   ├── icon-192.png          # Icono 192x192 para Android/PWA
│   ├── icon-512.png          # Icono 512x512 para SplashScreen
│   └── icon.svg              # Vectorial SVG
├── generate-icons.js         # Generador de iconos sin dependencias
├── index.html                # App Shell, UI y registro de SW
├── manifest.json             # Web App Manifest
├── sw.js                     # Service Worker con caché offline
├── .gitignore                # Exclusiones de Git
└── README.md
```

---

## 📱 Instalación en iPhone

1. Abre la URL en **Safari** (debe ser HTTPS).
2. Toca el botón **Compartir** (icono de cuadrado con flecha hacia arriba).
3. Selecciona **"Agregar al inicio"** (*Add to Home Screen*).
4. Asigna el nombre y presiona **Agregar**.
5. Abre la aplicación desde el icono en la pantalla de inicio.
6. Activa el **Modo Avión** para verificar que sigue funcionando offline.
