import { useState, useEffect } from 'react'
import { useRoutines } from '../contexts/RoutineContext'
import { useExecution } from '../contexts/ExecutionContext'
import type { RoutineItem } from '../types/routine'

function formatTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export function NowFocus() {
  const { selected } = useRoutines()
  const { checkedItems, timerState, progress } = useExecution()
  const [time, setTime] = useState(formatTime)

  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime()), 10_000)
    return () => clearInterval(interval)
  }, [])

  if (!selected) return null

  // タイマー中は RoutineChecklist にインライン表示されるため、
  // NowFocus では現在タスク名のみコンパクトに表示
  if (timerState?.running) {
    const allItems = selected.phases.flatMap(p => p.items)
    const timerItem = allItems.find(i => i.id === timerState.itemId)
    const min = Math.floor(timerState.remaining / 60)
    const sec = timerState.remaining % 60
    return (
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-mono tabular-nums text-wabi-timer">
          {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
        </span>
        <span className="text-xs text-wabi-text-muted truncate ml-3">{timerItem?.title}</span>
      </div>
    )
  }

  // 現在のタスクを探す
  let currentItem: RoutineItem | null = null
  let currentPhaseTitle = ''
  for (const phase of selected.phases) {
    for (const item of phase.items) {
      if (!checkedItems[item.id]) {
        currentItem = item
        currentPhaseTitle = phase.title
        break
      }
    }
    if (currentItem) break
  }

  // 全完了
  if (!currentItem) {
    if (progress.total === 0) return null
    return (
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-mono tabular-nums text-wabi-text">{time}</span>
        <span className="text-xs text-wabi-check">すべて完了</span>
      </div>
    )
  }

  const endTime = currentItem.duration ? addMinutes(time, currentItem.duration) : null

  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono tabular-nums text-wabi-text">{time}</span>
        {endTime && (
          <span className="text-[10px] text-wabi-text-muted/50 font-mono">→ {endTime}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {currentPhaseTitle && (
          <span className="text-[10px] text-wabi-text-muted/40">{currentPhaseTitle}</span>
        )}
        <span className="text-xs text-wabi-text truncate max-w-[180px]">{currentItem.title}</span>
        <span className="text-[10px] text-wabi-text-muted/50 font-mono">{progress.done}/{progress.total}</span>
      </div>
    </div>
  )
}
