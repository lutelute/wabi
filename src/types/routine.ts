export interface RoutineItem {
  id: string
  time: string | null       // "06:00" or null
  title: string             // "ストレッチ"
  duration: number | null   // 分単位 (10 = 10min)
  weight: number            // 重み (1〜5, デフォルト1)
  rawLine: string           // 元のテキスト行
}

export interface RoutinePhase {
  id: string
  title: string             // "朝の立ち上がり"
  items: RoutineItem[]
}

export interface Routine {
  id: string
  name: string              // "朝のルーティン"
  text: string              // Markdownテキスト (source of truth)
  phases: RoutinePhase[]    // textから派生
  createdAt: string
  updatedAt: string
}

export interface TimerState {
  itemId: string
  remaining: number         // 残り秒数
  total: number             // 合計秒数
  running: boolean
}

export interface ExecutionState {
  routineId: string
  date: string              // "2026-02-10"
  checkedItems: Record<string, boolean>
  itemWeights: Record<string, number>  // タイトル → 重み (スライダー調整分)
  timerState: TimerState | null
  declined: string          // 今日やらないと決めたこと（自由記述）
}

export interface AppSettings {
  timerNotification: boolean
  defaultWeight: number
  particleCount: 'low' | 'normal' | 'high'
}

export const DEFAULT_SETTINGS: AppSettings = {
  timerNotification: true,
  defaultWeight: 1,
  particleCount: 'normal',
}

export interface ElectronAPI {
  getRoutines: () => Promise<Routine[]>
  saveRoutines: (routines: Routine[]) => Promise<boolean>
  getExecution: (key: string) => Promise<ExecutionState | null>
  saveExecution: (key: string, state: ExecutionState) => Promise<boolean>
  clearExecutions: () => Promise<boolean>
  getSettings: () => Promise<Partial<AppSettings>>
  saveSettings: (settings: AppSettings) => Promise<boolean>
  showNotification: (title: string, body: string) => Promise<boolean>
  onOpenSettings: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
