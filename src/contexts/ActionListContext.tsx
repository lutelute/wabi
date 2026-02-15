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
  renameAction: (actionId: string, title: string) => void
  isItemAdded: (sourceItemId: string) => boolean
  getItemCount: (sourceItemId: string) => number
  checkedItems: Record<string, boolean>
  itemWeights: Record<string, number>
  timerState: TimerState | null
  itemMoods: Record<string, Mood>
  itemComments: Record<string, string>
  mentalCompletions: MentalCompletion[]
  declined: string
  dismissedConcepts: string[]
  toggleCheck: (actionId: string) => void
  updateWeight: (title: string, weight: number) => void
  getWeight: (title: string, defaultWeight: number) => number
  startTimer: (actionId: string, durationMin: number) => void
  stopTimer: () => void
  setItemMood: (actionId: string, mood: Mood) => void
  setItemComment: (actionId: string, comment: string) => void
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
  const [itemComments, setItemComments] = useState<Record<string, string>>({})
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
        setTimerState(null); setItemMoods({}); setItemComments({}); setMentalCompletions([])
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
        setItemComments((saved as any).itemComments ?? {})
        setMentalCompletions(saved.mentalCompletions ?? [])
        setDeclined(saved.declined ?? '')
        setDismissedConcepts(saved.dismissedConcepts ?? [])
      } else {
        setActions([]); setCheckedItems({}); setItemWeights({})
        setTimerState(null); setItemMoods({}); setItemComments({}); setMentalCompletions([])
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
        timerState, itemMoods, itemComments, mentalCompletions,
        declined, dismissedConcepts,
      }
      storage.saveActionState(date, state)
    }, 300)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [actions, checkedItems, itemWeights, timerState, itemMoods, itemComments, mentalCompletions, declined, dismissedConcepts, date, loaded])

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

  // sourceItemId → 追加数のルックアップ用
  const sourceItemCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of actions) map.set(a.sourceItemId, (map.get(a.sourceItemId) || 0) + 1)
    return map
  }, [actions])

  const addAction = useCallback((item: RoutineItem, routine: Routine, phase: RoutinePhase) => {
    setActions(prev => {
      const action: DailyAction = {
        id: nanoid(),
        sourceRoutineId: routine.id,
        sourceRoutineName: routine.name,
        sourcePhaseTitle: phase.title,
        sourceRoutineColor: routine.color,
        sourceItemId: item.id,
        title: item.title,
        duration: item.duration,
        weight: item.weight,
        isMental: item.isMental,
        isRest: item.isRest ?? false,
        customTags: [],
        addedAt: new Date().toISOString(),
      }
      return [action, ...prev]
    })
  }, [])

  const removeAction = useCallback((actionId: string) => {
    setActions(prev => prev.filter(a => a.id !== actionId))
    setCheckedItems(prev => { const next = { ...prev }; delete next[actionId]; return next })
    setItemMoods(prev => { const next = { ...prev }; delete next[actionId]; return next })
  }, [])

  const renameAction = useCallback((actionId: string, title: string) => {
    setActions(prev => prev.map(a => a.id === actionId ? { ...a, title } : a))
  }, [])

  const isItemAdded = useCallback((sourceItemId: string) => {
    return (sourceItemCounts.get(sourceItemId) || 0) > 0
  }, [sourceItemCounts])

  const getItemCount = useCallback((sourceItemId: string) => {
    return sourceItemCounts.get(sourceItemId) || 0
  }, [sourceItemCounts])

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
  const setItemComment = useCallback((id: string, comment: string) => {
    setItemComments(prev => comment ? { ...prev, [id]: comment } : (() => { const next = { ...prev }; delete next[id]; return next })())
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
      actions, addAction, removeAction, renameAction, isItemAdded, getItemCount,
      checkedItems, itemWeights, timerState, itemMoods, itemComments, mentalCompletions,
      declined, dismissedConcepts,
      toggleCheck, updateWeight, getWeight, startTimer, stopTimer,
      setItemMood, setItemComment, addMentalCompletion: addMentalCompletionCb,
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
