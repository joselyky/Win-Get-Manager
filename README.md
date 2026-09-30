# WinGet Manager 🚀

Panel de control moderno e intuitivo para Windows diseñado para gestionar, actualizar y desinstalar aplicaciones mediante **Windows Package Manager (WinGet)**, además de monitorear y actualizar controladores gráficos (GPU).

---

## ✨ Características

- 🔍 **Búsqueda y Detección de Actualizaciones:** Escaneo automático de programas desactualizados a través del catálogo de `winget`.
- ⚡ **Actualizaciones Individuales o en Lote:** Actualiza aplicaciones específicas con un solo clic o todas a la vez.
- 🗑️ **Desinstalador Limpio:** Detección de programas instalados con limpieza profunda de archivos temporales, carpetas residuales y registros.
- 🎮 **Monitor de GPU y Drivers:** Detección automática del hardware gráfico (NVIDIA, AMD, Intel), estado de controladores, VRAM, temperatura y accesos directos al panel de control.
- 🎨 **Interfaz Moderna:** Diseño oscuro, animaciones fluidas y notificaciones en tiempo real sobre el progreso de las operaciones.

---

## 📋 Requisitos Previos

- **Sistema Operativo:** Windows 10 (versión 1809 o superior) o Windows 11.
- **WinGet:** Windows Package Manager instalado (incluido por defecto en Windows 11 y versiones recientes de Windows 10).
- **Node.js:** Versión 18.x o superior recomendada ([Descargar Node.js](https://nodejs.org/)).
- **Permisos de Administrador:** Necesarios para instalar y desinstalar aplicaciones del sistema.

---

## 🛠️ Instalación y Desarrollo

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/joselyky/Win-Get-Manager.git
   cd Win-Get-Manager
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Ejecutar en modo desarrollo:**
   ```bash
   npm start
   ```
   o con la flag de desarrollo:
   ```bash
   npm run dev
   ```

---

## 📦 Compilación y Creación del Instalador de Windows

Puedes generar tanto un **instalador tradicional de Windows (`.exe` Setup con asistente)** como una **versión portable**:

1. **Crear el instalador de Windows (Setup `.exe`):**
   ```bash
   npm run build:installer
   ```
   *Crea un instalador interactivo (`dist/WinGet Manager Setup 1.0.0.exe`) con selección de carpeta, acceso directo en el Escritorio, integración en el Menú Inicio y desinstalador automático en Windows.*

2. **Crear la versión portable (sin instalación):**
   ```bash
   npm run build:portable
   ```

3. **Compilar ambos a la vez:**
   ```bash
   npm run build
   ```

Los ejecutables generados se guardarán en la carpeta `dist/`.

---

## 📁 Estructura del Proyecto

```text
Win-Get-Manager/
├── index.html          # Estructura de la interfaz de usuario
├── styles.css          # Estilos visuales y diseño responsive/dark
├── renderer.js         # Lógica del frontend y renderizado de la UI
├── preload.js          # Puente seguro entre Electron y la interfaz (ContextBridge)
├── main.js             # Proceso principal de Electron, integración con PowerShell y WinGet
├── package.json        # Configuración de dependencias y scripts de compilación
├── package-lock.json   # Árbol de dependencias bloqueado
├── .gitignore          # Reglas de exclusión para Git (node_modules, dist, logs)
└── README.md           # Documentación del proyecto
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` o `package.json` para más detalles.
