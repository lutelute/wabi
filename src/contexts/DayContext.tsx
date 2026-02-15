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
  addCheckIn: (stamina: number, mental: number, wave: number, bodyTemp: number, tags: string[], comment: string) => void
  markRestTaken: () => void
  closeDay: () => void
}

const DayContext = createContext<DayContextValue | null>(null)

export function DayProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState(todayString)
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

  // 日付チェック
  useEffect(() => {
    const interval = setInterval(() => {
      const now = todayString()
      if (now !== date) {
        setDate(now)
        setStaminaLog([]); setMentalLog([])
        setWaveLog([]); setBodyTempLog([])
        setMoodLog([]); setDailyNotes('')
        setCustomConcepts([])
        setCheckIns([]); setRestTaken(false); setClosedAt(undefined)
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
  const addCheckIn = useCallback((stamina: number, mental: number, wave: number, bodyTemp: number, tags: string[], comment: string) => {
    const time = nowTime()
    setCheckIns(prev => [...prev, { time, stamina, mental, wave, bodyTemp, tags, comment }])
    setStaminaLog(prev => [...prev, { level: stamina, time }])
    setMentalLog(prev => [...prev, { level: mental, time }])
    setWaveLog(prev => [...prev, { level: wave, time }])
    setBodyTempLog(prev => [...prev, { level: bodyTemp, time }])
  }, [])
  const markRestTaken = useCallback(() => setRestTaken(true), [])
  const closeDay = useCallback(() => setClosedAt(new Date().toISOString()), [])
  const addCustomConcept = useCallback((text: string) => {
    const trimmed = text.trim()
    if (trimmed) setCustomConcepts(prev => [...prev, trimmed])
  }, [])

  return (
    <DayContext.Provider value={{
      date, staminaLog, mentalLog, waveLog, bodyTempLog, moodLog, dailyNotes, customConcepts, checkIns, restTaken, closedAt,
      addStamina, addMental, addMood, setDailyNotes, addCustomConcept, addCheckIn, markRestTaken, closeDay,
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
