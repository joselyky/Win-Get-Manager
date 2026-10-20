<div align="center">

  <img src="logo.png" alt="WinGet Manager Logo" width="110" height="110" style="border-radius: 50%; box-shadow: 0 8px 32px rgba(110, 231, 183, 0.35);" />

  # WinGet Manager

  ### *El panel de control visual definitivo para gestionar, actualizar y desinstalar software en Windows.*

  [![GitHub Release](https://img.shields.io/github/v/release/joselyky/Win-Get-Manager?color=6ee7b7&label=Versi%C3%B3n&style=for-the-badge)](https://github.com/joselyky/Win-Get-Manager/releases/latest)
  [![Platform](https://img.shields.io/badge/Plataforma-Windows%2010%20%7C%2011-0078d4?style=for-the-badge&logo=windows)](https://github.com/joselyky/Win-Get-Manager)
  [![Engine](https://img.shields.io/badge/Motor-WinGet%20%2B%20Electron-4f8ef7?style=for-the-badge&logo=electron)](https://github.com/joselyky/Win-Get-Manager)
  [![License](https://img.shields.io/badge/Licencia-MIT-34d399?style=for-the-badge)](LICENSE)

  <br />

  <p align="center">
    <b>WinGet Manager</b> convierte el Administrador de Paquetes de Windows (<code>winget</code>) en una experiencia visual moderna, fluida y accesible para todo el mundo. Sin comandos complejos de consola, sin configuraciones confusas: escanea tu equipo, actualiza todos tus programas con un clic, elimina software sin dejar rastros y protege tu sistema en tiempo real.
  </p>

  <p align="center">
    <a href="#-descarga-e-instalación"><strong>Descargar Instalador »</strong></a> •
    <a href="#-características-destacadas">Características</a> •
    <a href="#-módulos-del-sistema">Módulos</a> •
    <a href="#-cómo-funciona">Cómo Funciona</a>
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

### 📦 6. Copia de Seguridad de Aplicaciones (Exportar / Importar)
- Exporta tu lista de aplicaciones instaladas a un archivo `.json` portable.
- Importa la lista en cualquier equipo nuevo o tras formatear Windows para restaurar todas tus herramientas automáticamente.

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

Este proyecto está bajo la licencia **MIT**. Eres libre de usar, modificar y distribuir esta aplicación según los términos de la misma.

<div align="center">
  <sub>Desarrollado con dedicación por <b><a href="https://github.com/joselyky">Jose Antonio Baeza Pineda (@joselyky)</a></b></sub>
</div>
