import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { storage } from '../storage'
import type { Mood, MoodEntry, CheckIn } from '../types/routine'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

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
  moodLog: MoodEntry[]
  dailyNotes: string
  customConcepts: string[]
  checkIns: CheckIn[]
  /** @deprecated 旧フィールド。ロード時に dailyNotes へマイグレーション */
  moodNote?: string
}

interface DayContextValue {
  date: string
  staminaLog: LevelEntry[]
  mentalLog: LevelEntry[]
  moodLog: MoodEntry[]
  dailyNotes: string
  customConcepts: string[]
  checkIns: CheckIn[]
  addStamina: (level: number) => void
  addMental: (level: number) => void
  addMood: (mood: Mood) => void
  setDailyNotes: (note: string) => void
  addCustomConcept: (text: string) => void
  addCheckIn: (stamina: number, mental: number, tags: string[], comment: string) => void
}

const DayContext = createContext<DayContextValue | null>(null)

export function DayProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState(todayString)
  const [staminaLog, setStaminaLog] = useState<LevelEntry[]>([])
  const [mentalLog, setMentalLog] = useState<LevelEntry[]>([])
  const [moodLog, setMoodLog] = useState<MoodEntry[]>([])
  const [dailyNotes, setDailyNotes] = useState('')
  const [customConcepts, setCustomConcepts] = useState<string[]>([])
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [loaded, setLoaded] = useState(false)

  // 日付チェック
  useEffect(() => {
    const interval = setInterval(() => {
      const now = todayString()
      if (now !== date) {
        setDate(now)
        setStaminaLog([]); setMentalLog([])
        setMoodLog([]); setDailyNotes('')
        setCustomConcepts([])
        setCheckIns([])
        setLoaded(false)
      }
    }, 30_000)
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
        setMoodLog(saved.moodLog ?? [])
        // マイグレーション: 旧 moodNote → dailyNotes
        setDailyNotes(saved.dailyNotes ?? (saved as any).moodNote ?? '')
        setCustomConcepts(saved.customConcepts ?? [])
        setCheckIns(saved.checkIns ?? [])
      } else {
        setStaminaLog([]); setMentalLog([])
        setMoodLog([]); setDailyNotes('')
        setCustomConcepts([])
        setCheckIns([])
      }
      setLoaded(true)
    })
  }, [date])

  // 保存
  useEffect(() => {
    if (!loaded) return
    const key = `day:${date}`
    const state: DayState = {
      date, staminaLog, mentalLog, moodLog, dailyNotes, customConcepts, checkIns,
    }
    storage.saveDayState(key, state)
  }, [staminaLog, mentalLog, moodLog, dailyNotes, customConcepts, checkIns, date, loaded])

  const addStamina = useCallback((level: number) => {
    setStaminaLog(prev => [...prev, { level, time: nowTime() }])
  }, [])
  const addMental = useCallback((level: number) => {
    setMentalLog(prev => [...prev, { level, time: nowTime() }])
  }, [])
  const addMood = useCallback((mood: Mood) => {
    setMoodLog(prev => [...prev, { mood, time: nowTime() }])
  }, [])
  const addCheckIn = useCallback((stamina: number, mental: number, tags: string[], comment: string) => {
    const time = nowTime()
    setCheckIns(prev => [...prev, { time, stamina, mental, tags, comment }])
    setStaminaLog(prev => [...prev, { level: stamina, time }])
    setMentalLog(prev => [...prev, { level: mental, time }])
  }, [])
  const addCustomConcept = useCallback((text: string) => {
    const trimmed = text.trim()
    if (trimmed) setCustomConcepts(prev => [...prev, trimmed])
  }, [])

  return (
    <DayContext.Provider value={{
      date, staminaLog, mentalLog, moodLog, dailyNotes, customConcepts, checkIns,
      addStamina, addMental, addMood, setDailyNotes, addCustomConcept, addCheckIn,
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
