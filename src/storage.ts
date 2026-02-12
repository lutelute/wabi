import type { Routine, ExecutionState } from './types/routine'

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function lsSet(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export const storage = {
  async getRoutines(): Promise<Routine[]> {
    if (isElectron) return window.electronAPI.getRoutines()
    return lsGet<Routine[]>('wabi:routines', [])
  },

  async saveRoutines(routines: Routine[]): Promise<boolean> {
    if (isElectron) return window.electronAPI.saveRoutines(routines)
    lsSet('wabi:routines', routines)
    return true
  },

  async getExecution(key: string): Promise<ExecutionState | null> {
    if (isElectron) return window.electronAPI.getExecution(key)
    return lsGet<ExecutionState | null>(`wabi:exec:${key}`, null)
  },

  async saveExecution(key: string, state: ExecutionState): Promise<boolean> {
    if (isElectron) return window.electronAPI.saveExecution(key, state)
    lsSet(`wabi:exec:${key}`, state)
    return true
  },

  async showNotification(title: string, body: string): Promise<boolean> {
    if (isElectron) return window.electronAPI.showNotification(title, body)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
    return true
  },
}
