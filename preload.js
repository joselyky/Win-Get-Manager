/**
 * preload.js — Context Bridge
 * Exposes only the necessary APIs to the renderer process securely.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow:    () => ipcRenderer.send('window:close'),

  // WinGet operations
  listUpgrades:             ()    => ipcRenderer.invoke('winget:list-upgrades'),
  upgradePackages:          (ids) => ipcRenderer.send('winget:upgrade-packages', ids),
  upgradeAll:               ()    => ipcRenderer.send('winget:upgrade-all'),
  enableWinGetInTerminal:   ()    => ipcRenderer.invoke('winget:enable-in-terminal'),

  // WinGet live output listeners
  onLog:         (cb) => ipcRenderer.on('winget:log',          (_e, data) => cb(data)),
  onDone:        (cb) => ipcRenderer.on('winget:done',         (_e, data) => cb(data)),
  onQueueInit:   (cb) => ipcRenderer.on('winget:queue-init',   (_e, data) => cb(data)),
  onQueueUpdate: (cb) => ipcRenderer.on('winget:queue-update', (_e, data) => cb(data)),

  // Remove listeners (cleanup)
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // System info
  getSystemInfo: () => ipcRenderer.invoke('system:info'),

  // Clean Uninstaller
  listInstalledApps: () => ipcRenderer.invoke('apps:list-installed'),
  uninstallAppClean: (app) => ipcRenderer.send('apps:uninstall-clean', app),
  forceProceedCleanup: () => ipcRenderer.send('apps:force-proceed-cleanup'),
  onUninstallLog: (cb) => ipcRenderer.on('apps:uninstall-log', (_e, data) => cb(data)),
  onUninstallDone: (cb) => ipcRenderer.on('apps:uninstall-done', (_e, data) => cb(data)),

  // GPU & Control Panel APIs
  getGpuInfo: () => ipcRenderer.invoke('gpu:detect-info'),
  installGpuPackage: (data) => ipcRenderer.send('gpu:install-package', data),
  launchGpuApp: (appIdOrPath) => ipcRenderer.invoke('gpu:launch-app', appIdOrPath),
  onGpuLog: (cb) => ipcRenderer.on('gpu:install-log', (_e, data) => cb(data)),
  onGpuDone: (cb) => ipcRenderer.on('gpu:install-done', (_e, data) => cb(data)),

  // Error recovery APIs
  killProcess: (nameOrId) => ipcRenderer.invoke('apps:kill-process', nameOrId),
  upgradePackageElevated: (pkg) => ipcRenderer.send('winget:upgrade-package-elevated', pkg),
});
