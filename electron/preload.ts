import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Routines
  getRoutines: () => ipcRenderer.invoke('store:getRoutines'),
  saveRoutines: (routines: unknown) => ipcRenderer.invoke('store:saveRoutines', routines),

  // Execution state
  getExecution: (key: string) => ipcRenderer.invoke('store:getExecution', key),
  saveExecution: (key: string, state: unknown) => ipcRenderer.invoke('store:saveExecution', key, state),
  clearExecutions: () => ipcRenderer.invoke('store:clearExecutions'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),

  // Notifications
  showNotification: (title: string, body: string) => ipcRenderer.invoke('notification:show', title, body),

  // Events from main process
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', callback)
    return () => ipcRenderer.removeListener('open-settings', callback)
  },

  // Backup
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),

  // Obsidian
  selectObsidianVault: () => ipcRenderer.invoke('obsidian:selectVault'),
  exportToObsidian: () => ipcRenderer.invoke('obsidian:export'),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.send('updater:check'),
  installUpdate: () => ipcRenderer.send('updater:install'),
  onUpdateStatus: (callback: (status: string) => void) => {
    const handler = (_event: unknown, status: string) => callback(status)
    ipcRenderer.on('updater:status', handler)
    return () => ipcRenderer.removeListener('updater:status', handler)
  },
  onNewVersion: (callback: (version: string) => void) => {
    const handler = (_event: unknown, version: string) => callback(version)
    ipcRenderer.on('updater:new-version', handler)
    return () => ipcRenderer.removeListener('updater:new-version', handler)
  },
  onDownloadProgress: (callback: (percent: number) => void) => {
    const handler = (_event: unknown, percent: number) => callback(percent)
    ipcRenderer.on('updater:download-progress', handler)
    return () => ipcRenderer.removeListener('updater:download-progress', handler)
  },
  onUpdateReady: (callback: (version: string) => void) => {
    const handler = (_event: unknown, version: string) => callback(version)
    ipcRenderer.on('updater:ready', handler)
    return () => ipcRenderer.removeListener('updater:ready', handler)
  },
})
