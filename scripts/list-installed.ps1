[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing

$paths = @(
  "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
  "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
)
$apps = Get-ItemProperty -Path $paths -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -ne $null -and $_.SystemComponent -ne 1 -and $_.ParentKeyName -eq $null }

$result = @()
$seen = [System.Collections.Generic.HashSet[string]]::new()
$dirSizeCache = @{}
$iconCache = @{}
$systemRoots = @("c:", "c:\", "c:\windows", "c:\windows\system32", "c:\program files", "c:\program files (x86)", "c:\programdata")

function Clean-Path([string]$p) {
    if ([string]::IsNullOrWhiteSpace($p)) { return "" }
    $p = $p.Trim().Trim('"').Trim("'")
    if ($p -match '^(.*?\\.(exe|ico|dll))(,|-|\\s|$)') {
        $p = $matches[1]
    } elseif ($p -match '^(.*?,\\d+)') {
        $p = $p.Split(',')[0].Trim('"')
    }
    return $p
}

function Safe-DirExists([string]$p) {
    if ([string]::IsNullOrWhiteSpace($p)) { return $false }
    try { return [System.IO.Directory]::Exists($p) } catch { return $false }
}

function Safe-FileExists([string]$p) {
    if ([string]::IsNullOrWhiteSpace($p)) { return $false }
    try { return [System.IO.File]::Exists($p) } catch { return $false }
}

function Get-IconBase64([string]$filePath) {
    if (! (Safe-FileExists $filePath)) { return "" }
    $norm = $filePath.ToLower()
    if ($iconCache.ContainsKey($norm)) { return $iconCache[$norm] }
    try {
        $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($filePath)
        if ($icon) {
            $bmp = $icon.ToBitmap()
            $ms = New-Object System.IO.MemoryStream
            $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
            $bytes = $ms.ToArray()
            $b64 = [Convert]::ToBase64String($bytes)
            $ms.Dispose()
            $bmp.Dispose()
            $icon.Dispose()
            $iconCache[$norm] = $b64
            return $b64
        }
    } catch {}
    $iconCache[$norm] = ""
    return ""
}

function Get-DirectorySizeFast([string]$dirPath) {
    if (! (Safe-DirExists $dirPath)) { return 0 }
    $norm = $dirPath.TrimEnd('\').ToLower()
    if ($norm -in $systemRoots) { return 0 }
    if ($dirSizeCache.ContainsKey($norm)) { return $dirSizeCache[$norm] }

    [int64]$totalBytes = 0
    try {
        $di = [System.IO.DirectoryInfo]::new($dirPath)
        $fileCount = 0
        foreach ($file in $di.EnumerateFiles('*', [System.IO.SearchOption]::AllDirectories)) {
            $totalBytes += $file.Length
            $fileCount++
            if ($fileCount -ge 2000) { break }
        }
    } catch {
        try {
            $di = [System.IO.DirectoryInfo]::new($dirPath)
            foreach ($file in $di.EnumerateFiles('*', [System.IO.SearchOption]::TopDirectoryOnly)) {
                $totalBytes += $file.Length
            }
        } catch {}
    }
    $mb = [math]::Round($totalBytes / 1MB, 2)
    $dirSizeCache[$norm] = $mb
    return $mb
}

foreach ($app in $apps) {
    $name = $app.DisplayName.Trim()
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    
    $ver = if ($app.DisplayVersion) { $app.DisplayVersion.Trim() } else { "" }
    $key = "$name|$ver"
    if ($seen.Contains($key)) { continue }
    $null = $seen.Add($key)

    $sizeMb = 0
    if ($app.EstimatedSize -and $app.EstimatedSize -gt 0) {
        $sizeMb = [math]::round($app.EstimatedSize / 1024, 2)
    }

    $iconPath = if ($app.DisplayIcon) { Clean-Path $app.DisplayIcon } else { "" }
    $installLoc = if ($app.InstallLocation) { $app.InstallLocation.Trim().Trim('"') } else { "" }

    if ($sizeMb -eq 0) {
        if (Safe-DirExists $installLoc) {
            $sizeMb = Get-DirectorySizeFast $installLoc
        }
        
        if ($sizeMb -eq 0 -and (Safe-FileExists $iconPath)) {
            $parent = Split-Path -Parent $iconPath
            if (![string]::IsNullOrWhiteSpace($parent) -and !(($parent.TrimEnd('\').ToLower()) -in $systemRoots) -and (Safe-DirExists $parent)) {
                $sizeMb = Get-DirectorySizeFast $parent
                if ([string]::IsNullOrWhiteSpace($installLoc)) { $installLoc = $parent }
            }
        }

        if ($sizeMb -eq 0 -and $app.UninstallString) {
            $uninstClean = Clean-Path $app.UninstallString
            if (Safe-FileExists $uninstClean) {
                $parent = Split-Path -Parent $uninstClean
                if (![string]::IsNullOrWhiteSpace($parent) -and !(($parent.TrimEnd('\').ToLower()) -in $systemRoots) -and (Safe-DirExists $parent)) {
                    $sizeMb = Get-DirectorySizeFast $parent
                    if ([string]::IsNullOrWhiteSpace($installLoc)) { $installLoc = $parent }
                }
            }
        }
    }

    if (! (Safe-FileExists $iconPath)) {
        if (Safe-DirExists $installLoc) {
            $exe = Get-ChildItem -LiteralPath $installLoc -Filter "*.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($exe) { $iconPath = $exe.FullName }
        }
    }

    $iconBase64 = if (![string]::IsNullOrWhiteSpace($iconPath)) { Get-IconBase64 $iconPath } else { "" }

    if ($sizeMb -eq 0) { $sizeMb = 1.0 }

    $result += [PSCustomObject]@{
        name = $name
        version = $ver
        publisher = if ($app.Publisher) { $app.Publisher.Trim() } else { "Desconocido" }
        sizeMb = $sizeMb
        installLocation = $installLoc
        iconBase64 = $iconBase64
        uninstallString = $app.UninstallString
        id = $app.PSChildName
    }
}
$result | ConvertTo-Json -Compress
