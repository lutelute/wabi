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
  deleteRoutine: (id: string) => void
  selectRoutine: (id: string) => void
}

const RoutineContext = createContext<RoutineContextValue | null>(null)

const DEFAULT_TEXT = `## 仕事の調整
- 今日取り組むことをひとつ選ぶ *2
- 終わりの形を決める *1

## 時間の調整
- 時間の使い方をざっくり決める *1
- 余白を残す *1

## 精神の調整
- 身体を動かす *2
- 静かに座る 10min *2

## 集中の時間
- 深い仕事にひとつ取り組む *3
- 手を動かして考える *2

## 夕方の手放し
- 今日できたことを思い出す *1
- 明日のことは明日 *1`

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
          name: '朝のルーティン',
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
    const routine: Routine = {
      id,
      name,
      text: '',
      phases: [],
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
