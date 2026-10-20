# WinGet Manager ⚡

Panel de control moderno e intuitivo para Windows diseñado para gestionar, actualizar y desinstalar aplicaciones mediante **Windows Package Manager (WinGet)**, además de monitorear hardware gráfico, puntos de restauración del sistema y auto-actualizarse directamente desde GitHub Releases.

---

## 🚀 Principales Características

- 🔄 **Sistema de Auto-Actualización Oficial (Auto-Updater):** Comprueba automáticamente las nuevas versiones publicadas en el repositorio de GitHub con diálogo de advertencia previo, descarga interactiva con medidor de velocidad y reinicio asistido.
- 🔍 **Búsqueda y Detección de Actualizaciones:** Escaneo automático de programas desactualizados a través del catálogo de `winget`.
- ⚡ **Actualizaciones Individuales o en Lote:** Actualiza aplicaciones específicas con un solo clic o todas a la vez con cola de progreso en tiempo real.
- 🛡️ **Desinstalador Limpio con Platform Shield:** Desinstalación profunda con limpieza de registros y archivos residuales. Incluye blindaje de seguridad inviolable para lanzadores de juegos (**Steam, Epic Games, Ubisoft Connect, EA App, Riot Games, Battle.net y GOG Galaxy**).
- 🎮 **Monitor de GPU y Drivers:** Detección en tiempo real de GPU (NVIDIA, AMD, Intel), telemetría de VRAM, temperatura, consumo de energía y suites de controladores oficiales recomendadas.
- 💾 **Gestión de Puntos de Restauración:** Creación de instantáneas del sistema antes de actualizar o desinstalar, con opción de purga y acceso directo al asistente nativo `rstrui.exe`.
- 📦 **Exportar e Importar Paquetes:** Respalda tu lista de aplicaciones instaladas en formato JSON para restaurarlas en cualquier equipo en segundos.
- 🎨 **Interfaz Windows 11 Glassmorphism:** Diseño ultra moderno con desenfoque de fondo, tema oscuro de alto contraste y animaciones fluidas aceleradas por hardware.

---

## 📋 Requisitos Previos

- **Sistema Operativo:** Windows 10 (versión 1809 o superior) o Windows 11 (64-bit).
- **WinGet:** Windows Package Manager (la app incluye un activador automático en terminal si no está presente).
- **Node.js:** Versión 18.x o superior recomendada (solo para desarrollo).
- **Permisos de Administrador:** Necesarios para gestionar software y puntos de restauración a nivel de sistema.

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
   o con DevTools habilitadas:
   ```bash
   npm run dev
   ```

---

## 📦 Compilación de Ejecutables

Para generar los instaladores listos para producción:

```bash
npm run build
```

Los ejecutables generados se ubican en la carpeta `dist/`:
- `WinGet Manager Setup 1.0.2.exe`: Instalador guiado para Windows con accesos directos y configuración automática.
- `WinGet Manager 1.0.2.exe`: Versión portable sin instalación.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` o `package.json` para más detalles.