import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { storage } from '../storage'
import { wabiToday, wabiRecentDates } from '../utils/wabiDate'
import type { Mood, MoodEntry, CheckIn } from '../types/routine'

function nowTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

interface LevelEntry {
  level: number
  time: string
}

export interface DayState {
  date: string
  staminaLog: LevelEntry[]
  mentalLog: LevelEntry[]
  waveLog: LevelEntry[]
  bodyTempLog: LevelEntry[]
  moodLog: MoodEntry[]
  dailyNotes: string
  customConcepts: string[]
  checkIns: CheckIn[]
  restTaken: boolean
  closedAt?: string
  /** @deprecated 旧フィールド。ロード時に dailyNotes へマイグレーション */
  moodNote?: string
}

interface DayContextValue {
  date: string
  staminaLog: LevelEntry[]
  mentalLog: LevelEntry[]
  waveLog: LevelEntry[]
  bodyTempLog: LevelEntry[]
  moodLog: MoodEntry[]
  dailyNotes: string
  customConcepts: string[]
  checkIns: CheckIn[]
  restTaken: boolean
  closedAt: string | undefined
  addStamina: (level: number) => void
  addMental: (level: number) => void
  addMood: (mood: Mood) => void
  setDailyNotes: (note: string) => void
  addCustomConcept: (text: string) => void
  addCheckIn: (stamina: number, mental: number, wave: number, bodyTemp: number, tags: string[], comment: string, source?: 'manual' | 'dialog') => void
  updateCheckIn: (index: number, patch: Partial<CheckIn>) => void
  deleteCheckIn: (index: number) => void
  markRestTaken: () => void
  closeDay: () => void
  reopenDay: () => void
}

const DayContext = createContext<DayContextValue | null>(null)

export function DayProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState(wabiToday)
  const [staminaLog, setStaminaLog] = useState<LevelEntry[]>([])
  const [mentalLog, setMentalLog] = useState<LevelEntry[]>([])
  const [waveLog, setWaveLog] = useState<LevelEntry[]>([])
  const [bodyTempLog, setBodyTempLog] = useState<LevelEntry[]>([])
  const [moodLog, setMoodLog] = useState<MoodEntry[]>([])
  const [dailyNotes, setDailyNotes] = useState('')
  const [customConcepts, setCustomConcepts] = useState<string[]>([])
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [restTaken, setRestTaken] = useState(false)
  const [closedAt, setClosedAt] = useState<string | undefined>(undefined)
  const [loaded, setLoaded] = useState(false)

  // 日付切り替え時の前日保存用に最新stateを保持
  // （setState経由のクローズはバッチングで date が先に変わり、新しい日のキーに保存されてしまう）
  const stateRef = useRef<DayState | null>(null)
  useEffect(() => {
    stateRef.current = loaded ? {
      date, staminaLog, mentalLog, waveLog, bodyTempLog, moodLog,
      dailyNotes, customConcepts, checkIns, restTaken,
      ...(closedAt ? { closedAt } : {}),
    } : null
  })

  // 起動時: 過去の未クローズ日を静かに閉じる
  // （アプリを閉じたまま朝5時を跨ぐと tick が走らないため、ここで拾う）
  useEffect(() => {
    (async () => {
      const today = wabiToday()
      for (const d of wabiRecentDates(8)) {
        if (d >= today) continue
        const key = `day:${d}`
        const saved = await storage.getDayState(key)
        if (!saved || saved.closedAt) continue
        const hasActivity = (saved.checkIns?.length ?? 0) > 0 || (saved.moodLog?.length ?? 0) > 0 ||
          (saved.staminaLog?.length ?? 0) > 0 || (saved.mentalLog?.length ?? 0) > 0
        if (hasActivity) {
          await storage.saveDayState(key, {
            ...saved,
            closedAt: new Date(d + 'T23:59:59').toISOString(),
          })
        }
      }
    })()
  }, [])

  // 日付チェック: wabiの一日は朝5時で切り替わる
  useEffect(() => {
    function tick() {
      const today = wabiToday()
      if (today === date) return

      // 朝5時を越えた: 前日分に活動があり未クローズなら、直接storageへクローズ保存
      const prev = stateRef.current
      if (prev && !prev.closedAt) {
        const hasActivity = prev.checkIns.length > 0 || prev.moodLog.length > 0 ||
          prev.staminaLog.length > 0 || prev.mentalLog.length > 0
        if (hasActivity) {
          storage.saveDayState(`day:${prev.date}`, {
            ...prev,
            closedAt: new Date(prev.date + 'T23:59:59').toISOString(),
          })
        }
      }

      setDate(today)
      setStaminaLog([]); setMentalLog([])
      setWaveLog([]); setBodyTempLog([])
      setMoodLog([]); setDailyNotes('')
      setCustomConcepts([])
      setCheckIns([]); setRestTaken(false); setClosedAt(undefined)
      setLoaded(false)
    }

    const interval = setInterval(tick, 30_000)
    return () => clearInterval(interval)
  }, [date])

  // ロード
  useEffect(() => {
    setLoaded(false)
    const key = `day:${date}`
    storage.getDayState(key).then((saved) => {
      if (saved) {
        setStaminaLog(saved.staminaLog ?? [])
        setMentalLog(saved.mentalLog ?? [])
        setWaveLog(saved.waveLog ?? [])
        setBodyTempLog(saved.bodyTempLog ?? [])
        setMoodLog(saved.moodLog ?? [])
        setDailyNotes(saved.dailyNotes ?? (saved as any).moodNote ?? '')
        setCustomConcepts(saved.customConcepts ?? [])
        setCheckIns(saved.checkIns ?? [])
        setRestTaken(saved.restTaken ?? false)
        setClosedAt(saved.closedAt)
      } else {
        setStaminaLog([]); setMentalLog([])
        setWaveLog([]); setBodyTempLog([])
        setMoodLog([]); setDailyNotes('')
        setCustomConcepts([])
        setCheckIns([]); setRestTaken(false); setClosedAt(undefined)
      }
      setLoaded(true)
    })
  }, [date])

  // 保存
  useEffect(() => {
    if (!loaded) return
    const key = `day:${date}`
    const state: DayState = {
      date, staminaLog, mentalLog, waveLog, bodyTempLog, moodLog, dailyNotes, customConcepts, checkIns, restTaken,
      ...(closedAt ? { closedAt } : {}),
    }
    storage.saveDayState(key, state)
  }, [staminaLog, mentalLog, waveLog, bodyTempLog, moodLog, dailyNotes, customConcepts, checkIns, restTaken, closedAt, date, loaded])

  const addStamina = useCallback((level: number) => {
    setStaminaLog(prev => [...prev, { level, time: nowTime() }])
  }, [])
  const addMental = useCallback((level: number) => {
    setMentalLog(prev => [...prev, { level, time: nowTime() }])
  }, [])
  const addMood = useCallback((mood: Mood) => {
    setMoodLog(prev => [...prev, { mood, time: nowTime() }])
  }, [])
  const addCheckIn = useCallback((stamina: number, mental: number, wave: number, bodyTemp: number, tags: string[], comment: string, source: 'manual' | 'dialog' = 'manual') => {
    const time = nowTime()
    setCheckIns(prev => [...prev, { time, stamina, mental, wave, bodyTemp, tags, comment, source }])
    setStaminaLog(prev => [...prev, { level: stamina, time }])
    setMentalLog(prev => [...prev, { level: mental, time }])
    setWaveLog(prev => [...prev, { level: wave, time }])
    setBodyTempLog(prev => [...prev, { level: bodyTemp, time }])
  }, [])
  // チェックインの編集（4軸ログも同じtimeのエントリを同期更新）
  // 各setterは独立して呼ぶ（updater内でsetterを呼ぶとStrictModeの二重実行で副作用が重複するため）
  const updateCheckIn = useCallback((index: number, patch: Partial<CheckIn>) => {
    const target = checkIns[index]
    if (!target) return
    const t = target.time
    const updTo = (level: number) => (log: LevelEntry[]) => {
      const i = log.findIndex(e => e.time === t)
      return i >= 0 ? log.map((e, j) => j === i ? { ...e, level } : e) : log
    }
    setCheckIns(prev => prev.map((ci, i) => i === index ? { ...ci, ...patch } : ci))
    if (patch.stamina != null) setStaminaLog(updTo(patch.stamina))
    if (patch.mental != null) setMentalLog(updTo(patch.mental))
    if (patch.wave != null) setWaveLog(updTo(patch.wave))
    if (patch.bodyTemp != null) setBodyTempLog(updTo(patch.bodyTemp))
  }, [checkIns])

  // チェックインの削除（4軸ログも同じtimeのエントリを1件削除）
  const deleteCheckIn = useCallback((index: number) => {
    const target = checkIns[index]
    if (!target) return
    const t = target.time
    const rmByTime = (log: LevelEntry[]) => {
      const i = log.findIndex(e => e.time === t)
      return i >= 0 ? log.filter((_, j) => j !== i) : log
    }
    setCheckIns(prev => prev.filter((_, i) => i !== index))
    setStaminaLog(rmByTime)
    setMentalLog(rmByTime)
    setWaveLog(rmByTime)
    setBodyTempLog(rmByTime)
  }, [checkIns])

  const markRestTaken = useCallback(() => setRestTaken(true), [])
  const closeDay = useCallback(() => setClosedAt(new Date().toISOString()), [])
  const reopenDay = useCallback(() => setClosedAt(undefined), [])
  const addCustomConcept = useCallback((text: string) => {
    const trimmed = text.trim()
    if (trimmed) setCustomConcepts(prev => [...prev, trimmed])
  }, [])

  return (
    <DayContext.Provider value={{
      date, staminaLog, mentalLog, waveLog, bodyTempLog, moodLog, dailyNotes, customConcepts, checkIns, restTaken, closedAt,
      addStamina, addMental, addMood, setDailyNotes, addCustomConcept, addCheckIn, updateCheckIn, deleteCheckIn, markRestTaken, closeDay, reopenDay,
    }}>
      {children}
    </DayContext.Provider>
  )
}

export function useDay() {
  const ctx = useContext(DayContext)
  if (!ctx) throw new Error('useDay must be used within DayProvider')
  return ctx
}
