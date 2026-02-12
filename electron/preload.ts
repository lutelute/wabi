import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Routines
  getRoutines: () => ipcRenderer.invoke('store:getRoutines'),
  saveRoutines: (routines: unknown) => ipcRenderer.invoke('store:saveRoutines', routines),

  // Execution state
  getExecution: (key: string) => ipcRenderer.invoke('store:getExecution', key),
  saveExecution: (key: string, state: unknown) => ipcRenderer.invoke('store:saveExecution', key, state),

  // Notifications
  showNotification: (title: string, body: string) => ipcRenderer.invoke('notification:show', title, body),
})
