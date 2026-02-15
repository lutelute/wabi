import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { nanoid } from 'nanoid'
import { parseRoutineText } from '../parser/routineParser'
import { storage } from '../storage'
import type { Routine } from '../types/routine'

interface RoutineContextValue {
  routines: Routine[]
  selectedId: string | null
  selected: Routine | null
  createRoutine: (name: string) => void
  updateRoutineText: (id: string, text: string) => void
  renameRoutine: (id: string, name: string) => void
  updateRoutineColor: (id: string, color: string) => void
  updateRoutineMemo: (id: string, memo: string) => void
  deleteRoutine: (id: string) => void
  selectRoutine: (id: string) => void
}

const RoutineContext = createContext<RoutineContextValue | null>(null)

const DEFAULT_TEXT = `## ほどく
- 今の自分の状態に気づく *1
- こわばりをゆるめる *1
- 急がなくていいことを確かめる *1

## 流す
- 手を動かし始める *2
- ひとつだけに集中する *3
- 途中で手放してもいい *1

## なじむ
- 今日やったことを振り返る *1
- 明日の自分にゆだねる *1
- 静かに終える *1`

export function RoutineProvider({ children }: { children: ReactNode }) {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // 初回ロード
  useEffect(() => {
    storage.getRoutines().then((saved) => {
      if (saved && saved.length > 0) {
        // マイグレーション: 旧 items → phases
        const migrated = saved.map(r => {
          if ('items' in r && !('phases' in r)) {
            const { items, ...rest } = r as any
            return { ...rest, phases: parseRoutineText(rest.text) }
          }
          return r
        })
        setRoutines(migrated)
        setSelectedId(migrated[0].id)
      } else {
        // 初回起動：デフォルトルーティン作成
        const id = nanoid(8)
        const now = new Date().toISOString()
        const initial: Routine = {
          id,
          name: '寂び',
          text: DEFAULT_TEXT,
          phases: parseRoutineText(DEFAULT_TEXT),
          createdAt: now,
          updatedAt: now,
        }
        setRoutines([initial])
        setSelectedId(id)
      }
      setLoaded(true)
    })
  }, [])

  // 保存
  useEffect(() => {
    if (loaded) {
      storage.saveRoutines(routines)
    }
  }, [routines, loaded])

  const createRoutine = useCallback((name: string) => {
    const id = nanoid(8)
    const now = new Date().toISOString()
    const defaultText = `## ほどく\n- 今の状態に気づく *1\n\n## 流す\n- 取り組むべきことに向かう *2\n\n## なじむ\n- 今日をふりかえる *1`
    const routine: Routine = {
      id,
      name,
      text: defaultText,
      phases: parseRoutineText(defaultText),
      createdAt: now,
      updatedAt: now,
    }
    setRoutines(prev => [...prev, routine])
    setSelectedId(id)
  }, [])

  const updateRoutineText = useCallback((id: string, text: string) => {
    setRoutines(prev => prev.map(r =>
      r.id === id
        ? { ...r, text, phases: parseRoutineText(text), updatedAt: new Date().toISOString() }
        : r
    ))
  }, [])

  const renameRoutine = useCallback((id: string, name: string) => {
    setRoutines(prev => prev.map(r =>
      r.id === id ? { ...r, name, updatedAt: new Date().toISOString() } : r
    ))
  }, [])

  const updateRoutineColor = useCallback((id: string, color: string) => {
    setRoutines(prev => prev.map(r =>
      r.id === id ? { ...r, color: color || undefined, updatedAt: new Date().toISOString() } : r
    ))
  }, [])

  const updateRoutineMemo = useCallback((id: string, memo: string) => {
    setRoutines(prev => prev.map(r =>
      r.id === id ? { ...r, memo: memo || undefined, updatedAt: new Date().toISOString() } : r
    ))
  }, [])

  const deleteRoutine = useCallback((id: string) => {
    setRoutines(prev => {
      const next = prev.filter(r => r.id !== id)
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null)
      }
      return next
    })
  }, [selectedId])

  const selected = routines.find(r => r.id === selectedId) ?? null

  return (
    <RoutineContext.Provider value={{
      routines,
      selectedId,
      selected,
      createRoutine,
      updateRoutineText,
      renameRoutine,
      updateRoutineColor,
      updateRoutineMemo,
      deleteRoutine,
      selectRoutine: setSelectedId,
    }}>
      {children}
    </RoutineContext.Provider>
  )
}

export function useRoutines() {
  const ctx = useContext(RoutineContext)
  if (!ctx) throw new Error('useRoutines must be used within RoutineProvider')
  return ctx
}
