## WinGet Manager v1.0.2 🚀

Esta es la actualización más ambiciosa de **WinGet Manager**, introduciendo el **sistema de auto-actualización oficial integrado con GitHub**, puntos de restauración del sistema, rediseño del logo en alta resolución y optimizaciones globales de rendimiento.

---

### ✨ Novedades y Características Principales

#### 🔄 Sistema de Auto-Actualización Oficial (Auto-Updater)
- **Detección Automática**: Comprobación silenciosa al iniciar la aplicación contra GitHub Releases.
- **Búsqueda Manual**: Botón en la cabecera del panel lateral e indicador de versión en el header para verificar actualizaciones en cualquier momento.
- **Advertencia al Usuario**: Diálogo modal informativo con la versión actual, versión nueva y notas de lanzamiento antes de proceder.
- **Descarga con Telemetría**: Descarga interactiva que muestra velocidad (`MB/s`), MB transferidos y porcentaje en tiempo real.
- **Reemplazo e Instalación Segura**: Advertencia antes del cierre y ejecución desasociada del instalador para aplicar la nueva versión automáticamente.

#### 🛡️ Gestión Integrada de Puntos de Restauración
- Creación rápida de puntos de restauración de Windows antes de actualizar componentes sensibles.
- Listado, consulta y eliminación selectiva o masiva de instantáneas del sistema.
- Acceso directo en un clic al asistente oficial de Windows (`rstrui.exe`) y a la configuración de protección de disco.

#### 🎨 Identidad Visual y Estilo Glassmorphism
- **Nuevo Logo e Iconografía**: Integración del logo de alta resolución escalado a 24px en el header con resplandor antialiasing.
- **Aceleración por Hardware**: Animaciones y barras de progreso optimizadas con `will-change` para máxima fluidez y bajo consumo de CPU.

#### 🎮 Monitor de GPU y Suites Oficiales
- Detección precisa de hardware gráfico (NVIDIA GeForce, AMD Radeon, Intel Arc / Iris).
- Monitor de temperatura, consumo, uso de GPU y estado de los paneles de control.
- Enlace directo a suites certificadas de controladores.

#### 🔒 Blindaje Platform Shield (Desinstalador Limpio)
- Protección total de lanzadores de juegos: Steam, Epic Games Launcher, Ubisoft Connect, EA App, Riot Games, Battle.net y GOG Galaxy.
- Eliminación estricta de residuos sin tocar bibliotecas ni juegos instalados.

---

### 📦 Archivos Adjuntos a este Release

- **`WinGet Manager Setup 1.0.2.exe`** (Recomendado): Instalador interactivo oficial para Windows 10/11 con accesos directos, desinstalador y configuración de WinGet en la terminal.
- **`WinGet Manager 1.0.2.exe`**: Versión portable lista para ejecutar sin requerir instalación.

---

**Desarrollado con ❤️ por Jose Antonio Baeza Pineda (@joselyky)**