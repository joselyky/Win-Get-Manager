<div align="center">

  <img src="logo.png" alt="WinGet Manager Logo" width="110" height="110" style="border-radius: 50%; box-shadow: 0 8px 32px rgba(110, 231, 183, 0.35);" />

  # WinGet Manager

  ### *El panel de control visual definitivo para gestionar, actualizar y desinstalar software en Windows.*

  [![GitHub Release](https://img.shields.io/github/v/release/joselyky/Win-Get-Manager?color=6ee7b7&label=Versi%C3%B3n&style=for-the-badge)](https://github.com/joselyky/Win-Get-Manager/releases/latest)
  [![Platform](https://img.shields.io/badge/Plataforma-Windows%2010%20%7C%2011-0078d4?style=for-the-badge&logo=windows)](https://github.com/joselyky/Win-Get-Manager)
  [![Engine](https://img.shields.io/badge/Motor-WinGet%20%2B%20Electron-4f8ef7?style=for-the-badge&logo=electron)](https://github.com/joselyky/Win-Get-Manager)
  [![License](https://img.shields.io/badge/Licencia-GPLv3-34d399?style=for-the-badge)](LICENSE)

  <br />

  <p align="center">
    <b>WinGet Manager</b> convierte el Administrador de Paquetes de Windows (<code>winget</code>) en una experiencia visual moderna, fluida y accesible para todo el mundo. Sin comandos complejos de consola, sin configuraciones confusas: escanea tu equipo, actualiza todos tus programas con un clic, elimina software sin dejar rastros y protege tu sistema en tiempo real.
  </p>

  <p align="center">
    <a href="#-descarga-e-instalación"><strong>Descargar Instalador »</strong></a> •
    <a href="#-seguridad-confianza-y-privacidad-garantizada"><strong>Seguridad & Confianza</strong></a> •
    <a href="#-características-destacadas">Características</a> •
    <a href="#-módulos-de-la-interfaz">Módulos</a>
  </p>

</div>

---

## 💡 ¿De qué va WinGet Manager?

Microsoft introdujo **WinGet** como la herramienta oficial por línea de comandos para instalar y actualizar programas en Windows. Sin embargo, tener que abrir PowerShell o CMD, recordar comandos o lidiar con parámetros silenciosos hace que la mayoría de usuarios descuiden sus actualizaciones o usen desinstaladores comerciales de dudosa procedencia.

**WinGet Manager** nace para solucionar esto:
1. **Centraliza todo tu software** en una interfaz intuitiva con estética moderna *Windows 11 Glassmorphism* (diseño translúcido y oscuro de alto rendimiento).
2. **Automatiza la búsqueda de actualizaciones** detectando qué versiones tienes instaladas y cuáles están disponibles en el catálogo oficial de Microsoft.
3. **Desinstala de forma limpia** cualquier aplicación, rastreando y eliminando carpetas residuales y claves del registro huérfanas.
4. **Protege tus videojuegos y plataformas**: Cuenta con un escudo (*Platform Shield*) para evitar que al desinstalar un juego se dañen lanzadores como Steam o Epic Games.
5. **Se auto-actualiza**: Se conecta de forma segura a este repositorio de GitHub y te avisa cuando existe una nueva versión oficial lista para instalar.

---

## 🛡️ Seguridad, Confianza y Privacidad Garantizada

WinGet Manager ha sido desarrollado bajo un modelo de **tolerancia cero al malware, control absoluto del usuario y total transparencia**:

### 🔒 1. Descargas Exclusivas de Fuentes Oficiales (SHA-256)
* **Infraestructura oficial de Microsoft**: Todas las aplicaciones provienen del repositorio verificado de Microsoft ([winget-pkgs](https://github.com/microsoft/winget-pkgs)) y de los servidores de descarga directos del desarrollador original (ej. Mozilla, Google, Discord, Valve).
* **Verificación Criptográfica**: Cada instalador se comprueba mediante su hash **SHA-256** oficial antes de ejecutarse, garantizando que el archivo no ha sido manipulado ni alterado.
* **Cero intermediarios**: No utilizamos proxies, mirrors de terceros ni instaladores empaquetados con publicidad (*bundleware* o barras de herramientas).

### 🛡️ 2. Blindaje Activo del Sistema y Lanzadores
* **Integridad del SO protegida**: La aplicación jamás toca ni modifica directorios protegidos de Windows (`C:\Windows\System32`, `WinSxS` o registros de arranque).
* **Platform Shield**: Al desinstalar videojuegos, un escudo activo protege los directorios raíz de **Steam, Epic Games, Ubisoft Connect, EA App, Riot Games, Battle.net y GOG Galaxy**, impidiendo que se borren librerías compartidas o lanzadores por error.
* **Solo residuos confirmados**: El limpiador profundo únicamente purga carpetas huérfanas en `%AppData%` y claves obsoletas del registro vinculadas de forma demostrable al programa eliminado.

### 👤 3. Cero Acciones Automáticas (Control Total en tus Manos)
* **Consentimiento explícito**: Nada se actualiza, instala o desinstala a tus espaldas. Cada acción requiere que selecciones las casillas correspondientes y confirmes la operación.
* **Sin tareas ocultas**: No se ejecutan servicios residentes ni tareas invisibles en segundo plano que consuman recursos o modifiquen archivos sin que te enteres.
* **Consola de Registros en Directo**: Tienes a tu disposición la salida oficial en tiempo real de cada comando ejecutado en streaming.

### 💾 4. Puntos de Restauración y Código Abierto
* **Rollback nativo de Windows**: Posibilidad de generar instantáneas del sistema operativo (`rstrui.exe`) con un clic antes de cualquier cambio para revertir fácilmente cualquier imprevisto.
* **100% Código Abierto (GPLv3)**: Todo el código fuente de WinGet Manager está publicado en este repositorio de GitHub bajo licencia libre GNU GPLv3 para ser auditado por cualquier desarrollador del mundo.
* **Ejecución 100% Local**: No requiere registro, no recopila contraseñas ni datos personales y no contiene telemetría invasiva. Tus datos nunca abandonan tu ordenador.

---

## 🌟 Características Destacadas

### 🔄 1. Auto-Actualización Inteligente (Auto-Updater)
- **Detección continua**: Al iniciar el programa, comprueba si existe una versión más reciente en GitHub Releases.
- **Aviso y control total**: Antes de descargar nada, se muestra un modal interactivo con las notas de la versión y las novedades.
- **Descarga con métricas en vivo**: Visualiza el porcentaje completado, tamaño transferido y velocidad en tiempo real (`MB/s`).
- **Reinicio fluido**: El programa se cierra de forma segura e inicia el instalador actualizado sin requerir intervención manual compleja.

### ⚡ 2. Gestor de Actualizaciones en Tiempo Real
- **Detección en segundos**: Escaneo optimizado mediante el catálogo oficial de Microsoft.
- **Actualizar Todo o Individual**: Elige actualizar una sola app o lanza la cola de actualización masiva con un clic.
- **Filtros por categorías**: Clasificación inteligente entre aplicaciones cotidianas, juegos y utilidades del sistema.
- **Historial de registros en directo**: Visualiza la salida oficial de WinGet en una consola integrada desplegable.

### 🛡️ 3. Desinstalador Limpio con Platform Shield
- **Eliminación profunda de residuos**: Analiza rutas comunes (`%ProgramFiles%`, `%AppData%`, `%LocalAppData%`, `ProgramData`) y el Registro de Windows (`HKLM` y `HKCU`) para eliminar carpetas huérfanas que los desinstaladores convencionales dejan atrás.
- **Blindaje inviolable para juegos**: Protección integrada para **Epic Games, Steam, Ubisoft Connect, EA App / Origin, Riot Games, Battle.net y GOG Galaxy**. Puedes desinstalar un juego individual con la total certeza de que tu lanzador y el resto de tu biblioteca permanecerán intactos.

### 🎮 4. Monitor de GPU y Suites Oficiales de Controladores
- **Identificación de hardware**: Reconoce tarjetas gráficas **NVIDIA GeForce**, **AMD Radeon** e **Intel Arc / Iris**.
- **Telemetría en tiempo real**: Monitoriza uso de VRAM, temperatura de la GPU, consumo energético y resolución de pantalla.
- **Suites certificadas**: Accesos directos para descargar e instalar paneles de control oficiales (GeForce Experience, AMD Software, Intel Graphics Command Center).

### 💾 5. Gestión de Puntos de Restauración de Windows
- **Protección previa**: Crea una instantánea del sistema operativo antes de instalar drivers o desinstalar programas críticos.
- **Gestor integrado**: Consulta cuántos puntos de restauración existen, elimínalos selectivamente para liberar espacio o abre el asistente oficial `rstrui.exe` directamente.

### ⚡ 6. Actualizaciones Masivas en Lote y Filtros Rápidos
- **Cola desatendida**: Selecciona múltiples programas o actualiza todo tu catálogo de una sola vez en segundo plano.
- **Selector inteligente**: Filtra por categorías, detecta versiones en segundos y olvídate de interactuar con instaladores uno por uno.

---

## 🖥️ Módulos de la Interfaz

| Módulo | Icono | Propósito |
| :--- | :---: | :--- |
| **Actualizaciones** | 🔄 | Panel principal con la tabla de software desactualizado, filtros de búsqueda, selector múltiple y cola en tiempo real. |
| **Desinstalador Limpio** | 🗑️ | Lista completa de programas instalados con detección de tamaño, versión, fecha de instalación y botón de purga residual. |
| **Gráficos & Control** | 🎮 | Panel de métricas térmicas, consumo de GPU, estado de los controladores y descarga de drivers oficiales. |
| **Puntos de Restauración** | 🛡️ | Creación y administración de copias de seguridad del estado del sistema operativo. |
| **Auto-Updater** | 🚀 | Modal interactivo que descarga e instala nuevas versiones publicadas en GitHub. |

---

## 📥 Descarga e Instalación

### Opción 1: Instalador Oficial (Recomendado)
Descarga el archivo **`WinGet Manager Setup 1.0.2.exe`** desde la sección de [**Releases**](https://github.com/joselyky/Win-Get-Manager/releases/latest).
- Incluye asistente guiado de instalación en español.
- Crea accesos directos en el Escritorio y Menú Inicio.
- Registra automáticamente `winget` en tu terminal de Windows si tu sistema no lo tenía activo.
- Soporta desinstalación limpia desde el Panel de Control de Windows.

### Opción 2: Versión Portable
Descarga **`WinGet Manager 1.0.2.exe`** para ejecutar la herramienta directamente sin instalación previa (ideal para llevar en una memoria USB).

---

## ⚙️ Requisitos del Sistema

- **Sistema Operativo:** Windows 10 (versión 1809 o posterior) o Windows 11 (64 bits).
- **Herramienta WinGet:** Incluida de fábrica en Windows 11 y Windows 10 actualizado *(si falta, el asistente la instala automáticamente)*.
- **Permisos de Administrador:** Necesarios para modificar software a nivel del sistema y crear puntos de restauración.

---

## 🛠️ Para Desarrolladores

Si deseas compilar o contribuir al proyecto:

```bash
# 1. Clonar el repositorio
git clone https://github.com/joselyky/Win-Get-Manager.git
cd Win-Get-Manager

# 2. Instalar dependencias
npm install

# 3. Iniciar en modo desarrollo
npm start

# 4. Compilar instaladores listos para producción
npm run build
```

---

## 📜 Licencia

Este proyecto está protegido bajo la licencia **GNU General Public License v3.0 (GPLv3)**. Eres libre de usar, estudiar y contribuir al código fuente. Cualquier redistribución o trabajo derivado está obligado legalmente a permanecer bajo la misma licencia GPLv3, ser de código abierto y mantener el reconocimiento explícito a la autoría original. Consulta el archivo [LICENSE](LICENSE) para más detalles.

<div align="center">
  <sub>Desarrollado con dedicación por <b><a href="https://github.com/joselyky">Jose Antonio Baeza Pineda (@joselyky)</a></b></sub>
</div>
