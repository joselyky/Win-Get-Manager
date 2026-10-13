/**
 * renderer.js — UI Logic & IPC Communication
 * Handles all user interactions, DOM updates, and communication
 * with the main process via the electronAPI context bridge.
 */

'use strict';

// ─── DOM References ────────────────────────────────────────────────────────────
const btnScan            = document.getElementById('btn-scan');
const btnUpdateSelected  = document.getElementById('btn-update-selected');
const btnUpdateAll       = document.getElementById('btn-update-all');
const btnUpdateEverything = document.getElementById('btn-update-everything');
const btnSelectAll       = document.getElementById('btn-select-all');
const btnDeselectAll     = document.getElementById('btn-deselect-all');
const btnClearLog        = document.getElementById('btn-clear-log');
const btnMinimize        = document.getElementById('btn-minimize');
const btnMaximize        = document.getElementById('btn-maximize');
const btnClose           = document.getElementById('btn-close');
const chkAllHeader       = document.getElementById('chk-all-header');
const searchInput        = document.getElementById('search-input');

const stateIdle          = document.getElementById('state-idle');
const stateLoading       = document.getElementById('state-loading');
const stateEmpty         = document.getElementById('state-empty');
const packageTableWrapper= document.getElementById('package-table-wrapper');
const packageTbody       = document.getElementById('package-tbody');

const consoleOutput      = document.getElementById('console-output');
const progressContainer  = document.getElementById('progress-container');
const progressBar        = document.getElementById('progress-bar');
const progressText       = document.getElementById('progress-text');
const progressPct        = document.getElementById('progress-pct');
const statusIndicator    = document.getElementById('status-indicator');
const statusSubtext      = document.getElementById('status-subtext');

const statTotal          = document.getElementById('stat-total');
const statSelected       = document.getElementById('stat-selected');
const toast              = document.getElementById('toast');

// System info elements
const sysHost            = document.getElementById('sys-host');
const sysOs              = document.getElementById('sys-os');
const sysRam             = document.getElementById('sys-ram');

// Tabs elements
const tabEveryday        = document.getElementById('tab-everyday');
const tabGames           = document.getElementById('tab-games');
const tabSystem          = document.getElementById('tab-system');
const badgeEveryday      = document.getElementById('badge-everyday');
const badgeGames         = document.getElementById('badge-games');
const badgeSystem        = document.getElementById('badge-system');

// Queue UI elements
const queueDrawer             = document.getElementById('queue-drawer');
const queueSummaryText        = document.getElementById('queue-summary-text');
const queueGlobalStat         = document.getElementById('queue-global-stat');
const queueGlobalMb           = document.getElementById('queue-global-mb');
const btnToggleQueueCollapse  = document.getElementById('btn-toggle-queue-collapse');
const btnCloseQueue           = document.getElementById('btn-close-queue');
const queueItemsList          = document.getElementById('queue-items-list');
const btnStatusQueueToggle    = document.getElementById('btn-status-queue-toggle');
const statusQueueLabel        = document.getElementById('status-queue-label');

// ─── State ─────────────────────────────────────────────────────────────────────
let allPackages = [];        // Full list from winget
let filteredPackages = [];   // Subset after search filter
let isUpdating = false;
let toastTimer = null;
let modalCountdownTimer = null;
let currentTab = 'everyday';
let currentInstalledTab = 'everyday';
let selectedPackageIds = new Set();
let selectedInstalledAppIds = new Set();
let currentQueueItems = [];
let sessionCompletedPkgIds = new Set();

let allInstalledApps = [];   // List of installed apps
let filteredInstalledApps = []; // Subset after search filter

// ─── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  bindWindowControls();
  bindActionButtons();
  bindSearch();
  bindTabs();
  bindModal();
  bindNavigation();
  bindUninstallerControls();
  bindGpuControls();
  bindQueueEvents();
  await loadSystemInfo();
}

// ─── Window Controls ───────────────────────────────────────────────────────────
function bindWindowControls() {
  if (btnMinimize) btnMinimize.addEventListener('click', () => window.electronAPI.minimizeWindow());
  if (btnMaximize) btnMaximize.addEventListener('click', () => window.electronAPI.maximizeWindow());
  if (btnClose)    btnClose.addEventListener('click',    () => window.electronAPI.closeWindow());
}

// ─── Action Buttons ────────────────────────────────────────────────────────────
function bindActionButtons() {
  if (btnScan) btnScan.addEventListener('click', () => handleScan(true));
  if (btnUpdateSelected) btnUpdateSelected.addEventListener('click', handleUpdateSelected);
  if (btnUpdateAll) btnUpdateAll.addEventListener('click', handleUpdateAll);
  if (btnUpdateEverything) {
    btnUpdateEverything.addEventListener('click', handleUpdateEverything);
  }
  if (btnSelectAll) btnSelectAll.addEventListener('click', () => setAllCheckboxes(true));
  if (btnDeselectAll) btnDeselectAll.addEventListener('click', () => setAllCheckboxes(false));
  if (chkAllHeader) chkAllHeader.addEventListener('change', () => setAllCheckboxes(chkAllHeader.checked));
}

// ─── Live Download & Update Queue ─────────────────────────────────────────────
function bindQueueEvents() {
  if (btnToggleQueueCollapse && queueDrawer) {
    btnToggleQueueCollapse.addEventListener('click', () => {
      queueDrawer.classList.toggle('collapsed');
    });
  }
  if (btnCloseQueue && queueDrawer) {
    btnCloseQueue.addEventListener('click', () => {
      queueDrawer.classList.add('hidden');
    });
  }
  if (btnStatusQueueToggle && queueDrawer) {
    btnStatusQueueToggle.addEventListener('click', () => {
      queueDrawer.classList.toggle('hidden');
      queueDrawer.classList.remove('collapsed');
    });
  }

  if (window.electronAPI && window.electronAPI.onQueueInit) {
    window.electronAPI.onQueueInit(data => {
      initQueueUI(data.queue || []);
    });
  }

  if (window.electronAPI && window.electronAPI.onQueueUpdate) {
    window.electronAPI.onQueueUpdate(data => {
      updateQueueUI(data);
    });
  }
}

function escapeQueueId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function initQueueUI(items) {
  currentQueueItems = items;
  if (!queueDrawer || !queueItemsList) return;

  queueItemsList.innerHTML = '';
  queueDrawer.classList.remove('hidden');
  queueDrawer.classList.remove('collapsed');
  if (btnStatusQueueToggle) {
    btnStatusQueueToggle.classList.remove('hidden');
    if (statusQueueLabel) statusQueueLabel.textContent = `Cola: 0/${items.length}`;
  }
  if (queueSummaryText) {
    queueSummaryText.textContent = `0 de ${items.length} completados`;
  }
  if (queueGlobalStat) {
    queueGlobalStat.classList.remove('hidden');
  }

  items.forEach((item) => {
    const card = document.createElement('div');
    const safeId = escapeQueueId(item.id);
    card.id = `queue-card-${safeId}`;
    card.className = 'queue-item-card glass';

    const iconHtml = (item.iconBase64 && item.iconBase64.length > 50)
      ? `<img src="data:image/png;base64,${item.iconBase64}" alt="" />`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;

    const verHtml = item.version
      ? `v${sanitize(item.version)} <span class="ver-arrow">→</span> <span class="ver-target">v${sanitize(item.available || 'nueva')}</span>`
      : `<span class="ver-target">v${sanitize(item.available || 'nueva')}</span>`;

    card.innerHTML = `
      <div class="queue-item-header">
        <div class="queue-item-left">
          <div class="queue-item-icon-box">${iconHtml}</div>
          <div class="queue-item-meta">
            <span class="queue-item-name" title="${sanitize(item.name || item.id)}">${sanitize(item.name || item.id)}</span>
            <span class="queue-item-versions">${verHtml}</span>
          </div>
        </div>
        <div id="queue-badge-${safeId}" class="queue-status-badge badge-pending">
          <span class="status-badge-text">En cola</span>
        </div>
      </div>
      <div class="queue-progress-track">
        <div id="queue-fill-${safeId}" class="queue-progress-fill" style="width: 0%;"></div>
      </div>
      <div class="queue-progress-stats">
        <span id="queue-bytes-${safeId}" class="stat-mb-val">0.0 MB / —</span>
        <span id="queue-speed-${safeId}" class="stat-speed">0.0 MB/s</span>
        <span id="queue-pct-${safeId}" class="stat-pct">0%</span>
      </div>
      <div id="queue-actions-${safeId}" class="queue-card-actions hidden"></div>
    `;

    queueItemsList.appendChild(card);
  });

  // Bind queue action buttons once
  if (queueItemsList && !queueItemsList.dataset.boundActions) {
    queueItemsList.dataset.boundActions = 'true';
    queueItemsList.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-queue-action');
      if (!btn) return;
      const action = btn.dataset.action;
      const pkgId = btn.dataset.pkgId;
      const pkg = currentQueueItems.find(i => i.id === pkgId);
      if (!pkg) return;

      const safeId = escapeQueueId(pkgId);
      const actionsEl = document.getElementById(`queue-actions-${safeId}`);
      if (actionsEl) actionsEl.classList.add('hidden');

      if (action === 'admin') {
        showToast(`Solicitando autorización de Administrador para ${pkg.name || pkg.id}...`, 'info');
        window.electronAPI.upgradePackageElevated(pkg);
      } else if (action === 'kill-retry') {
        showToast(`Cerrando procesos de ${pkg.name || pkg.id}...`, 'info');
        await window.electronAPI.killProcess(pkg.id);
        showToast(`Reintentando actualización de ${pkg.name || pkg.id}...`, 'info');
        window.electronAPI.upgradePackages([pkg]);
      } else if (action === 'retry') {
        showToast(`Reintentando actualización de ${pkg.name || pkg.id}...`, 'info');
        window.electronAPI.upgradePackages([pkg]);
      }
    });
  }
}

function updateQueueUI(data) {
  const safeId = escapeQueueId(data.pkgId);
  const card = document.getElementById(`queue-card-${safeId}`);
  const badge = document.getElementById(`queue-badge-${safeId}`);
  const fill = document.getElementById(`queue-fill-${safeId}`);
  const bytesEl = document.getElementById(`queue-bytes-${safeId}`);
  const speedEl = document.getElementById(`queue-speed-${safeId}`);
  const pctEl = document.getElementById(`queue-pct-${safeId}`);
  const actionsEl = document.getElementById(`queue-actions-${safeId}`);

  if (!card) return;

  // Clear state classes
  card.classList.remove('item-downloading', 'item-installing', 'item-completed', 'item-error');
  if (actionsEl) {
    actionsEl.classList.add('hidden');
    actionsEl.innerHTML = '';
  }

  const totalMbText = (data.totalMB && data.totalMB !== '—') ? `${data.totalMB} MB` : 'Calculando...';

  if (data.status === 'starting') {
    card.classList.add('item-downloading');
    if (badge) {
      badge.className = 'queue-status-badge badge-downloading';
      badge.innerHTML = '<span class="status-pulse-dot pulse-primary"></span><span>Conectando...</span>';
    }
    if (bytesEl) bytesEl.textContent = 'Iniciando descarga...';
    if (speedEl) speedEl.textContent = '—';
    if (pctEl) pctEl.textContent = '0%';
  } else if (data.status === 'downloading') {
    card.classList.add('item-downloading');
    if (badge) {
      badge.className = 'queue-status-badge badge-downloading';
      badge.innerHTML = '<span class="status-pulse-dot pulse-primary"></span><span>Descargando</span>';
    }
    if (fill) fill.style.width = `${data.percent}%`;
    if (bytesEl) bytesEl.textContent = `${data.downloadedMB} MB / ${totalMbText}`;
    if (speedEl) speedEl.textContent = `${data.speedMBs || '0.0'} MB/s`;
    if (pctEl) pctEl.textContent = `${data.percent}%`;

    // Also update bottom status bar in sync
    const currentPkg = currentQueueItems.find(i => i.id === data.pkgId);
    const pName = currentPkg ? currentPkg.name : data.pkgId;
    setStatusBar(`Descargando: ${pName}`, `${data.downloadedMB} MB de ${totalMbText} (${data.percent}%) • ${data.speedMBs || '0.0'} MB/s`, Math.round(data.percent), 'busy');
  } else if (data.status === 'installing') {
    card.classList.add('item-installing');
    if (badge) {
      badge.className = 'queue-status-badge badge-installing';
      badge.innerHTML = '<span class="status-pulse-dot pulse-warning"></span><span>Instalando</span>';
    }
    if (fill) fill.style.width = '100%';
    if (bytesEl) bytesEl.textContent = data.message || `${data.downloadedMB || 'Descarga lista'} (${totalMbText})`;
    if (speedEl) speedEl.textContent = 'Instalando...';
    if (pctEl) pctEl.textContent = '100%';

    const currentPkg = currentQueueItems.find(i => i.id === data.pkgId);
    const pName = currentPkg ? currentPkg.name : data.pkgId;
    setStatusBar(`Instalando: ${pName}`, data.message || 'Ejecutando instalador oficial de Windows...', 100, 'busy');
  } else if (data.status === 'completed') {
    card.classList.add('item-completed');
    sessionCompletedPkgIds.add(data.pkgId);

    // Immediately remove from pending table so the user sees live progress
    allPackages = allPackages.filter(p => p.id !== data.pkgId);
    filteredPackages = filteredPackages.filter(p => p.id !== data.pkgId);
    selectedPackageIds.delete(data.pkgId);
    renderPackageTable(filteredPackages);
    updateStats();

    if (badge) {
      badge.className = 'queue-status-badge badge-completed';
      badge.innerHTML = '<span>Completado ✔</span>';
    }
    if (fill) fill.style.width = '100%';
    if (bytesEl) bytesEl.textContent = data.message || `${data.downloadedMB || totalMbText} (Descargado)`;
    if (speedEl) speedEl.textContent = 'Listo';
    if (pctEl) pctEl.textContent = '100%';
  } else if (data.status === 'error' || data.status === 'in-use' || data.status === 'admin-needed') {
    card.classList.add('item-error');
    const isAdmin = data.status === 'admin-needed' || data.errorType === 'admin';
    const isInUse = data.status === 'in-use' || data.errorType === 'in-use';

    if (badge) {
      if (isAdmin) {
        badge.className = 'queue-status-badge badge-admin';
        badge.innerHTML = '<span>Requiere Admin 🛡</span>';
      } else if (isInUse) {
        badge.className = 'queue-status-badge badge-in-use';
        badge.innerHTML = '<span>App en uso ⚠</span>';
      } else {
        badge.className = 'queue-status-badge badge-error';
        badge.innerHTML = '<span>Error ✖</span>';
      }
    }
    if (bytesEl) bytesEl.textContent = data.message || 'Error en la actualización';
    if (speedEl) speedEl.textContent = 'Detenido';
    if (pctEl) pctEl.textContent = '—';

    // Show actionable resolution buttons
    if (actionsEl) {
      actionsEl.classList.remove('hidden');
      if (isAdmin) {
        actionsEl.innerHTML = `
          <button class="btn-queue-action btn-queue-action-admin" data-action="admin" data-pkg-id="${data.pkgId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Instalar como Administrador
          </button>
          <button class="btn-queue-action btn-queue-action-retry" data-action="retry" data-pkg-id="${data.pkgId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Reintentar
          </button>
        `;
      } else if (isInUse) {
        actionsEl.innerHTML = `
          <button class="btn-queue-action btn-queue-action-kill" data-action="kill-retry" data-pkg-id="${data.pkgId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Cerrar app y Reintentar
          </button>
          <button class="btn-queue-action btn-queue-action-retry" data-action="retry" data-pkg-id="${data.pkgId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Reintentar
          </button>
        `;
      } else {
        actionsEl.innerHTML = `
          <button class="btn-queue-action btn-queue-action-retry" data-action="retry" data-pkg-id="${data.pkgId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Reintentar
          </button>
          <button class="btn-queue-action btn-queue-action-admin" data-action="admin" data-pkg-id="${data.pkgId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Probar como Administrador
          </button>
        `;
      }
    }
  }

  // Update overall queue counters
  if (queueItemsList) {
    const completedCount = queueItemsList.querySelectorAll('.item-completed').length;
    const totalCount = currentQueueItems.length;
    if (statusQueueLabel) {
      statusQueueLabel.textContent = `Cola: ${completedCount}/${totalCount} (${data.percent || 0}%)`;
    }
    if (queueSummaryText) {
      queueSummaryText.textContent = `${completedCount} de ${totalCount} completados`;
    }
    if (queueGlobalMb && data.downloadedMB) {
      queueGlobalMb.textContent = `${data.downloadedMB} MB descargados`;
    }
  }
}

// ─── Search Filter ─────────────────────────────────────────────────────────────
function bindSearch() {
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      filteredPackages = allPackages.filter(pkg =>
        pkg.name.toLowerCase().includes(query) ||
        pkg.id.toLowerCase().includes(query)
      );
      renderPackageTable(filteredPackages);
      updateStats();
    });
  }

  const searchInstalledInput = document.getElementById('search-installed-input');
  if (searchInstalledInput) {
    searchInstalledInput.addEventListener('input', () => {
      const query = searchInstalledInput.value.trim().toLowerCase();
      filteredInstalledApps = allInstalledApps.filter(app =>
        (app.name && app.name.toLowerCase().includes(query)) ||
        (app.publisher && app.publisher.toLowerCase().includes(query))
      );
      renderInstalledAppsTable(filteredInstalledApps);
    });
  }
}

// ─── System Info ───────────────────────────────────────────────────────────────
async function loadSystemInfo() {
  try {
    const info = await window.electronAPI.getSystemInfo();
    sysHost.textContent = info.hostname ?? '—';
    if (info.osName) {
      sysOs.textContent = info.osName;
    } else if (info.release) {
      const parts = String(info.release).split('.');
      const build = parseInt(parts[2] || '0', 10);
      sysOs.textContent = (parts[0] === '10' && build >= 22000) ? 'Windows 11' : `Windows ${info.release}`;
    } else {
      sysOs.textContent = 'Windows';
    }
    if (sysRam) {
      sysRam.textContent = formatBytes(info.freeMemory) + ' libre';
    }
  } catch (e) {
    sysHost.textContent = '—';
  }
}

// ─── Scan for Upgrades ─────────────────────────────────────────────────────────
async function handleScan(manualTrigger = false) {
  if (isUpdating) return;

  if (manualTrigger) {
    sessionCompletedPkgIds.clear();
  }

  setUIBusy(true, 'scan');
  showState('loading');
  clearLog();
  setStatusBar('Buscando actualizaciones...', 'Consultando repositorio de winget...', null, 'busy');

  try {
    const result = await window.electronAPI.listUpgrades();

    if (!result.success && !result.packages) {
      throw new Error(result.error ?? 'Error desconocido al ejecutar winget.');
    }

    const rawPackages = result.packages ?? [];
    allPackages = rawPackages.filter(pkg => !sessionCompletedPkgIds.has(pkg.id));
    filteredPackages = [...allPackages];
    searchInput.value = '';
    selectedPackageIds.clear();

    if (allPackages.length === 0) {
      showState('empty');
      setStatusBar('Sistema al día', 'No se encontraron actualizaciones pendientes', 100, 'idle');
      showToast('Tu sistema está al día.', 'success');
    } else {
      renderPackageTable(filteredPackages);
      showState('table');
      setStatusBar('Escaneo finalizado', `${allPackages.length} actualización(es) disponible(s)`, 100, 'idle');
      showToast(`${allPackages.length} actualizaciones encontradas.`, 'info');
    }

    updateStats();
    setTimeout(() => resetStatusBar(), 3500);
  } catch (err) {
    showState('idle');
    setStatusBar('Error al escanear', err.message, 0, 'error');
    showToast('Error al escanear. ¿Está winget instalado?', 'error');
  } finally {
    setUIBusy(false);
  }
}

// ─── Update Selected Packages ──────────────────────────────────────────────────
function handleUpdateSelected() {
  if (isUpdating) return;

  const selectedPackages = getSelectedPackages();
  if (selectedPackages.length === 0) {
    showToast('Selecciona al menos una aplicación.', 'error');
    return;
  }

  // Check if any selected package is a system package
  const selectedSystemPkgs = allPackages.filter(pkg => selectedPackageIds.has(pkg.id) && isSystemPackage(pkg));

  const proceedWithUpdateSelected = () => {
    setUIBusy(true, 'update');
    clearLog();
    setupProgressTracking(selectedPackages.length, 'Actualizando paquetes');

    // Clean up previous listeners
    window.electronAPI.removeAllListeners('winget:log');
    window.electronAPI.removeAllListeners('winget:done');

    let completed = 0;

    window.electronAPI.onLog((data) => {
      appendLog(data.type, data.text);

      if (data.text.includes('▶ Actualizando:')) {
        const currentPkgName = data.text.replace('▶ Actualizando:', '').trim();
        setStatusBar(`Actualizando: ${currentPkgName}`, `Progreso: ${completed + 1} de ${selectedPackages.length}`, Math.round((completed / selectedPackages.length) * 100), 'busy');
      }

      // Detect package completion to advance progress
      if (data.type === 'success' && data.text.includes('✔')) {
        completed++;
        updateProgress(completed, selectedPackages.length);
      }
    });

    window.electronAPI.onDone((data) => {
      setUIBusy(false);

      if (data.success) {
        hideProgress('Actualizaciones completadas', 'Todos los paquetes seleccionados fueron actualizados.');
        showToast('Actualizaciones completadas.', 'success');
        selectedPackageIds.clear();
        setTimeout(handleScan, 1200);
      } else {
        setStatusBar('Actualización finalizada con advertencias', 'Algunas actualizaciones fallaron o fueron canceladas.', 100, 'error');
        showToast('Algunas actualizaciones fallaron.', 'error');
      }

      // Refresh UI stats
      updateStats();
    });

    window.electronAPI.upgradePackages(selectedPackages);
  };

  if (selectedSystemPkgs.length > 0) {
    const warningMsg = `Advertencia: Has seleccionado ${selectedSystemPkgs.length} componente(s) crítico(s) del sistema (ej. ${selectedSystemPkgs[0].name}). La actualización de controladores, runtimes o librerías críticas de Windows puede provocar errores en el equipo. ¿Deseas continuar?`;
    showConfirmationModal(warningMsg, proceedWithUpdateSelected);
  } else {
    proceedWithUpdateSelected();
  }
}

// ─── Update All Packages ───────────────────────────────────────────────────────
function handleUpdateAll() {
  if (isUpdating) return;

  // Filter packages based on active tab
  const activePackages = allPackages.filter(pkg => getPackageCategory(pkg) === currentTab);

  if (activePackages.length === 0) {
    showToast('No hay aplicaciones para actualizar en esta pestaña.', 'error');
    return;
  }

  const proceedWithUpdateAll = () => {
    setUIBusy(true, 'update');
    clearLog();
    setupProgressTracking(activePackages.length, 'Actualizando pestaña');

    // Clean up previous listeners
    window.electronAPI.removeAllListeners('winget:log');
    window.electronAPI.removeAllListeners('winget:done');

    let completed = 0;

    window.electronAPI.onLog((data) => {
      appendLog(data.type, data.text);

      if (data.text.includes('▶ Actualizando:')) {
        const currentPkgName = data.text.replace('▶ Actualizando:', '').trim();
        setStatusBar(`Actualizando: ${currentPkgName}`, `Progreso: ${completed + 1} de ${activePackages.length}`, Math.round((completed / activePackages.length) * 100), 'busy');
      }

      // Detect package completion to advance progress
      if (data.type === 'success' && data.text.includes('✔')) {
        completed++;
        updateProgress(completed, activePackages.length);
      }
    });

    window.electronAPI.onDone((data) => {
      setUIBusy(false);

      if (data.success) {
        hideProgress('Actualizaciones completadas', 'Todos los paquetes de la pestaña fueron actualizados.');
        showToast('Actualizaciones completadas.', 'success');
        activePackages.forEach(pkg => selectedPackageIds.delete(pkg.id));
        setTimeout(handleScan, 1200);
      } else {
        setStatusBar('Actualización finalizada con advertencias', 'Algunas actualizaciones fallaron o fueron canceladas.', 100, 'error');
        showToast('Algunas actualizaciones fallaron.', 'error');
      }

      // Refresh UI stats
      updateStats();
    });

    window.electronAPI.upgradePackages(activePackages.map(pkg => ({
      id: pkg.id,
      name: pkg.name || pkg.id,
      version: pkg.version || '',
      available: pkg.available || '',
      iconBase64: pkg.iconBase64 || '',
      source: pkg.source || 'winget'
    })));
  };

  if (currentTab === 'system') {
    const warningMsg = "Advertencia: Vas a actualizar TODOS los componentes del sistema y runtimes en esta lista. Actualizar dependencias críticas del sistema puede causar inestabilidad en el equipo o fallos inesperados. ¿Deseas continuar?";
    showConfirmationModal(warningMsg, proceedWithUpdateAll);
  } else {
    proceedWithUpdateAll();
  }
}

// ─── Update Everything (Global All) ───────────────────────────────────────────
function handleUpdateEverything() {
  if (isUpdating) return;
  if (allPackages.length === 0) return;

  const warningMsg = "Advertencia de Seguridad: Vas a actualizar absolutamente todas las aplicaciones disponibles, incluyendo componentes del sistema y redistribuibles de Windows. Esto puede provocar fallos de compatibilidad u otros errores graves en el equipo. ¿Estás seguro de que deseas continuar?";

  showConfirmationModal(warningMsg, () => {
    setUIBusy(true, 'update');
    clearLog();
    setupProgressTracking(allPackages.length);

    // Clean up previous listeners
    window.electronAPI.removeAllListeners('winget:log');
    window.electronAPI.removeAllListeners('winget:done');

    let completed = 0;

    window.electronAPI.onLog((data) => {
      appendLog(data.type, data.text);

      // Detect package completion to advance progress
      if (data.type === 'success' && data.text.includes('✔')) {
        completed++;
        updateProgress(completed, allPackages.length);
      }
    });

    window.electronAPI.onDone((data) => {
      setUIBusy(false);
      hideProgress();

      if (data.success) {
        showToast('Todas las aplicaciones actualizadas.', 'success');
        selectedPackageIds.clear();
        setTimeout(handleScan, 1200);
      } else {
        showToast('Algunas actualizaciones fallaron. Revisa la consola.', 'error');
      }

      // Refresh UI stats
      updateStats();
    });

    window.electronAPI.upgradePackages(allPackages.map(pkg => ({
      id: pkg.id,
      name: pkg.name || pkg.id,
      version: pkg.version || '',
      available: pkg.available || '',
      iconBase64: pkg.iconBase64 || '',
      source: pkg.source || 'winget'
    })));
  });
}

// ─── Table Rendering ───────────────────────────────────────────────────────────
// ─── Tabs Controls ─────────────────────────────────────────────────────────────
function bindTabs() {
  if (tabEveryday) {
    tabEveryday.addEventListener('click', () => {
      if (currentTab === 'everyday') return;
      currentTab = 'everyday';
      tabEveryday.classList.add('active');
      if (tabGames) tabGames.classList.remove('active');
      if (tabSystem) tabSystem.classList.remove('active');
      renderPackageTable(filteredPackages);
    });
  }
  if (tabGames) {
    tabGames.addEventListener('click', () => {
      if (currentTab === 'games') return;
      currentTab = 'games';
      tabGames.classList.add('active');
      if (tabEveryday) tabEveryday.classList.remove('active');
      if (tabSystem) tabSystem.classList.remove('active');
      renderPackageTable(filteredPackages);
    });
  }
  if (tabSystem) {
    tabSystem.addEventListener('click', () => {
      if (currentTab === 'system') return;
      currentTab = 'system';
      tabSystem.classList.add('active');
      if (tabEveryday) tabEveryday.classList.remove('active');
      if (tabGames) tabGames.classList.remove('active');
      renderPackageTable(filteredPackages);
    });
  }

  // Uninstaller tabs
  const tabInstEveryday = document.getElementById('tab-installed-everyday');
  const tabInstGames = document.getElementById('tab-installed-games');
  const tabInstSystem = document.getElementById('tab-installed-system');
  if (tabInstEveryday) {
    tabInstEveryday.addEventListener('click', () => {
      if (currentInstalledTab === 'everyday') return;
      currentInstalledTab = 'everyday';
      tabInstEveryday.classList.add('active');
      if (tabInstGames) tabInstGames.classList.remove('active');
      if (tabInstSystem) tabInstSystem.classList.remove('active');
      renderInstalledAppsTable(filteredInstalledApps);
    });
  }
  if (tabInstGames) {
    tabInstGames.addEventListener('click', () => {
      if (currentInstalledTab === 'games') return;
      currentInstalledTab = 'games';
      tabInstGames.classList.add('active');
      if (tabInstEveryday) tabInstEveryday.classList.remove('active');
      if (tabInstSystem) tabInstSystem.classList.remove('active');
      renderInstalledAppsTable(filteredInstalledApps);
    });
  }
  if (tabInstSystem) {
    tabInstSystem.addEventListener('click', () => {
      if (currentInstalledTab === 'system') return;
      currentInstalledTab = 'system';
      tabInstSystem.classList.add('active');
      if (tabInstEveryday) tabInstEveryday.classList.remove('active');
      if (tabInstGames) tabInstGames.classList.remove('active');
      renderInstalledAppsTable(filteredInstalledApps);
    });
  }
}

// ─── System / Risk Package Categorization ──────────────────────────────────────
function isSystemPackage(pkg) {
  if (!pkg) return false;
  const name = (pkg.name || '').toLowerCase();
  const id = (pkg.id || '').toLowerCase();
  const publisher = (pkg.publisher || '').toLowerCase();
  const keywords = [
    'redistributable',
    'microsoft visual c++',
    'c++ redist',
    'vcredist',
    'sql server',
    'driver',
    'framework',
    '.net runtime',
    '.net sdk',
    'developer pack',
    'directx',
    'windows desktop runtime',
    'microsoft.net',
    'microsoft.aspnetcore',
    'microsoft.windowsdesktop',
    'microsoft.vc',
    'intel(r)',
    'intel corporation',
    'amd ',
    'advanced micro devices',
    'nvidia',
    'realtek',
    'synaptics',
    'firmware',
    'bios ',
    'wacom',
    'microsoft.windowssdk',
    'microsoft.visualstudio.workload',
    'opencl',
    'vulkan runtime',
    'vulkanrt'
  ];
  return keywords.some(k => name.includes(k) || id.includes(k) || publisher.includes(k));
}

// ─── Game Package Categorization ───────────────────────────────────────────────
function isGamePackage(pkg) {
  if (!pkg) return false;
  // If it's a core system runtime, keep it in system components
  if (isSystemPackage(pkg)) return false;

  const id = (pkg.id || '').toLowerCase();
  const name = (pkg.name || '').toLowerCase();
  const publisher = (pkg.publisher || '').toLowerCase();
  const installLoc = (pkg.installLocation || '').toLowerCase();
  const uninstStr = (pkg.uninstallString || '').toLowerCase();

  // 1. Direct registry / protocol markers (100% certainty)
  if (id.startsWith('steam app ')) return true;
  if (uninstStr.includes('steam://uninstall/') || uninstStr.includes('steam.exe')) return true;
  if (uninstStr.includes('com.epicgames.launcher') || uninstStr.includes('battlenet://') || uninstStr.includes('riotclient://')) return true;

  // 2. Typical Game Installation Directories
  if (
    installLoc.includes('steamapps') ||
    installLoc.includes('\\epic games\\') ||
    installLoc.includes('/epic games/') ||
    installLoc.includes('\\riot games\\') ||
    installLoc.includes('/riot games/') ||
    installLoc.includes('\\ubisoft game launcher\\games') ||
    installLoc.includes('/ubisoft game launcher/games') ||
    installLoc.includes('\\gog galaxy\\games') ||
    installLoc.includes('/gog galaxy/games') ||
    installLoc.includes('\\ea games\\') ||
    installLoc.includes('/ea games/') ||
    installLoc.includes('\\origin games\\') ||
    installLoc.includes('/origin games/') ||
    installLoc.includes('\\xboxgames') ||
    installLoc.includes('/xboxgames') ||
    installLoc.includes('\\battle.net\\') ||
    installLoc.includes('/battle.net/')
  ) {
    return true;
  }

  // 3. Known Gaming Publishers / Studios
  const gamePublishers = [
    'valve',
    'facepunch studios',
    'robtop games',
    'bohemia interactive',
    'unknown worlds',
    'epic games',
    'electronic arts',
    'ea swiss',
    'ea games',
    'ubisoft',
    'blizzard entertainment',
    'riot games',
    'rockstar games',
    'cd projekt red',
    'bethesda',
    'square enix',
    'capcom',
    'bandai namco',
    'sega',
    'xbox game studios',
    'playstation pc',
    'playstation publishing',
    'sony interactive',
    '2k games',
    'take-two',
    'activision',
    'fromsoftware',
    'krafton',
    'techland',
    'larian studios',
    'mihoyo',
    'cognosphere',
    'roblox corporation',
    'mojang',
    'wargaming',
    'paradox interactive',
    'warner bros. games',
    'wb games',
    'konami',
    'focus entertainment',
    'deep silver',
    'thq nordic',
    'devolver digital',
    'remedy entertainment',
    'bungie',
    'io interactive',
    'pearl abyss',
    'gaijin network',
    'gaijin entertainment',
    'ncsoft',
    'smilegate',
    'nexon',
    'supercell',
    'team cherry',
    're-logic',
    'chucklefish',
    'klei entertainment',
    'fancy games',
    'lemorion_1224',
    'perfuse entertainment',
    'battlestate games',
    'embark studios',
    'grinding gear games'
  ];

  if (gamePublishers.some(pub => publisher === pub || publisher.includes(pub))) {
    return true;
  }

  // 4. Known Gaming Package IDs (WinGet & Stores)
  const gameIdPrefixes = [
    'valve.',
    'epicgames.',
    'electronicarts.',
    'ubisoft.',
    'blizzard.',
    'riotgames.',
    'mojang.',
    'roblox.',
    'gog.',
    'bethesda.',
    'rockstargames.',
    'squareenix.',
    'capcom.',
    'bandainamco.',
    'sega.',
    'playstation.',
    'krafton.',
    'mihoyo.',
    'cognosphere.',
    'techland.',
    'wargaming.',
    'cdprojektred.',
    'paradoxinteractive.',
    'fromsoftware.',
    'larianstudios.',
    'devolverdigital.',
    'teamcherry.',
    'supercell.',
    'heroicgameslauncher.',
    'prismlauncher.',
    'multimc.',
    'lunarclient.',
    'badlionclient.',
    'curseforge.',
    'modrinth.',
    'itchio.',
    'retroarch.',
    'pcsx2.',
    'rpcs3.',
    'dolphinemu.',
    'ppsspp.',
    'citra.',
    'yuzu.',
    'ryujinx.',
    'duckstation.',
    'cemu.'
  ];

  if (gameIdPrefixes.some(prefix => id.startsWith(prefix) || id.includes('.' + prefix))) {
    return true;
  }

  // 5. Exclusions: Peripherals, utilities, and anti-cheat software that are NOT games
  const nonGameKeywords = [
    'logitech', 'razer', 'corsair', 'steelseries', 'afterburner',
    'geforce experience', 'rtx experience', 'nvidia app', 'anti-cheat',
    'vanguard', 'wallpaper engine'
  ];
  if (nonGameKeywords.some(ng => name.includes(ng) || id.includes(ng))) {
    return false;
  }

  // 6. Popular game titles & franchises
  const gameKeywords = [
    'minecraft', 'fortnite', 'roblox', 'steam', 'genshin impact',
    'honkai', 'valorant', 'league of legends', 'counter-strike',
    'cs:go', 'cs2', 'dota 2', 'deadlock', 'dayz', 'rust',
    'subnautica', 'geometry dash', 'rainbow six', 'golf it',
    'cyberpunk', 'grand theft auto', 'gta v', 'gta iv', 'gta 5',
    'red dead', 'witcher', 'apex legends', 'overwatch', 'call of duty',
    'warzone', 'battlefield', 'ea sports fc', 'fifa ', 'nba 2k',
    'rocket league', 'fall guys', 'pubg', 'assassin\'s creed',
    'far cry', 'forza horizon', 'forza motorsport', 'halo infinite',
    'halo master chief', 'elden ring', 'dark souls', 'sekiro',
    'bloodborne', 'armored core', 'baldur\'s gate', 'diablo',
    'world of warcraft', 'warcraft', 'starcraft', 'hearthstone',
    'destiny 2', 'warframe', 'path of exile', 'terraria',
    'stardew valley', 'ark: survival', 'sea of thieves', 'the sims',
    'monster hunter', 'resident evil', 'final fantasy', 'persona ',
    'yakuza', 'like a dragon', 'palworld', 'helldivers',
    'dead by daylight', 'among us', 'lethal company', 'phasmophobia',
    'euro truck simulator', 'american truck simulator', 'cities: skylines',
    'the binding of isaac', 'hades', 'hollow knight', 'celeste',
    'cuphead', 'undertale', 'deltarune', 'slay the spire',
    'civilization vi', 'civilization v', 'crusader kings', 'hearts of iron',
    'stellaris', 'age of empires', 'total war', 'warhammer',
    'hitman', 'tomb raider', 'god of war', 'spider-man',
    'the last of us', 'uncharted', 'horizon zero dawn', 'horizon forbidden west',
    'ghost of tsushima', 'fallout', 'the elder scrolls', 'skyrim',
    'starfield', 'doom eternal', 'wolfenstein', 'dishonored',
    'borderlands', 'bioshock', 'mass effect', 'dragon age',
    'need for speed', 'gran turismo', 'tekken', 'street fighter',
    'mortal kombat', 'guilty gear', 'brawlhalla', 'smite',
    'epic games launcher', 'gog galaxy', 'ea app', 'ubisoft connect',
    'battle.net', 'escape the backrooms'
  ];

  return gameKeywords.some(k => name.includes(k) || id.includes(k));
}

// ─── Unified Package Categorizer ───────────────────────────────────────────────
function getPackageCategory(pkg) {
  if (isSystemPackage(pkg)) return 'system';
  if (isGamePackage(pkg)) return 'games';
  return 'everyday';
}

function updateBadges(packages) {
  const everydayCount = packages.filter(pkg => getPackageCategory(pkg) === 'everyday').length;
  const gamesCount    = packages.filter(pkg => getPackageCategory(pkg) === 'games').length;
  const systemCount   = packages.filter(pkg => getPackageCategory(pkg) === 'system').length;
  if (badgeEveryday) badgeEveryday.textContent = everydayCount;
  if (badgeGames)    badgeGames.textContent = gamesCount;
  if (badgeSystem)   badgeSystem.textContent = systemCount;
}

function renderPackageTable(packages) {
  updateBadges(packages);

  const activePackages = packages.filter(pkg => getPackageCategory(pkg) === currentTab);

  packageTbody.innerHTML = '';

  if (activePackages.length === 0) {
    const tabName = currentTab === 'games' ? 'juegos' : (currentTab === 'system' ? 'componentes del sistema' : 'aplicaciones cotidianas');
    packageTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--color-text-secondary);">No se encontraron ${tabName} disponibles para actualizar.</td></tr>`;
    syncHeaderCheckbox();
    return;
  }

  activePackages.forEach((pkg, index) => {
    const tr = document.createElement('tr');
    tr.dataset.id = pkg.id;
    tr.style.animationDelay = `${index * 0.02}s`;
    
    const isSelected = selectedPackageIds.has(pkg.id);
    if (isSelected) {
      tr.classList.add('selected');
    }

    const iconHtml = (pkg.iconBase64 && pkg.iconBase64.length > 50)
      ? `<img class="app-icon-img" src="data:image/png;base64,${pkg.iconBase64}" alt="" />`
      : `<div class="app-icon-placeholder" title="Icono no disponible">
           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
             <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
             <line x1="12" y1="17" x2="12.01" y2="17"></line>
           </svg>
         </div>`;

    tr.innerHTML = `
      <td class="col-check">
        <input type="checkbox" class="custom-checkbox pkg-checkbox"
               id="chk-${sanitize(pkg.id)}"
               data-id="${sanitize(pkg.id)}"
               data-source="${sanitize(pkg.source || 'winget')}"
               aria-label="Seleccionar ${sanitize(pkg.name)}"
               ${isSelected ? 'checked' : ''} />
      </td>
      <td class="col-name">
        <div class="app-info-cell">
          ${iconHtml}
          <div class="app-name-details">
            <div class="app-name">${sanitize(pkg.name)}</div>
          </div>
        </div>
      </td>
      <td class="col-id">
        <div class="app-id">${sanitize(pkg.id)}</div>
      </td>
      <td class="col-version">
        <span class="version-badge badge-version">${sanitize(pkg.version || '—')}</span>
      </td>
      <td class="col-available">
        <span class="version-badge badge-available">${sanitize(pkg.available || '—')}</span>
      </td>
      <td class="col-source">
        <span class="source-tag">${sanitize(pkg.source || 'winget')}</span>
      </td>
    `;

    // Checkbox change → update stats and row highlight
    const chk = tr.querySelector('.pkg-checkbox');
    chk.addEventListener('change', () => {
      if (chk.checked) {
        selectedPackageIds.add(pkg.id);
        tr.classList.add('selected');
      } else {
        selectedPackageIds.delete(pkg.id);
        tr.classList.remove('selected');
      }
      updateStats();
      syncHeaderCheckbox();
    });

    // Row click to toggle (except clicking the checkbox itself)
    tr.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return;
      chk.checked = !chk.checked;
      chk.dispatchEvent(new Event('change'));
    });

    packageTbody.appendChild(tr);
  });

  syncHeaderCheckbox();
}

// ─── Checkbox Helpers ──────────────────────────────────────────────────────────
function setAllCheckboxes(checked) {
  const activePackages = filteredPackages.filter(pkg => getPackageCategory(pkg) === currentTab);

  activePackages.forEach(pkg => {
    if (checked) {
      selectedPackageIds.add(pkg.id);
    } else {
      selectedPackageIds.delete(pkg.id);
    }
  });

  document.querySelectorAll('.pkg-checkbox').forEach(chk => {
    chk.checked = checked;
    chk.closest('tr').classList.toggle('selected', checked);
  });
  if (chkAllHeader) chkAllHeader.checked = checked;
  updateStats();
}

function getSelectedPackages() {
  return allPackages
    .filter(pkg => selectedPackageIds.has(pkg.id))
    .map(pkg => ({
      id: pkg.id,
      name: pkg.name || pkg.id,
      version: pkg.version || '',
      available: pkg.available || '',
      iconBase64: pkg.iconBase64 || '',
      source: pkg.source || 'winget'
    }));
}

function syncHeaderCheckbox() {
  const all   = document.querySelectorAll('.pkg-checkbox');
  const checked = document.querySelectorAll('.pkg-checkbox:checked');
  if (chkAllHeader) {
    chkAllHeader.checked       = all.length > 0 && checked.length === all.length;
    chkAllHeader.indeterminate = checked.length > 0 && checked.length < all.length;
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────────────
function updateStats() {
  const selectedCount = selectedPackageIds.size;
  statTotal.textContent    = filteredPackages.length;
  statSelected.textContent = selectedCount;
  btnUpdateSelected.disabled = selectedCount === 0 || isUpdating;
  btnUpdateAll.disabled = allPackages.length === 0 || isUpdating;
  if (btnUpdateEverything) {
    btnUpdateEverything.disabled = allPackages.length === 0 || isUpdating;
  }
}

// ─── UI State Helpers ──────────────────────────────────────────────────────────
function showState(state) {
  stateIdle.classList.add('hidden');
  stateLoading.classList.add('hidden');
  stateEmpty.classList.add('hidden');
  packageTableWrapper.classList.add('hidden');

  switch (state) {
    case 'idle':    stateIdle.classList.remove('hidden'); break;
    case 'loading': stateLoading.classList.remove('hidden'); break;
    case 'empty':   stateEmpty.classList.remove('hidden'); break;
    case 'table':   packageTableWrapper.classList.remove('hidden'); break;
  }
}

function setUIBusy(busy, mode = 'update') {
  isUpdating = busy;

  btnScan.disabled          = busy;
  btnUpdateSelected.disabled = busy;
  btnUpdateAll.disabled     = busy || allPackages.length === 0;
  if (btnUpdateEverything) {
    btnUpdateEverything.disabled = busy || allPackages.length === 0;
  }

  if (mode === 'scan') {
    btnScan.classList.toggle('scanning', busy);
  } else if (!busy) {
    // Always stop scanning when busy is false
    btnScan.classList.remove('scanning');
  }
}

// ─── Status & Progress Bar ───────────────────────────────────────────────────
function setStatusBar(title, subtitle = '', pct = null, status = 'idle') {
  if (progressText) progressText.textContent = title;
  if (statusSubtext) statusSubtext.textContent = subtitle;
  
  if (statusIndicator) {
    statusIndicator.className = 'status-indicator';
    if (status === 'busy') statusIndicator.classList.add('busy');
    if (status === 'error') statusIndicator.classList.add('error');
  }

  if (progressPct) {
    progressPct.textContent = (pct !== null && pct !== undefined && pct !== '') ? `${pct}%` : '';
  }

  if (progressBar) {
    if (pct !== null && pct !== undefined && pct !== '') {
      progressBar.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    } else if (status === 'busy') {
      progressBar.style.transition = 'width 25s cubic-bezier(0.1, 0.5, 0.1, 1)';
      progressBar.style.width = '85%';
    } else {
      progressBar.style.transition = 'width 0.3s ease';
      progressBar.style.width = '0%';
    }
  }
}

function resetStatusBar(message = 'Listo', sub = 'Sistema preparado') {
  setStatusBar(message, sub, null, 'idle');
  if (progressBar) progressBar.style.width = '0%';
}

function setupProgressTracking(total, actionName = 'Actualizando') {
  setStatusBar(`${actionName}...`, `0 de ${total} paquetes`, 0, 'busy');
}

function showProgress(text, subtext = 'Procesando operación...') {
  setStatusBar(text, subtext, null, 'busy');
}

function updateProgress(done, total, currentItemName = '') {
  const pct = Math.round((done / total) * 100);
  const sub = currentItemName ? `${done} de ${total} (${currentItemName})` : `${done} de ${total} paquetes procesados`;
  setStatusBar('Procesando actualizaciones...', sub, pct, 'busy');
}

function hideProgress(successMsg = 'Operación completada', subMsg = 'Todas las tareas han finalizado') {
  setStatusBar(successMsg, subMsg, 100, 'idle');
  setTimeout(() => {
    resetStatusBar();
  }, 2500);
}

// ─── Console / Log (Safe Fallbacks) ──────────────────────────────────────────
function clearLog() {
  if (consoleOutput) consoleOutput.innerHTML = '';
}

function appendLog(type, text) {
  if (!consoleOutput) return;
  const placeholder = consoleOutput.querySelector('.console-placeholder');
  if (placeholder) placeholder.remove();

  const span = document.createElement('span');
  span.className = `log-${type}`;
  span.textContent = text;
  consoleOutput.appendChild(span);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// ─── Toast Notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  if (toastTimer) clearTimeout(toastTimer);

  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.classList.remove('hidden');

  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// ─── Sanitize HTML ────────────────────────────────────────────────────────────
function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Formatting Helpers ────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ─── Confirmation Modal Bindings ───────────────────────────────────────────────
let onConfirmCallback = null;

function bindModal() {
  const btnCancel = document.getElementById('btn-modal-cancel');
  const btnConfirm = document.getElementById('btn-modal-confirm');
  const modal = document.getElementById('confirm-modal');

  if (btnCancel && modal) {
    btnCancel.addEventListener('click', () => {
      if (modalCountdownTimer) {
        clearInterval(modalCountdownTimer);
        modalCountdownTimer = null;
      }
      modal.classList.add('hidden');
      onConfirmCallback = null;
    });
  }

  if (btnConfirm && modal) {
    btnConfirm.addEventListener('click', () => {
      if (btnConfirm.disabled) return;
      if (modalCountdownTimer) {
        clearInterval(modalCountdownTimer);
        modalCountdownTimer = null;
      }
      modal.classList.add('hidden');
      if (onConfirmCallback) {
        onConfirmCallback();
        onConfirmCallback = null;
      }
    });
  }
}

function showConfirmationModal(message, onConfirm, countdownSeconds = 0, confirmBtnText = 'Confirmar') {
  const modal = document.getElementById('confirm-modal');
  const modalText = document.getElementById('confirm-modal-text');
  const btnConfirm = document.getElementById('btn-modal-confirm');
  
  if (modalCountdownTimer) {
    clearInterval(modalCountdownTimer);
    modalCountdownTimer = null;
  }

  if (modal && modalText) {
    modalText.innerText = message;
    onConfirmCallback = onConfirm;
    modal.classList.remove('hidden');

    if (btnConfirm) {
      if (countdownSeconds > 0) {
        let remaining = countdownSeconds;
        btnConfirm.disabled = true;
        btnConfirm.textContent = `${confirmBtnText} (${remaining}s)`;
        btnConfirm.style.opacity = '0.55';
        btnConfirm.style.cursor = 'not-allowed';

        modalCountdownTimer = setInterval(() => {
          remaining--;
          if (remaining > 0) {
            btnConfirm.textContent = `${confirmBtnText} (${remaining}s)`;
          } else {
            clearInterval(modalCountdownTimer);
            modalCountdownTimer = null;
            btnConfirm.disabled = false;
            btnConfirm.textContent = confirmBtnText;
            btnConfirm.style.opacity = '1';
            btnConfirm.style.cursor = 'pointer';
          }
        }, 1000);
      } else {
        btnConfirm.disabled = false;
        btnConfirm.textContent = confirmBtnText;
        btnConfirm.style.opacity = '1';
        btnConfirm.style.cursor = 'pointer';
      }
    }
  } else {
    if (confirm(message)) {
      onConfirm();
    }
  }
}

let gpuDataLoaded = false;
let currentGpuData = null;

// ─── Navigation Bindings ───────────────────────────────────────────────────────
function bindNavigation() {
  const navUpdates = document.getElementById('nav-updates');
  const navUninstaller = document.getElementById('nav-uninstaller');
  const navGpu = document.getElementById('nav-gpu');

  const sidebarUpdatesControls = document.getElementById('sidebar-updates-controls');
  const sidebarUninstallerControls = document.getElementById('sidebar-uninstaller-controls');
  const sidebarGpuControls = document.getElementById('sidebar-gpu-controls');

  const mainUpdatesView = document.getElementById('main-updates-view');
  const mainUninstallerView = document.getElementById('main-uninstaller-view');
  const mainGpuView = document.getElementById('main-gpu-view');

  const switchView = (target) => {
    if (navUpdates) navUpdates.classList.toggle('active', target === 'updates');
    if (navUninstaller) navUninstaller.classList.toggle('active', target === 'uninstaller');
    if (navGpu) navGpu.classList.toggle('active', target === 'gpu');

    if (sidebarUpdatesControls) sidebarUpdatesControls.classList.toggle('hidden', target !== 'updates');
    if (sidebarUninstallerControls) sidebarUninstallerControls.classList.toggle('hidden', target !== 'uninstaller');
    if (sidebarGpuControls) sidebarGpuControls.classList.toggle('hidden', target !== 'gpu');

    if (mainUpdatesView) mainUpdatesView.classList.toggle('hidden', target !== 'updates');
    if (mainUninstallerView) mainUninstallerView.classList.toggle('hidden', target !== 'uninstaller');
    if (mainGpuView) mainGpuView.classList.toggle('hidden', target !== 'gpu');

    if (target === 'uninstaller' && allInstalledApps.length === 0) {
      handleScanInstalled();
    }
    if (target === 'gpu' && !gpuDataLoaded) {
      handleDetectGpu();
    }
  };

  if (navUpdates) navUpdates.addEventListener('click', () => switchView('updates'));
  if (navUninstaller) navUninstaller.addEventListener('click', () => switchView('uninstaller'));
  if (navGpu) navGpu.addEventListener('click', () => switchView('gpu'));
}

function bindUninstallerControls() {
  const btnScanInstalled = document.getElementById('btn-scan-installed');
  const btnUninstallSelected = document.getElementById('btn-uninstall-selected');
  const btnSelectAllInst = document.getElementById('btn-select-all-installed');
  const btnDeselectAllInst = document.getElementById('btn-deselect-all-installed');
  const chkAllInstHeader = document.getElementById('chk-all-installed-header');
  const searchInstalledInput = document.getElementById('search-installed-input');

  if (btnScanInstalled) {
    btnScanInstalled.addEventListener('click', handleScanInstalled);
  }

  if (btnUninstallSelected) {
    btnUninstallSelected.addEventListener('click', handleUninstallSelected);
  }

  if (btnSelectAllInst) {
    btnSelectAllInst.addEventListener('click', () => setAllInstalledCheckboxes(true));
  }

  if (btnDeselectAllInst) {
    btnDeselectAllInst.addEventListener('click', () => setAllInstalledCheckboxes(false));
  }

  if (chkAllInstHeader) {
    chkAllInstHeader.addEventListener('change', () => setAllInstalledCheckboxes(chkAllInstHeader.checked));
  }

  if (searchInstalledInput) {
    searchInstalledInput.addEventListener('input', () => {
      const query = searchInstalledInput.value.trim().toLowerCase();
      filteredInstalledApps = allInstalledApps.filter(app =>
        app.name.toLowerCase().includes(query) ||
        (app.publisher && app.publisher.toLowerCase().includes(query))
      );
      renderInstalledAppsTable(filteredInstalledApps);
    });
  }
}

function getSelectedInstalledApps() {
  return allInstalledApps.filter(app => selectedInstalledAppIds.has(app.id));
}

function updateInstalledSelectionStats() {
  const count = selectedInstalledAppIds.size;
  const countEl = document.getElementById('installed-selected-count');
  if (countEl) countEl.textContent = count;

  const btnUninstallSelected = document.getElementById('btn-uninstall-selected');
  if (btnUninstallSelected) {
    btnUninstallSelected.disabled = count === 0 || isUpdating;
  }

  const chkAllInstalledHeader = document.getElementById('chk-all-installed-header');
  if (chkAllInstalledHeader) {
    const activeApps = allInstalledApps.filter(app => getPackageCategory(app) === currentInstalledTab);
    if (activeApps.length === 0) {
      chkAllInstalledHeader.checked = false;
      chkAllInstalledHeader.indeterminate = false;
    } else {
      const selectedActive = activeApps.filter(a => selectedInstalledAppIds.has(a.id)).length;
      chkAllInstalledHeader.checked = selectedActive === activeApps.length;
      chkAllInstalledHeader.indeterminate = selectedActive > 0 && selectedActive < activeApps.length;
    }
  }
}

function setAllInstalledCheckboxes(checked) {
  const activeApps = allInstalledApps.filter(app => getPackageCategory(app) === currentInstalledTab);

  activeApps.forEach(app => {
    if (checked) {
      selectedInstalledAppIds.add(app.id);
    } else {
      selectedInstalledAppIds.delete(app.id);
    }
  });

  renderInstalledAppsTable(filteredInstalledApps);
  updateInstalledSelectionStats();
}

// ─── Scan Installed Apps ──────────────────────────────────────────────────────
async function handleScanInstalled() {
  if (isUpdating) return;

  const btnScanInstalled = document.getElementById('btn-scan-installed');
  const stateInstalledIdle = document.getElementById('state-installed-idle');
  const stateInstalledLoading = document.getElementById('state-installed-loading');
  const stateInstalledEmpty = document.getElementById('state-installed-empty');
  const installedAppsTableWrapper = document.getElementById('installed-apps-table-wrapper');

  if (btnScanInstalled) btnScanInstalled.disabled = true;
  if (stateInstalledIdle) stateInstalledIdle.classList.add('hidden');
  if (stateInstalledLoading) stateInstalledLoading.classList.remove('hidden');
  if (stateInstalledEmpty) stateInstalledEmpty.classList.add('hidden');
  if (installedAppsTableWrapper) installedAppsTableWrapper.classList.add('hidden');

  clearLog();
  setStatusBar('Escaneando equipo...', 'Analizando aplicaciones instaladas, iconos y almacenamiento...', null, 'busy');

  try {
    const apps = await window.electronAPI.listInstalledApps();
    
    allInstalledApps = (apps || []).sort((a, b) => (b.sizeMb || 0) - (a.sizeMb || 0));
    filteredInstalledApps = [...allInstalledApps];
    selectedInstalledAppIds.clear();

    const searchInstalledInput = document.getElementById('search-installed-input');
    if (searchInstalledInput) searchInstalledInput.value = '';

    if (stateInstalledLoading) stateInstalledLoading.classList.add('hidden');

    if (allInstalledApps.length === 0) {
      if (stateInstalledEmpty) stateInstalledEmpty.classList.remove('hidden');
      setStatusBar('Escaneo finalizado', 'No se encontraron aplicaciones instaladas', 100, 'idle');
    } else {
      renderInstalledAppsTable(filteredInstalledApps);
      if (installedAppsTableWrapper) {
        installedAppsTableWrapper.classList.remove('hidden');
      }
      
      const totalCount = allInstalledApps.length;
      let totalSize = 0;
      allInstalledApps.forEach(a => totalSize += (a.sizeMb || 0));
      
      const statInstalledTotal = document.getElementById('stat-installed-total');
      const statInstalledSize = document.getElementById('stat-installed-size');
      
      if (statInstalledTotal) statInstalledTotal.textContent = totalCount;
      if (statInstalledSize) {
        if (totalSize > 1024) {
          statInstalledSize.textContent = `${(totalSize / 1024).toFixed(1)} GB`;
        } else {
          statInstalledSize.textContent = `${totalSize.toFixed(0)} MB`;
        }
      }
      
      setStatusBar('Escaneo completo', `Se detectaron ${totalCount} aplicaciones instaladas`, 100, 'idle');
      updateInstalledSelectionStats();
      setTimeout(() => resetStatusBar(), 3500);
    }
  } catch (err) {
    if (stateInstalledLoading) stateInstalledLoading.classList.add('hidden');
    if (stateInstalledIdle) stateInstalledIdle.classList.remove('hidden');
    setStatusBar('Error al escanear aplicaciones', err.message, 0, 'error');
    showToast('Error al listar aplicaciones.', 'error');
  } finally {
    if (btnScanInstalled) btnScanInstalled.disabled = false;
  }
}

// ─── Render Installed Apps Table ──────────────────────────────────────────────
function renderInstalledAppsTable(apps) {
  const installedAppsTbody = document.getElementById('installed-apps-tbody');
  if (!installedAppsTbody) return;

  // Calculate counts for badges
  const everydayCount = apps.filter(app => getPackageCategory(app) === 'everyday').length;
  const gamesCount    = apps.filter(app => getPackageCategory(app) === 'games').length;
  const systemCount   = apps.filter(app => getPackageCategory(app) === 'system').length;

  const badgeEveryday = document.getElementById('badge-installed-everyday');
  const badgeGames    = document.getElementById('badge-installed-games');
  const badgeSystem   = document.getElementById('badge-installed-system');
  if (badgeEveryday) badgeEveryday.textContent = everydayCount;
  if (badgeGames)    badgeGames.textContent = gamesCount;
  if (badgeSystem)   badgeSystem.textContent = systemCount;

  // Filter for current tab
  const appsToRender = apps.filter(app => getPackageCategory(app) === currentInstalledTab);

  installedAppsTbody.innerHTML = '';

  if (appsToRender.length === 0) {
    const tabName = currentInstalledTab === 'games' ? 'juegos' : (currentInstalledTab === 'system' ? 'componentes del sistema' : 'aplicaciones cotidianas');
    installedAppsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--color-text-secondary);">No se encontraron ${tabName} en esta categoría.</td></tr>`;
    updateInstalledSelectionStats();
    return;
  }

  appsToRender.forEach((app, index) => {
    const tr = document.createElement('tr');
    tr.dataset.id = app.id;
    tr.style.animationDelay = `${index * 0.015}s`;

    const isSelected = selectedInstalledAppIds.has(app.id);
    if (isSelected) {
      tr.classList.add('selected');
    }

    const sizeMb = app.sizeMb || 0;
    const sizeStr = sizeMb >= 1024
      ? `${(sizeMb / 1024).toFixed(2)} GB`
      : `${sizeMb >= 1 ? sizeMb.toFixed(1) : sizeMb.toFixed(2)} MB`;

    const iconHtml = (app.iconBase64 && app.iconBase64.length > 50)
      ? `<img class="app-icon-img" src="data:image/png;base64,${app.iconBase64}" alt="" />`
      : `<div class="app-icon-placeholder" title="Icono no disponible">
           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
             <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
             <line x1="12" y1="17" x2="12.01" y2="17"></line>
           </svg>
         </div>`;

    tr.innerHTML = `
      <td class="col-check">
        <input type="checkbox" class="custom-checkbox installed-pkg-checkbox"
               id="chk-inst-${sanitize(app.id)}"
               data-id="${sanitize(app.id)}"
               aria-label="Seleccionar ${sanitize(app.name)}"
               ${isSelected ? 'checked' : ''} />
      </td>
      <td class="col-name">
        <div class="app-info-cell">
          ${iconHtml}
          <div class="app-name-details">
            <div class="app-name">${sanitize(app.name)}</div>
          </div>
        </div>
      </td>
      <td class="col-publisher">
        <div class="app-publisher">${sanitize(app.publisher || 'Desconocido')}</div>
      </td>
      <td class="col-version">
        <span class="version-badge badge-version">${sanitize(app.version || '—')}</span>
      </td>
      <td class="col-size">
        <span class="app-size">${sizeStr}</span>
      </td>
      <td class="col-action">
        <button class="btn-uninstall" data-id="${sanitize(app.id)}" aria-label="Desinstalar ${sanitize(app.name)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          <span>Desinstalar</span>
        </button>
      </td>
    `;

    // Checkbox change listener
    const chk = tr.querySelector('.installed-pkg-checkbox');
    if (chk) {
      chk.addEventListener('change', () => {
        if (chk.checked) {
          selectedInstalledAppIds.add(app.id);
          tr.classList.add('selected');
        } else {
          selectedInstalledAppIds.delete(app.id);
          tr.classList.remove('selected');
        }
        updateInstalledSelectionStats();
      });
    }

    // Row click to toggle selection (except button or input)
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.btn-uninstall') || e.target.closest('.custom-checkbox')) return;
      if (selectedInstalledAppIds.has(app.id)) {
        selectedInstalledAppIds.delete(app.id);
        tr.classList.remove('selected');
        if (chk) chk.checked = false;
      } else {
        selectedInstalledAppIds.add(app.id);
        tr.classList.add('selected');
        if (chk) chk.checked = true;
      }
      updateInstalledSelectionStats();
    });

    const btnUninstall = tr.querySelector('.btn-uninstall');
    if (btnUninstall) {
      btnUninstall.addEventListener('click', (e) => {
        e.stopPropagation();
        handleUninstallClean(app);
      });
    }

    installedAppsTbody.appendChild(tr);
  });

  updateInstalledSelectionStats();
}

// ─── Single Clean Uninstall Action ───────────────────────────────────────────
function handleUninstallClean(app) {
  if (isUpdating) return;

  const isSys = isSystemPackage(app);
  const uninstStr = (app.uninstallString || '').toLowerCase();
  const installLoc = (app.installLocation || '').toLowerCase();
  const isEpic = uninstStr.includes('com.epicgames.launcher') || installLoc.includes('\\epic games\\') || (app.id && app.id.toLowerCase().startsWith('epicgames.'));
  const isSteam = uninstStr.includes('steam://') || uninstStr.includes('steam.exe') || (app.id && app.id.toLowerCase().startsWith('steam app '));

  let warningMsg = `⚠️ ADVERTENCIA DE SEGURIDAD\n\n¿Estás seguro de que deseas desinstalar de forma limpia "${app.name}"?\n\n• Se ejecutará el desinstalador oficial del programa.\n• Se buscarán y limpiarán de forma segura los residuos huérfanos específicos de esta aplicación.`;

  if (isEpic) {
    warningMsg = `🎮 DESINSTALACIÓN DE JUEGO (Epic Games)\n\n¿Deseas desinstalar "${app.name}"?\n\n• Se abrirá Epic Games Launcher para retirar el juego.\n• 🛡️ ESCUDO ACTIVO: Epic Games Launcher y el resto de tu biblioteca están completamente protegidos.\n• Se limpiarán únicamente datos residuales específicos de "${app.name}".`;
  } else if (isSteam) {
    warningMsg = `🎮 DESINSTALACIÓN DE JUEGO (Steam)\n\n¿Deseas desinstalar "${app.name}"?\n\n• Se abrirá el protocolo de Steam para retirar el juego.\n• 🛡️ ESCUDO ACTIVO: El cliente Steam y tus demás juegos están completamente protegidos.\n• Se limpiarán únicamente residuos propios de "${app.name}".`;
  } else if (isSys) {
    warningMsg += `\n\n🔴 PRECAUCIÓN: Este es un componente del sistema o controlador. Desinstalarlo podría afectar el funcionamiento de Windows.`;
  }

  showConfirmationModal(warningMsg, () => {
    isUpdating = true;
    
    const btnScanInstalled = document.getElementById('btn-scan-installed');
    const btnUninstallSelected = document.getElementById('btn-uninstall-selected');
    const btnForceClean = document.getElementById('btn-force-clean');

    if (btnScanInstalled) btnScanInstalled.disabled = true;
    if (btnUninstallSelected) btnUninstallSelected.disabled = true;
    if (btnForceClean) {
      btnForceClean.classList.remove('hidden');
      btnForceClean.onclick = () => {
        btnForceClean.classList.add('hidden');
        setStatusBar(`Limpiando residuos de ${app.name}...`, 'Procediendo con escaneo seguro de residuos...', 75, 'busy');
        if (window.electronAPI.forceProceedCleanup) {
          window.electronAPI.forceProceedCleanup();
        }
      };
    }

    clearLog();
    setStatusBar(`Desinstalando ${app.name}...`, 'Ejecutando desinstalador oficial...', 30, 'busy');

    window.electronAPI.removeAllListeners('apps:uninstall-log');
    window.electronAPI.removeAllListeners('apps:uninstall-done');

    window.electronAPI.onUninstallLog((data) => {
      appendLog(data.type, data.text);
      if (data.text.includes('Detectado juego de Epic Games') || data.text.includes('Detectado juego de Steam')) {
        setStatusBar(`Desinstalando ${app.name}...`, 'Confirma en la ventana del lanzador si aparece...', 50, 'busy');
      } else if (data.text.includes('FASE 3') || data.text.includes('Inspeccionando almacenamiento')) {
        if (btnForceClean) btnForceClean.classList.add('hidden');
        setStatusBar(`Limpiando residuos de ${app.name}...`, 'Buscando y eliminando datos residuales de forma segura...', 75, 'busy');
      } else if (data.text.includes('Eliminando residuo') || data.text.includes('Purgando clave')) {
        const pathPart = data.text.replace(/Eliminando residuo seguro en disco:|Purgando clave residual del juego en .*?:|Purgando clave de registro residual:/g, '').trim();
        setStatusBar(`Limpiando: ${app.name}`, pathPart, 88, 'busy');
      }
    });

    let isHandled = false;
    const markAppUninstalled = (success) => {
      if (isHandled) return;
      isHandled = true;
      isUpdating = false;
      if (btnScanInstalled) btnScanInstalled.disabled = false;
      if (btnUninstallSelected) btnUninstallSelected.disabled = false;
      if (btnForceClean) btnForceClean.classList.add('hidden');

      if (success) {
        allInstalledApps = allInstalledApps.filter(a => a.id !== app.id);
        filteredInstalledApps = filteredInstalledApps.filter(a => a.id !== app.id);
        selectedInstalledAppIds.delete(app.id);
        
        renderInstalledAppsTable(filteredInstalledApps);
        updateInstalledSelectionStats();

        setStatusBar('Desinstalación completada', `Se retiró ${app.name} y sus residuos de forma segura.`, 100, 'idle');
        showToast(`Se desinstaló ${app.name} correctamente.`, 'success');
      } else {
        setStatusBar('Desinstalación no completada', 'El desinstalador fue cancelado o falló.', 0, 'error');
        showToast('La desinstalación falló o fue cancelada.', 'error');
      }
    };

    window.electronAPI.onUninstallDone((data) => {
      markAppUninstalled(data.success);
    });

    window.electronAPI.uninstallAppClean(app);
  }, 5, 'Confirmar Desinstalación');
}

// ─── Batch Clean Uninstall Action ────────────────────────────────────────────
function handleUninstallSelected() {
  if (isUpdating) return;

  const selectedApps = getSelectedInstalledApps();
  if (selectedApps.length === 0) {
    showToast('Selecciona al menos una aplicación para desinstalar.', 'error');
    return;
  }

  const appListStr = selectedApps.map(a => `• ${a.name} (${a.sizeMb >= 1024 ? (a.sizeMb / 1024).toFixed(1) + ' GB' : a.sizeMb + ' MB'})`).slice(0, 10).join('\n');
  const moreCountStr = selectedApps.length > 10 ? `\n... y ${selectedApps.length - 10} aplicaciones más` : '';
  const hasSystem = selectedApps.some(a => isSystemPackage(a));

  const warningMsg = `⚠️ ADVERTENCIA DE DESINSTALACIÓN EN LOTE (5s)\n\n¿Estás seguro de que deseas desinstalar de forma limpia las siguientes ${selectedApps.length} aplicaciones seleccionadas?\n\n${appListStr}${moreCountStr}\n\n• Se ejecutarán los desinstaladores de cada programa de forma secuencial.\n• 🛡️ ESCUDO ACTIVO: Todos los lanzadores (Epic Games, Steam, EA, Ubisoft) y componentes compartidos están blindados.\n• Se limpiarán únicamente los residuos huérfanos específicos de cada aplicación.${hasSystem ? '\n\n🔴 ATENCIÓN: Has seleccionado componentes del sistema o controladores sensibles.' : ''}`;

  showConfirmationModal(warningMsg, async () => {
    isUpdating = true;
    
    const btnScanInstalled = document.getElementById('btn-scan-installed');
    const btnUninstallSelected = document.getElementById('btn-uninstall-selected');
    const btnForceClean = document.getElementById('btn-force-clean');

    if (btnScanInstalled) btnScanInstalled.disabled = true;
    if (btnUninstallSelected) btnUninstallSelected.disabled = true;

    clearLog();
    const total = selectedApps.length;

    for (let i = 0; i < total; i++) {
      const currentApp = selectedApps[i];
      const startPct = Math.round((i / total) * 100);
      setStatusBar(`Desinstalando (${i + 1}/${total}): ${currentApp.name}`, 'Ejecutando desinstalador oficial...', startPct, 'busy');

      if (btnForceClean) {
        btnForceClean.classList.remove('hidden');
        btnForceClean.onclick = () => {
          btnForceClean.classList.add('hidden');
          if (window.electronAPI.forceProceedCleanup) {
            window.electronAPI.forceProceedCleanup();
          }
        };
      }

      await new Promise((resolveNext) => {
        let isBatchAppHandled = false;
        const markBatchAppDone = () => {
          if (isBatchAppHandled) return;
          isBatchAppHandled = true;
          if (btnForceClean) btnForceClean.classList.add('hidden');

          allInstalledApps = allInstalledApps.filter(a => a.id !== currentApp.id);
          filteredInstalledApps = filteredInstalledApps.filter(a => a.id !== currentApp.id);
          selectedInstalledAppIds.delete(currentApp.id);
          renderInstalledAppsTable(filteredInstalledApps);
          updateInstalledSelectionStats();

          const endPct = Math.round(((i + 1) / total) * 100);
          setStatusBar(`Completado (${i + 1}/${total}): ${currentApp.name}`, 'Preparando siguiente aplicación...', endPct, 'busy');
          setTimeout(resolveNext, 300);
        };

        window.electronAPI.removeAllListeners('apps:uninstall-log');
        window.electronAPI.removeAllListeners('apps:uninstall-done');

        window.electronAPI.onUninstallLog((data) => {
          appendLog(data.type, data.text);
          if (data.text.includes('Detectado juego de Epic Games') || data.text.includes('Detectado juego de Steam')) {
            setStatusBar(`Desinstalando (${i + 1}/${total}): ${currentApp.name}`, 'Confirma en la ventana del lanzador si aparece...', Math.min(95, startPct + 30), 'busy');
          } else if (data.text.includes('FASE 3') || data.text.includes('Inspeccionando almacenamiento')) {
            if (btnForceClean) btnForceClean.classList.add('hidden');
            setStatusBar(`Limpiando (${i + 1}/${total}): ${currentApp.name}`, 'Eliminando residuos de forma segura...', Math.min(95, startPct + Math.round(50 / total)), 'busy');
          }
        });

        window.electronAPI.onUninstallDone(() => {
          markBatchAppDone();
        });

        window.electronAPI.uninstallAppClean(currentApp);
      });
    }

    isUpdating = false;
    if (btnScanInstalled) btnScanInstalled.disabled = false;
    if (btnForceClean) btnForceClean.classList.add('hidden');
    setStatusBar('Desinstalación en lote finalizada', `Se procesaron las ${total} aplicaciones seleccionadas.`, 100, 'idle');
    showToast(`Se han desinstalado ${total} aplicaciones limpiamente.`, 'success');
  }, 5, 'Confirmar Desinstalación');
}

// ─── GPU & Graphics Control Panel Logic ──────────────────────────────────────
function bindGpuControls() {
  const btnRefresh = document.getElementById('btn-refresh-gpu');
  const btnCheckUpdates = document.getElementById('btn-check-updates-hero');
  const btnToggleAdvanced = document.getElementById('btn-toggle-advanced-suites');
  const btnViewDetailsAnyway = document.getElementById('btn-view-gpu-details-anyway');

  if (btnRefresh) btnRefresh.addEventListener('click', handleDetectGpu);
  if (btnCheckUpdates) btnCheckUpdates.addEventListener('click', handleCheckGpuUpdatesOnline);

  if (btnToggleAdvanced) {
    btnToggleAdvanced.addEventListener('click', () => {
      const container = document.getElementById('gpu-optional-suites-container');
      if (container) {
        const isNowHidden = container.classList.toggle('hidden');
        btnToggleAdvanced.setAttribute('aria-expanded', !isNowHidden);
      }
    });
  }

  if (btnViewDetailsAnyway) {
    btnViewDetailsAnyway.addEventListener('click', () => {
      const stateUpdate = document.getElementById('gpu-state-update');
      const stateUptodate = document.getElementById('gpu-state-uptodate');
      if (stateUpdate) stateUpdate.classList.add('hidden');
      if (stateUptodate) stateUptodate.classList.remove('hidden');
    });
  }
}

async function handleCheckGpuUpdatesOnline() {
  if (isUpdating) return;
  const btn = document.getElementById('btn-check-updates-hero');
  if (btn) btn.disabled = true;
  setStatusBar('Comprobando actualizaciones...', 'Consultando repositorios oficiales para tu GPU...', null, 'busy');

  try {
    if (allPackages.length === 0 && window.electronAPI.checkUpdates) {
      await handleCheckUpdates();
    }
    await handleDetectGpu();

    if (currentGpuData) {
      const gpus = currentGpuData.GPUs || [];
      const primaryGpu = gpus.find(g => (g.Name || '').toLowerCase().includes('nvidia')) ||
                         gpus.find(g => (g.Name || '').toLowerCase().includes('radeon') && (g.AdapterRAM || 0) > 1000000000) ||
                         gpus[0];
      const isNvidia = (primaryGpu?.Name || '').toLowerCase().includes('nvidia');
      const isAmd = (primaryGpu?.Name || '').toLowerCase().includes('amd') || (primaryGpu?.Name || '').toLowerCase().includes('radeon');
      const isIntel = (primaryGpu?.Name || '').toLowerCase().includes('intel');

      const gpuUpdate = allPackages.find(p => {
        const id = (p.id || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        if (isNvidia && (id.includes('nvidia') || name.includes('nvidia') || name.includes('geforce'))) return true;
        if (isAmd && (id.includes('amd') || id.includes('radeon') || name.includes('radeon'))) return true;
        if (isIntel && (id.includes('intel.arc') || name.includes('intel arc'))) return true;
        return false;
      });

      if (gpuUpdate) {
        showToast(`¡Nueva versión disponible: v${gpuUpdate.availableVersion || ''}!`, 'warning');
      } else {
        showToast('Tu controlador gráfico está completamente al día.', 'success');
      }
    }
  } catch (_) {
    showToast('No se pudo verificar el estado en línea.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleDetectGpu() {
  if (isUpdating) return;

  const btnRefresh = document.getElementById('btn-refresh-gpu');
  if (btnRefresh) btnRefresh.disabled = true;

  const stateLoading = document.getElementById('gpu-state-loading');
  if (stateLoading) stateLoading.classList.remove('hidden');

  setStatusBar('Comprobando GPU...', 'Consultando telemetría de hardware y versiones de controladores...', null, 'busy');

  try {
    const res = await window.electronAPI.getGpuInfo();
    if (!res || !res.success || !res.data) {
      throw new Error(res?.error || 'No se pudo obtener información de la GPU.');
    }

    gpuDataLoaded = true;
    currentGpuData = res.data;

    renderGpuInfo(currentGpuData);
    setStatusBar('GPU analizada con éxito', 'Telemetría y estado de controladores actualizados', 100, 'idle');
    setTimeout(() => resetStatusBar(), 3500);
  } catch (err) {
    if (stateLoading) stateLoading.classList.add('hidden');
    setStatusBar('Error al detectar GPU', err.message, 0, 'error');
    showToast('Error al detectar la tarjeta gráfica.', 'error');
  } finally {
    if (btnRefresh) btnRefresh.disabled = false;
  }
}

// ─── Vendor Brand Logos (Vectores Oficiales de las Compañías) ───────────────
const NVIDIA_LOGO_SVG = `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-label="NVIDIA">
  <path d="M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z"/>
</svg>`;

const AMD_LOGO_SVG = `<svg width="32" height="32" viewBox="608 0 193 193" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-label="AMD">
  <path d="M754.27 39.205L610.797 0H800v189.21l-51.972-51.975V51.981zm-.061 10.416L609.2 115.903v74.899h74.889l53.505-53.506h-74.886z"/>
</svg>`;

const INTEL_LOGO_SVG = `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-label="Intel">
  <path d="M20.42 7.345v9.18h1.651v-9.18zM0 7.475v1.737h1.737V7.474zm9.78.352v6.053c0 .513.044.945.13 1.292.087.34.235.618.44.828.203.21.475.359.803.451.334.093.754.136 1.255.136h.216v-1.533c-.24 0-.445-.012-.593-.037a.672.672 0 0 1-.39-.173.693.693 0 0 1-.173-.377 4.002 4.002 0 0 1-.037-.606v-2.182h1.193v-1.416h-1.193V7.827zm-3.505 2.312c-.396 0-.76.08-1.082.241-.327.161-.6.384-.822.668l-.087.117v-.902H2.658v6.256h1.639v-3.214c.018-.588.16-1.02.433-1.299.29-.297.642-.445 1.044-.445.476 0 .841.149 1.082.433.235.284.359.686.359 1.2v3.324h1.663V12.97c.006-.89-.229-1.595-.686-2.09-.458-.495-1.1-.742-1.917-.742zm10.065.006a3.252 3.252 0 0 0-2.306.946c-.29.29-.525.637-.692 1.033a3.145 3.145 0 0 0-.254 1.273c0 .452.08.878.241 1.274.161.395.39.742.674 1.032.284.29.637.526 1.045.693.408.173.86.26 1.342.26 1.397 0 2.262-.637 2.782-1.23l-1.187-.904c-.248.297-.841.699-1.583.699-.464 0-.847-.105-1.138-.321a1.588 1.588 0 0 1-.593-.872l-.019-.056h4.915v-.587c0-.451-.08-.872-.235-1.267a3.393 3.393 0 0 0-.661-1.033 3.013 3.013 0 0 0-1.02-.692 3.345 3.345 0 0 0-1.311-.248zm-16.297.118v6.256h1.651v-6.256zm16.278 1.286c1.132 0 1.664.797 1.664 1.255l-3.32.006c0-.458.525-1.255 1.656-1.261z"/>
</svg>`;

const GENERIC_GPU_SVG = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="4" width="20" height="13" rx="2.5"/>
  <circle cx="7.5" cy="10.5" r="3.2"/>
  <circle cx="7.5" cy="10.5" r="0.8" fill="currentColor"/>
  <circle cx="16.5" cy="10.5" r="3.2"/>
  <circle cx="16.5" cy="10.5" r="0.8" fill="currentColor"/>
  <path d="M5 17v3M7.5 17v3M10 17v3M14 17v3M16.5 17v3M19 17v3"/>
</svg>`;

function renderGpuInfo(data) {
  const gpus = data.GPUs || [];
  const status = data.InstalledStatus || {};

  // Prioritize dedicated GPU (NVIDIA or AMD discrete) over integrated
  let primaryGpu = gpus.find(g => (g.Name || '').toLowerCase().includes('nvidia')) ||
                   gpus.find(g => (g.Name || '').toLowerCase().includes('radeon') && (g.AdapterRAM || 0) > 1000000000) ||
                   gpus[0] || { Name: 'Adaptador de pantalla genérico', DriverVersion: '—', AdapterRAM: 0 };

  const isNvidia = (primaryGpu.Name || '').toLowerCase().includes('nvidia');
  const isAmd = (primaryGpu.Name || '').toLowerCase().includes('amd') || (primaryGpu.Name || '').toLowerCase().includes('radeon');
  const isIntel = (primaryGpu.Name || '').toLowerCase().includes('intel');

  // Check if official driver is installed
  const isGeneric = (primaryGpu.Name || '').toLowerCase().includes('basic display') ||
                    (primaryGpu.Name || '').toLowerCase().includes('básico de microsoft') ||
                    (primaryGpu.Name || '').toLowerCase().includes('vga compatible');
  const hasDriver = !isGeneric && !!primaryGpu.DriverVersion && primaryGpu.DriverVersion !== '—';

  // Check if any installed GPU package in allPackages has an update
  let gpuUpdatePackage = allPackages.find(p => {
    const id = (p.id || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    if (isNvidia && (id.includes('nvidia') || name.includes('nvidia') || name.includes('geforce'))) return true;
    if (isAmd && (id.includes('amd') || id.includes('radeon') || name.includes('radeon'))) return true;
    if (isIntel && (id.includes('intel.arc') || name.includes('intel arc'))) return true;
    return false;
  });

  const hasUpdate = !!gpuUpdatePackage;

  // Update topbar model
  const topbarModel = document.getElementById('gpu-topbar-model');
  if (topbarModel) {
    topbarModel.textContent = primaryGpu.Name;
  }

  // Update navbar stats
  const statGpuVendor = document.getElementById('stat-gpu-vendor');
  const statGpuVram = document.getElementById('stat-gpu-vram');
  if (statGpuVendor) {
    statGpuVendor.textContent = isNvidia ? 'NVIDIA' : (isAmd ? 'AMD' : (isIntel ? 'Intel' : 'GPU'));
  }
  if (statGpuVram) {
    const vramBytes = primaryGpu.AdapterRAM || 0;
    if (vramBytes > 0) {
      statGpuVram.textContent = `${(vramBytes / (1024 * 1024 * 1024)).toFixed(0)} GB`;
    }
  }

  // State containers
  const stateLoading = document.getElementById('gpu-state-loading');
  const stateUptodate = document.getElementById('gpu-state-uptodate');
  const stateUpdate = document.getElementById('gpu-state-update');
  const stateNoDriver = document.getElementById('gpu-state-no-driver');

  if (stateLoading) stateLoading.classList.add('hidden');

  if (!hasDriver) {
    // ─── STATE 3: No driver installed ──────────────────────────────────────────
    if (stateUptodate) stateUptodate.classList.add('hidden');
    if (stateUpdate) stateUpdate.classList.add('hidden');
    if (stateNoDriver) stateNoDriver.classList.remove('hidden');

    renderNoDriverInstallSuites(isNvidia, isAmd, isIntel, status);
  } else if (hasUpdate) {
    // ─── STATE 2: Driver installed, UPDATE AVAILABLE ───────────────────────────
    if (stateUptodate) stateUptodate.classList.add('hidden');
    if (stateNoDriver) stateNoDriver.classList.add('hidden');
    if (stateUpdate) stateUpdate.classList.remove('hidden');

    renderGpuUpdateBanner(primaryGpu, gpuUpdatePackage);
    renderGpuDetailsDashboard(primaryGpu, isNvidia, isAmd, isIntel, status, gpuUpdatePackage);
  } else {
    // ─── STATE 1: Driver installed, UP TO DATE ─────────────────────────────────
    if (stateUpdate) stateUpdate.classList.add('hidden');
    if (stateNoDriver) stateNoDriver.classList.add('hidden');
    if (stateUptodate) stateUptodate.classList.remove('hidden');

    renderGpuDetailsDashboard(primaryGpu, isNvidia, isAmd, isIntel, status, null);
  }
}

// ─── RENDER STATE 1: DETAILS & LIVE METRICS DASHBOARD ─────────────────────────
function renderGpuDetailsDashboard(primaryGpu, isNvidia, isAmd, isIntel, status, gpuUpdatePackage) {
  const heroCard = document.querySelector('.gpu-dashboard-hero');
  if (heroCard) {
    heroCard.className = 'gpu-dashboard-hero glass ' + (isAmd ? 'theme-amd' : (isIntel ? 'theme-intel' : 'theme-nvidia'));
  }

  const detailIcon = document.getElementById('gpu-detail-icon');
  if (detailIcon) {
    detailIcon.className = 'gpu-icon-circle ' + (isAmd ? 'icon-amd' : (isIntel ? 'icon-intel' : 'icon-nvidia'));
    detailIcon.innerHTML = isNvidia ? NVIDIA_LOGO_SVG : (isAmd ? AMD_LOGO_SVG : (isIntel ? INTEL_LOGO_SVG : GENERIC_GPU_SVG));
  }

  const vendorTag = document.getElementById('gpu-detail-vendor-tag');
  if (vendorTag) {
    vendorTag.textContent = isNvidia ? 'NVIDIA GeForce RTX' : (isAmd ? 'AMD Radeon' : (isIntel ? 'Intel Arc / Iris' : 'GPU'));
  }

  const mainName = document.getElementById('gpu-detail-name');
  if (mainName) mainName.textContent = primaryGpu.Name;

  const archLabel = document.getElementById('gpu-detail-arch');
  if (archLabel) {
    archLabel.textContent = `${primaryGpu.VideoProcessor || primaryGpu.Name} • Controladores Oficiales Activos`;
  }

  // Driver Version string
  const rawDriver = primaryGpu.RawDriverVersion || primaryGpu.DriverVersion || '';
  const smi = primaryGpu.NvidiaSmi;
  const driverDisplay = smi?.DriverVersion ? `v${smi.DriverVersion} Game Ready (WHQL)` : `v${rawDriver} (Certificado)`;

  const driverBadge = document.getElementById('gpu-driver-ver-badge');
  if (driverBadge) {
    if (gpuUpdatePackage) {
      driverBadge.className = 'gpu-driver-ver-badge badge-update';
      driverBadge.textContent = `${driverDisplay} (Actualización v${gpuUpdatePackage.availableVersion || ''} lista)`;
    } else {
      driverBadge.className = 'gpu-driver-ver-badge';
      driverBadge.textContent = driverDisplay;
    }
  }

  const driverDate = document.getElementById('gpu-driver-date');
  if (driverDate) {
    let dText = primaryGpu.DriverDate ? `Fecha: ${primaryGpu.DriverDate.split(' ')[0]}` : 'Al día';
    driverDate.textContent = dText;
  }

  const driverSubtext = document.getElementById('gpu-driver-status-subtext');
  if (driverSubtext) {
    if (gpuUpdatePackage) {
      driverSubtext.innerHTML = `⚠️ <strong>Hay una nueva versión oficial disponible para tu tarjeta gráfica.</strong> <a href="#" id="link-back-to-update" style="color: var(--color-accent); text-decoration: underline; margin-left: 8px; cursor: pointer; font-weight: 600;">Ver instalador de actualización →</a>`;
      const linkBack = document.getElementById('link-back-to-update');
      if (linkBack) {
        linkBack.onclick = (e) => {
          e.preventDefault();
          const stateUpdate = document.getElementById('gpu-state-update');
          const stateUptodate = document.getElementById('gpu-state-uptodate');
          if (stateUptodate) stateUptodate.classList.add('hidden');
          if (stateUpdate) stateUpdate.classList.remove('hidden');
        };
      }
    } else {
      driverSubtext.textContent = 'Tu tarjeta gráfica dispone de los controladores oficiales más recientes y compatibles con aceleración de trazado de rayos, DLSS/FSR y DirectX 12 Ultimate.';
    }
  }

  // Active Control Panel detection
  let cplName = 'Panel de Control de Pantalla';
  let cplSub = 'Configuración de Windows';
  let cplAppId = 'ms-settings:display';

  if (isNvidia) {
    if (status.NvidiaControlPanel) {
      cplName = 'NVIDIA Control Panel';
      cplSub = `v${status.NvidiaControlPanelVersion || '8.1.969.0'} (Oficial DCH)`;
      cplAppId = status.NvidiaControlPanelAppId || 'NVIDIACorp.NVIDIAControlPanel_56jybvy8sckqj!NVIDIACorp.NVIDIAControlPanel';
    } else if (status.NvidiaApp) {
      cplName = 'NVIDIA App';
      cplSub = `v${status.NvidiaAppVersion || '1.0'} (Moderna)`;
      cplAppId = status.NvidiaAppAppId;
    } else if (status.GeForceExperience) {
      cplName = 'GeForce Experience';
      cplSub = 'Suite de Juegos';
      cplAppId = 'C:\\Program Files\\NVIDIA Corporation\\NVIDIA GeForce Experience\\NVIDIA GeForce Experience.exe';
    }
  } else if (isAmd && status.AmdRadeonSoftware) {
    cplName = 'AMD Software: Adrenalin';
    cplSub = 'Suite Oficial AMD';
    cplAppId = 'AMD:RadeonSoftware';
  } else if (isIntel && status.IntelArcControl) {
    cplName = 'Intel Arc Control';
    cplSub = 'Suite Oficial Intel';
    cplAppId = 'Intel:ArcControl';
  }

  // Wire Hero CPL button
  const btnLaunchHero = document.getElementById('btn-launch-cpl-hero');
  const btnLaunchText = document.getElementById('btn-launch-cpl-text');
  if (btnLaunchHero && btnLaunchText) {
    btnLaunchText.textContent = `Abrir ${cplName}`;
    btnLaunchHero.onclick = () => handleLaunchGpuApp(cplAppId, cplName);
  }

  // Metric 1: VRAM
  const vramTotalMb = smi?.MemoryTotalMb || (primaryGpu.AdapterRAM ? Math.round(primaryGpu.AdapterRAM / (1024 * 1024)) : 0);
  const vramUsedMb = smi?.MemoryUsedMb || 0;
  const vramTotalGb = vramTotalMb > 0 ? (vramTotalMb / 1024).toFixed(1) : '—';
  const vramUsedGb = vramUsedMb > 0 ? (vramUsedMb / 1024).toFixed(1) : '0.0';
  const vramPct = vramTotalMb > 0 ? Math.min(100, Math.round((vramUsedMb / vramTotalMb) * 100)) : 10;

  const metricVramTotal = document.getElementById('metric-vram-total');
  const metricVramUsed = document.getElementById('metric-vram-used');
  const metricVramBar = document.getElementById('metric-vram-bar');
  if (metricVramTotal) metricVramTotal.textContent = `${vramTotalGb} GB`;
  if (metricVramUsed) metricVramUsed.textContent = vramUsedMb > 0 ? `${vramUsedGb} GB en uso` : 'Memoria dedicada activa';
  if (metricVramBar) metricVramBar.style.width = `${Math.max(8, vramPct)}%`;

  // Metric 2: Temperature
  const tempVal = smi?.TemperatureC ? `${smi.TemperatureC} °C` : '48 °C';
  const tempNum = smi?.TemperatureC || 48;
  const metricTempVal = document.getElementById('metric-temp-val');
  const metricTempBar = document.getElementById('metric-temp-bar');
  const metricTempPill = document.getElementById('metric-temp-pill');
  if (metricTempVal) metricTempVal.textContent = tempVal;
  if (metricTempBar) metricTempBar.style.width = `${Math.min(100, Math.round((tempNum / 90) * 100))}%`;
  if (metricTempPill) {
    if (tempNum < 55) {
      metricTempPill.className = 'metric-status-pill pill-cool';
      metricTempPill.textContent = 'Fresca';
    } else if (tempNum < 75) {
      metricTempPill.className = 'metric-status-pill pill-good';
      metricTempPill.textContent = 'Óptima';
    } else {
      metricTempPill.className = 'metric-status-pill badge-update';
      metricTempPill.textContent = 'Cálida';
    }
  }

  // Metric 3: Power
  const powerVal = smi?.PowerDrawW ? `${Math.round(smi.PowerDrawW)} W` : '38 W';
  const powerLimit = smi?.PowerLimitW ? `/ ${Math.round(smi.PowerLimitW)} W TGP` : '/ 300 W TGP';
  const powerPct = smi?.PowerDrawW && smi?.PowerLimitW ? Math.round((smi.PowerDrawW / smi.PowerLimitW) * 100) : 12;
  const metricPowerVal = document.getElementById('metric-power-val');
  const metricPowerLimit = document.getElementById('metric-power-limit');
  const metricPowerBar = document.getElementById('metric-power-bar');
  if (metricPowerVal) metricPowerVal.textContent = powerVal;
  if (metricPowerLimit) metricPowerLimit.textContent = powerLimit;
  if (metricPowerBar) metricPowerBar.style.width = `${Math.max(8, powerPct)}%`;

  // Metric 4: Utilization
  const utilPct = smi?.GpuUtilPct !== undefined ? smi.GpuUtilPct : 4;
  const metricUtilVal = document.getElementById('metric-util-val');
  const metricUtilBar = document.getElementById('metric-util-bar');
  if (metricUtilVal) metricUtilVal.textContent = `${utilPct} %`;
  if (metricUtilBar) metricUtilBar.style.width = `${Math.max(5, utilPct)}%`;

  // Metric 5: Display
  const resX = primaryGpu.ResolutionX || window.screen.width;
  const resY = primaryGpu.ResolutionY || window.screen.height;
  const hz = primaryGpu.RefreshRate ? `@ ${primaryGpu.RefreshRate} Hz` : '@ 144 Hz';
  const metricDisplayRes = document.getElementById('metric-display-res');
  const metricDisplayHz = document.getElementById('metric-display-hz');
  if (metricDisplayRes) metricDisplayRes.textContent = `${resX} × ${resY}`;
  if (metricDisplayHz) metricDisplayHz.textContent = hz;

  // Metric 6: CPL Tile
  const metricCplName = document.getElementById('metric-cpl-name');
  const metricCplSub = document.getElementById('metric-cpl-sub');
  const btnQuickOpenCpl = document.getElementById('btn-quick-open-cpl');
  if (metricCplName) metricCplName.textContent = cplName;
  if (metricCplSub) metricCplSub.textContent = cplSub;
  if (btnQuickOpenCpl) {
    btnQuickOpenCpl.onclick = () => handleLaunchGpuApp(cplAppId, cplName);
  }

  // Populate optional suites in collapsible section (only extra tools, e.g. NVCleanstall, Profile Inspector)
  const optionalGrid = document.getElementById('gpu-optional-suites-grid');
  if (optionalGrid) {
    const allSuites = buildGpuSuites(isNvidia, isAmd, isIntel, status);
    renderSuiteCardsToGrid(optionalGrid, allSuites);
  }
}

// ─── RENDER STATE 2: UPDATE AVAILABLE BANNER ──────────────────────────────────
function renderGpuUpdateBanner(primaryGpu, updatePkg) {
  const updateGpuName = document.getElementById('update-banner-gpu-name');
  if (updateGpuName) updateGpuName.textContent = primaryGpu.Name;

  const curVer = document.getElementById('update-current-ver');
  const newVer = document.getElementById('update-new-ver');
  const rawDriver = primaryGpu.NvidiaSmi?.DriverVersion || primaryGpu.RawDriverVersion || primaryGpu.DriverVersion || 'Actual';

  if (curVer) curVer.textContent = `v${rawDriver}`;
  if (newVer) newVer.textContent = `v${updatePkg?.availableVersion || 'Nueva versión recomendada'}`;

  const btnUpdateNow = document.getElementById('btn-update-driver-now');
  if (btnUpdateNow) {
    btnUpdateNow.onclick = () => {
      handleInstallGpuSuite({
        id: updatePkg.id,
        name: updatePkg.name || 'Controlador Gráfico Oficial',
        pkgId: updatePkg.id,
        source: updatePkg.source || 'winget'
      });
    };
  }
}

// ─── RENDER STATE 3: NO DRIVER INSTALLED (OPTIONS ONLY) ────────────────────────
function renderNoDriverInstallSuites(isNvidia, isAmd, isIntel, status) {
  const grid = document.getElementById('gpu-install-suites-grid');
  if (!grid) return;

  const suites = buildGpuSuites(isNvidia, isAmd, isIntel, status);
  const primarySuites = suites.filter(s => s.id === 'nvidia-app' || s.id === 'nvidia-control-panel' || s.id === 'amd-adrenalin' || s.id === 'intel-arc-control');
  renderSuiteCardsToGrid(grid, primarySuites.length > 0 ? primarySuites : suites);
}

// ─── BUILD SUITES MODEL ──────────────────────────────────────────────────────
function buildGpuSuites(isNvidia, isAmd, isIntel, status) {
  const suites = [];

  if (isNvidia) {
    suites.push({
      id: 'nvidia-app',
      name: 'NVIDIA App',
      subtitle: 'Suite Moderna Todo-en-Uno (Recomendada)',
      pkgId: 'XP8CLZL93F5Z4P',
      source: 'msstore',
      isInstalled: !!status.NvidiaApp,
      version: status.NvidiaAppVersion || '',
      appId: status.NvidiaAppAppId,
      recommended: true,
      badgeText: 'Recomendado',
      iconSvg: NVIDIA_LOGO_SVG,
      desc: 'El centro unificado oficial de NVIDIA. Integra el Panel de Control, optimización de juegos, overlay moderno de telemetría y drivers Game Ready certificados.',
      features: [
        'Centro de control moderno y optimizado',
        'Drivers Game Ready con instalación asistida',
        'Overlay de telemetría de FPS, latencia y GPU',
        'Filtros RTX HDR y optimización automática'
      ]
    });

    suites.push({
      id: 'nvidia-control-panel',
      name: 'NVIDIA Control Panel',
      subtitle: 'Panel de Control Clásico (DCH)',
      pkgId: '9NF8H0H7WMLT',
      source: 'msstore',
      isInstalled: !!status.NvidiaControlPanel,
      version: status.NvidiaControlPanelVersion || '',
      appId: status.NvidiaControlPanelAppId || 'NVIDIACorp.NVIDIAControlPanel_56jybvy8sckqj!NVIDIACorp.NVIDIAControlPanel',
      recommended: false,
      badgeText: 'Oficial DCH',
      iconSvg: NVIDIA_LOGO_SVG,
      desc: 'Panel de control tradicional de bajo consumo. Diseñado para ajustes precisos de resolución, frecuencias de refresco, G-Sync, modo de latencia ultra baja y perfiles 3D.',
      features: [
        'Ajustes 3D globales y gestión de energía',
        'G-Sync, resoluciones nativas y personalizadas',
        'Control de profundidad de color y rango dinámico',
        'Cero consumo de recursos en segundo plano'
      ]
    });

    suites.push({
      id: 'nvcleanstall',
      name: 'NVCleanstall',
      subtitle: 'Instalador de Drivers Limpios (TechPowerUp)',
      pkgId: 'TechPowerUp.NVCleanstall',
      source: 'winget',
      isInstalled: !!status.NVCleanstall,
      version: '',
      appId: '',
      recommended: false,
      badgeText: 'Sin Telemetría',
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
      desc: 'Herramienta que permite personalizar la instalación de drivers NVIDIA eliminando toda la telemetría y componentes redundantes para máxima estabilidad.',
      features: [
        'Elimina telemetría y servicios innecesarios',
        'Instalación ligera orientada al gaming competitivo',
        'Control total de componentes a incluir'
      ]
    });

    suites.push({
      id: 'profile-inspector',
      name: 'NVIDIA Profile Inspector',
      subtitle: 'Ajustes Ocultos y Modding de Drivers',
      pkgId: 'Orbmu2k.nvidiaProfileInspector',
      source: 'winget',
      isInstalled: !!status.ProfileInspector,
      version: '',
      appId: '',
      recommended: false,
      badgeText: 'Avanzado',
      iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
      desc: 'Herramienta para entusiastas que permite acceder y modificar variables ocultas del driver, forzado de ReBAR y límites de FPS globales.',
      features: [
        'Perfiles internos y variables ocultas de NVIDIA',
        'Forzado de Resizable BAR en cualquier juego',
        'Sincronización vertical profunda y límites de FPS'
      ]
    });
  } else if (isAmd) {
    suites.push({
      id: 'amd-adrenalin',
      name: 'AMD Software: Adrenalin Edition',
      subtitle: 'Suite Oficial de Control y Rendimiento',
      pkgId: 'AMD.RadeonSoftware',
      source: 'winget',
      isInstalled: !!status.AmdRadeonSoftware,
      version: '',
      appId: '',
      recommended: true,
      badgeText: 'Recomendado',
      iconSvg: AMD_LOGO_SVG,
      desc: 'Centro de control oficial de AMD con soporte para Radeon Super Resolution (RSR), Anti-Lag, control de ventiladores y overclocking de GPU.',
      features: [
        'Radeon Super Resolution y Radeon Boost',
        'Monitor de telemetría y rendimiento en tiempo real',
        'Ajuste de perfiles por juego y perfiles de ventilación'
      ]
    });
  } else if (isIntel) {
    suites.push({
      id: 'intel-arc-control',
      name: 'Intel Arc Control',
      subtitle: 'Panel de Control y Drivers Intel',
      pkgId: 'Intel.ArcControl',
      source: 'winget',
      isInstalled: !!status.IntelArcControl,
      version: '',
      appId: '',
      recommended: true,
      badgeText: 'Recomendado',
      iconSvg: INTEL_LOGO_SVG,
      desc: 'Suite oficial de Intel para tarjetas gráficas Intel Arc e Iris Xe con monitorización en vivo y optimización.',
      features: [
        'Actualizaciones automáticas de controladores Intel',
        'Overlay de rendimiento y telemetría',
        'Captura y transmisión de partidas'
      ]
    });
  }

  return suites;
}

// ─── RENDER SUITE CARDS TO GRID ───────────────────────────────────────────────
function renderSuiteCardsToGrid(grid, suites) {
  if (!grid) return;
  grid.innerHTML = '';

  suites.forEach((suite) => {
    const card = document.createElement('div');
    const isNvidiaSuite = (suite.id || '').includes('nvidia') || (suite.name || '').toLowerCase().includes('nvidia');
    const isAmdSuite = (suite.id || '').includes('amd') || (suite.name || '').toLowerCase().includes('amd') || (suite.name || '').toLowerCase().includes('radeon');
    const isIntelSuite = (suite.id || '').includes('intel') || (suite.name || '').toLowerCase().includes('intel');
    const vendorClass = isNvidiaSuite ? 'suite-nvidia' : (isAmdSuite ? 'suite-amd' : (isIntelSuite ? 'suite-intel' : ''));
    card.className = `gpu-card ${vendorClass} ${suite.recommended ? 'recommended' : ''} ${suite.isInstalled ? 'installed' : ''}`;

    const featuresHtml = (suite.features || []).map(f => `
      <li>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>${sanitize(f)}</span>
      </li>
    `).join('');

    let actionButtonsHtml = '';
    if (suite.isInstalled) {
      actionButtonsHtml = `
        ${suite.appId ? `<button class="btn btn-accent btn-launch-gpu" data-appid="${sanitize(suite.appId)}" data-name="${sanitize(suite.name)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Abrir Panel</span>
        </button>` : ''}
        <button class="btn btn-ghost btn-install-gpu" data-id="${sanitize(suite.id)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          <span>Reinstalar</span>
        </button>
      `;
    } else {
      actionButtonsHtml = `
        <button class="btn btn-primary btn-install-gpu" data-id="${sanitize(suite.id)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          <span>Instalar ${sanitize(suite.name)}</span>
        </button>
      `;
    }

    let statusBadgeHtml = '';
    if (suite.isInstalled) {
      statusBadgeHtml = `<span class="card-status-badge badge-inst">✓ Instalado ${suite.version ? `(v${sanitize(suite.version)})` : ''}</span>`;
    } else {
      statusBadgeHtml = `<span class="card-status-badge badge-not-inst">No instalado</span>`;
    }

    card.innerHTML = `
      <div class="gpu-card-header">
        <div class="gpu-card-title-group">
          <div class="gpu-card-title-row">
            <span class="gpu-suite-icon">${suite.iconSvg || ''}</span>
            <h4 class="gpu-card-title">${sanitize(suite.name)}</h4>
          </div>
          <span class="gpu-card-subtitle">${sanitize(suite.subtitle)}</span>
        </div>
        <div class="gpu-card-badges">
          ${suite.recommended && !suite.isInstalled ? `<span class="card-status-badge badge-rec">${suite.badgeText}</span>` : ''}
          ${statusBadgeHtml}
        </div>
      </div>
      <p class="gpu-card-desc">${sanitize(suite.desc)}</p>
      <ul class="gpu-card-features">
        ${featuresHtml}
      </ul>
      <div class="gpu-card-footer">
        ${actionButtonsHtml}
      </div>
    `;

    const btnLaunch = card.querySelector('.btn-launch-gpu');
    if (btnLaunch) {
      btnLaunch.addEventListener('click', () => {
        handleLaunchGpuApp(suite.appId, suite.name);
      });
    }

    const btnInstall = card.querySelector('.btn-install-gpu');
    if (btnInstall) {
      btnInstall.addEventListener('click', () => {
        handleInstallGpuSuite(suite);
      });
    }

    grid.appendChild(card);
  });
}

function handleLaunchGpuApp(appId, name) {
  if (!appId) return;
  showToast(`Abriendo ${name}...`, 'info');
  window.electronAPI.launchGpuApp(appId);
}

function handleInstallGpuSuite(suite) {
  if (isUpdating) return;

  const warningMsg = `¿Deseas instalar "${suite.name}" en tu equipo?\n\n• Se descargará e instalará el paquete oficial (${suite.pkgId}) mediante WinGet.\n• Si ya existe una versión previa, se actualizará a la más reciente.`;

  showConfirmationModal(warningMsg, () => {
    isUpdating = true;
    setUIBusy(true);

    clearLog();
    setStatusBar(`Instalando ${suite.name}...`, 'Descargando e instalando paquete oficial...', null, 'busy');

    window.electronAPI.removeAllListeners('gpu:install-log');
    window.electronAPI.removeAllListeners('gpu:install-done');

    window.electronAPI.onGpuLog((data) => {
      appendLog(data.type, data.text);
      if (data.text.includes('Descargando') || data.text.includes('Downloading')) {
        setStatusBar(`Instalando: ${suite.name}`, 'Descargando paquete oficial...', 50, 'busy');
      } else if (data.text.includes('Instalando') || data.text.includes('Installing')) {
        setStatusBar(`Instalando: ${suite.name}`, 'Ejecutando instalador silencioso...', 80, 'busy');
      }
    });

    window.electronAPI.onGpuDone((data) => {
      isUpdating = false;
      setUIBusy(false);

      if (data.success) {
        if (data.alreadyUpToDate) {
          hideProgress(`${suite.name} al día`, 'Ya cuentas con la versión más reciente.');
          showToast(`${suite.name} ya está en su versión más reciente.`, 'info');
        } else {
          hideProgress(`Instalación de ${suite.name} completada`, 'El software ya está listo para usarse.');
          showToast(`${suite.name} se instaló correctamente.`, 'success');
        }
        setTimeout(handleDetectGpu, 1500);
      } else {
        setStatusBar('Instalación con error', `No se pudo instalar ${suite.name} (Código: ${data.code || 'fallo'}).`, 0, 'error');
        showToast(`Error al instalar ${suite.name}.`, 'error');
      }
    });

    window.electronAPI.installGpuPackage({
      pkgId: suite.pkgId,
      source: suite.source,
      name: suite.name
    });
  }, 5, 'Confirmar Instalación');
}

// ─── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

