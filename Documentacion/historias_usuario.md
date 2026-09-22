# 📋 Historias de Usuario - TamalitosAPP

Este documento recopila las historias de usuario base que definen los requerimientos funcionales y técnicos de la aplicación móvil PWA con enfoque Offline-First.

---

### HU-001: Instalación en Pantalla de Inicio de iOS (Modo Standalone)
**Como** dueño de negocio o usuario de iPhone,  
**Quiero** poder agregar la aplicación a la pantalla de inicio desde Safari,  
**Para** abrirla directamente como si fuera una aplicación nativa sin barras de navegación ni menús del navegador.

#### Criterios de Aceptación:
- **Dado** que accedo a la URL de la app en Safari por HTTPS.
- **Cuando** selecciono el botón *Compartir* y elijo *"Agregar al inicio"*.
- **Entonces** se debe visualizar el icono oficial de la app con el nombre `TamalitosAPP`.
- **Cuando** toco el icono desde la pantalla de inicio.
- **Entonces** la app se debe abrir a pantalla completa sin barra de direcciones de Safari y el detector debe mostrar `📱 Standalone PWA (Instalada)`.

---

### HU-002: Ejecución 100% Offline (Sin Conexión)
**Como** usuario que opera en zonas sin cobertura o con intermitencia de red,  
**Quiero** que la aplicación abra y cargue inmediatamente aunque no tenga internet o esté en Modo Avión,  
**Para** no interrumpir la operación del negocio en ningún momento.

#### Criterios de Aceptación:
- **Dado** que la app ya fue abierta al menos una vez mientras había conexión a internet (precacheo completado).
- **Cuando** pongo el dispositivo en *Modo Avión* y abro la app desde la pantalla de inicio.
- **Entonces** la interfaz debe cargar en menos de 1 segundo sin mostrar errores de red tipo *"Safari no puede abrir la página"*.
- **Y** el indicador visual de conectividad debe cambiar a `OFFLINE (Sin Red)`.

---

### HU-003: Persistencia Local de Datos
**Como** usuario de TamalitosAPP,  
**Quiero** guardar notas, registros o pedidos en la memoria local del dispositivo,  
**Para** que la información permanezca disponible y no se pierda al cerrar la app o apagar el teléfono.

#### Criterios de Aceptación:
- **Dado** que estoy dentro de la app (ya sea online u offline).
- **Cuando** escribo un dato y presiono el botón *"Guardar"*.
- **Entonces** la información queda almacenada en el `localStorage` con su marca de tiempo correspondiente.
- **Cuando** cierro la aplicación desde el multitarea de iOS y la vuelvo a abrir.
- **Y** presiono el botón *"Leer"*.
- **Entonces** la app debe mostrar exactamente la información que guardé previamente.

---

### HU-004: Monitoreo en Tiempo Real del Estado de Red y Service Worker
**Como** desarrollador o administrador del negocio,  
**Quiero** ver en pantalla el estado del Service Worker y el cambio de conectividad en tiempo real,  
**Para** tener certeza del comportamiento técnico sin necesidad de conectar el teléfono a una computadora para depurar.

#### Criterios de Aceptación:
- **Dado** que la aplicación está abierta.
- **Cuando** el Service Worker se registra exitosamente.
- **Entonces** el estado del Service Worker debe mostrar `✅ Activo (Controlando la app)`.
- **Cuando** el usuario activa o desactiva la conexión Wi-Fi/Datos móviles.
- **Entonces** el badge superior debe actualizarse automáticamente entre `ONLINE (Conectado)` y `OFFLINE (Sin Conexión)` sin necesidad de recargar la página.
- **Y** la caja de logs debe registrar el evento con la hora exacta.

---

### HU-005: Actualización Automática y Limpieza de Versiones Previas
**Como** equipo de desarrollo,  
**Quiero** que al publicar una nueva versión del Service Worker se borren las cachés antiguas,  
**Para** asegurar que los usuarios reciban las mejoras sin experimentar inconsistencias de versiones.

#### Criterios de Aceptación:
- **Dado** que un usuario tiene instalada la versión `offline-pwa-v1`.
- **Cuando** se despliega en producción la versión `offline-pwa-v2`.
- **Entonces** el evento `activate` del Service Worker debe detectar y eliminar `offline-pwa-v1`.
- **Y** tomar el control de la aplicación llamando a `clients.claim()`.
