<div align="center">

  <img src="logo.png" alt="WinGet Manager Logo" width="110" height="110" style="border-radius: 50%; box-shadow: 0 8px 32px rgba(110, 231, 183, 0.35);" />

  # WinGet Manager ⚡

  ### *The ultimate visual control panel to manage, batch-update, and cleanly uninstall software on Windows.*

  [![GitHub Release](https://img.shields.io/github/v/release/joselyky/Win-Get-Manager?color=6ee7b7&label=Release&style=for-the-badge)](https://github.com/joselyky/Win-Get-Manager/releases/latest)
  [![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078d4?style=for-the-badge&logo=windows)](https://github.com/joselyky/Win-Get-Manager)
  [![Engine](https://img.shields.io/badge/Engine-WinGet%20%2B%20Electron-4f8ef7?style=for-the-badge&logo=electron)](https://github.com/joselyky/Win-Get-Manager)
  [![License](https://img.shields.io/badge/License-GPLv3-34d399?style=for-the-badge)](LICENSE)

  <br />

  <p align="center">
    <b>WinGet Manager</b> transforms the official Windows Package Manager (<code>winget</code>) into a modern, responsive, and intuitive desktop experience. No convoluted terminal commands, no confusing syntax: scan your PC in seconds, batch-update all outdated software with one click, wipe residual leftover files, and keep your system secure in real time.
  </p>

  <p align="center">
    <a href="#-download--installation"><strong>Download Installer »</strong></a> •
    <a href="#-security-trust--guaranteed-privacy"><strong>Security & Trust</strong></a> •
    <a href="#-key-features">Key Features</a> •
    <a href="#-interface-modules">UI Modules</a> •
    <a href="#-for-developers">Build from Source</a>
  </p>

</div>

---

## 💡 What is WinGet Manager?

Microsoft introduced **WinGet** as the official command-line package manager for Windows. However, running PowerShell or CMD, memorizing complex command flags, and handling silent installer arguments often leads users to neglect software updates or resort to questionable third-party uninstaller utilities bundled with adware.

**WinGet Manager** solves this:
1. **Centralizes all your software** inside a sleek *Windows 11 Glassmorphism* user interface (lightweight, GPU-accelerated dark theme).
2. **Automates update discovery** by scanning your installed programs and cross-referencing them against Microsoft's official verified repository.
3. **Clean uninstaller**: Traces and purges orphaned directories in `%AppData%` and obsolete Windows Registry keys left behind by native uninstallers.
4. **Protects games and launchers**: Features built-in **Platform Shield** to ensure that uninstalling a game never corrupts launchers such as Steam or Epic Games.
5. **Built-in Auto-Updater**: Connects directly and securely to GitHub Releases, alerting you whenever a new official build is ready to install.

---

## 🛡️ Security, Trust & Guaranteed Privacy

WinGet Manager is architected under a **zero-malware tolerance, full user control, and 100% transparency** standard:

### 🔒 1. Official Download Sources Only (SHA-256 Verified)
* **Official Microsoft Infrastructure**: Every package originates directly from the verified Microsoft catalog ([winget-pkgs](https://github.com/microsoft/winget-pkgs)) and direct developer CDNs (e.g., Mozilla, Google, Discord, Valve).
* **Cryptographic Hash Verification**: Installers are verified against their official **SHA-256** checksum prior to execution, ensuring binaries remain untampered.
* **Zero Middlemen**: No third-party mirrors, no proxies, and absolutely no bundled adware or promotional toolbars.

### 🛡️ 2. Active System & Game Launcher Shielding
* **Operating System Integrity**: WinGet Manager never modifies critical Windows system directories (`C:\Windows\System32`, `WinSxS`, or boot registries).
* **Platform Shield**: When uninstalling games, an active guard protects the root directories and shared libraries of **Steam, Epic Games, Ubisoft Connect, EA App, Riot Games, Battle.net, and GOG Galaxy**, preventing accidental file deletions.
* **Confirmed Residuals Only**: The deep cleaner solely targets orphaned folders in `%AppData%` and leftover registry keys provably tied to the removed software.

### 👤 3. Zero Automated / Stealth Actions (You Stay in Control)
* **Explicit User Consent**: Nothing updates, installs, or uninstalls in the background without your approval. Every action requires your explicit confirmation.
* **No Hidden Background Services**: No resident background daemons, trackers, or hidden resource hogs.
* **Live Streaming Console**: Real-time streaming log of the exact official `winget` terminal commands executed.

### 💾 4. Native Restore Points & Open Source
* **Native Windows Rollback**: Create a complete Windows System Restore snapshot (`rstrui.exe`) with a single click before critical modifications to guarantee effortless rollback.
* **100% Open Source (GPLv3)**: All source code is publicly available on GitHub under the GNU GPLv3 license for open auditing.
* **100% Local Execution**: No accounts required, no passwords collected, and no invasive telemetry. Your data stays entirely on your computer.

---

## 🌟 Key Features

### 🔄 1. Smart Auto-Updater
- **Automatic Check**: Silently checks for newer GitHub Releases on launch.
- **Interactive Update Modal**: Displays release notes, changelog details, and download size before initiating any update.
- **Live Transfer Telemetry**: Real-time progress bar, bytes transferred, and download speed indicators (`MB/s`).
- **Seamless Restart**: Safely closes the application and launches the updated installer automatically.

### ⚡ 2. Real-Time Update Hub
- **Rapid Scan**: Scans and evaluates installed software versions against Microsoft's official database in seconds.
- **1-Click Batch Updates**: Update individual apps or queue every outdated application simultaneously.
- **Category Filters**: Easily filter between desktop applications, games, and system utilities.
- **Integrated Console**: View raw `winget` output in an expandable live streaming log.

### 🛡️ 3. Clean Uninstaller with Platform Shield
- **Deep Leftover Purge**: Analyzes `%ProgramFiles%`, `%AppData%`, `%LocalAppData%`, `ProgramData`, and the Windows Registry (`HKLM` / `HKCU`) to remove orphaned leftovers.
- **Platform Shield**: Hardened armor for **Steam, Epic Games, Ubisoft Connect, EA App, Riot Games, Battle.net, and GOG Galaxy**. Uninstall games without risking launcher corruption or collateral damage to your game library.

### 🎮 4. GPU Telemetry & Official Driver Suites
- **Hardware Detection**: Automatically detects **NVIDIA GeForce**, **AMD Radeon**, and **Intel Arc / Iris** graphics adapters.
- **Live Telemetry**: Real-time VRAM allocation, GPU core temperatures, power consumption, and display resolution.
- **Direct Official Suites**: One-click quick links to download official control software (GeForce Experience / NVIDIA App, AMD Software Adrenalin, Intel Graphics Command Center).

### 💾 5. Windows System Restore Points
- **Pre-emptive Snapshots**: Create system restore points before installing graphics drivers or uninstalling mission-critical packages.
- **Snapshot Manager**: Review existing restore points, clean older snapshots to reclaim disk space, or launch `rstrui.exe` directly.

### ⚡ 6. Batch Operations & Smart Queue
- **Unattended Execution**: Select multiple packages and let the queue run in the background.
- **Smart Selector**: Quick filters, instant version comparison, and zero manual installer prompts.

---

## 🖥️ Interface Modules

| Module | Icon | Description |
| :--- | :---: | :--- |
| **Updates** | 🔄 | Main dashboard listing outdated software with search filters, batch selector, and real-time update queue. |
| **Clean Uninstaller** | 🗑️ | Comprehensive list of installed software with version, size, installation date, and deep leftover purge. |
| **GPU & Control** | 🎮 | Live thermal sensor readings, VRAM usage monitor, GPU specs, and official driver downloads. |
| **Restore Points** | 🛡️ | Create, inspect, and manage native Windows System Restore snapshots. |
| **Auto-Updater** | 🚀 | Interactive modal that downloads and installs new GitHub releases seamlessly. |

---

## 📥 Download & Installation

### Option 1: Guided Installer (.exe) — Recommended
Download **`WinGet Manager Setup 1.0.2.exe`** from the official [**GitHub Releases**](https://github.com/joselyky/Win-Get-Manager/releases/latest).
- Guided setup wizard.
- Creates Desktop and Start Menu shortcuts.
- Automatically enables and configures `winget` in your Windows terminal if absent.
- Full uninstallation support from the Windows Control Panel.

### Option 2: Portable Standalone (.exe)
Download **`WinGet Manager 1.0.2.exe`** to run the tool standalone without installation (ideal for IT maintenance USB flash drives).

---

## ⚙️ System Requirements

- **Operating System:** Windows 10 (version 1809 or higher) or Windows 11 (64-bit).
- **WinGet CLI:** Built into Windows 11 and modern Windows 10 builds *(automatically installed if missing)*.
- **Administrator Privileges:** Required for machine-wide uninstalls, registry cleanup, and system restore point creation.

---

## 🛠️ For Developers

To clone, run, or build the project locally:

```bash
# 1. Clone the repository
git clone https://github.com/joselyky/Win-Get-Manager.git
cd Win-Get-Manager

# 2. Install dependencies
npm install

# 3. Start development mode
npm start

# 4. Build production installer & portable binaries
npm run build
```

---

## 📜 License

This project is open-source software licensed under the **GNU General Public License v3.0 (GPLv3)**. You are free to inspect, run, modify, and contribute to the codebase. Any derivative work or redistribution must remain open source under the same GPLv3 license and preserve original author attribution. See the [LICENSE](LICENSE) file for complete details.

<div align="center">
  <sub>Developed with ❤️ by <b><a href="https://github.com/joselyky">Jose Antonio Baeza Pineda (@joselyky)</a></b></sub>
</div>
