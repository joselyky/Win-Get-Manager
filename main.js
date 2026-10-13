const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const http = require('http');

// ─── Globals ──────────────────────────────────────────────────────────────────
let mainWindow;
const isDev = process.argv.includes('--dev');

// ─── Build Environment ────────────────────────────────────────────────────────
// winget lives in WindowsApps as an App Execution Alias.
// These aliases ONLY work called by name — never by full path.
// We inject all known WindowsApps directories so cmd can resolve 'winget'.
function buildEnv() {
  const cur = process.env.PATH || '';
  const dirs = [
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps'),
  ];
  try {
    fs.readdirSync('C:\\Users').forEach(u =>
      dirs.push(`C:\\Users\\${u}\\AppData\\Local\\Microsoft\\WindowsApps`)
    );
  } catch (_) {}

  const toAdd = dirs.filter(d => !cur.includes(d)).join(';');
  return { ...process.env, PATH: toAdd ? `${toAdd};${cur}` : cur };
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 760, minWidth: 800, minHeight: 600,
    frame: false, transparent: true, backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });
  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── Window Controls ──────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('window:close',    () => mainWindow?.close());

// ═══════════════════════════════════════════════════════════════════════════════
// WINGET OUTPUT PARSER
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Robust locale-independent parser for `winget upgrade` plain-text output.
 *
 * STRATEGY — Separator-anchored column mapping:
 *  1. Find the separator line (long run of dashes) — this is the structural anchor.
 *  2. Read the header line immediately above it.
 *  3. Split the header by 2+ consecutive spaces to get column tokens in order.
 *  4. Record the CHARACTER POSITION of each token in the header line.
 *  5. For every data row, slice each column using those fixed character positions.
 *
 * WHY THIS IS MORE ROBUST THAN SPLITTING BY SPACES:
 *  - Package names contain spaces ("Microsoft Visual Studio Code") — split() breaks them.
 *  - Version strings may have unusual characters.
 *  - Locale doesn't matter: we never match by column name ("Name" vs "Nombre").
 *  - The separator line guarantees the column widths are exactly as rendered.
 *
 * COLUMN ORDER (winget always outputs in this order regardless of language):
 *  0: Name  1: Id  2: Version  3: Available  4: Source
 */
function parseWingetOutput(raw) {
  const packages = [];

  // 1. Normalize: strip BOM, ANSI escape codes, unify CRLF → LF
  const cleaned = raw
    .replace(/^\uFEFF/, '')
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = cleaned.split('\n');

  // 2. Find the separator line (only dashes/box chars, length > 10)
  let sepIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].replace(/\s/g, '');
    if (stripped.length > 10 && /^[-─\u2500\u2015]+$/.test(stripped)) {
      sepIdx = i;
      break;
    }
  }
  if (sepIdx < 1) return packages;

  // 3. Find the header line: first non-empty line above the separator
  let headerLine = '';
  for (let i = sepIdx - 1; i >= 0; i--) {
    if (lines[i].trim()) { headerLine = lines[i]; break; }
  }
  if (!headerLine) return packages;

  // 4. Map column token positions in the header line
  //    Split by 2+ spaces to find tokens, then locate each in the header string
  const tokens = headerLine.split(/  +/).map(s => s.trim()).filter(Boolean);
  if (tokens.length < 2) return packages;

  const colStarts = [];
  let searchFrom = 0;
  for (const tok of tokens) {
    const idx = headerLine.indexOf(tok, searchFrom);
    if (idx === -1) break;
    colStarts.push(idx);
    searchFrom = idx + tok.length;
  }
  if (colStarts.length < 2) return packages;

  // 5. Helper: extract cell at column index using fixed character positions
  const cell = (line, colIdx) => {
    if (colIdx >= colStarts.length) return '';
    const start = colStarts[colIdx];
    const end   = colIdx + 1 < colStarts.length ? colStarts[colIdx + 1] : line.length;
    if (start >= line.length) return '';
    return line.slice(start, end).trim();
  };

  // 6. Parse data rows (skip separator, summary lines, short lines)
  const seen = new Set(); // deduplicate by ID
  for (let i = sepIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[-─\u2500]{5,}/.test(trimmed)) continue;        // another separator
    if (/^\d+\s+\w/.test(trimmed)) continue;              // "2 actualizaciones disponibles."
    if (line.length < colStarts[1] + 1) continue;         // too short to have an ID column

    const name      = cell(line, 0);
    const id        = cell(line, 1);
    const version   = cell(line, 2);
    const available = cell(line, 3);
    const source    = cell(line, 4) || 'winget';

    // Require both name and a valid-looking ID (must contain a dot or be non-empty)
    if (!name || !id) continue;
    if (seen.has(id)) continue; // if multiple rows same ID, keep first (highest priority)
    seen.add(id);

    packages.push({ name, id, version, available, source });
  }

  return packages;
}

// Helper to attach icons to Winget upgrade packages
async function attachIconsToPackages(packages) {
  if (!packages || packages.length === 0) return packages;
  
  return new Promise((resolve) => {
    const pkgData = JSON.stringify(packages.map(p => ({ name: p.name, id: p.id })));
    const psScript = `
Add-Type -AssemblyName System.Drawing

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

function Get-IconBase64([string]$filePath) {
    if ([string]::IsNullOrWhiteSpace($filePath) -or !(Test-Path -LiteralPath $filePath)) { return "" }
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
            return $b64
        }
    } catch {}
    return ""
}

$paths = @(
  "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
)
$regApps = Get-ItemProperty -Path $paths -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -ne $null }

$jsonInput = '${pkgData.replace(/'/g, "''").replace(/\\/g, "\\\\")}'
$items = ConvertFrom-Json $jsonInput

$results = @()
foreach ($item in $items) {
    $pkgName = ($item.name + '').ToLower()
    $pkgId = ($item.id + '').ToLower()

    $match = $regApps | Where-Object {
        ($_.DisplayName -and $_.DisplayName.ToLower() -eq $pkgName) -or
        ($_.DisplayName -and $pkgName.Contains($_.DisplayName.ToLower())) -or
        ($_.PSChildName -and $_.PSChildName.ToLower() -eq $pkgId)
    } | Select-Object -First 1

    $iconPath = ""
    if ($match -and $match.DisplayIcon) {
        $iconPath = Clean-Path $match.DisplayIcon
    }
    if ([string]::IsNullOrWhiteSpace($iconPath) -and $match -and $match.InstallLocation) {
        $exe = Get-ChildItem -LiteralPath $match.InstallLocation -Filter "*.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($exe) { $iconPath = $exe.FullName }
    }

    $b64 = ""
    if (![string]::IsNullOrWhiteSpace($iconPath)) {
        $b64 = Get-IconBase64 $iconPath
    }

    $results += [PSCustomObject]@{
        id = $item.id
        iconBase64 = $b64
    }
}
$results | ConvertTo-Json -Compress
`;

    const tmpPath = path.join(os.tmpdir(), `winget_icons_${Date.now()}.ps1`);
    fs.writeFileSync(tmpPath, psScript, 'utf8');

    const proc = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpPath], {
      windowsHide: true,
    });

    const chunks = [];
    proc.stdout.on('data', d => chunks.push(d));
    proc.on('close', () => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      const output = Buffer.concat(chunks).toString('utf8').trim();
      try {
        const parsed = JSON.parse(output);
        const iconList = Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
        const map = new Map(iconList.map(i => [i.id, i.iconBase64]));
        packages.forEach(pkg => {
          pkg.iconBase64 = map.get(pkg.id) || '';
        });
        resolve(packages);
      } catch (_) {
        resolve(packages);
      }
    });
    proc.on('error', () => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      resolve(packages);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPCMAIN: LIST UPGRADES
// ═══════════════════════════════════════════════════════════════════════════════
ipcMain.handle('winget:list-upgrades', async () => {
  return new Promise((resolve) => {
    const env = buildEnv();
    const proc = spawn('cmd', ['/c', 'winget upgrade --accept-source-agreements'], {
      env, shell: false, windowsHide: true,
    });

    const chunks = [], errChunks = [];
    proc.stdout.on('data', d => chunks.push(d));
    proc.stderr.on('data', d => errChunks.push(d));

    proc.on('close', async code => {
      const raw    = Buffer.concat(chunks).toString('utf8');
      const stderr = Buffer.concat(errChunks).toString('utf8');
      try {
        let packages = parseWingetOutput(raw);
        packages = await attachIconsToPackages(packages);
        resolve({ success: true, packages, raw, stderr, code });
      } catch (err) {
        resolve({ success: false, error: err.message, raw, stderr, code });
      }
    });

    proc.on('error', err => resolve({
      success: false,
      error: `No se pudo ejecutar winget: ${err.message}\n\nInstala "App Installer" desde la Microsoft Store o activa WinGet en la terminal.`,
      raw: '', stderr: '', code: -1,
    }));
  });
});

// ─── IPCMAIN: ENABLE WINGET IN TERMINAL ───────────────────────────────────────
ipcMain.handle('winget:enable-in-terminal', async () => {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'scripts', 'enable-winget.ps1');
    const fallbackPath = path.join(process.resourcesPath || '', 'scripts', 'enable-winget.ps1');
    const targetScript = fs.existsSync(scriptPath) ? scriptPath : fallbackPath;

    if (!fs.existsSync(targetScript)) {
      return resolve({
        success: false,
        error: `No se encontro el script de activacion en ${targetScript}`,
      });
    }

    const proc = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', targetScript,
    ], { windowsHide: true });

    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      resolve({ success: code === 0, stdout, stderr, code });
    });

    proc.on('error', err => {
      resolve({ success: false, error: err.message, code: -1 });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IPCMAIN: UPGRADE SELECTED PACKAGES
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Upgrades each package by its exact ID.
 *
 * COMMAND: winget upgrade --id "<ID>" --silent --force --accept-package-agreements --accept-source-agreements
 *
 * WHY --force:
 *   Apps like Chrome and VS Code have their own auto-updaters. When they update
 *   themselves, winget's installed-version registry becomes stale. Without --force,
 *   winget compares the stale record with the available version, finds no difference,
 *   and returns error 0x8A150014 ("no applicable update"). --force bypasses this
 *   version comparison and installs the latest version unconditionally.
 *
 * WHY --silent:
 *   Same behaviour as `winget upgrade --all` — prevents installer UI dialogs from
 *   blocking the process. Chrome and VSCode both support silent installation.
 *
 * WHY quoted ID:
 *   While winget IDs don't normally contain spaces, quoting is defensive programming
 *   and prevents shell word-splitting on unusual IDs.
 */
// Helper to query remote Content-Length via HTTP HEAD following redirects
function getTotalSizeFromUrl(url, maxRedirects = 5) {
  return new Promise(resolve => {
    if (!url || maxRedirects <= 0) return resolve(0);
    try {
      const client = url.startsWith('https:') ? https : http;
      const req = client.request(url, { method: 'HEAD', headers: { 'User-Agent': 'WinGet-Manager/1.0.1' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          try {
            const nextUrl = new URL(res.headers.location, url).href;
            return getTotalSizeFromUrl(nextUrl, maxRedirects - 1).then(resolve);
          } catch (_) {
            return resolve(0);
          }
        }
        const len = parseInt(res.headers['content-length'] || '0', 10);
        resolve(isNaN(len) ? 0 : len);
      });
      req.on('error', () => resolve(0));
      req.setTimeout(4000, () => { req.destroy(); resolve(0); });
      req.end();
    } catch (_) {
      resolve(0);
    }
  });
}

// Real-time tracker for active download files in Temp\WinGet
function trackActiveDownload(pkgId, totalBytes, onProgress) {
  const wingetDir = path.join(process.env.LOCALAPPDATA || '', 'Temp', 'WinGet');
  let lastBytes = 0;
  let lastTime = Date.now();
  let maxBytesSeen = 0;
  let stopped = false;

  const interval = setInterval(() => {
    if (stopped) return;
    try {
      if (!fs.existsSync(wingetDir)) return;
      const subdirs = fs.readdirSync(wingetDir);
      let currentBytes = 0;
      let foundTmp = false;

      // 1. Check folder matching pkgId
      const targetSub = subdirs.find(s => s.toLowerCase().includes(pkgId.toLowerCase()));
      if (targetSub) {
        const fullSub = path.join(wingetDir, targetSub);
        try {
          if (fs.statSync(fullSub).isDirectory()) {
            const files = fs.readdirSync(fullSub).filter(f => f.endsWith('.tmp'));
            for (const f of files) {
              const tmpPath = path.join(fullSub, f);
              try {
                const fd = fs.openSync(tmpPath, 'r');
                const sz = fs.fstatSync(fd).size;
                fs.closeSync(fd);
                if (sz > currentBytes) currentBytes = sz;
                foundTmp = true;
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      // 2. If not found in subfolder, inspect .tmp files modified recently in WinGet root
      if (!foundTmp) {
        const rootTmps = subdirs.filter(f => f.endsWith('.tmp'));
        for (const f of rootTmps) {
          const tmpPath = path.join(wingetDir, f);
          try {
            const stat = fs.statSync(tmpPath);
            if (Date.now() - stat.mtimeMs < 20000) {
              const fd = fs.openSync(tmpPath, 'r');
              const sz = fs.fstatSync(fd).size;
              fs.closeSync(fd);
              if (sz > currentBytes) currentBytes = sz;
            }
          } catch (_) {}
        }
      }

      if (currentBytes > maxBytesSeen) maxBytesSeen = currentBytes;

      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      let speedMBs = '0.0';
      if (dt >= 0.5) {
        const speed = (maxBytesSeen - lastBytes) / dt;
        speedMBs = Math.max(0, speed / (1024 * 1024)).toFixed(1);
        lastBytes = maxBytesSeen;
        lastTime = now;
      }

      const downloadedMB = (maxBytesSeen / (1024 * 1024)).toFixed(1);
      const totalMB = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '—';
      const percent = totalBytes > 0 ? Math.min(99.5, Number(((maxBytesSeen / totalBytes) * 100).toFixed(1))) : 0;

      onProgress({
        downloadedBytes: maxBytesSeen,
        totalBytes,
        downloadedMB,
        totalMB,
        percent,
        speedMBs
      });
    } catch (_) {}
  }, 200);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
    getMaxBytes: () => maxBytesSeen
  };
}

ipcMain.on('winget:upgrade-packages', (event, packages) => {
  if (!packages?.length) {
    event.sender.send('winget:log', { type: 'error', text: 'No se seleccionaron paquetes.' });
    event.sender.send('winget:done', { success: false });
    return;
  }

  const env = buildEnv();
  event.sender.send('winget:log', {
    type: 'info',
    text: `▶ Iniciando actualización de ${packages.length} paquete(s)...\n`,
  });

  // Initialize UI Queue
  const queueItems = packages.map((p, idx) => ({
    id: p.id,
    name: p.name || p.id,
    version: p.version || '',
    available: p.available || '',
    source: p.source || 'winget',
    iconBase64: p.iconBase64 || '',
    status: 'pending',
    downloadedMB: '0.0',
    totalMB: '—',
    percent: 0,
    speedMBs: '0.0',
    index: idx,
    total: packages.length
  }));
  event.sender.send('winget:queue-init', { queue: queueItems });

  let index = 0;
  const upgradeNext = () => {
    if (index >= packages.length) {
      event.sender.send('winget:log', { type: 'success', text: '\n✅ Todas las actualizaciones completadas.' });
      event.sender.send('winget:done', { success: true });
      return;
    }

    const currentIdx = index++;
    const pkg = packages[currentIdx];
    const pkgId = pkg.id;
    const pkgName = pkg.name || pkgId;
    const pkgSource = pkg.source || 'winget';

    event.sender.send('winget:log', {
      type: 'info',
      text: `\n📦 Actualizando: ${pkgId} (${pkgSource})\n${'─'.repeat(50)}\n`,
    });

    // Notify queue that package is preparing / starting
    event.sender.send('winget:queue-update', {
      pkgId,
      status: 'starting',
      downloadedMB: '0.0',
      totalMB: '—',
      percent: 0,
      speedMBs: '0.0',
      message: 'Iniciando descarga...',
      index: currentIdx,
      total: packages.length
    });

    const args = [
      'upgrade',
      '--id', pkgId,
      '--exact',
      '--source', pkgSource,
      '--silent',
      '--force',
      '--accept-package-agreements',
      '--accept-source-agreements'
    ];

    const proc = spawn('winget', args, {
      env, shell: true, windowsHide: true,
    });

    let procOutput = '';
    let targetUrl = '';
    let totalBytes = 0;
    let tracker = null;
    let installStarted = false;

    proc.stdout.on('data', d => {
      const text = d.toString('utf8');
      procOutput += text;
      event.sender.send('winget:log', { type: 'output', text });

      // Detect download URL in output stream
      const urlMatch = text.match(/https?:\/\/[^\s\r\n"']+/i);
      if (urlMatch && !targetUrl) {
        targetUrl = urlMatch[0];
        getTotalSizeFromUrl(targetUrl).then(size => {
          totalBytes = size;
          if (!installStarted) {
            if (tracker) tracker.stop();
            tracker = trackActiveDownload(pkgId, totalBytes, prog => {
              if (installStarted) return;
              event.sender.send('winget:queue-update', {
                pkgId,
                status: 'downloading',
                downloadedMB: prog.downloadedMB,
                totalMB: prog.totalMB,
                percent: prog.percent,
                speedMBs: prog.speedMBs,
                message: `Descargando: ${prog.downloadedMB} MB / ${prog.totalMB} MB (${prog.percent}%)`,
                index: currentIdx,
                total: packages.length
              });
            });
          }
        });
      }

      // Detect installer verification / installation start
      const isInstalling = text.includes('hash del instalador se verificó') ||
                           text.includes('Installer hash verified') ||
                           text.includes('Iniciando la actualización') ||
                           text.includes('Iniciando instalación') ||
                           text.includes('Starting package install');
      if (isInstalling && !installStarted) {
        installStarted = true;
        if (tracker) tracker.stop();
        const finalMB = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : (tracker ? (tracker.getMaxBytes() / (1024*1024)).toFixed(1) : '—');
        event.sender.send('winget:queue-update', {
          pkgId,
          status: 'installing',
          downloadedMB: finalMB,
          totalMB: finalMB,
          percent: 100,
          speedMBs: '0.0',
          message: 'Instalando actualización...',
          index: currentIdx,
          total: packages.length
        });
      }
    });

    proc.stderr.on('data', d => { procOutput += d.toString('utf8'); });

    proc.on('close', code => {
      if (tracker) tracker.stop();
      const outputLower = procOutput.toLowerCase();
      const unsignedCode = (typeof code === 'number') ? (code >>> 0) : 0;
      const hexCode = '0x' + unsignedCode.toString(16).toLowerCase();

      const fileInUse = unsignedCode === 2316632107 ||
                        hexCode === '0x8a15002b' ||
                        unsignedCode === 32 ||
                        hexCode === '0x80070020' ||
                        outputLower.includes('0x80070020') ||
                        outputLower.includes('being used by another process') ||
                        outputLower.includes('en uso por otro proceso') ||
                        outputLower.includes('abierta');

      const needsAdmin = unsignedCode === 2147958056 ||
                         hexCode === '0x80073d28' ||
                         unsignedCode === 2147942405 ||
                         hexCode === '0x80070005' ||
                         unsignedCode === 5 ||
                         outputLower.includes('0x80073d28') ||
                         outputLower.includes('0x80070005') ||
                         outputLower.includes('privilegios de administrador') ||
                         outputLower.includes('administrator') ||
                         outputLower.includes('run as administrator');

      // Treat successful reboot codes and up-to-date codes as OK
      const isRebootOrUpToDate = unsignedCode === 3010 ||
                                 unsignedCode === 1641 ||
                                 unsignedCode === 2316632084 ||
                                 hexCode === '0x8a150014' ||
                                 outputLower.includes('no applicable update') ||
                                 outputLower.includes('ninguna actualización aplicable');
      const ok = code === 0 || isRebootOrUpToDate;

      const finalMB = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : (tracker ? (tracker.getMaxBytes() / (1024*1024)).toFixed(1) : '—');

      if (ok) {
        const msg = (unsignedCode === 3010 || unsignedCode === 1641)
          ? `✔ ${pkgId} actualizado correctamente (Reinicio pendiente).\n`
          : `✔ ${pkgId} actualizado correctamente.\n`;
        event.sender.send('winget:queue-update', {
          pkgId,
          status: 'completed',
          downloadedMB: finalMB,
          totalMB: finalMB,
          percent: 100,
          speedMBs: '0.0',
          message: (unsignedCode === 3010 || unsignedCode === 1641) ? 'Completado ✔ (Reinicio requerido)' : 'Completado con éxito',
          index: currentIdx,
          total: packages.length
        });
        event.sender.send('winget:log', { type: 'success', text: msg });
        upgradeNext();
        return;
      }

      // If installation failed because it needs Admin, automatically prompt with elevation!
      if (needsAdmin) {
        event.sender.send('winget:log', {
          type: 'warning',
          text: `⚠ ${pkgId} requiere permisos de Administrador para instalarse. Solicitando autorización del sistema (UAC)...\n`
        });
        event.sender.send('winget:queue-update', {
          pkgId,
          status: 'installing',
          downloadedMB: finalMB,
          totalMB: finalMB,
          percent: 100,
          speedMBs: '0.0',
          message: 'Esperando autorización de Administrador (UAC)...',
          index: currentIdx,
          total: packages.length
        });

        runElevatedUpgrade(pkgId, pkgSource, (elevatedCode, elevatedOut) => {
          const elUnsigned = (typeof elevatedCode === 'number') ? (elevatedCode >>> 0) : 0;
          const elOk = elevatedCode === 0 || elUnsigned === 3010 || elUnsigned === 1641;
          const userCancel = elevatedCode === 1223 || elUnsigned === 1223;
          const status = elOk ? 'completed' : (userCancel ? 'admin-needed' : 'error');
          const friendlyMsg = elOk
            ? 'Completado con éxito (como Administrador)'
            : (userCancel ? 'Permisos de Administrador cancelados por el usuario' : getFriendlyErrorMessage(elevatedCode, elevatedOut));

          event.sender.send('winget:queue-update', {
            pkgId,
            status,
            downloadedMB: finalMB,
            totalMB: finalMB,
            percent: elOk ? 100 : 0,
            speedMBs: '0.0',
            message: friendlyMsg,
            errorType: userCancel ? 'admin' : 'general',
            index: currentIdx,
            total: packages.length
          });

          event.sender.send('winget:log', {
            type: elOk ? 'success' : 'warning',
            text: elOk ? `✔ ${pkgId} actualizado correctamente con permisos de Administrador.\n` : `✖ Falló con permisos de Administrador (${friendlyMsg}).\n`
          });
          upgradeNext();
        });
        return;
      }

      // Other errors or app in use
      const friendlyMsg = getFriendlyErrorMessage(code, procOutput);
      const status = fileInUse ? 'in-use' : (needsAdmin ? 'admin-needed' : 'error');

      event.sender.send('winget:queue-update', {
        pkgId,
        status,
        downloadedMB: finalMB,
        totalMB: finalMB,
        percent: 0,
        speedMBs: '0.0',
        message: friendlyMsg,
        errorType: needsAdmin ? 'admin' : (fileInUse ? 'in-use' : 'general'),
        index: currentIdx,
        total: packages.length
      });

      event.sender.send('winget:log', {
        type: 'warning',
        text: `⚠ ${pkgId}: ${friendlyMsg} (código ${hexCode !== '0x0' ? hexCode : code}).\n`
      });

      upgradeNext();
    });

    proc.on('error', err => {
      if (tracker) tracker.stop();
      event.sender.send('winget:queue-update', {
        pkgId,
        status: 'error',
        downloadedMB: '0.0',
        totalMB: '—',
        percent: 0,
        speedMBs: '0.0',
        message: `Error al iniciar el proceso: ${err.message}`,
        errorType: 'general',
        index: currentIdx,
        total: packages.length
      });
      event.sender.send('winget:log', { type: 'error', text: `✖ Error: ${err.message}\n` });
      upgradeNext();
    });
  };

  upgradeNext();
});

// Helper for error message translation
function getFriendlyErrorMessage(code, output = '') {
  const unsignedCode = (typeof code === 'number') ? (code >>> 0) : 0;
  const hexCode = '0x' + unsignedCode.toString(16).toLowerCase();
  const lower = (output || '').toLowerCase();

  if (code === 0) return 'Completado con éxito';
  if (unsignedCode === 3010 || unsignedCode === 1641) return 'Completado ✔ (Reinicio requerido)';
  if (unsignedCode === 2316632084 || hexCode === '0x8a150014' || lower.includes('no applicable update') || lower.includes('ninguna actualización aplicable')) {
    return 'Ya se encuentra en la versión más reciente';
  }
  if (unsignedCode === 2147958056 || hexCode === '0x80073d28' || unsignedCode === 2147942405 || hexCode === '0x80070005' || unsignedCode === 5 ||
      lower.includes('0x80073d28') || lower.includes('0x80070005') || lower.includes('privilegios de administrador') || lower.includes('administrator')) {
    return 'Requiere permisos de Administrador para instalarse';
  }
  if (unsignedCode === 1223 || hexCode === '0x800704c7' || unsignedCode === 1602 || hexCode === '0x80070642' || lower.includes('cancelada por el usuario')) {
    return 'Instalación cancelada por el usuario';
  }
  if (unsignedCode === 2316632107 || hexCode === '0x8a15002b' || unsignedCode === 32 || hexCode === '0x80070020' ||
      lower.includes('0x80070020') || lower.includes('en uso') || lower.includes('in use') || lower.includes('another process')) {
    return 'La aplicación está abierta en Windows. Ciérrala para continuar';
  }
  if (unsignedCode === 2316632081 || hexCode === '0x8a150011' || lower.includes('hash')) {
    return 'Fallo de integridad: El hash del instalador no coincide con el repositorio oficial';
  }
  if (unsignedCode === 1618 || hexCode === '0x80070652') {
    return 'Hay otra instalación de Windows en curso (espera unos segundos)';
  }
  if (unsignedCode === 1603 || hexCode === '0x80070643') {
    return 'Error del instalador (1603): Puede requerir permisos de Administrador o cerrar la app';
  }
  if (unsignedCode === 2316632066 || hexCode === '0x8a150002') {
    return 'Paquete no encontrado en el origen';
  }
  if (lower.includes('download') && (lower.includes('failed') || lower.includes('falló') || lower.includes('error'))) {
    return 'Error de conexión al descargar el instalador';
  }
  if (hexCode !== '0x0') {
    return `Error en la instalación (${hexCode})`;
  }
  return `Error en la instalación (${code})`;
}

// Executes an upgrade with administrator elevation via PowerShell UAC
function runElevatedUpgrade(pkgId, pkgSource, callback) {
  const sourceArg = pkgSource ? `'--source', '${pkgSource}',` : '';
  const psScript = `
try {
  $p = Start-Process winget -ArgumentList @('upgrade', '--id', '${pkgId}', '--exact', ${sourceArg} '--silent', '--force', '--accept-package-agreements', '--accept-source-agreements') -Verb RunAs -PassThru -Wait -WindowStyle Hidden
  if ($p) {
    exit $p.ExitCode
  } else {
    exit 1
  }
} catch {
  if ($_.Exception.NativeErrorCode -eq 1223) {
    exit 1223
  }
  Write-Output $_.Exception.Message
  exit 1
}
`;
  const proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
    windowsHide: true
  });
  let out = '';
  proc.stdout.on('data', d => { out += d.toString('utf8'); });
  proc.stderr.on('data', d => { out += d.toString('utf8'); });
  proc.on('close', code => {
    callback(code, out);
  });
  proc.on('error', err => {
    callback(-1, err.message);
  });
}

// IPC: Kill process for package
ipcMain.handle('apps:kill-process', async (_e, nameOrId) => {
  return new Promise(resolve => {
    const term = (nameOrId || '').split('.').pop() || nameOrId;
    const psScript = `
Get-Process -Name "*${term}*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
`;
    const proc = spawn('powershell.exe', ['-NoProfile', '-Command', psScript], { windowsHide: true });
    proc.on('close', () => resolve({ success: true }));
  });
});

// IPC: Manually trigger elevated upgrade for a single package
ipcMain.on('winget:upgrade-package-elevated', (event, pkg) => {
  const pkgId = pkg.id;
  const pkgSource = pkg.source || 'winget';

  event.sender.send('winget:log', {
    type: 'info',
    text: `\n🛡 Reintentando con permisos de Administrador: ${pkgId}...\n`
  });

  event.sender.send('winget:queue-update', {
    pkgId,
    status: 'installing',
    downloadedMB: '—',
    totalMB: '—',
    percent: 100,
    speedMBs: '0.0',
    message: 'Esperando autorización de Administrador (UAC)...'
  });

  runElevatedUpgrade(pkgId, pkgSource, (code, out) => {
    const unsignedCode = (typeof code === 'number') ? (code >>> 0) : 0;
    const ok = code === 0 || unsignedCode === 3010 || unsignedCode === 1641;
    const userCancel = code === 1223 || unsignedCode === 1223;
    const status = ok ? 'completed' : (userCancel ? 'admin-needed' : 'error');
    const friendlyMsg = ok
      ? 'Completado con éxito (como Administrador)'
      : (userCancel ? 'Permisos de Administrador cancelados por el usuario' : getFriendlyErrorMessage(code, out));

    event.sender.send('winget:queue-update', {
      pkgId,
      status,
      downloadedMB: '—',
      totalMB: '—',
      percent: ok ? 100 : 0,
      speedMBs: '0.0',
      message: friendlyMsg,
      errorType: userCancel ? 'admin' : 'general'
    });

    event.sender.send('winget:log', {
      type: ok ? 'success' : 'warning',
      text: ok ? `✔ ${pkgId} actualizado con permisos de Administrador.\n` : `✖ Falló (${friendlyMsg}).\n`
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IPCMAIN: UPGRADE ALL
// ═══════════════════════════════════════════════════════════════════════════════
ipcMain.on('winget:upgrade-all', (event) => {
  const env = buildEnv();
  event.sender.send('winget:log', { type: 'info', text: '▶ Ejecutando winget upgrade --all ...\n' });

  const proc = spawn('cmd', [
    '/c',
    'winget upgrade --all --silent --accept-package-agreements --accept-source-agreements',
  ], { env, shell: false, windowsHide: true });

  proc.stdout.on('data', d => event.sender.send('winget:log', { type: 'output', text: d.toString('utf8') }));
  proc.stderr.on('data', d => event.sender.send('winget:log', { type: 'error',  text: d.toString('utf8') }));

  proc.on('close', code => {
    event.sender.send('winget:log', {
      type: code === 0 ? 'success' : 'warning',
      text: code === 0
        ? '\n✅ Todas las aplicaciones actualizadas correctamente.'
        : `\n⚠ Proceso finalizado con código: ${code}`,
    });
    event.sender.send('winget:done', { success: code === 0 });
  });

  proc.on('error', err => {
    event.sender.send('winget:log', { type: 'error', text: `\n✖ Error: ${err.message}` });
    event.sender.send('winget:done', { success: false });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IPCMAIN: SYSTEM INFO
// ═══════════════════════════════════════════════════════════════════════════════
ipcMain.handle('system:info', async () => {
  const release = os.release();
  const parts = release.split('.');
  const build = parseInt(parts[2] || '0', 10);
  let osName = 'Windows';
  if (parts[0] === '10' && parts[1] === '0') {
    osName = build >= 22000 ? 'Windows 11' : 'Windows 10';
  } else if (release.startsWith('6.3')) {
    osName = 'Windows 8.1';
  } else if (release.startsWith('6.2')) {
    osName = 'Windows 8';
  } else if (release.startsWith('6.1')) {
    osName = 'Windows 7';
  } else {
    osName = `Windows ${release}`;
  }

  return {
    hostname:    process.env.COMPUTERNAME || os.hostname(),
    osName:      osName,
    platform:    os.platform(),
    release:     os.release(),
    arch:        os.arch(),
    uptime:      os.uptime(),
    totalMemory: os.totalmem(),
    freeMemory:  os.freemem(),
  };
});

// ═══════════════════════════════════════════════════════════════════════════════
// IPCMAIN: CLEAN UNINSTALLER
// ═══════════════════════════════════════════════════════════════════════════════
ipcMain.handle('apps:list-installed', async () => {
  return new Promise((resolve) => {
    // PowerShell script to extract installed apps with accurate sizes and native Base64 PNG icons
    const psScriptContent = `
Add-Type -AssemblyName System.Drawing

$paths = @(
  "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
)
$apps = Get-ItemProperty -Path $paths -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -ne $null -and $_.SystemComponent -ne 1 -and $_.ParentKeyName -eq $null }

$result = @()
$seen = [System.Collections.Generic.HashSet[string]]::new()
$fso = New-Object -ComObject Scripting.FileSystemObject

function Get-DirectorySize([string]$dirPath) {
    if ([string]::IsNullOrWhiteSpace($dirPath) -or !(Test-Path -LiteralPath $dirPath)) { return 0 }
    try {
        $folder = $fso.GetFolder($dirPath)
        return [math]::round($folder.Size / 1MB, 2)
    } catch {
        try {
            $sum = (Get-ChildItem -LiteralPath $dirPath -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($sum) { return [math]::round($sum / 1MB, 2) }
        } catch {}
    }
    return 0
}

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

function Get-IconBase64([string]$filePath) {
    if ([string]::IsNullOrWhiteSpace($filePath) -or !(Test-Path -LiteralPath $filePath)) { return "" }
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
            return $b64
        }
    } catch {}
    return ""
}

$progFiles86 = $env:ProgramFiles + " (x86)"
$progFiles = $env:ProgramFiles
$localApp = $env:LOCALAPPDATA
$roamApp = $env:APPDATA

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

    $iconPath = ""
    if ($app.DisplayIcon) {
        $iconPath = Clean-Path $app.DisplayIcon
    }

    $installLoc = if ($app.InstallLocation) { $app.InstallLocation.Trim().Trim('"') } else { "" }

    # If size is 0, estimate from installLocation or iconPath or uninstallString
    if ($sizeMb -eq 0) {
        if (![string]::IsNullOrWhiteSpace($installLoc) -and (Test-Path -LiteralPath $installLoc)) {
            $sizeMb = Get-DirectorySize $installLoc
        }
        
        if ($sizeMb -eq 0 -and ![string]::IsNullOrWhiteSpace($iconPath) -and (Test-Path -LiteralPath $iconPath)) {
            $parent = Split-Path -Parent $iconPath
            if (![string]::IsNullOrWhiteSpace($parent) -and $parent -ne "C:\\" -and $parent -ne "C:\\Windows\\System32" -and $parent -ne "C:\\Windows" -and (Test-Path -LiteralPath $parent)) {
                $sizeMb = Get-DirectorySize $parent
                if ([string]::IsNullOrWhiteSpace($installLoc)) { $installLoc = $parent }
            }
        }

        if ($sizeMb -eq 0 -and $app.UninstallString) {
            $uninstClean = Clean-Path $app.UninstallString
            if (![string]::IsNullOrWhiteSpace($uninstClean) -and (Test-Path -LiteralPath $uninstClean)) {
                $parent = Split-Path -Parent $uninstClean
                if (![string]::IsNullOrWhiteSpace($parent) -and $parent -ne "C:\\" -and $parent -ne "C:\\Windows\\System32" -and $parent -ne "C:\\Windows" -and (Test-Path -LiteralPath $parent)) {
                    $sizeMb = Get-DirectorySize $parent
                    if ([string]::IsNullOrWhiteSpace($installLoc)) { $installLoc = $parent }
                }
            }
        }
        
        # Check Program Files / AppData common folders
        if ($sizeMb -eq 0) {
            $cleanFolderName = $name -replace '[\\\\/:*?"<>|]', ''
            $commonDirs = @(
                "$progFiles\\$cleanFolderName",
                "$progFiles86\\$cleanFolderName",
                "$localApp\\Programs\\$cleanFolderName",
                "$localApp\\$cleanFolderName",
                "$roamApp\\$cleanFolderName"
            )
            foreach ($cd in $commonDirs) {
                if (Test-Path -LiteralPath $cd) {
                    $sz = Get-DirectorySize $cd
                    if ($sz -gt 0) {
                        $sizeMb = $sz
                        if ([string]::IsNullOrWhiteSpace($installLoc)) { $installLoc = $cd }
                        break
                    }
                }
            }
        }
    }

    # If iconPath is not found or invalid, try to find .exe in installLoc or commonDirs
    if ([string]::IsNullOrWhiteSpace($iconPath) -or !(Test-Path -LiteralPath $iconPath)) {
        if (![string]::IsNullOrWhiteSpace($installLoc) -and (Test-Path -LiteralPath $installLoc)) {
            $exe = Get-ChildItem -LiteralPath $installLoc -Filter "*.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($exe) { $iconPath = $exe.FullName }
        }
    }

    # Extract native Base64 icon
    $iconBase64 = ""
    if (![string]::IsNullOrWhiteSpace($iconPath)) {
        $iconBase64 = Get-IconBase64 $iconPath
    }

    # Fallback size for utilities
    if ($sizeMb -eq 0) {
        if (![string]::IsNullOrWhiteSpace($iconPath) -and (Test-Path -LiteralPath $iconPath)) {
            $item = Get-Item -LiteralPath $iconPath -ErrorAction SilentlyContinue
            if ($item) {
                $sizeMb = [math]::max(0.5, [math]::round($item.Length / 1MB, 2))
            }
        }
    }
    if ($sizeMb -eq 0) {
        $sizeMb = 1.0
    }

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
`;

    const tmpScriptPath = path.join(os.tmpdir(), `winget_mgr_list_${Date.now()}.ps1`);
    fs.writeFileSync(tmpScriptPath, psScriptContent, 'utf8');

    const proc = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpScriptPath], {
      windowsHide: true,
    });

    const chunks = [];
    proc.stdout.on('data', d => chunks.push(d));
    proc.on('close', () => {
      // Cleanup temp file
      try { fs.unlinkSync(tmpScriptPath); } catch (_) {}

      const output = Buffer.concat(chunks).toString('utf8').trim();
      try {
        const apps = JSON.parse(output);
        const appsArray = Array.isArray(apps) ? apps : [apps].filter(Boolean);
        resolve(appsArray);
      } catch (err) {
        resolve([]);
      }
    });
    proc.on('error', () => {
      try { fs.unlinkSync(tmpScriptPath); } catch (_) {}
      resolve([]);
    });
  });
});

ipcMain.on('apps:uninstall-clean', (event, appInfo) => {
  const { name, publisher, uninstallString, installLocation, id } = appInfo;

  if (!uninstallString) {
    event.sender.send('apps:uninstall-log', { type: 'error', text: '✖ No se encontró comando de desinstalación para esta aplicación.\n' });
    event.sender.send('apps:uninstall-done', { success: false });
    return;
  }

  // ─── FASE 1: Identificación y Extracción Segura de Tokens y Plataforma ───────────────
  const stopwords = new Set([
    'setup', 'install', 'installer', 'uninstaller', 'update', 'updater',
    'windows', 'microsoft', 'corporation', 'inc', 'ltd', 'gmbh', 'llc',
    'software', 'app', 'application', 'tool', 'tools', 'utility', 'utilities',
    'x64', 'x86', 'win64', 'win32', 'v1', 'v2', 'v3', 'edition', 'version',
    'free', 'pro', 'desktop', 'client', 'service', 'services', 'manager', 'management',
    'games', 'game', 'gaming', 'player', 'play', 'studio', 'studios', 'system', 'systems',
    'center', 'centre', 'hub', 'suite', 'online', 'live', 'code', 'open', 'web', 'net',
    'file', 'files', 'data', 'base', 'core', 'pack', 'package', 'portable', 'classic',
    'launcher', 'store', 'portal', 'community', 'standard', 'ultimate', 'deluxe'
  ]);

  // Lista de plataformas y directorios estrictamente protegidos (ESCUDO DE PROTECCIÓN)
  const protectedEcosystems = [
    'epic games', 'epicgames', 'epicgameslauncher', 'epic', 'epic online services',
    'steam', 'valve', 'steamapps', 'common',
    'ubisoft', 'ubisoft game launcher', 'ubisoftconnect', 'upc',
    'electronic arts', 'ea desktop', 'origin', 'ea games', 'origin games',
    'riot games', 'riot client',
    'battle.net', 'blizzard', 'blizzard entertainment',
    'gog galaxy', 'gog.com',
    'microsoft', 'windows', 'windows nt', 'windowsapps', 'package cache', 'common files',
    'system32', 'syswow64', 'program files', 'program files (x86)', 'programdata',
    'adobe', 'google', 'mozilla', 'apple', 'nvidia', 'nvidia corporation', 'amd', 'intel',
    'saved games', 'my games'
  ];

  const uninstLower = (uninstallString || '').toLowerCase();
  const idLower = (id || '').toLowerCase();
  const locLower = (installLocation || '').toLowerCase();

  // Detección de tienda / lanzador de juegos
  const isSteam = uninstLower.includes('steam://') || uninstLower.includes('steam.exe') || idLower.startsWith('steam app ');
  const isEpic = uninstLower.includes('com.epicgames.launcher') || locLower.includes('\\epic games\\') || locLower.includes('/epic games/') || idLower.startsWith('epicgames.');
  const isUbisoft = locLower.includes('ubisoft game launcher') || uninstLower.includes('uplay');
  const isEA = locLower.includes('ea desktop') || locLower.includes('origin games') || locLower.includes('ea games') || locLower.includes('electronic arts');
  const isRiot = locLower.includes('riot games') || uninstLower.includes('riotclient');
  const isBattleNet = locLower.includes('battle.net') || uninstLower.includes('battlenet://');
  const isGOG = locLower.includes('gog galaxy') || uninstLower.includes('gog galaxy');

  const isLauncherManaged = isSteam || isEpic || isUbisoft || isEA || isRiot || isBattleNet || isGOG;

  // Extracción de tokens limpia: SÓLO a partir del nombre del programa, NUNCA del editor/publisher
  const rawTokens = [];
  const cleanName = (name || '')
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\bv?\d+(\.\d+)*\b/g, '')
    .trim();

  cleanName.split(/[\s\-_\.]+/).forEach(w => {
    const low = w.toLowerCase().trim();
    if (low.length >= 3 && !stopwords.has(low)) rawTokens.push(low);
  });

  // Si installLocation apunta a una carpeta específica del juego (no la raíz del lanzador)
  let safeInstallLoc = '';
  if (installLocation) {
    const baseFolder = path.basename(installLocation).toLowerCase().trim();
    const isProtectedFolder = protectedEcosystems.includes(baseFolder);
    if (!isProtectedFolder && baseFolder.length >= 3 && !stopwords.has(baseFolder)) {
      rawTokens.push(baseFolder);
      safeInstallLoc = installLocation;
    }
  }

  const tokens = Array.from(new Set(rawTokens));

  event.sender.send('apps:uninstall-log', {
    type: 'info',
    text: `\n┌─────────────────────────────────────────────────────────────┐\n` +
          `│ 🛡️ MOTOR DE DESINSTALACIÓN SEGURA Y RESIDUAL (SHIELD ENGINE) │\n` +
          `└─────────────────────────────────────────────────────────────┘\n` +
          `📦 Aplicación: ${name}\n` +
          `🏢 Editor: ${publisher || 'Desconocido'}\n` +
          `${isLauncherManaged ? `🎮 Plataforma de Juegos: ${isEpic ? 'Epic Games' : isSteam ? 'Steam' : isUbisoft ? 'Ubisoft Connect' : isEA ? 'EA App / Origin' : isRiot ? 'Riot Games' : isBattleNet ? 'Battle.net' : 'GOG Galaxy'} (Protección de cliente activa)\n` : ''}` +
          `🔍 Tokens de comprobación residual: [${tokens.join(', ')}]\n\n`
  });

  function fixUninstallString(str) {
    if (!str) return '';
    let s = str.trim();
    s = s.replace(/^(msiexec(?:\.exe)?\s+)\/i/i, '$1/x');
    if (s.toLowerCase().startsWith('msiexec') && !s.includes('/qn') && !s.includes('/passive') && !s.includes('/qr')) {
      s += ' /passive /norestart';
    }
    if (s.startsWith('"')) return s;
    const match = s.match(/^(.*\.exe)(\s+.*)?$/i);
    if (match) {
      return `"${match[1]}"${match[2] || ''}`;
    }
    return s;
  }

  const fixedUninstallString = fixUninstallString(uninstallString);
  let isFinished = false;

  // ─── FASE 3 & 4: Escaneo Heurístico Protegido y Purga Segura ─────────────────
  const runDeepHeuristicPurge = () => {
    if (isFinished) return;
    isFinished = true;

    event.sender.send('apps:uninstall-log', {
      type: 'info',
      text: `\n[FASE 3] Iniciando escaneo residual seguro en Registro y Almacenamiento...\n`
    });

    // PowerShell script con Escudo de Protección Absoluto y ejecución ultrarrápida
    const psScript = `
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$appName = ${JSON.stringify(name)}
$cleanName = ${JSON.stringify(cleanName)}
$appId = ${JSON.stringify(id || '')}
$safeInstallLoc = ${JSON.stringify(safeInstallLoc || '')}
$tokens = @(${tokens.map(t => JSON.stringify(t)).join(', ')})
$isLauncherManaged = ${isLauncherManaged ? '$true' : '$false'}

$deletedDirs = 0
$purgedKeys = 0
$rebootFiles = 0
$stoppedServices = 0
$killedProcs = 0

# ─── ESCUDO DE PROTECCIÓN: NUNCA TOCAR ESTOS ELEMENTOS ────────────────────────
$protectedNames = @(
    "epic games", "epic", "epicgames", "epicgameslauncher", "epic online services",
    "steam", "valve", "steamapps", "common",
    "ubisoft", "ubisoft game launcher", "ubisoftconnect", "upc",
    "electronic arts", "ea desktop", "origin", "ea games", "origin games",
    "riot games", "riot client",
    "battle.net", "blizzard", "blizzard entertainment",
    "gog galaxy", "gog.com",
    "microsoft", "windows", "windows nt", "windowsapps", "package cache", "common files",
    "system32", "syswow64", "system", "policies", "classes",
    "adobe", "google", "mozilla", "apple", "nvidia", "nvidia corporation", "amd", "intel",
    "saved games", "my games", "documents", "downloads", "desktop"
)

$protectedProcs = @(
    'epicgameslauncher', 'epiconlineservices', 'steam', 'steamwebhelper', 'steamservice',
    'ubisoftconnect', 'upc', 'ubisoftgamelauncher', 'eadesktop', 'origin', 'riotclientservices',
    'battle.net', 'agent', 'explorer', 'svchost', 'powershell', 'cmd', 'electron', 'winget manager', 'taskmgr'
)

# ─── FASE 4A: Cierre Seguro de Procesos Bloqueadores ──────────────────────────
if (![string]::IsNullOrWhiteSpace($safeInstallLoc) -and (Test-Path -LiteralPath $safeInstallLoc)) {
    $locBase = [System.IO.Path]::GetFileName($safeInstallLoc).ToLower()
    if ($protectedNames -notcontains $locBase) {
        $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object {
            try {
                if ($_.Path -and ($_.Path.StartsWith($safeInstallLoc, [System.StringComparison]::OrdinalIgnoreCase))) {
                    $pName = $_.ProcessName.ToLower()
                    if ($protectedProcs -notcontains $pName) { return $true }
                }
            } catch {}
            $false
        }
        foreach ($p in $procs) {
            Write-Output "LOG:warning|  [FASE 4] Proceso bloqueador detectado: $($p.ProcessName) (PID: $($p.Id)). Finalizando..."
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            $killedProcs++
        }
    }
}

# ─── FASE 4B: Detención Segura de Servicios Propios ───────────────────────────
if (![string]::IsNullOrWhiteSpace($safeInstallLoc)) {
    try {
        $services = Get-CimInstance -ClassName Win32_Service -ErrorAction SilentlyContinue | Where-Object {
            try {
                if ($_.PathName -and $_.PathName.IndexOf($safeInstallLoc, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                    $sName = $_.Name.ToLower()
                    $isProt = $false
                    foreach ($pn in $protectedNames) { if ($sName.IndexOf($pn) -ge 0) { $isProt = $true; break } }
                    return !$isProt
                }
            } catch {}
            $false
        }
        foreach ($svc in $services) {
            Write-Output "LOG:warning|  [FASE 4] Servicio propio detectado: $($svc.Name). Deteniendo y eliminando..."
            Stop-Service -Name $svc.Name -Force -ErrorAction SilentlyContinue
            & sc.exe delete $($svc.Name) | Out-Null
            $stoppedServices++
        }
    } catch {}
}

# ─── FASE 3A & 4C: Escaneo y Purga de Claves de Registro ───────────────────────
Write-Output "LOG:info|[FASE 3] Inspeccionando registro de forma segura..."

$regRoots = @(
    "HKLM:\\SOFTWARE",
    "HKCU:\\Software",
    "HKLM:\\SOFTWARE\\WOW6432Node",
    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths"
)

$normApp = ($cleanName -replace '[^a-zA-Z0-9]', '').ToLower()

foreach ($regRoot in $regRoots) {
    if (Test-Path -LiteralPath $regRoot) {
        $subKeys = Get-ChildItem -LiteralPath $regRoot -ErrorAction SilentlyContinue
        foreach ($sk in $subKeys) {
            $kName = $sk.PSChildName
            $kLow = $kName.ToLower()

            # NUNCA eliminar una clave de editor o plataforma compartida
            if ($protectedNames -contains $kLow) {
                # Si es una clave de plataforma (ej. Epic Games o Valve), inspeccionar hijos para el juego específico
                $childKeys = Get-ChildItem -LiteralPath $sk.PSPath -ErrorAction SilentlyContinue
                foreach ($ck in $childKeys) {
                    $ckName = $ck.PSChildName
                    $ckNorm = ($ckName -replace '[^a-zA-Z0-9]', '').ToLower()
                    if ($ckNorm -eq $normApp -or ($normApp.Length -ge 4 -and $ckNorm.StartsWith($normApp))) {
                        Write-Output "LOG:output|  [FASE 4] Purgando clave residual del juego en $($sk.Name): $ckName"
                        Remove-Item -LiteralPath $ck.PSPath -Recurse -Force -ErrorAction SilentlyContinue
                        $purgedKeys++
                    }
                }
                continue
            }

            # Para claves no protegidas, comprobar coincidencia exacta o normalizada con el nombre de la app
            $kNorm = ($kName -replace '[^a-zA-Z0-9]', '').ToLower()
            $isMatch = $false
            if ($kNorm -eq $normApp) {
                $isMatch = $true
            } elseif ($normApp.Length -ge 5 -and $kNorm.StartsWith($normApp)) {
                $isMatch = $true
            }

            if ($isMatch) {
                Write-Output "LOG:output|  [FASE 4] Purgando clave de registro residual: $($sk.Name)"
                Remove-Item -LiteralPath $sk.PSPath -Recurse -Force -ErrorAction SilentlyContinue
                $purgedKeys++
            }
        }
    }
}

# Limpiar entrada de Desinstalación (Uninstall) para eliminar registros fantasma
if (![string]::IsNullOrWhiteSpace($appId)) {
    $uninstallRegPaths = @(
        "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\$appId",
        "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\$appId",
        "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\$appId"
    )
    foreach ($urp in $uninstallRegPaths) {
        if (Test-Path -LiteralPath $urp) {
            Write-Output "LOG:output|  [FASE 4] Limpiando registro de desinstalación de Windows..."
            Remove-Item -LiteralPath $urp -Recurse -Force -ErrorAction SilentlyContinue
            $purgedKeys++
        }
    }
}

# ─── FASE 3B & 4D: Escaneo y Purga de Disco con Protección Total ───────────────
Write-Output "LOG:info|[FASE 3] Inspeccionando almacenamiento y carpetas residuales..."

$scanBases = @(
    [System.Environment]::GetFolderPath('CommonApplicationData'),
    [System.Environment]::GetFolderPath('LocalApplicationData'),
    [System.Environment]::GetFolderPath('ApplicationData'),
    (Join-Path $env:USERPROFILE "AppData\\LocalLow"),
    (Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs"),
    (Join-Path ([System.Environment]::GetFolderPath('CommonApplicationData')) "Microsoft\\Windows\\Start Menu\\Programs"),
    [System.IO.Path]::GetTempPath()
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

# Program Files sólo si no está gestionado por un launcher como Epic o Steam
if (!$isLauncherManaged) {
    $scanBases += @(
        [System.Environment]::GetFolderPath('ProgramFiles'),
        [System.Environment]::GetFolderPath('ProgramFilesX86')
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
}

$dirsToPurge = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

# Si hay una carpeta de instalación confirmada propia del programa (no raíz del lanzador)
if (![string]::IsNullOrWhiteSpace($safeInstallLoc) -and (Test-Path -LiteralPath $safeInstallLoc)) {
    $bName = [System.IO.Path]::GetFileName($safeInstallLoc).ToLower()
    if ($protectedNames -notcontains $bName) {
        $null = $dirsToPurge.Add($safeInstallLoc)
    }
}

foreach ($base in $scanBases) {
    $entries = Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue
    foreach ($entry in $entries) {
        $eName = $entry.Name.Trim()
        $eLow = $eName.ToLower()

        # ESCUDO: Si es una carpeta de launcher o compartida, omitir
        if ($protectedNames -contains $eLow) { continue }

        $eNorm = ($eName -replace '[^a-zA-Z0-9]', '').ToLower()
        $matched = $false

        # Coincidencia estricta: nombre exacto normalizado o prefijo con separador
        if ($eNorm -eq $normApp) {
            $matched = $true
        } elseif ($cleanName.Length -ge 4 -and $eName -match "^(?i)$([regex]::Escape($cleanName))([\s\-_\.]|$)") {
            $matched = $true
        } elseif ($tokens.Count -ge 2) {
            # Si hay múltiples tokens específicos, deben estar presentes todos
            $allPresent = $true
            foreach ($t in $tokens) {
                if ($eLow.IndexOf($t) -lt 0) { $allPresent = $false; break }
            }
            if ($allPresent) { $matched = $true }
        }

        if ($matched) {
            $null = $dirsToPurge.Add($entry.FullName)
        }
    }
}

foreach ($target in $dirsToPurge) {
    # Doble verificación antes de borrar
    $tBase = [System.IO.Path]::GetFileName($target).ToLower()
    if ($protectedNames -contains $tBase) {
        Write-Output "LOG:warning|  [ESCUDO] Protección activada: Omitiendo carpeta del sistema o lanzador: $target"
        continue
    }

    Write-Output "LOG:output|  [FASE 4] Eliminando residuo seguro en disco: $target"
    try {
        [System.IO.Directory]::Delete($target, $true)
        $deletedDirs++
    } catch {
        try {
            Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
            $deletedDirs++
        } catch {
            Write-Output "LOG:warning|  [FASE 4] No se pudo eliminar de inmediato (en uso): $target"
        }
    }
}

Write-Output "SUMMARY|$deletedDirs|$purgedKeys|$rebootFiles|$killedProcs|$stoppedServices"
`;

    const tmpScriptPath = path.join(os.tmpdir(), `winget_clean_engine_${Date.now()}.ps1`);
    fs.writeFileSync(tmpScriptPath, '\ufeff' + psScript, 'utf8');

    const cleanProc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpScriptPath], {
      windowsHide: true,
    });

    let summaryData = null;

    cleanProc.stdout.on('data', (d) => {
      const text = d.toString('utf8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('LOG:')) {
          const firstPipe = line.indexOf('|');
          const type = line.substring(4, firstPipe);
          const msg = line.substring(firstPipe + 1);
          event.sender.send('apps:uninstall-log', { type, text: msg + '\n' });
        } else if (line.startsWith('SUMMARY|')) {
          const parts = line.split('|');
          summaryData = {
            deletedDirs: parseInt(parts[1] || '0', 10),
            purgedKeys: parseInt(parts[2] || '0', 10),
            rebootFiles: parseInt(parts[3] || '0', 10),
            killedProcs: parseInt(parts[4] || '0', 10),
            stoppedServices: parseInt(parts[5] || '0', 10)
          };
        }
      }
    });

    cleanProc.stderr.on('data', (d) => {
      const errText = d.toString('utf8').trim();
      if (errText) {
        event.sender.send('apps:uninstall-log', { type: 'warning', text: `[PowerShell] ${errText}\n` });
      }
    });

    let isCleanDone = false;
    const finalizeClean = () => {
      if (isCleanDone) return;
      isCleanDone = true;
      try { fs.unlinkSync(tmpScriptPath); } catch (_) {}

      const s = summaryData || { deletedDirs: 0, purgedKeys: 0, rebootFiles: 0, killedProcs: 0, stoppedServices: 0 };
      event.sender.send('apps:uninstall-log', {
        type: 'success',
        text: `\n✅ LIMPIEZA SEGURA COMPLETADA:\n` +
              `  • Directorios y carpetas eliminados: ${s.deletedDirs}\n` +
              `  • Claves y registros purgados: ${s.purgedKeys}\n` +
              `  • Procesos propios cerrados: ${s.killedProcs}\n` +
              `  • Servicios propios eliminados: ${s.stoppedServices}\n` +
              `  • Protección de plataformas (Epic Games / Steam / Otros): ACTIVA Y RESPETADA 🛡️\n`
      });

      event.sender.send('apps:uninstall-done', { success: true, summary: s });
    };

    cleanProc.on('exit', finalizeClean);
    cleanProc.on('close', finalizeClean);

    cleanProc.on('error', (err) => {
      try { fs.unlinkSync(tmpScriptPath); } catch (_) {}
      event.sender.send('apps:uninstall-log', { type: 'error', text: `✖ Error al ejecutar motor de limpieza: ${err.message}\n` });
      event.sender.send('apps:uninstall-done', { success: false });
    });
  };

  // ─── FASE 2: Ejecución Inteligente del Desinstalador Oficial ────────────────
  let purgeStarted = false;
  const triggerPurge = (reason, code) => {
    if (purgeStarted) return;
    purgeStarted = true;
    ipcMain.removeAllListeners('apps:force-proceed-cleanup');
    if (code !== undefined && code !== null) {
      event.sender.send('apps:uninstall-log', { type: 'info', text: `\n[FASE 2] Desinstalador oficial finalizado (código: ${code}). Iniciando limpieza segura...\n` });
    }
    runDeepHeuristicPurge();
  };

  ipcMain.removeAllListeners('apps:force-proceed-cleanup');
  ipcMain.once('apps:force-proceed-cleanup', () => {
    event.sender.send('apps:uninstall-log', { type: 'info', text: `\n[AVISO] Confirmación recibida: procediendo con el escaneo y purga segura...\n` });
    triggerPurge('manual');
  });

  // CASO A: EPIC GAMES
  if (isEpic) {
    event.sender.send('apps:uninstall-log', {
      type: 'info',
      text: `[FASE 2] Detectado juego de Epic Games.\n` +
            `▶ Abriendo desinstalador oficial en Epic Games Launcher...\n` +
            `ℹ Confirma la desinstalación en la ventana de Epic Games si aparece.\n` +
            `🛡️ El cliente y resto de juegos de Epic Games permanecerán intactos.\n`
    });

    const epicMatch = uninstallString.match(/com\.epicgames\.launcher:\/\/apps\/[^\s"']+/i);
    const epicUrl = epicMatch ? epicMatch[0] : null;
    const cmd = epicUrl ? `Start-Process '${epicUrl}'` : fixedUninstallString;

    spawn('powershell.exe', ['-NoProfile', '-Command', cmd], { windowsHide: true });

    // Para juegos de launcher, el cliente de Epic gestiona la desinstalación
    setTimeout(() => {
      if (!purgeStarted) {
        event.sender.send('apps:uninstall-log', {
          type: 'info',
          text: `\nℹ Cuando la desinstalación en Epic Games termine, pulsa en la barra inferior 'El desinstalador ya terminó' para limpiar residuos de este juego.\n`
        });
      }
    }, 4000);
    return;
  }

  // CASO B: STEAM
  if (isSteam) {
    event.sender.send('apps:uninstall-log', {
      type: 'info',
      text: `[FASE 2] Detectado juego de Steam.\n` +
            `▶ Abriendo protocolo oficial de desinstalación de Steam...\n` +
            `ℹ Confirma la desinstalación en la ventana de Steam.\n` +
            `🛡️ El cliente de Steam y el resto de la biblioteca permanecerán intactos.\n`
    });
    const steamMatch = uninstallString.match(/steam:\/\/uninstall\/\d+/i);
    const steamUrl = steamMatch ? steamMatch[0] : null;
    const cmd = steamUrl ? `Start-Process '${steamUrl}'` : fixedUninstallString;

    spawn('powershell.exe', ['-NoProfile', '-Command', cmd], { windowsHide: true });

    setTimeout(() => {
      if (!purgeStarted) {
        event.sender.send('apps:uninstall-log', {
          type: 'info',
          text: `\nℹ Cuando la desinstalación en Steam termine, pulsa en la barra inferior 'El desinstalador ya terminó' para limpiar residuos de este juego.\n`
        });
      }
    }, 4000);
    return;
  }

  // CASO C: APLICACIONES ESTÁNDAR
  try {
    event.sender.send('apps:uninstall-log', { type: 'info', text: `[FASE 2] Ejecutando desinstalador oficial: ${fixedUninstallString}\n` });

    const proc = spawn(fixedUninstallString, [], {
      shell: true,
      windowsHide: false,
      stdio: 'ignore'
    });

    proc.on('exit', (code) => {
      triggerPurge('exit', code);
    });

    proc.on('close', (code) => {
      triggerPurge('close', code);
    });

    proc.on('error', (err) => {
      event.sender.send('apps:uninstall-log', { type: 'warning', text: `[FASE 2] Aviso al ejecutar desinstalador: ${err.message}. Continuando con purga segura...\n` });
      triggerPurge('error');
    });

    // Timeout de seguridad amplio (4 minutos) en caso de que el desinstalador quede en espera
    setTimeout(() => {
      if (!purgeStarted) {
        event.sender.send('apps:uninstall-log', { type: 'info', text: `⏱ Tiempo de espera superado. Procediendo con el escaneo y purga segura...\n` });
        triggerPurge('timeout');
      }
    }, 240000);

  } catch (err) {
    event.sender.send('apps:uninstall-log', { type: 'error', text: `[FASE 2] Error al lanzar desinstalador: ${err.message}. Procediendo con purga directa...\n` });
    triggerPurge('spawn_error');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GPU & GRAPHICS CONTROL PANEL HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

ipcMain.handle('gpu:detect-info', async () => {
  const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$nvidiaSmiDetails = $null
try {
    $smi = & 'nvidia-smi' --query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw,power.limit --format=csv,noheader,nounits 2>$null
    if ($smi) {
        $parts = $smi -split ','
        if ($parts.Length -ge 8) {
            $nvidiaSmiDetails = [PSCustomObject]@{
                Name = $parts[0].Trim()
                DriverVersion = $parts[1].Trim()
                MemoryTotalMb = [int64]$parts[2].Trim()
                MemoryUsedMb = [int64]$parts[3].Trim()
                GpuUtilPct = [int]$parts[4].Trim()
                TemperatureC = [int]$parts[5].Trim()
                PowerDrawW = [double]$parts[6].Trim()
                PowerLimitW = [double]$parts[7].Trim()
            }
        }
    }
} catch {}

$cimVideo = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
$regAdapters = @(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\000*' -ErrorAction SilentlyContinue | Where-Object { $_.DriverDesc })

$gpus = @($regAdapters | ForEach-Object {
    $desc = $_.DriverDesc
    $qwMem = $_.'HardwareInformation.qwMemorySize'
    $mem32 = $_.'HardwareInformation.MemorySize'
    $drvVer = $_.DriverVersion
    $drvDate = $_.DriverDate
    
    $vramBytes = 0
    if ($qwMem -and [int64]$qwMem -gt 0) {
        $vramBytes = [int64]$qwMem
    } elseif ($mem32 -and [int64]$mem32 -gt 0) {
        $vramBytes = [int64]$mem32
    }

    $cimMatch = $cimVideo | Where-Object { $_.Name -eq $desc -or $_.DriverVersion -eq $drvVer } | Select-Object -First 1

    $refreshRate = $null
    $resX = $null
    $resY = $null
    if ($cimMatch) {
        $refreshRate = $cimMatch.CurrentRefreshRate
        $resX = $cimMatch.CurrentHorizontalResolution
        $resY = $cimMatch.CurrentVerticalResolution
        if (-not $drvDate) { $drvDate = $cimMatch.DriverDate }
    }

    $nvDriverDisplay = $drvVer
    if ($desc -like '*NVIDIA*' -and $nvidiaSmiDetails) {
        $nvDriverDisplay = "$($nvidiaSmiDetails.DriverVersion) ($drvVer)"
    }
    
    [PSCustomObject]@{
        Name = $desc
        DriverVersion = $nvDriverDisplay
        RawDriverVersion = $drvVer
        DriverDate = $drvDate
        Status = "OK"
        AdapterRAM = $vramBytes
        VideoProcessor = $desc
        RefreshRate = $refreshRate
        ResolutionX = $resX
        ResolutionY = $resY
        NvidiaSmi = if ($desc -like '*NVIDIA*') { $nvidiaSmiDetails } else { $null }
    }
})

$startApps = @(Get-StartApps | Where-Object { 
    $_.Name -match 'NVIDIA|GeForce|Radeon|AMD|Intel.*Arc|Graphics Command' -or
    $_.AppID -match 'NVIDIA|GeForce|Radeon|AMD|Intel'
} | Select-Object Name, AppID)

$appxList = @(Get-AppxPackage | Select-Object Name, Version, PackageFamilyName)

$nvcplInstalled = $false
$nvAppInstalled = $false
$gfeInstalled = $false
$nvcleanInstalled = $false
$nvpiInstalled = $false
$amdInstalled = $false
$intelInstalled = $false

$nvcplAppId = ""
$nvAppAppId = ""
$nvcplVer = ""
$nvAppVer = ""

$nvcplAppx = $appxList | Where-Object { $_.Name -like "*NVIDIAControlPanel*" }
if ($nvcplAppx) {
    $nvcplVer = $nvcplAppx.Version
    $nvcplInstalled = $true
    $nvcplAppId = "$($nvcplAppx.PackageFamilyName)!NVIDIACorp.NVIDIAControlPanel"
}

$nvAppAppx = $appxList | Where-Object { $_.Name -like "*NVIDIAapp*" -or $_.Name -like "*XP8CLZL93F5Z4P*" }
if ($nvAppAppx) {
    $nvAppVer = $nvAppAppx.Version
    $nvAppInstalled = $true
    $nvAppAppId = "$($nvAppAppx.PackageFamilyName)!NVIDIA.app"
}

foreach ($app in $startApps) {
    if ($app.Name -like "*NVIDIA Control Panel*" -or $app.AppID -like "*NVIDIAControlPanel*") { 
        $nvcplInstalled = $true
        if (-not $nvcplAppId) { $nvcplAppId = $app.AppID }
    }
    if ($app.Name -like "*NVIDIA App*" -or $app.AppID -like "*XP8CLZL93F5Z4P*" -or $app.AppID -like "*NVIDIAapp*") { 
        $nvAppInstalled = $true
        if (-not $nvAppAppId) { $nvAppAppId = $app.AppID }
    }
    if ($app.Name -like "*GeForce Experience*") { $gfeInstalled = $true }
    if ($app.Name -like "*NVCleanstall*") { $nvcleanInstalled = $true }
    if ($app.Name -like "*Profile Inspector*") { $nvpiInstalled = $true }
    if ($app.Name -like "*AMD Software*" -or $app.Name -like "*Radeon*") { $amdInstalled = $true }
    if ($app.Name -like "*Intel Arc*" -or $app.Name -like "*Graphics Command*") { $intelInstalled = $true }
}

# Check Program Files paths if not registered in start menu
if (-not $nvcplInstalled) {
    if (Test-Path "C:\\Program Files\\NVIDIA Corporation\\Control Panel Client\\nvcplui.exe") { 
        $nvcplInstalled = $true
        $nvcplAppId = "C:\\Program Files\\NVIDIA Corporation\\Control Panel Client\\nvcplui.exe"
    }
}
if (-not $nvAppInstalled) {
    if (Test-Path "C:\\Program Files\\NVIDIA Corporation\\NVIDIA App\\NVIDIA App.exe") { 
        $nvAppInstalled = $true
        $nvAppAppId = "C:\\Program Files\\NVIDIA Corporation\\NVIDIA App\\NVIDIA App.exe"
    }
}
if (-not $gfeInstalled) {
    if (Test-Path "C:\\Program Files\\NVIDIA Corporation\\NVIDIA GeForce Experience\\NVIDIA GeForce Experience.exe") { $gfeInstalled = $true }
}

$result = [PSCustomObject]@{
    GPUs = $gpus
    StartApps = $startApps
    InstalledStatus = [PSCustomObject]@{
        NvidiaControlPanel = $nvcplInstalled
        NvidiaControlPanelVersion = $nvcplVer
        NvidiaControlPanelAppId = $nvcplAppId
        NvidiaApp = $nvAppInstalled
        NvidiaAppVersion = $nvAppVer
        NvidiaAppAppId = $nvAppAppId
        GeForceExperience = $gfeInstalled
        NVCleanstall = $nvcleanInstalled
        ProfileInspector = $nvpiInstalled
        AmdRadeonSoftware = $amdInstalled
        IntelArcControl = $intelInstalled
    }
}

$result | ConvertTo-Json -Depth 4
`;

  return new Promise((resolve) => {
    const tmp = path.join(os.tmpdir(), `winget_gpu_detect_${Date.now()}.ps1`);
    fs.writeFileSync(tmp, '\ufeff' + psScript, 'utf8');
    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmp]);
    let out = '';
    ps.stdout.on('data', d => out += d);
    ps.on('close', () => {
      try { fs.unlinkSync(tmp); } catch (_) {}
      try {
        const data = JSON.parse(out.trim());
        resolve({ success: true, data });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
    ps.on('error', (err) => {
      try { fs.unlinkSync(tmp); } catch (_) {}
      resolve({ success: false, error: err.message });
    });
  });
});

ipcMain.on('gpu:install-package', (event, { pkgId, source, name }) => {
  event.sender.send('gpu:install-log', { type: 'info', text: `▶ Iniciando proceso para ${name || pkgId}...\n` });

  let args = ['install', '--id', pkgId, '--exact', '--accept-package-agreements', '--accept-source-agreements'];
  if (source) {
    args.push('--source', source);
  } else {
    args.push('--silent');
  }

  const wingetProc = spawn('winget.exe', args, { env: buildEnv(), shell: true });

  wingetProc.stdout.on('data', (d) => {
    event.sender.send('gpu:install-log', { type: 'output', text: d.toString() });
  });

  wingetProc.stderr.on('data', (d) => {
    event.sender.send('gpu:install-log', { type: 'warning', text: d.toString() });
  });

  wingetProc.on('close', (code) => {
    const isUpToDate = (code === 2316632107 || code === -1978236885 || code === 2316632084 || code === -1978236908);
    const isAlreadyInstalled = (code === 2316632109 || code === -1978236883);
    const isSuccess = (code === 0 || code === 3010 || isUpToDate || isAlreadyInstalled);

    if (isSuccess) {
      if (isUpToDate) {
        event.sender.send('gpu:install-log', { type: 'success', text: `\n✔ ${name || pkgId} ya está instalado y actualizado a la última versión disponible.\n` });
        event.sender.send('gpu:install-done', { success: true, pkgId, alreadyUpToDate: true });
      } else {
        event.sender.send('gpu:install-log', { type: 'success', text: `\n✔ Operación completada con éxito para ${name || pkgId}.\n` });
        event.sender.send('gpu:install-done', { success: true, pkgId });
      }
    } else {
      event.sender.send('gpu:install-log', { type: 'error', text: `\n✖ Error durante la instalación (Código: ${code}).\n` });
      event.sender.send('gpu:install-done', { success: false, pkgId, code });
    }
  });

  wingetProc.on('error', (err) => {
    event.sender.send('gpu:install-log', { type: 'error', text: `✖ No se pudo iniciar el instalador: ${err.message}\n` });
    event.sender.send('gpu:install-done', { success: false, error: err.message });
  });
});

ipcMain.handle('gpu:launch-app', async (event, appIdOrPath) => {
  if (!appIdOrPath) return { success: false, error: 'No se especificó la aplicación a ejecutar' };

  return new Promise((resolve) => {
    let cmd = '';
    if (appIdOrPath.includes('!')) {
      cmd = `Start-Process 'explorer.exe' 'shell:AppsFolder\\${appIdOrPath}'`;
    } else {
      cmd = `Start-Process '${appIdOrPath}'`;
    }

    const ps = spawn('powershell.exe', ['-NoProfile', '-Command', cmd]);
    ps.on('close', (code) => resolve({ success: code === 0 }));
    ps.on('error', (err) => resolve({ success: false, error: err.message }));
  });
});

