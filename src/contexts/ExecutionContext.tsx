import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useRoutines } from './RoutineContext'
import { storage } from '../storage'
import type { ExecutionState, TimerState, Mood, MentalCompletion } from '../types/routine'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function executionKey(routineId: string, date: string): string {
  return `${routineId}:${date}`
}

/** NaN/Infinity/負数を安全に除去するヘルパー */
function safeWeight(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

export interface EnergyProgress {
  energy: number
  capacity: number
  stamina: number
  ratio: number
  done: number
  total: number
}

interface ExecutionContextValue {
  checkedItems: Record<string, boolean>
  itemWeights: Record<string, number>
  timerState: TimerState | null
  declined: string
  itemMoods: Record<string, Mood>
  mentalCompletions: MentalCompletion[]
  dismissedConcepts: string[]
  toggleCheck: (itemId: string) => void
  updateWeight: (itemTitle: string, weight: number) => void
  getWeight: (itemTitle: string, defaultWeight: number) => number
  startTimer: (itemId: string, durationMin: number) => void
  stopTimer: () => void
  updateDeclined: (text: string) => void
  setItemMood: (itemId: string, mood: Mood) => void
  addMentalCompletion: (itemId: string, reflection: string) => void
  dismissConcept: (conceptId: string) => void
  progress: EnergyProgress
}

const ExecutionContext = createContext<ExecutionContextValue | null>(null)

const EMPTY: never[] = []

export function ExecutionProvider({ children }: { children: ReactNode }) {
  const { selected } = useRoutines()
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [itemWeights, setItemWeights] = useState<Record<string, number>>({})
  const [timerState, setTimerState] = useState<TimerState | null>(null)
  const [declined, setDeclined] = useState('')
  const [itemMoods, setItemMoods] = useState<Record<string, Mood>>({})
  const [mentalCompletions, setMentalCompletions] = useState<MentalCompletion[]>([])
  const [dismissedConcepts, setDismissedConcepts] = useState<string[]>([])
  const [date, setDate] = useState(todayString)
  const [loaded, setLoaded] = useState(false)

  // 日付チェック
  useEffect(() => {
    const interval = setInterval(() => {
      const now = todayString()
      if (now !== date) {
        setDate(now)
        setCheckedItems({}); setItemWeights({}); setTimerState(null)
        setDeclined(''); setItemMoods({})
        setMentalCompletions([]); setDismissedConcepts([])
        setLoaded(false)
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [date])

  // ロード
  useEffect(() => {
    if (!selected) return
    setLoaded(false)
    const key = executionKey(selected.id, date)
    storage.getExecution(key).then((saved) => {
      if (saved) {
        setCheckedItems(saved.checkedItems)
        setItemWeights(saved.itemWeights ?? {})
        setTimerState(saved.timerState)
        setDeclined(saved.declined ?? '')
        setItemMoods(saved.itemMoods ?? {})
        setMentalCompletions(saved.mentalCompletions ?? [])
        setDismissedConcepts(saved.dismissedConcepts ?? [])
      } else {
        setCheckedItems({}); setItemWeights({}); setTimerState(null)
        setDeclined(''); setItemMoods({})
        setMentalCompletions([]); setDismissedConcepts([])
      }
      setLoaded(true)
    })
  }, [selected?.id, date])

  // 保存
  useEffect(() => {
    if (!selected || !loaded) return
    const key = executionKey(selected.id, date)
    const state: ExecutionState = {
      routineId: selected.id, date, checkedItems, itemWeights,
      timerState, declined, itemMoods,
      mentalCompletions, dismissedConcepts,
      // 後方互換: 空のフィールドも含める
      moodLog: [], moodNote: '', staminaLog: [], mentalLog: [], checkIns: [],
    }
    storage.saveExecution(key, state)
  }, [checkedItems, itemWeights, timerState, declined, itemMoods, mentalCompletions, dismissedConcepts, selected?.id, date, loaded])

  // タイマー
  useEffect(() => {
    if (!timerState?.running) return
    const interval = setInterval(() => {
      setTimerState(prev => {
        if (!prev || !prev.running) return prev
        const next = prev.remaining - 1
        if (next <= 0) { storage.showNotification('wabi', 'タイマー完了'); return null }
        return { ...prev, remaining: next }
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timerState?.running])

  const toggleCheck = useCallback((itemId: string) => {
    setCheckedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }))
  }, [])
  const updateWeight = useCallback((t: string, w: number) => {
    setItemWeights(prev => ({ ...prev, [t]: safeWeight(w, 1) }))
  }, [])
  const getWeight = useCallback((t: string, d: number) => safeWeight(itemWeights[t], d), [itemWeights])
  const startTimer = useCallback((id: string, min: number) => {
    const total = min * 60
    setTimerState({ itemId: id, remaining: total, total, running: true })
  }, [])
  const stopTimer = useCallback(() => setTimerState(null), [])
  const updateDeclined = useCallback((text: string) => setDeclined(text), [])
  const setItemMood = useCallback((id: string, mood: Mood) => {
    setItemMoods(prev => ({ ...prev, [id]: mood }))
  }, [])
  const addMentalCompletion = useCallback((itemId: string, reflection: string) => {
    setMentalCompletions(prev => [...prev, { itemId, reflection, completedAt: new Date().toISOString() }])
  }, [])
  const dismissConcept = useCallback((conceptId: string) => {
    setDismissedConcepts(prev => [...prev, conceptId])
  }, [])

  const progress: EnergyProgress = useMemo(() => {
    const allItems = selected?.phases.flatMap(p => p.items) ?? EMPTY
    const totalWeight = allItems.reduce((s, i) => s + safeWeight(itemWeights[i.title], i.weight), 0)
    const earnedWeight = allItems.filter(i => checkedItems[i.id]).reduce((s, i) => s + safeWeight(itemWeights[i.title], i.weight), 0)
    const capacity = Number.isFinite(totalWeight) ? totalWeight : 0
    const energy = Number.isFinite(earnedWeight) ? earnedWeight : 0
    return {
      energy, capacity, stamina: capacity - energy,
      ratio: capacity > 0 ? energy / capacity : 0,
      done: Object.values(checkedItems).filter(Boolean).length,
      total: allItems.length,
    }
  }, [selected?.phases, checkedItems, itemWeights])

  return (
    <ExecutionContext.Provider value={{
      checkedItems, itemWeights, timerState, declined, itemMoods,
      mentalCompletions, dismissedConcepts,
      toggleCheck, updateWeight, getWeight, startTimer, stopTimer,
      updateDeclined, setItemMood, addMentalCompletion, dismissConcept, progress,
    }}>
      {children}
    </ExecutionContext.Provider>
  )
}

export function useExecution() {
  const ctx = useContext(ExecutionContext)
  if (!ctx) throw new Error('useExecution must be used within ExecutionProvider')
  return ctx
}
