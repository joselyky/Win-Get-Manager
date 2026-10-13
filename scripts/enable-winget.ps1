<#
.SYNOPSIS
    Script de activación y reparación de WinGet (Windows Package Manager) para la terminal de Windows.
.DESCRIPTION
    Este script asegura que 'winget' esté disponible en CMD, PowerShell y Windows Terminal:
    1. Verifica y repara la variable PATH agregando la ruta de 'WindowsApps'.
    2. Registra el paquete oficial 'Microsoft.DesktopAppInstaller' (App Execution Alias).
    3. Si el paquete no existe o fue desinstalado, descarga e instala la versión oficial y sus dependencias.
    4. Notifica al sistema operativo (WM_SETTINGCHANGE) para que las terminales reconozcan el comando inmediatamente.
#>

[CmdletBinding()]
param (
    [switch]$ForceDownload = $false
)

$ErrorActionPreference = 'Continue'
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Activador de WinGet en la Terminal de Windows" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$isElevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Host "[INFO] Modo ejecucion: $(if ($isElevated) { 'Administrador' } else { 'Usuario estandar' })" -ForegroundColor Gray

# ── 1. Asegurar ruta de WindowsApps en PATH del Usuario y Sistema ──
Write-Host "`n[PASO 1/4] Verificando variables de entorno PATH..." -ForegroundColor Yellow

$localAppData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $env:USERPROFILE "AppData\Local" }
$windowsAppsUser = Join-Path $localAppData "Microsoft\WindowsApps"

# PATH del Usuario actual
try {
    $currentUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $userPaths = ($currentUserPath -split ';') | Where-Object { $_ -ne '' }
    if ($userPaths -notcontains $windowsAppsUser) {
        $newUserPath = if ([string]::IsNullOrWhiteSpace($currentUserPath)) { $windowsAppsUser } else { "$currentUserPath;$windowsAppsUser" }
        [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
        Write-Host "  -> Agregado '$windowsAppsUser' a PATH (Usuario)." -ForegroundColor Green
    } else {
        Write-Host "  -> WindowsApps ya esta presente en PATH (Usuario)." -ForegroundColor Green
    }
} catch {
    Write-Warning "  No se pudo actualizar PATH de usuario: $($_.Exception.Message)"
}

# Si se ejecuta elevado (UAC), asegurar tambien el PATH del usuario interactivo logueado si es distinto
if ($isElevated) {
    try {
        $loggedUser = (Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue).UserName
        if ($loggedUser) {
            $userName = $loggedUser.Split('\')[-1]
            if ($userName -ne $env:USERNAME) {
                $altUserApps = "C:\Users\$userName\AppData\Local\Microsoft\WindowsApps"
                $userSid = (New-Object System.Security.Principal.NTAccount($loggedUser)).Translate([System.Security.Principal.SecurityIdentifier]).Value
                if ($userSid -and (Test-Path "Registry::HKEY_USERS\$userSid\Environment")) {
                    $altPath = (Get-ItemProperty -Path "Registry::HKEY_USERS\$userSid\Environment" -Name "Path" -ErrorAction SilentlyContinue).Path
                    if ($altPath -split ';' -notcontains $altUserApps) {
                        $newAlt = if ([string]::IsNullOrWhiteSpace($altPath)) { $altUserApps } else { "$altPath;$altUserApps" }
                        Set-ItemProperty -Path "Registry::HKEY_USERS\$userSid\Environment" -Name "Path" -Value $newAlt
                        Write-Host "  -> Agregado '$altUserApps' a PATH de usuario interactivo ($userName)." -ForegroundColor Green
                    }
                }
            }
        }
    } catch { }
}

# Actualizar el PATH del proceso actual en memoria
if ($env:Path -split ';' -notcontains $windowsAppsUser) {
    $env:Path = "$windowsAppsUser;$env:Path"
}

# ── 2. Registrar el paquete App Installer y su Alias de Ejecucion ──
Write-Host "`n[PASO 2/4] Registrando paquete Microsoft.DesktopAppInstaller..." -ForegroundColor Yellow

# A) Registrar por FamilyName para el usuario actual
try {
    Add-AppxPackage -RegisterByFamilyName -MainPackage "Microsoft.DesktopAppInstaller_8wekyb3d8bbwe" -ErrorAction Stop
    Write-Host "  -> Paquete registrado exitosamente por FamilyName." -ForegroundColor Green
} catch {
    Write-Host "  -> Registro por FamilyName omitido o ya existente. Comprobando manifiesto..." -ForegroundColor Gray
}

# B) Registrar buscando el manifiesto en WindowsApps
try {
    $package = Get-AppxPackage -Name "Microsoft.DesktopAppInstaller" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($package -and (Test-Path (Join-Path $package.InstallLocation "AppXManifest.xml"))) {
        $manifestPath = Join-Path $package.InstallLocation "AppXManifest.xml"
        Add-AppxPackage -DisableDevelopmentMode -Register $manifestPath -ErrorAction Stop
        Write-Host "  -> Paquete registrado exitosamente desde: $manifestPath" -ForegroundColor Green
    }
} catch {
    Write-Host "  -> Registro por manifiesto local: $($_.Exception.Message)" -ForegroundColor Gray
}

# C) Si es Administrador, registrar para todos los usuarios
if ($isElevated) {
    try {
        Get-AppxPackage -AllUsers -Name "Microsoft.DesktopAppInstaller" -ErrorAction SilentlyContinue | ForEach-Object {
            $manifest = Join-Path $_.InstallLocation "AppXManifest.xml"
            if (Test-Path $manifest) {
                Add-AppxPackage -DisableDevelopmentMode -Register $manifest -ErrorAction SilentlyContinue
            }
        }
    } catch { }
}

# ── 3. Descarga e instalacion en caso de no existir el paquete ──
Write-Host "`n[PASO 3/4] Comprobando disponibilidad del comando 'winget'..." -ForegroundColor Yellow

$wingetFound = $false
try {
    $targetExe = Join-Path $windowsAppsUser "winget.exe"
    if (Test-Path $targetExe) {
        $testOutput = & $targetExe --version 2>$null
        if ($testOutput) { $wingetFound = $true }
    }
    if (-not $wingetFound) {
        $testCmd = Get-Command "winget" -ErrorAction SilentlyContinue
        if ($testCmd) { $wingetFound = $true }
    }
} catch { }

if (-not $wingetFound -or $ForceDownload) {
    Write-Host "  -> 'winget' no fue detectado en el sistema. Procediendo a descargar paquete oficial de Microsoft..." -ForegroundColor Yellow
    
    $tempDir = Join-Path $env:TEMP "WinGetInstaller_$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

        $vclibsPath = Join-Path $tempDir "Microsoft.VCLibs.x64.14.00.Desktop.appx"
        $xamlPath   = Join-Path $tempDir "Microsoft.UI.Xaml.2.8.x64.appx"
        $bundlePath = Join-Path $tempDir "Microsoft.DesktopAppInstaller.msixbundle"

        Write-Host "  -> Descargando dependencias de Microsoft..." -ForegroundColor Gray
        Invoke-WebRequest -Uri "https://aka.ms/Microsoft.VCLibs.x64.14.00.Desktop.appx" -OutFile $vclibsPath -UseBasicParsing -TimeoutSec 30 -ErrorAction SilentlyContinue
        Invoke-WebRequest -Uri "https://github.com/microsoft/microsoft-ui-xaml/releases/download/v2.8.6/Microsoft.UI.Xaml.2.8.x64.appx" -OutFile $xamlPath -UseBasicParsing -TimeoutSec 30 -ErrorAction SilentlyContinue

        Write-Host "  -> Descargando WinGet MSIXBundle oficial..." -ForegroundColor Gray
        Invoke-WebRequest -Uri "https://github.com/microsoft/winget-cli/releases/latest/download/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle" -OutFile $bundlePath -UseBasicParsing -TimeoutSec 60 -ErrorAction Stop

        Write-Host "  -> Instalando dependencias previas..." -ForegroundColor Gray
        foreach ($dep in @($vclibsPath, $xamlPath)) {
            if (Test-Path $dep) {
                try { Add-AppxPackage -Path $dep -ErrorAction SilentlyContinue } catch { }
            }
        }

        Write-Host "  -> Instalando paquetes AppX de WinGet..." -ForegroundColor Green
        $dependencies = @($vclibsPath, $xamlPath) | Where-Object { Test-Path $_ }

        if ($dependencies.Count -gt 0) {
            Add-AppxPackage -Path $bundlePath -DependencyPath $dependencies -ErrorAction Stop
        } else {
            Add-AppxPackage -Path $bundlePath -ErrorAction Stop
        }

        Write-Host "  -> Paquete instalado correctamente." -ForegroundColor Green
        $wingetFound = $true
    } catch {
        Write-Warning "  No se pudo completar la instalacion descargada: $($_.Exception.Message)"
    } finally {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "  -> Winget detectado correctamente." -ForegroundColor Green
}

# ── 4. Notificar al sistema sobre cambios de variables de entorno ──
Write-Host "`n[PASO 4/4] Notificando al sistema operativo sobre cambios en PATH..." -ForegroundColor Yellow
try {
    if (-not ("Win32.NativeMethods" -as [type])) {
        Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition @'
            [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
            public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
'@ -ErrorAction SilentlyContinue
    }
    [UIntPtr]$result = [UIntPtr]::Zero
    # 0x001A = WM_SETTINGCHANGE, HWND_BROADCAST = 0xffff
    [Win32.NativeMethods]::SendMessageTimeout([IntPtr]0xffff, 0x001A, [UIntPtr]::Zero, "Environment", 2, 5000, [ref]$result) | Out-Null
    Write-Host "  -> Mensaje WM_SETTINGCHANGE transmitido." -ForegroundColor Green
} catch {
    Write-Host "  -> Continuar sin transmision de ventana." -ForegroundColor Gray
}

# ── Verificacion Final ──
Write-Host "`n==========================================================" -ForegroundColor Cyan
try {
    $versionOutput = $null
    $targetExe = Join-Path $windowsAppsUser "winget.exe"

    if (Test-Path $targetExe) {
        $versionOutput = & $targetExe --version 2>$null
    }

    if (-not $versionOutput) {
        $testCmd = Get-Command "winget" -ErrorAction SilentlyContinue
        if ($testCmd) {
            $versionOutput = & $testCmd.Source --version 2>$null
        }
    }

    if ($versionOutput) {
        Write-Host "[EXITO] WinGet esta activo y operativo en la terminal (Version: $versionOutput)." -ForegroundColor Green
        exit 0
    } else {
        Write-Host "[AVISO] WinGet fue configurado. Reinicia tu terminal o sesion de Windows si es necesario." -ForegroundColor Yellow
        exit 0
    }
} catch {
    Write-Host "[AVISO] Configuracion finalizada. En caso necesario, abre una nueva ventana de terminal." -ForegroundColor Yellow
    exit 0
}
