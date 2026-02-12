import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useRoutines } from './RoutineContext'
import { storage } from '../storage'
import type { ExecutionState, TimerState } from '../types/routine'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function executionKey(routineId: string, date: string): string {
  return `${routineId}:${date}`
}

export interface EnergyProgress {
  energy: number      // 獲得エネルギー (重み付き)
  capacity: number    // 最大キャパシティ (全重みの合計)
  stamina: number     // 残り体力 (capacity - energy)
  ratio: number       // 達成率 0-1
  done: number
  total: number
}

interface ExecutionContextValue {
  checkedItems: Record<string, boolean>
  itemWeights: Record<string, number>
  timerState: TimerState | null
  declined: string
  toggleCheck: (itemId: string) => void
  updateWeight: (itemTitle: string, weight: number) => void
  getWeight: (itemTitle: string, defaultWeight: number) => number
  startTimer: (itemId: string, durationMin: number) => void
  stopTimer: () => void
  updateDeclined: (text: string) => void
  progress: EnergyProgress
}

const ExecutionContext = createContext<ExecutionContextValue | null>(null)

export function ExecutionProvider({ children }: { children: ReactNode }) {
  const { selected } = useRoutines()
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [itemWeights, setItemWeights] = useState<Record<string, number>>({})
  const [timerState, setTimerState] = useState<TimerState | null>(null)
  const [declined, setDeclined] = useState('')
  const [date, setDate] = useState(todayString)

  // 日付チェック（日をまたいだらリセット）
  useEffect(() => {
    const interval = setInterval(() => {
      const now = todayString()
      if (now !== date) {
        setDate(now)
        setCheckedItems({})
        setItemWeights({})
        setTimerState(null)
        setDeclined('')
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [date])

  // ルーティン切替時にロード
  useEffect(() => {
    if (!selected) return
    const key = executionKey(selected.id, date)
    storage.getExecution(key).then((saved) => {
      if (saved) {
        setCheckedItems(saved.checkedItems)
        setItemWeights(saved.itemWeights ?? {})
        setTimerState(saved.timerState)
        setDeclined(saved.declined ?? '')
      } else {
        setCheckedItems({})
        setItemWeights({})
        setTimerState(null)
        setDeclined('')
      }
    })
  }, [selected?.id, date])

  // 保存
  useEffect(() => {
    if (!selected) return
    const key = executionKey(selected.id, date)
    const state: ExecutionState = {
      routineId: selected.id,
      date,
      checkedItems,
      itemWeights,
      timerState,
      declined,
    }
    storage.saveExecution(key, state)
  }, [checkedItems, itemWeights, timerState, declined, selected?.id, date])

  // タイマーカウントダウン
  useEffect(() => {
    if (!timerState?.running) return
    const interval = setInterval(() => {
      setTimerState(prev => {
        if (!prev || !prev.running) return prev
        const next = prev.remaining - 1
        if (next <= 0) {
          storage.showNotification('wabi', 'タイマー完了')
          return null
        }
        return { ...prev, remaining: next }
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timerState?.running])

  const toggleCheck = useCallback((itemId: string) => {
    setCheckedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }))
  }, [])

  const updateWeight = useCallback((itemTitle: string, weight: number) => {
    setItemWeights(prev => ({ ...prev, [itemTitle]: weight }))
  }, [])

  const getWeight = useCallback((itemTitle: string, defaultWeight: number) => {
    return itemWeights[itemTitle] ?? defaultWeight
  }, [itemWeights])

  const startTimer = useCallback((itemId: string, durationMin: number) => {
    const total = durationMin * 60
    setTimerState({ itemId, remaining: total, total, running: true })
  }, [])

  const stopTimer = useCallback(() => {
    setTimerState(null)
  }, [])

  const updateDeclined = useCallback((text: string) => {
    setDeclined(text)
  }, [])

  const progress: EnergyProgress = useMemo(() => {
    const allItems = selected?.phases.flatMap(p => p.items) ?? []
    const totalWeight = allItems.reduce((sum, i) => {
      const w = itemWeights[i.title] ?? i.weight
      return sum + w
    }, 0)
    const earnedWeight = allItems
      .filter(i => checkedItems[i.id])
      .reduce((sum, i) => {
        const w = itemWeights[i.title] ?? i.weight
        return sum + w
      }, 0)

    return {
      energy: earnedWeight,
      capacity: totalWeight,
      stamina: totalWeight - earnedWeight,
      ratio: totalWeight > 0 ? earnedWeight / totalWeight : 0,
      done: Object.values(checkedItems).filter(Boolean).length,
      total: allItems.length,
    }
  }, [selected?.phases, checkedItems, itemWeights])

  return (
    <ExecutionContext.Provider value={{
      checkedItems,
      itemWeights,
      timerState,
      declined,
      toggleCheck,
      updateWeight,
      getWeight,
      startTimer,
      stopTimer,
      updateDeclined,
      progress,
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
