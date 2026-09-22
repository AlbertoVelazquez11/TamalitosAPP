# 🔄 Diagramas y Flujos de TamalitosAPP

Este documento describe los tres flujos operacionales esenciales de la aplicación: el proceso de instalación en iOS, el ciclo de vida del Service Worker ante peticiones de red y la experiencia de usuario en modo offline.

---

## 1. Flujo de Instalación en iOS Safari ("Agregar al Inicio")

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Usuario (iPhone)
    participant Safari as Safari Browser
    participant SW as Service Worker
    participant Cache as Cache Storage
    participant iOS as Sistema Operativo iOS

    Usuario->>Safari: Abre URL (HTTPS)
    Safari->>SW: Registra sw.js
    SW->>Cache: Precachea index.html, manifest.json, iconos
    SW-->>Safari: Service Worker Activo (Controlando la app)
    Safari-->>Usuario: Muestra UI (Modo: Navegador Safari)
    
    Usuario->>Safari: Toca botón Compartir
    Usuario->>Safari: Selecciona "Agregar al inicio"
    Safari->>iOS: Solicita crear acceso con apple-touch-icon.png
    iOS-->>Usuario: Icono TamalitosAPP agregado a Pantalla de Inicio

    Usuario->>iOS: Toca icono TamalitosAPP
    iOS->>SW: Abre en contenedor Standalone (sin barras de Safari)
    SW->>Cache: Sirve index.html instantáneamente
    SW-->>Usuario: Muestra UI (Modo: Standalone PWA)
```

---

## 2. Flujo de Intercepción de Peticiones y Caché (Service Worker)

```mermaid
flowchart TD
    Start([Petición Fetch entrante]) --> CheckType{¿Tipo de petición?}
    
    %% Flujo de Navegación HTML
    CheckType -->|mode == 'navigate'| CacheCheckNav{¿index.html en caché?}
    CacheCheckNav -->|Sí| ServeCachedNav[Devolver index.html de Caché inmediatamente]
    ServeCachedNav --> BackgroundSync[Intentar actualizar en segundo plano si hay red]
    CacheCheckNav -->|No| NetNav[Solicitar a la red]
    NetNav -->|Éxito| SaveNav[Guardar copia en caché] --> ReturnNetNav[Devolver respuesta de red]
    NetNav -->|Fallo / Offline| FallbackNav[Fallback a index.html en caché]
    
    %% Flujo de Assets Estáticos
    CheckType -->|GET de Assets: imágenes, scripts, css| CacheCheckAsset{¿Asset en caché?}
    CacheCheckAsset -->|Sí| ServeAsset[Servir desde Caché]
    ServeAsset --> Revalidate[Revalidar en segundo plano con la red]
    CacheCheckAsset -->|No| FetchNetAsset[Descargar de la Red]
    FetchNetAsset -->|Éxito| PutAssetCache[Almacenar en caché para futuras visitas]
    PutAssetCache --> ReturnAsset[Devolver respuesta al cliente]
    FetchNetAsset -->|Fallo / Offline| ReturnNothing[Retornar error silencioso / fallback]
```

---

## 3. Flujo de Usuario y Persistencia Offline

```mermaid
flowchart LR
    A[Usuario abre la App] --> B{¿Hay conexión a internet?}
    
    B -->|Sí (Online)| C[Badge verde ONLINE]
    B -->|No (Offline / Modo Avión)| D[Badge rojo OFFLINE]
    
    C --> E[Usuario introduce datos de ventas/pedidos]
    D --> E
    
    E --> F[Presiona Guardar]
    F --> G[(LocalStorage del Dispositivo)]
    G --> H[Confirmación visual inmediata en pantalla]
    
    H --> I[Cerrar app / Reiniciar dispositivo]
    I --> J[Reabrir TamalitosAPP sin conexión]
    J --> K[Presiona Leer]
    K --> L[Datos recuperados intactos desde LocalStorage]
```
