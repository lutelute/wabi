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

  // Auto-updater
  checkForUpdates: () => ipcRenderer.send('updater:check'),
  installUpdate: () => ipcRenderer.send('updater:install'),
  onUpdateStatus: (callback: (status: string) => void) => {
    const handler = (_event: unknown, status: string) => callback(status)
    ipcRenderer.on('updater:status', handler)
    return () => ipcRenderer.removeListener('updater:status', handler)
  },
})
