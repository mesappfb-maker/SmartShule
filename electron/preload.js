// SmartShule — Electron Preload Script
// ============================================================
// Pont sécurisé entre le renderer (Next.js) et le main process (Node).
// Expose uniquement les API nécessaires via contextBridge.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('smartshule', {
  version: process.env.npm_package_version,
  platform: process.platform,
  // API pour déclencher la vérification de mise à jour depuis l'UI
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  // API pour récupérer des infos système (offline-first)
  getDeviceInfo: () => ({
    platform: process.platform,
    arch: process.arch,
    version: process.versions.electron,
    nodeVersion: process.versions.node,
  }),
})
