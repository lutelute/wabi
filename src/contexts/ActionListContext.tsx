import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { nanoid } from 'nanoid'
import { storage } from '../storage'
import type { DailyAction, DailyActionState, TimerState, Mood, MentalCompletion, RoutineItem, Routine, RoutinePhase } from '../types/routine'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
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

interface ActionListContextValue {
  actions: DailyAction[]
  addAction: (item: RoutineItem, routine: Routine, phase: RoutinePhase) => void
  removeAction: (actionId: string) => void
  isItemAdded: (sourceItemId: string) => boolean
  checkedItems: Record<string, boolean>
  itemWeights: Record<string, number>
  timerState: TimerState | null
  itemMoods: Record<string, Mood>
  mentalCompletions: MentalCompletion[]
  declined: string
  dismissedConcepts: string[]
  toggleCheck: (actionId: string) => void
  updateWeight: (title: string, weight: number) => void
  getWeight: (title: string, defaultWeight: number) => number
  startTimer: (actionId: string, durationMin: number) => void
  stopTimer: () => void
  setItemMood: (actionId: string, mood: Mood) => void
  addMentalCompletion: (actionId: string, reflection: string) => void
  updateDeclined: (text: string) => void
  dismissConcept: (conceptId: string) => void
  progress: EnergyProgress
}

const ActionListContext = createContext<ActionListContextValue | null>(null)

export function ActionListProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<DailyAction[]>([])
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [itemWeights, setItemWeights] = useState<Record<string, number>>({})
  const [timerState, setTimerState] = useState<TimerState | null>(null)
  const [itemMoods, setItemMoods] = useState<Record<string, Mood>>({})
  const [mentalCompletions, setMentalCompletions] = useState<MentalCompletion[]>([])
  const [declined, setDeclined] = useState('')
  const [dismissedConcepts, setDismissedConcepts] = useState<string[]>([])
  const [date, setDate] = useState(todayString)
  const [loaded, setLoaded] = useState(false)

  // 日付チェック
  useEffect(() => {
    const interval = setInterval(() => {
      const now = todayString()
      if (now !== date) {
        setDate(now)
        setActions([]); setCheckedItems({}); setItemWeights({})
        setTimerState(null); setItemMoods({}); setMentalCompletions([])
        setDeclined(''); setDismissedConcepts([])
        setLoaded(false)
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [date])

  // ロード
  useEffect(() => {
    setLoaded(false)
    storage.getActionState(date).then((saved) => {
      if (saved) {
        setActions(saved.actions ?? [])
        setCheckedItems(saved.checkedItems ?? {})
        setItemWeights(saved.itemWeights ?? {})
        setTimerState(saved.timerState ?? null)
        setItemMoods(saved.itemMoods ?? {})
        setMentalCompletions(saved.mentalCompletions ?? [])
        setDeclined(saved.declined ?? '')
        setDismissedConcepts(saved.dismissedConcepts ?? [])
      } else {
        setActions([]); setCheckedItems({}); setItemWeights({})
        setTimerState(null); setItemMoods({}); setMentalCompletions([])
        setDeclined(''); setDismissedConcepts([])
      }
      setLoaded(true)
    })
  }, [date])

  // 保存（デバウンス）
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loaded) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const state: DailyActionState = {
        date, actions, checkedItems, itemWeights,
        timerState, itemMoods, mentalCompletions,
        declined, dismissedConcepts,
      }
      storage.saveActionState(date, state)
    }, 300)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [actions, checkedItems, itemWeights, timerState, itemMoods, mentalCompletions, declined, dismissedConcepts, date, loaded])

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

  // sourceItemId → actionId のルックアップ用
  const sourceItemIds = useMemo(() => {
    const set = new Set<string>()
    for (const a of actions) set.add(a.sourceItemId)
    return set
  }, [actions])

  const addAction = useCallback((item: RoutineItem, routine: Routine, phase: RoutinePhase) => {
    setActions(prev => {
      if (prev.some(a => a.sourceItemId === item.id)) return prev
      const action: DailyAction = {
        id: nanoid(),
        sourceRoutineId: routine.id,
        sourceRoutineName: routine.name,
        sourcePhaseTitle: phase.title,
        sourceItemId: item.id,
        title: item.title,
        duration: item.duration,
        weight: item.weight,
        isMental: item.isMental,
        customTags: [],
        addedAt: new Date().toISOString(),
      }
      return [...prev, action]
    })
  }, [])

  const removeAction = useCallback((actionId: string) => {
    setActions(prev => prev.filter(a => a.id !== actionId))
    setCheckedItems(prev => { const next = { ...prev }; delete next[actionId]; return next })
    setItemMoods(prev => { const next = { ...prev }; delete next[actionId]; return next })
  }, [])

  const isItemAdded = useCallback((sourceItemId: string) => {
    return sourceItemIds.has(sourceItemId)
  }, [sourceItemIds])

  const toggleCheck = useCallback((actionId: string) => {
    setCheckedItems(prev => ({ ...prev, [actionId]: !prev[actionId] }))
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
  const setItemMood = useCallback((id: string, mood: Mood) => {
    setItemMoods(prev => ({ ...prev, [id]: mood }))
  }, [])
  const addMentalCompletionCb = useCallback((actionId: string, reflection: string) => {
    setMentalCompletions(prev => [...prev, { itemId: actionId, reflection, completedAt: new Date().toISOString() }])
  }, [])
  const updateDeclined = useCallback((text: string) => setDeclined(text), [])
  const dismissConcept = useCallback((conceptId: string) => {
    setDismissedConcepts(prev => [...prev, conceptId])
  }, [])

  const progress: EnergyProgress = useMemo(() => {
    const totalWeight = actions.reduce((s, a) => s + safeWeight(itemWeights[a.title], a.weight), 0)
    const earnedWeight = actions.filter(a => checkedItems[a.id]).reduce((s, a) => s + safeWeight(itemWeights[a.title], a.weight), 0)
    const capacity = Number.isFinite(totalWeight) ? totalWeight : 0
    const energy = Number.isFinite(earnedWeight) ? earnedWeight : 0
    return {
      energy, capacity, stamina: capacity - energy,
      ratio: capacity > 0 ? energy / capacity : 0,
      done: Object.values(checkedItems).filter(Boolean).length,
      total: actions.length,
    }
  }, [actions, checkedItems, itemWeights])

  return (
    <ActionListContext.Provider value={{
      actions, addAction, removeAction, isItemAdded,
      checkedItems, itemWeights, timerState, itemMoods, mentalCompletions,
      declined, dismissedConcepts,
      toggleCheck, updateWeight, getWeight, startTimer, stopTimer,
      setItemMood, addMentalCompletion: addMentalCompletionCb,
      updateDeclined, dismissConcept, progress,
    }}>
      {children}
    </ActionListContext.Provider>
  )
}

export function useActionList() {
  const ctx = useContext(ActionListContext)
  if (!ctx) throw new Error('useActionList must be used within ActionListProvider')
  return ctx
}
