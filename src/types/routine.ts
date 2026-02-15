export interface RoutineItem {
  id: string
  time: string | null       // "06:00" or null
  title: string             // "ストレッチ"
  duration: number | null   // 分単位 (10 = 10min)
  weight: number            // 重み (1〜5, デフォルト1)
  isMental: boolean         // @mental タグ付き
  isRest: boolean           // @rest タグ付き（体力回復）
  rawLine: string           // 元のテキスト行
}

export interface RoutinePhase {
  id: string
  title: string             // "朝の立ち上がり"
  items: RoutineItem[]
}

export const ROUTINE_COLORS = [
  { id: 'none', value: '' },
  { id: 'warm', value: '#e8c8a0' },
  { id: 'peach', value: '#e8b4a0' },
  { id: 'rose', value: '#dca0b0' },
  { id: 'lavender', value: '#c0a8d4' },
  { id: 'sky', value: '#a0c4dc' },
  { id: 'mint', value: '#a0d4c0' },
  { id: 'sage', value: '#b4ccac' },
  { id: 'sand', value: '#d4c8a8' },
  { id: 'stone', value: '#b8b0a8' },
] as const

export interface Routine {
  id: string
  name: string              // "朝のルーティン"
  text: string              // Markdownテキスト (source of truth)
  phases: RoutinePhase[]    // textから派生
  color?: string            // ルーティンカラー (hex)
  memo?: string             // ルーティンメモ
  createdAt: string
  updatedAt: string
}

export interface TimerState {
  itemId: string
  remaining: number         // 残り秒数
  total: number             // 合計秒数
  running: boolean
}

export type Mood = 'heavy' | 'cloudy' | 'flat' | 'calm' | 'light'

export const MOOD_OPTIONS: { value: Mood; label: string }[] = [
  { value: 'heavy', label: '重い' },
  { value: 'cloudy', label: 'もやもや' },
  { value: 'flat', label: 'ふつう' },
  { value: 'calm', label: '穏やか' },
  { value: 'light', label: '軽い' },
]

export interface MoodEntry {
  mood: Mood
  time: string              // "14:32"
}

export interface CheckIn {
  time: string              // "14:32"
  stamina: number           // 0-100 (体力: 満↔尽)
  mental: number            // 0-100 (心: 沈む↔浮く)
  wave: number              // 0-100 (波: 凪↔荒)
  bodyTemp: number          // 0-100 (体温: 冷↔熱)
  tags: string[]            // 気持ちタグ
  comment: string           // 自由コメント
}

export interface MentalCompletion {
  itemId: string
  reflection: string
  completedAt: string       // ISO string
}

export type TimeSlot = 'morning' | 'forenoon' | 'noon' | 'afternoon' | 'evening' | 'night'

export interface ConceptSuggestion {
  id: string
  slot: TimeSlot
  message: string
  dismissed: boolean
}

export interface Reminder {
  id: string
  subject: string
  body?: string
  time: string              // "HH:MM"
  sourceType: 'routine' | 'manual'
  sourceItemId?: string
  recurring: boolean
  enabled: boolean
}

export interface ReminderInstance {
  reminderId: string
  date: string
  fired: boolean
  dismissed: boolean
}

export interface CalendarDayData {
  date: string
  checkInCount: number
  dominantMood: Mood | null
  completionRatio: number
  hasData: boolean
}

export interface DailyNoteMeta {
  date: string
  stamina: number[]
  mental: number[]
  mood_flow: Mood[]
  dominant_mood: Mood | null
  completion: string          // "6/8"
  completion_ratio: number
  check_in_count: number
  tags: string[]
}

// ── アクションリスト方式 ──
export interface DailyAction {
  id: string                    // nanoid
  sourceRoutineId: string       // 元のルーティンID
  sourceRoutineName: string     // "朝のルーティン"
  sourcePhaseTitle: string      // "仕事の調整"
  sourceRoutineColor?: string   // ルーティンカラー (hex)
  sourceItemId: string          // 元のRoutineItem.id
  title: string                 // "ストレッチ"
  duration: number | null
  weight: number
  isMental: boolean
  isRest: boolean               // @rest: 体力回復アイテム
  customTags: string[]          // ユーザー追加タグ
  addedAt: string               // ISO string
}

export interface DailyActionState {
  date: string                  // "2026-02-15"
  actions: DailyAction[]        // 今日のアクションリスト
  checkedItems: Record<string, boolean>  // actionId → checked
  itemWeights: Record<string, number>    // title → weight
  timerState: TimerState | null
  itemMoods: Record<string, Mood>
  itemComments: Record<string, string>  // actionId → コメント
  mentalCompletions: MentalCompletion[]
  declined: string              // 今日やらないと決めたこと
  dismissedConcepts: string[]   // dismiss済み概念ルーティンID
}

export interface ExecutionState {
  routineId: string
  date: string              // "2026-02-10"
  checkedItems: Record<string, boolean>
  itemWeights: Record<string, number>  // タイトル → 重み (スライダー調整分)
  timerState: TimerState | null
  declined: string          // 今日やらないと決めたこと（自由記述）
  moodLog: MoodEntry[]      // 気分の記録（タイムライン）
  moodNote: string          // 心のメモ（自由記述）
  itemMoods: Record<string, Mood>  // itemId → 気持ち
  staminaLog: { level: number; time: string }[]  // 体力の自己申告ログ
  mentalLog: { level: number; time: string }[]   // 心の自己申告ログ
  checkIns: CheckIn[]       // チェックイン記録
  mentalCompletions: MentalCompletion[]  // @mental完了記録
  dismissedConcepts: string[]            // dismiss済み概念ルーティンID
}

export interface AppSettings {
  timerNotification: boolean
  defaultWeight: number
  particleCount: 'low' | 'normal' | 'high'
  softCapRatio: number        // よくやった閾値 (0.5-1.0, default 0.9)
  weightMax: number            // 重みスライダー最大値 (5 or 10, default 5)
  karesansuiRings: number      // 砂紋リング数 (3-15, default 10)
  conceptRoutinesEnabled: boolean
  reminderSoundEnabled: boolean
  obsidianVaultPath: string    // Obsidian Vaultのデイリーノートフォルダパス（空=無効）
}

export const DEFAULT_SETTINGS: AppSettings = {
  timerNotification: true,
  defaultWeight: 1,
  particleCount: 'normal',
  softCapRatio: 0.9,
  weightMax: 5,
  karesansuiRings: 10,
  conceptRoutinesEnabled: true,
  reminderSoundEnabled: true,
  obsidianVaultPath: '',
}

export interface BackupData {
  version: number
  exportedAt: string
  routines: Routine[]
  executions: Record<string, ExecutionState>
  settings: Partial<AppSettings>
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
  // Backup
  exportBackup: () => Promise<{ success: boolean; path?: string }>
  importBackup: () => Promise<{ success: boolean; error?: string }>
  // Obsidian
  selectObsidianVault: () => Promise<string | null>
  exportToObsidian: () => Promise<{ success: boolean; error?: string }>
  // Auto-updater
  checkForUpdates: () => void
  openReleasePage: () => void
  onUpdateStatus: (callback: (status: string) => void) => () => void
  onNewVersion?: (callback: (version: string) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
