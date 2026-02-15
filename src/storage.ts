import type { Routine, ExecutionState, DailyActionState, AppSettings, BackupData, Reminder, ReminderInstance } from './types/routine'
import type { DayState } from './contexts/DayContext'
import { DEFAULT_SETTINGS } from './types/routine'
import { debouncedPush, pullAll, setupOnlineListener, isAuthenticated } from './sync/syncEngine'
import { isCloudEnabled } from './sync/supabaseClient'

const isElectron = typeof window !== 'undefined' && !!window.electronAPI
const isWeb = !isElectron

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

// ── localStorage バックアップローテーション ──
function lsRotate(key: string) {
  try {
    const current = localStorage.getItem(key)
    if (current) {
      localStorage.setItem(`${key}:prev`, current)
    }
  } catch {
    // quota超過等は無視
  }
}

function lsRestoreIfEmpty<T>(key: string, fallback: T): T {
  const current = lsGet<T>(key, fallback)
  // 空データチェック（配列の場合は長さ0、オブジェクトの場合はキー0）
  const isEmpty = current === fallback ||
    (Array.isArray(current) && current.length === 0) ||
    (current && typeof current === 'object' && !Array.isArray(current) && Object.keys(current as object).length === 0)

  if (!isEmpty) return current

  const prev = lsGet<T>(`${key}:prev`, fallback)
  if (prev !== fallback) {
    lsSet(key, prev)
    console.log(`[wabi] restored ${key} from backup`)
    return prev
  }
  return fallback
}

// ── Cloud Sync ──
let syncInitialized = false

async function initSyncOnce() {
  if (syncInitialized || !isCloudEnabled()) return
  syncInitialized = true

  setupOnlineListener()

  if (await isAuthenticated()) {
    try {
      const remote = await pullAll()
      if (remote) {
        if (isElectron) {
          // Electron: リモートデータをelectron-storeにマージ
          if (remote['routines']) {
            const local = await window.electronAPI.getRoutines()
            if (!local || local.length === 0) {
              await window.electronAPI.saveRoutines(remote['routines'] as Routine[])
            }
          }
          for (const [key, value] of Object.entries(remote)) {
            if (key.startsWith('exec:') || key.startsWith('day:')) {
              const local = await window.electronAPI.getExecution(key)
              if (!local) {
                await window.electronAPI.saveExecution(key, value as ExecutionState)
              }
            }
          }
        } else {
          // Web: リモートデータをlocalStorageにマージ
          if (remote['routines']) {
            const localRoutines = lsGet<Routine[]>('wabi:routines', [])
            if (localRoutines.length === 0) {
              lsSet('wabi:routines', remote['routines'])
            }
          }
          if (remote['settings']) {
            const localSettings = lsGet<Partial<AppSettings>>('wabi:settings', {})
            if (Object.keys(localSettings).length === 0) {
              lsSet('wabi:settings', remote['settings'])
            }
          }
          for (const [key, value] of Object.entries(remote)) {
            if (key.startsWith('exec:') || key.startsWith('day:')) {
              const lsKey = `wabi:${key}`
              if (!localStorage.getItem(lsKey)) {
                lsSet(lsKey, value)
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('[sync] initial pull failed:', e)
    }
  }
}

function syncPush(dataKey: string, data: unknown) {
  if (!isCloudEnabled()) return
  debouncedPush(dataKey, data)
}

export const storage = {
  async getRoutines(): Promise<Routine[]> {
    if (isElectron) {
      await initSyncOnce()
      return window.electronAPI.getRoutines()
    }
    await initSyncOnce()
    return lsRestoreIfEmpty<Routine[]>('wabi:routines', [])
  },

  async saveRoutines(routines: Routine[]): Promise<boolean> {
    if (isElectron) {
      const ok = await window.electronAPI.saveRoutines(routines)
      syncPush('routines', routines)
      return ok
    }
    lsRotate('wabi:routines')
    lsSet('wabi:routines', routines)
    syncPush('routines', routines)
    return true
  },

  async getExecution(key: string): Promise<ExecutionState | null> {
    if (isElectron) return window.electronAPI.getExecution(key)
    return lsGet<ExecutionState | null>(`wabi:exec:${key}`, null)
  },

  async saveExecution(key: string, state: ExecutionState): Promise<boolean> {
    if (isElectron) {
      const ok = await window.electronAPI.saveExecution(key, state)
      syncPush(`exec:${key}`, state)
      return ok
    }
    lsRotate(`wabi:exec:${key}`)
    lsSet(`wabi:exec:${key}`, state)
    syncPush(`exec:${key}`, state)
    return true
  },

  async getActionState(date: string): Promise<DailyActionState | null> {
    const key = `actions:${date}`
    if (isElectron) return window.electronAPI.getExecution(key) as Promise<any>
    return lsGet<DailyActionState | null>(`wabi:exec:${key}`, null)
  },

  async saveActionState(date: string, state: DailyActionState): Promise<boolean> {
    const key = `actions:${date}`
    if (isElectron) {
      const ok = await window.electronAPI.saveExecution(key, state as any)
      syncPush(`exec:${key}`, state)
      return ok
    }
    lsRotate(`wabi:exec:${key}`)
    lsSet(`wabi:exec:${key}`, state)
    syncPush(`exec:${key}`, state)
    return true
  },

  async getDayState(key: string): Promise<DayState | null> {
    if (isElectron) return window.electronAPI.getExecution(key) as Promise<any>
    return lsGet<DayState | null>(`wabi:exec:${key}`, null)
  },

  async saveDayState(key: string, state: DayState): Promise<boolean> {
    if (isElectron) {
      const ok = await window.electronAPI.saveExecution(key, state as any)
      syncPush(key, state)
      return ok
    }
    lsRotate(`wabi:exec:${key}`)
    lsSet(`wabi:exec:${key}`, state)
    syncPush(key, state)
    return true
  },

  async getSettings(): Promise<AppSettings> {
    if (isElectron) {
      const saved = await window.electronAPI.getSettings()
      return { ...DEFAULT_SETTINGS, ...saved }
    }
    return { ...DEFAULT_SETTINGS, ...lsGet<Partial<AppSettings>>('wabi:settings', {}) }
  },

  async saveSettings(settings: AppSettings): Promise<boolean> {
    if (isElectron) {
      const ok = await window.electronAPI.saveSettings(settings)
      syncPush('settings', settings)
      return ok
    }
    lsRotate('wabi:settings')
    lsSet('wabi:settings', settings)
    syncPush('settings', settings)
    return true
  },

  async clearExecutions(): Promise<boolean> {
    if (isElectron) return window.electronAPI.clearExecutions()
    const keys = Object.keys(localStorage).filter(k => k.startsWith('wabi:exec:'))
    keys.forEach(k => localStorage.removeItem(k))
    return true
  },

  onOpenSettings(callback: () => void): () => void {
    if (isElectron) return window.electronAPI.onOpenSettings(callback)
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        callback()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  },

  async showNotification(title: string, body: string): Promise<boolean> {
    if (isElectron) return window.electronAPI.showNotification(title, body)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
    return true
  },

  getReminders(): Reminder[] {
    return lsGet<Reminder[]>('wabi:reminders', [])
  },

  saveReminders(reminders: Reminder[]): void {
    lsSet('wabi:reminders', reminders)
  },

  getReminderState(date: string): ReminderInstance[] {
    return lsGet<ReminderInstance[]>(`wabi:reminder-state:${date}`, [])
  },

  saveReminderState(date: string, state: ReminderInstance[]): void {
    lsSet(`wabi:reminder-state:${date}`, state)
  },

  // ── Web版エクスポート/インポート ──
  exportBackupWeb(): BackupData {
    const routines = lsGet<Routine[]>('wabi:routines', [])
    const executions: Record<string, ExecutionState> = {}
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('wabi:exec:') && !key.endsWith(':prev')) {
        const k = key.replace('wabi:exec:', '')
        executions[k] = JSON.parse(localStorage.getItem(key)!)
      }
    }
    const settings = lsGet<Partial<AppSettings>>('wabi:settings', {})
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      routines,
      executions,
      settings,
    }
  },

  importBackupWeb(data: BackupData): boolean {
    if (!data.version || !data.routines) return false
    // ローテーション
    lsRotate('wabi:routines')
    lsSet('wabi:routines', data.routines)
    if (data.executions) {
      for (const [key, state] of Object.entries(data.executions)) {
        lsRotate(`wabi:exec:${key}`)
        lsSet(`wabi:exec:${key}`, state)
      }
    }
    if (data.settings) {
      lsRotate('wabi:settings')
      lsSet('wabi:settings', data.settings)
    }
    return true
  },
}
